"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

const stripeSecret = functions.config().stripe?.secret;
const stripe = stripeSecret ? require("stripe")(stripeSecret) : null;

admin.initializeApp();

const allowedGroups = ["member", "subscriber", "donor", "admin", "developer"];

const ensureAdmin = (context) => {
	if (!context.auth || !Array.isArray(context.auth.token?.groups) || !context.auth.token.groups.includes("admin")) {
		throw new functions.https.HttpsError("permission-denied", "Administrator privileges are required.");
	}
};

const ensureAuthenticated = (context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
	}
};

const ensureStripeConfigured = () => {
	if (!stripe) {
		throw new functions.https.HttpsError(
			"failed-precondition",
			"Stripe secret key is not configured. Set functions config `stripe.secret`."
		);
	}
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
	ensureStripeConfigured();

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
	ensureStripeConfigured();

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

const addDonorTransaction = async (uid, amount, currency, paymentIntentId, metadata = {}) => {
	const userRef = admin.firestore().collection("users").doc(uid);
	const userDoc = await userRef.get();
	const data = userDoc.exists ? userDoc.data() || {} : {};
	const existingGroups = Array.isArray(data.groups) ? data.groups : [];
	const groups = Array.from(new Set([...existingGroups, "member", "donor"]));
	const transactions = Array.isArray(data.transactions) ? data.transactions : [];

	const createdAt = admin.firestore.Timestamp.now();
	transactions.push({
		amount,
		currency,
		paymentIntentId,
		productId: metadata.productId || null,
		note: metadata.note || null,
		createdAt
	});

	const trimmedTransactions = transactions.slice(-100);

	await userRef.set(
		{
			groups,
			transactions: trimmedTransactions,
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		},
		{merge: true}
	);

	const userRecord = await admin.auth().getUser(uid);
	const currentClaims = userRecord.customClaims || {};
	const claimGroups = Array.isArray(currentClaims.groups) ? currentClaims.groups : [];
	const updatedClaimsGroups = Array.from(new Set([...claimGroups, "member", "donor"]));
	await admin.auth().setCustomUserClaims(uid, { ...currentClaims, groups: updatedClaimsGroups });
};

exports.recordDonation = functions.https.onCall(async (data, context) => {
	ensureAuthenticated(context);
	ensureStripeConfigured();

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
