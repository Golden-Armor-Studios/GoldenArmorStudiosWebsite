"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { ethers } = require("ethers");
const crypto = require("node:crypto");

admin.initializeApp();

const STORAGE_BUCKET = "goldenarmorstudios.firebasestorage.app";
const NEWS_STORAGE_PREFIX = "News";
const storageBucket = admin.storage().bucket(STORAGE_BUCKET);

let stripeInstance = null;
let onChainIssuer = null;

const PRICING_TOTAL_COINS = Number(functions.config().pricing?.total_coins ?? 1_000_000);
const PRICING_ADJUSTMENT_K = Number(functions.config().pricing?.adjustment_k ?? 5e-8);
const ETH_PRICE_ENDPOINT = functions.config().pricing?.eth_api
	?? "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

const getStripeClient = () => {
	const stripeSecret = functions.config().stripe?.secret;
	if (!stripeSecret) {
		throw new functions.https.HttpsError(
			"failed-precondition",
			"Stripe secret key is not configured. Set functions config `stripe.secret`."
		);
	}

	if (!stripeInstance) {
		stripeInstance = require("stripe")(stripeSecret);
	}

	return stripeInstance;
};

const getOnChainIssuer = () => {
	const rpcUrl = functions.config().chain?.rpc_url;
	const privateKey = functions.config().chain?.private_key;
	const contractAddress = functions.config().chain?.nft_contract;

	if (!rpcUrl || !privateKey || !contractAddress) {
		throw new functions.https.HttpsError(
			"failed-precondition",
			"Blockchain configuration missing. Set functions config `chain.rpc_url`, `chain.private_key`, and `chain.nft_contract`."
		);
	}

	if (!onChainIssuer) {
		const provider = new ethers.JsonRpcProvider(rpcUrl);
		const signer = new ethers.Wallet(privateKey, provider);
		const abi = [
			"function mint(address to, uint256 amount) external"
		];
		const contract = new ethers.Contract(contractAddress, abi, signer);
		onChainIssuer = { contract, provider };
	}

	return onChainIssuer;
};

const fetchEthPriceUSD = async () => {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 7000);
		const response = await fetch(ETH_PRICE_ENDPOINT, { signal: controller.signal });
		clearTimeout(timeout);
		if (!response.ok) {
			throw new Error(`Unexpected status ${response.status}`);
		}
		const json = await response.json();
		const price = Number(json?.ethereum?.usd ?? json?.market_data?.current_price?.usd);
		if (!Number.isFinite(price) || price <= 0) {
			throw new Error("Invalid ETH price payload.");
		}
		return price;
	} catch (error) {
		functions.logger.error("Failed to fetch ETH price", error);
		throw new functions.https.HttpsError("internal", "Unable to load ETH price.");
	}
};

const getTokensPerEther = async () => {
	try {
		const { contract } = getOnChainIssuer();
		const value = await contract.tokensPerEther();
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
		return 1000;
	} catch (error) {
		functions.logger.warn("Falling back to default tokensPerEther", error);
		return 1000;
	}
};

const sumNftIssuances = async () => {
	const snapshot = await admin.firestore().collection("nftIssuances").get();
	let total = 0;
	snapshot.forEach((doc) => {
		total += Number(doc.get("nftAmount")) || 0;
	});
	return total;
};

const computeAdjustment = (sold, ethPrice) => {
	if (!Number.isFinite(ethPrice) || ethPrice <= 0) {
		return 0;
	}
	const ratio = Math.max(Number(sold) || 0, 0) / PRICING_TOTAL_COINS;
	if (ratio <= 0) {
		return 0;
	}
	return ratio / (PRICING_ADJUSTMENT_K * ethPrice);
};

const allowedGroups = ["member", "subscriber", "donor", "admin", "developer"];

const guessExtensionFromContentType = (contentType = "") => {
 if (typeof contentType !== "string") {
  return "bin";
 }

 const normalized = contentType.toLowerCase();
 if (normalized.includes("jpeg")) return "jpg";
 if (normalized.includes("svg")) return "svg";

 const parts = normalized.split("/");
 if (parts.length === 2 && parts[1]) {
  return parts[1].split(";")[0];
 }
 return "bin";
};

const sanitizeFileName = (value, fallback = "file") => {
	if (typeof value !== "string" || !value.trim()) {
		return fallback;
	}

 return value
  .trim()
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 120) || fallback;
};

const decodeFilePayload = (payload = {}) => {
 if (typeof payload !== "object" || payload === null) {
  return null;
 }

 let { data, contentType, fileName } = payload;
 if (typeof data !== "string" || data.length === 0) {
  return null;
 }

 const dataUrlMatch = data.match(/^data:(.*?);base64,(.*)$/);
 if (dataUrlMatch) {
  contentType = contentType || dataUrlMatch[1];
  data = dataUrlMatch[2];
 }

 try {
  const buffer = Buffer.from(data, "base64");
  if (!contentType && payload.contentType) {
   contentType = payload.contentType;
  }
  const extension = guessExtensionFromContentType(contentType);
  const sanitizedName = sanitizeFileName(fileName, `${Date.now()}-${crypto.randomUUID()}.${extension}`);
  const finalFileName = sanitizedName.includes(".") ? sanitizedName : `${sanitizedName}.${extension}`;
  return {
   buffer,
   contentType: contentType || "application/octet-stream",
   fileName: finalFileName
  };
 } catch (error) {
  functions.logger.warn("Failed to decode file payload", error);
  return null;
 }
};

const uploadImageToStorage = async (newsId, payload) => {
 const decoded = decodeFilePayload(payload);
 if (!decoded) {
  return null;
 }

 const storagePath = `${NEWS_STORAGE_PREFIX}/${newsId}/${decoded.fileName}`;
 const file = storageBucket.file(storagePath);

 await file.save(decoded.buffer, {
  resumable: false,
  metadata: {
   contentType: decoded.contentType,
   cacheControl: "public, max-age=86400"
  }
 });

 try {
  await file.makePublic();
 } catch (error) {
  functions.logger.warn("Failed to set public ACL for uploaded image", { newsId, storagePath, error });
 }

 const downloadUrl = file.publicUrl();

 return {
  storagePath: `gs://${storageBucket.name}/${storagePath}`,
  downloadUrl,
  contentType: decoded.contentType,
  fileName: decoded.fileName
 };
};

const normalizeGroups = (groups) => {
	const initialGroups = Array.isArray(groups) ? groups : [];
	const sanitized = Array.from(new Set(initialGroups
		.map((group) => typeof group === "string" ? group.trim() : "")
		.filter((group) => allowedGroups.includes(group))));

	if (!sanitized.includes("member")) {
		sanitized.unshift("member");
	}

	return sanitized;
};

const ensureAdmin = (context) => {
 if (!context.auth || !Array.isArray(context.auth.token?.groups) || !context.auth.token.groups.includes("admin")) {
  throw new functions.https.HttpsError("permission-denied", "Administrator privileges are required.");
 }
};

const ensureDeveloper = (context) => {
 ensureAuthenticated(context);
 const groups = Array.isArray(context.auth.token?.groups) ? context.auth.token.groups : [];
 if (!groups.includes("developer") && !groups.includes("admin")) {
  throw new functions.https.HttpsError("permission-denied", "Developer privileges are required.");
 }
 return groups;
};

const ensureAuthenticated = (context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
	}
};

const resolveUserGroups = async (uid, fallbackGroups = []) => {
	const userRef = admin.firestore().collection("users").doc(uid);
	const userDoc = await userRef.get();
	const docData = userDoc.exists ? userDoc.data() || {} : {};

	const docGroups = normalizeGroups(docData.groups);
	if (docGroups.length) {
		return docGroups;
	}

	const sanitizedFallback = normalizeGroups(fallbackGroups);
	return sanitizedFallback.length ? sanitizedFallback : ["member"];
};

exports.helloWorld = functions.https.onRequest((request, response) => {
	functions.logger.info("Hello logs!", {structuredData: true});
	response.send("Hello from Firebase!");
});

exports.addDefaultGroup = functions.auth.user().onCreate(async (user) => {
	try {
		await admin.auth().setCustomUserClaims(user.uid, {
			groups: ["member"]
		});
		await admin.firestore()
			.collection("users")
			.doc(user.uid)
			.set(
				{
					groups: ["member"],
					email: user.email ?? null,
					createdAt: admin.firestore.FieldValue.serverTimestamp()
				},
				{merge: true}
			);
		functions.logger.info(`Default group 'member' assigned to user ${user.uid}`);
	} catch (error) {
		functions.logger.error("Failed to assign default group", error);
		throw error;
	}
});

exports.syncUserGroups = functions.auth.user().beforeSignIn(async (user, context) => {
	try {
		const userRef = admin.firestore().collection("users").doc(user.uid);
		const userDoc = await userRef.get();
		const docData = userDoc.exists ? userDoc.data() || {} : {};
		let groups = Array.isArray(docData.groups) ? docData.groups : [];

		if (!groups.length) {
			groups = ["member"];
		}

		groups = Array.from(new Set(groups));

		if (!groups.includes("member")) {
			groups.unshift("member");
			groups = Array.from(new Set(groups));
		}

		const token = context?.auth?.token || {};
		const providerId = token.firebase?.sign_in_provider;
		const providerName = token.name || null;
		const providerPhoto = token.picture || null;

		const userRecord = await admin.auth().getUser(user.uid);
		const resolvedDisplayName =
			providerName ||
			user.displayName ||
			userRecord.displayName ||
			docData.displayName ||
			user.email ||
			user.uid;

		const resolvedPhoto =
			providerPhoto ||
			user.photoURL ||
			userRecord.photoURL ||
			docData.photoURL ||
			null;

		const updatePayload = {
			displayName: resolvedDisplayName,
			photoURL: resolvedPhoto,
			groups,
			lastLogin: admin.firestore.FieldValue.serverTimestamp()
		};

		if (providerId === "github.com" && resolvedDisplayName) {
			updatePayload.githubDisplayName = providerName || resolvedDisplayName;
		} else if (docData.githubDisplayName) {
			updatePayload.githubDisplayName = docData.githubDisplayName;
		}

		await userRef.set(updatePayload, {merge: true});

		functions.logger.info(`Applying custom claims for user ${user.uid}`, {groups});

		return {
			customClaims: {
				groups
			}
		};
	} catch (error) {
		functions.logger.error("Failed to process beforeSignIn trigger", error);
		throw error;
	}
});

exports.generateCustomAuthToken = functions.https.onCall(async (_, context) => {
	ensureAuthenticated(context);
	const uid = context.auth.uid;
	const fallbackGroups = normalizeGroups(context.auth.token?.groups);

	try {
		const groups = await resolveUserGroups(uid, fallbackGroups);
		const customToken = await admin.auth().createCustomToken(uid, { groups });

		functions.logger.info(`Generated custom auth token for user ${uid}`, {groups});

		return {
			token: customToken,
			groups,
			issuedAt: new Date().toISOString()
		};
	} catch (error) {
		functions.logger.error("Failed to generate custom auth token", error);

		if (error instanceof functions.https.HttpsError) {
			throw error;
		}

		throw new functions.https.HttpsError("internal", error?.message || "Unable to generate a custom auth token at this time.");
	}
});

exports.submitTeamApplication = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "You must be signed in to submit an application.");
	}

	const uid = context.auth.uid;
	const {
		developerType,
		experience,
		languages,
		address,
		phone,
		portfolio,
		otherLinks,
		about
	} = data || {};

	if (typeof developerType !== "string" || developerType.trim().length === 0) {
		throw new functions.https.HttpsError("invalid-argument", "developerType is required.");
	}

	const yearsExperience = Number(experience);
	if (Number.isNaN(yearsExperience) || yearsExperience < 0) {
		throw new functions.https.HttpsError("invalid-argument", "experience must be a non-negative number.");
	}

	const sanitizedLanguages = Array.isArray(languages)
		? languages
			.map((lang) => typeof lang === "string" ? lang.trim() : "")
			.filter((lang) => lang.length > 0)
		: [];

	const requiredStrings = [
		["address", address],
		["phone", phone],
		["portfolio", portfolio],
		["about", about]
	];

	requiredStrings.forEach(([field, value]) => {
		if (typeof value !== "string" || value.trim().length === 0) {
			throw new functions.https.HttpsError("invalid-argument", `${field} is required.`);
		}
	});

	const applicationPayload = {
		developerType: developerType.trim(),
		experience: yearsExperience,
		languages: sanitizedLanguages,
		address: address.trim(),
		phone: phone.trim(),
		portfolio: portfolio.trim(),
		otherLinks: typeof otherLinks === "string" ? otherLinks.trim() : "",
		about: about.trim(),
		submittedAt: admin.firestore.FieldValue.serverTimestamp()
	};

	try {
		await admin.firestore()
			.collection("users")
			.doc(uid)
			.set(
				{
					isApplying: true,
					application: applicationPayload
				},
				{merge: true}
			);

		functions.logger.info(`Application received for user ${uid}`, {
			developerType: applicationPayload.developerType,
			experience: applicationPayload.experience,
			languages: applicationPayload.languages
		});

		return { success: true };
	} catch (error) {
		functions.logger.error("Failed to submit application", error);
		throw new functions.https.HttpsError("internal", "Unable to submit application at this time.");
	}
});

exports.createStripePaymentIntent = functions.https.onCall(async (data, context) => {
	ensureAuthenticated(context);
	const stripe = getStripeClient();

	const { productId, amount, currency } = data || {};
	const sanitizedProductId = typeof productId === "string" ? productId.trim() : "";
	const sanitizedAmount = Number(amount);
	const resolvedCurrency = typeof currency === "string" ? currency.toLowerCase() : "usd";

	if (!sanitizedProductId) {
		throw new functions.https.HttpsError("invalid-argument", "A valid productId is required.");
	}

	if (!Number.isInteger(sanitizedAmount) || sanitizedAmount <= 0) {
		throw new functions.https.HttpsError("invalid-argument", "Amount must be a positive integer (in the smallest currency unit).");
	}

	try {
		const paymentIntent = await stripe.paymentIntents.create({
			amount: sanitizedAmount,
			currency: resolvedCurrency,
			automatic_payment_methods: {
				enabled: true
			},
			metadata: {
				productId: sanitizedProductId,
				uid: context.auth.uid
			}
		});

		return {
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id
		};
	} catch (error) {
		functions.logger.error("Failed to create Stripe payment intent", error);
		throw new functions.https.HttpsError("internal", "Unable to create payment intent.");
	}
});

exports.createStripeSetupIntent = functions.https.onCall(async (data, context) => {
	ensureAuthenticated(context);
	const stripe = getStripeClient();

	const usage = typeof data?.usage === "string" ? data.usage : "off_session";

	try {
		const setupIntent = await stripe.setupIntents.create({
			usage,
			metadata: {
				uid: context.auth.uid
			}
		});

		return {
			clientSecret: setupIntent.client_secret,
			setupIntentId: setupIntent.id
		};
	} catch (error) {
		functions.logger.error("Failed to create Stripe setup intent", error);
		throw new functions.https.HttpsError("internal", "Unable to create setup intent.");
	}
});

const updateUserTransactions = async (uid, transaction, options = {}) => {
	const {
		ensureGroups = [],
		syncClaims = false,
		mutateUserData
	} = options;

	const userRef = admin.firestore().collection("users").doc(uid);
	const userDoc = await userRef.get();
	const data = userDoc.exists ? userDoc.data() || {} : {};
	const existingGroups = Array.isArray(data.groups) ? data.groups : [];
	const groups = Array.from(new Set([...existingGroups, "member", ...ensureGroups]));
	const transactions = Array.isArray(data.transactions) ? data.transactions : [];

	const createdAt = transaction.createdAt ?? admin.firestore.Timestamp.now();
	transactions.push({
		...transaction,
		createdAt
	});

	const trimmedTransactions = transactions.slice(-100);

	const extraFields = typeof mutateUserData === "function" ? mutateUserData(data) || {} : {};

	await userRef.set(
		{
			groups,
			transactions: trimmedTransactions,
			updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			...extraFields
		},
		{merge: true}
	);

	if (syncClaims && ensureGroups.length) {
		const userRecord = await admin.auth().getUser(uid);
		const currentClaims = userRecord.customClaims || {};
		const claimGroups = Array.isArray(currentClaims.groups) ? currentClaims.groups : [];
		const updatedClaimsGroups = Array.from(new Set([...claimGroups, ...ensureGroups, "member"]));
		await admin.auth().setCustomUserClaims(uid, { ...currentClaims, groups: updatedClaimsGroups });
	}
};

const createDepositFieldUpdater = (depositAddress) => (existingData = {}) => {
	const existingAddresses = Array.isArray(existingData.depositAddresses) ? existingData.depositAddresses : [];
	const updatedAddresses = Array.from(new Set([...existingAddresses, depositAddress])).slice(-50);
	return {
		depositAddresses: updatedAddresses,
		lastDepositAddress: depositAddress
	};
};

const addDonorTransaction = async (uid, amount, currency, paymentIntentId, metadata = {}) => {
	const createdAt = admin.firestore.Timestamp.now();
	await updateUserTransactions(
		uid,
		{
			amount,
			currency,
			paymentIntentId,
			productId: metadata.productId || null,
			note: metadata.note || null,
			createdAt
		},
		{
			ensureGroups: ["donor"],
			syncClaims: true
		}
	);
};

exports.recordDonation = functions.https.onCall(async (data, context) => {
	ensureAuthenticated(context);
	const stripe = getStripeClient();

	const { paymentIntentId } = data || {};
	if (typeof paymentIntentId !== "string" || paymentIntentId.trim().length === 0) {
		throw new functions.https.HttpsError("invalid-argument", "A valid paymentIntentId is required.");
	}

	try {
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
		if (!paymentIntent || paymentIntent.status !== "succeeded") {
			throw new functions.https.HttpsError("failed-precondition", "Payment is not complete.");
		}
		const recordedAmount = Number(paymentIntent.amount_received ?? paymentIntent.amount ?? 0);
		const recordedCurrency = (paymentIntent.currency || "usd").toLowerCase();
		await addDonorTransaction(
			context.auth.uid,
			recordedAmount,
			recordedCurrency,
			paymentIntent.id,
			{
				productId: paymentIntent.metadata?.productId ?? null
			}
		);
		return { success: true };
	} catch (error) {
		functions.logger.error("Failed to record donation", error);
		if (error instanceof functions.https.HttpsError) {
			throw error;
		}
		throw new functions.https.HttpsError("internal", "Unable to record donation.");
	}
});

const issueNftsOnChain = async (recipient, nftAmount) => {
	const { contract } = getOnChainIssuer();
	const normalizedAmount = ethers.toBigInt(nftAmount);
	const tx = await contract.mint(recipient, normalizedAmount);
	const receipt = await tx.wait();
	return receipt?.hash || tx.hash;
};

exports.purchaseNft = functions.https.onCall(async (data, context) => {
	ensureAuthenticated(context);
	const stripe = getStripeClient();

	const { paymentIntentId, depositAddress, nftAmount } = data || {};

	if (typeof paymentIntentId !== "string" || paymentIntentId.trim().length === 0) {
		throw new functions.https.HttpsError("invalid-argument", "A valid paymentIntentId is required.");
	}

	const normalizedAddress = typeof depositAddress === "string" ? depositAddress.trim() : "";
	if (!normalizedAddress) {
		throw new functions.https.HttpsError("invalid-argument", "A deposit address is required.");
	}

	const parsedNftAmount = Number(nftAmount ?? 0);
	if (!Number.isFinite(parsedNftAmount) || parsedNftAmount <= 0) {
		throw new functions.https.HttpsError("invalid-argument", "A positive nftAmount is required.");
	}

	try {
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
		if (!paymentIntent || paymentIntent.status !== "succeeded") {
			throw new functions.https.HttpsError("failed-precondition", "Payment is not complete.");
		}

		const recordedAmount = Number(paymentIntent.amount_received ?? paymentIntent.amount ?? 0);
		const recordedCurrency = (paymentIntent.currency || "usd").toLowerCase();

		const chainTxHash = await issueNftsOnChain(normalizedAddress, parsedNftAmount);

		await updateUserTransactions(
			context.auth.uid,
			{
				type: "nft_purchase",
				amount: recordedAmount,
				currency: recordedCurrency,
				paymentIntentId: paymentIntent.id,
				nftAmount: parsedNftAmount,
				depositAddress: normalizedAddress,
				chainTxHash,
				productId: paymentIntent.metadata?.productId || null,
				note: paymentIntent.metadata?.note || null
			},
			{
				mutateUserData: createDepositFieldUpdater(normalizedAddress)
			}
		);

		await admin.firestore().collection("nftIssuances").add({
			uid: context.auth.uid,
			paymentIntentId: paymentIntent.id,
			depositAddress: normalizedAddress,
			nftAmount: parsedNftAmount,
			amount: recordedAmount,
			currency: recordedCurrency,
			chainTxHash,
			createdAt: admin.firestore.FieldValue.serverTimestamp()
		});

		return {
			success: true,
			nftAmount: parsedNftAmount,
			depositAddress: normalizedAddress,
			chainTxHash
		};
	} catch (error) {
		functions.logger.error("Failed to process NFT purchase", error);
		if (error instanceof functions.https.HttpsError) {
			throw error;
		}
		throw new functions.https.HttpsError("internal", "Unable to process NFT purchase.");
	}
});

exports.getGascPrice = functions.https.onCall(async () => {
	try {
		const [ethUsd, tokensPerEther, totalSold] = await Promise.all([
			fetchEthPriceUSD(),
			getTokensPerEther(),
			sumNftIssuances()
		]);

		const basePrice = ethUsd / tokensPerEther;
		const adjustment = computeAdjustment(totalSold, ethUsd);
		const finalPrice = basePrice + adjustment;

		return {
			success: true,
			ethUsd,
			tokensPerEther,
			basePrice,
			adjustment,
			finalPrice,
			totalSold
		};
	} catch (error) {
		if (error instanceof functions.https.HttpsError) {
			throw error;
		}
		functions.logger.error("Failed to fetch GASC price", error);
		throw new functions.https.HttpsError("internal", "Unable to load token price.");
	}
});

exports.getUserTransactions = functions.https.onCall(async (data, context) => {
	ensureAuthenticated(context);

	try {
		const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
		const docData = userDoc.exists ? userDoc.data() || {} : {};
		const transactions = Array.isArray(docData.transactions) ? docData.transactions : [];
		const total = transactions.reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);

		return {
			transactions,
			totalAmount: total,
			currency: transactions[0]?.currency || "usd"
		};
	} catch (error) {
		functions.logger.error("Failed to fetch user transactions", error);
		throw new functions.https.HttpsError("internal", "Unable to load transactions.");
	}
});

const serializeTimestamp = (value) => {
	if (!value) {
		return null;
	}
	if (value.toDate) {
		return value.toDate().toISOString();
	}
	return value;
};

exports.listUsers = functions.https.onCall(async (data, context) => {
	ensureAdmin(context);

	const applicantsOnly = Boolean(data?.applicantsOnly);
	let query = admin.firestore().collection("users");

	if (applicantsOnly) {
		query = query.where("isApplying", "==", true);
	}

	let snapshot;
	try {
		snapshot = await query.get();
	} catch (error) {
		functions.logger.error("Failed to query users collection", error);
		throw new functions.https.HttpsError("internal", "Unable to load users.");
	}

	const users = await Promise.all(snapshot.docs.map(async (doc) => {
		const data = doc.data() || {};
		const userRecord = {
			uid: doc.id,
			displayName: data.displayName || data.email || doc.id,
			email: data.email || null,
			groups: Array.isArray(data.groups) ? data.groups : [],
			isApplying: Boolean(data.isApplying),
			createdAt: serializeTimestamp(data.createdAt)
		};

		if (data.application && typeof data.application === "object") {
			userRecord.application = {
				...data.application,
				submittedAt: serializeTimestamp(data.application.submittedAt)
			};
		} else {
			userRecord.application = null;
		}

		return userRecord;
	}));

	return users;
});

exports.updateUserGroups = functions.https.onCall(async (data, context) => {
	ensureAdmin(context);

	const { uid, groups } = data || {};

	if (typeof uid !== "string" || uid.trim().length === 0) {
		throw new functions.https.HttpsError("invalid-argument", "A valid user ID is required.");
	}

	if (!Array.isArray(groups)) {
		throw new functions.https.HttpsError("invalid-argument", "Groups must be provided as an array.");
	}

	const sanitizedGroups = Array.from(new Set(groups
		.map((group) => typeof group === "string" ? group.trim() : "")
		.filter((group) => allowedGroups.includes(group))))
		.sort();

	if (!sanitizedGroups.includes("member")) {
		sanitizedGroups.unshift("member");
	}

	try {
		const userRecord = await admin.auth().getUser(uid);
		const existingClaims = userRecord.customClaims || {};
		existingClaims.groups = sanitizedGroups;

		await Promise.all([
			admin.auth().setCustomUserClaims(uid, existingClaims),
			admin.firestore()
				.collection("users")
				.doc(uid)
				.set(
					{
						groups: sanitizedGroups,
						isApplying: false,
						updatedAt: admin.firestore.FieldValue.serverTimestamp()
					},
					{merge: true}
				)
		]);

		functions.logger.info(`Updated groups for user ${uid}`, {groups: sanitizedGroups});
		return {success: true, groups: sanitizedGroups};
	} catch (error) {
		functions.logger.error("Failed to update user groups", error);
		throw new functions.https.HttpsError("internal", "Unable to update user groups.");
	}
});

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
	ensureAdmin(context);

	const { uid } = data || {};

	if (typeof uid !== "string" || uid.trim().length === 0) {
		throw new functions.https.HttpsError("invalid-argument", "A valid user ID is required.");
	}

	if (uid === context.auth.uid) {
		throw new functions.https.HttpsError("failed-precondition", "You cannot delete your own account.");
	}

	try {
		await Promise.all([
			admin.auth().deleteUser(uid),
			admin.firestore().collection("users").doc(uid).delete().catch((error) => {
				functions.logger.warn(`Failed to delete Firestore document for ${uid}`, error);
			})
		]);

		functions.logger.info(`Deleted user ${uid}`);
		return {success: true};
	} catch (error) {
		functions.logger.error("Failed to delete user", error);
		throw new functions.https.HttpsError("internal", "Unable to delete user.");
	}
});

exports.getDeveloperProfiles = functions.https.onCall(async () => {
	try {
		const snapshot = await admin.firestore()
			.collection("users")
			.where("groups", "array-contains", "developer")
			.limit(100)
			.get();

		const profiles = snapshot.docs.map((doc) => {
			const data = doc.data() || {};
			const displayName = data.githubDisplayName || data.displayName || data.email || doc.id;
			const transactions = Array.isArray(data.transactions) ? data.transactions : [];
			const totalAmount = transactions.reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0);
			const currency = transactions[0]?.currency || 'usd';

			return {
				id: doc.id,
				displayName,
				githubDisplayName: data.githubDisplayName || null,
				photoURL: data.photoURL || null,
				githubUrl: data.githubProfileUrl || null,
				totalAmount,
				currency
			};
		});

		return {profiles};
	} catch (error) {
		functions.logger.error("Failed to load developer profiles", error);
		throw new functions.https.HttpsError("internal", "Unable to load developer profiles.");
	}
});

exports.createNewsArticle = functions.https.onCall(async (data, context) => {
	ensureDeveloper(context);

	const payload = typeof data === "object" && data !== null ? data : {};
	const rawTitle = typeof payload.title === "string" ? payload.title.trim() : "";
	const rawContent = typeof payload.contentHtml === "string" ? payload.contentHtml.trim() : "";
	const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
	const rawStatus = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : "draft";
	const allowedStatuses = new Set(["draft", "published", "archived"]);
	const status = allowedStatuses.has(rawStatus) ? rawStatus : "draft";

	if (!rawTitle) {
		throw new functions.https.HttpsError("invalid-argument", "A non-empty title is required.");
	}

	if (!rawContent) {
		throw new functions.https.HttpsError("invalid-argument", "Rich text content is required.");
	}

	const providedId = typeof payload.id === "string" && payload.id.trim().length ? payload.id.trim() : null;
	const newsCollection = admin.firestore().collection("news");
	const newsRef = providedId
		? newsCollection.doc(providedId)
		: newsCollection.doc();
	const newsId = newsRef.id;
	let contentHtml = rawContent;
	let existingData = {};

	if (providedId) {
		const existingSnapshot = await newsRef.get();
		if (existingSnapshot.exists) {
			existingData = existingSnapshot.data() || {};
		}
	}

	const coverPayload = typeof payload.coverImage === "object" && payload.coverImage !== null ? payload.coverImage : null;
	if (!coverPayload) {
		throw new functions.https.HttpsError("invalid-argument", "A cover image is required.");
	}

	let coverImageMeta = null;
	if (coverPayload.downloadUrl && coverPayload.storagePath) {
		coverImageMeta = {
			downloadUrl: coverPayload.downloadUrl,
			storagePath: coverPayload.storagePath,
			contentType: coverPayload.contentType || "image/jpeg",
			fileName: coverPayload.fileName || null
		};
	} else {
		coverImageMeta = await uploadImageToStorage(newsId, coverPayload);
	}

	const mediaEntries = [];

	if (Array.isArray(payload.media)) {
		for (const entry of payload.media) {
			if (!entry || typeof entry !== "object") continue;
			if (entry.downloadUrl && entry.storagePath) {
				mediaEntries.push({
					type: entry.type === "video" ? "video" : "image",
					downloadUrl: entry.downloadUrl,
					storagePath: entry.storagePath,
					contentType: entry.contentType || null,
					fileName: entry.fileName || null,
					poster: entry.poster || null
				});
			} else if (entry.data) {
				const uploaded = await uploadImageToStorage(newsId, entry);
				if (uploaded) {
					mediaEntries.push({
						type: "image",
						...uploaded
					});
				}
			}
		}
	}

	const legacyImages = Array.isArray(payload.images) ? payload.images : [];
	const inlineUploads = [];
	for (let index = 0; index < legacyImages.length; index += 1) {
		const imagePayload = legacyImages[index];
		const uploadResult = await uploadImageToStorage(newsId, imagePayload);
		if (!uploadResult) continue;
		const placeholder = typeof imagePayload?.placeholder === "string" ? imagePayload.placeholder : null;
		if (placeholder) {
			contentHtml = contentHtml.split(placeholder).join(uploadResult.downloadUrl);
		}
		const legacyEntry = {
			...uploadResult,
			placeholder,
			order: index
		};
		inlineUploads.push(legacyEntry);
		mediaEntries.push({
			type: "image",
			...uploadResult
		});
	}

	const timestamps = {
		createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
		updatedAt: admin.firestore.FieldValue.serverTimestamp()
	};

	const articleData = {
		title: rawTitle,
		contentHtml,
		summary: summary || null,
		status,
		coverImage: coverImageMeta,
		media: mediaEntries,
		inlineImages: inlineUploads,
		createdBy: context.auth.uid,
		likesCount: Number.isFinite(existingData.likesCount) ? existingData.likesCount : 0,
		commentsCount: Number.isFinite(existingData.commentsCount) ? existingData.commentsCount : 0,
		...timestamps
	};

	if (status === "published") {
		articleData.publishedAt = existingData.publishedAt || admin.firestore.FieldValue.serverTimestamp();
	}

	await newsRef.set(articleData);

	return {
		id: newsId,
		newsId,
		coverImage: coverImageMeta,
		media: mediaEntries
	};
});

exports.getDonorProfiles = functions.https.onCall(async () => {
	try {
		const snapshot = await admin.firestore()
			.collection("users")
			.where("groups", "array-contains", "donor")
			.limit(100)
			.get();

		const profiles = snapshot.docs.map((doc) => {
			const data = doc.data() || {};
			const displayName = data.githubDisplayName || data.displayName || data.email || doc.id;

			return {
				id: doc.id,
				displayName,
				githubDisplayName: data.githubDisplayName || null,
				photoURL: data.photoURL || null,
				githubUrl: data.githubProfileUrl || null
			};
		});

		return {profiles};
	} catch (error) {
		functions.logger.error("Failed to load donor profiles", error);
		throw new functions.https.HttpsError("internal", "Unable to load donor profiles.");
	}
});
const newsHandlers = require('./news');
exports.listNewsArticles = newsHandlers.listNewsArticles;
exports.listPublishedNews = newsHandlers.listPublishedNews;
exports.addNewsComment = newsHandlers.addNewsComment;
exports.getPublishedNewsComments = newsHandlers.getPublishedNewsComments;
exports.toggleNewsLike = newsHandlers.toggleNewsLike;
exports.toggleNewsCommentLike = newsHandlers.toggleNewsCommentLike;
exports.toggleNewsCommentFlag = newsHandlers.toggleNewsCommentFlag;
exports.getNewsEngagement = newsHandlers.getNewsEngagement;
exports.updateNewsStatus = newsHandlers.updateNewsStatus;
exports.getNewsArticle = newsHandlers.getNewsArticle;
exports.getPublishedNewsArticle = newsHandlers.getPublishedNewsArticle;
exports.deleteNewsArticle = newsHandlers.deleteNewsArticle;
exports.renderNewsShare = newsHandlers.renderNewsShare;
