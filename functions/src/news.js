"use strict";

const admin = require("firebase-admin");
const functions = require("firebase-functions");

const NEWS_COLLECTION = "news";
const ALLOWED_STATUSES = new Set(["draft", "published", "archived"]);

const getNewsRef = (newsId) => admin.firestore().collection(NEWS_COLLECTION).doc(newsId);
const getCommentsRef = (newsId) => getNewsRef(newsId).collection("comments");
const getLikesRef = (newsId) => getNewsRef(newsId).collection("likes");

const ensureDeveloper = (context) => {
	if (!context.auth || !Array.isArray(context.auth.token?.groups)) {
		throw new functions.https.HttpsError("permission-denied", "Developer privileges are required.");
	}

	const groups = context.auth.token.groups;
	if (!groups.includes("developer") && !groups.includes("admin")) {
		throw new functions.https.HttpsError("permission-denied", "Developer privileges are required.");
	}
};

const listNewsArticles = functions.https.onCall(async (_data, context) => {
	ensureDeveloper(context);

	const snapshot = await admin.firestore()
		.collection(NEWS_COLLECTION)
		.orderBy("updatedAt", "desc")
		.limit(200)
		.get();

	const articles = snapshot.docs.map((doc) => {
		const data = doc.data() || {};
		return {
			id: doc.id,
			title: data.title || "Untitled Article",
			summary: data.summary || null,
			status: data.status || "draft",
			coverImage: data.coverImage || null,
			media: Array.isArray(data.media) ? data.media : [],
			createdAt: data.createdAt || null,
			updatedAt: data.updatedAt || null
		};
	});

	return { articles };
});

const listPublishedNews = functions.https.onCall(async () => {
	const snapshot = await admin.firestore()
		.collection(NEWS_COLLECTION)
		.where("status", "==", "published")
		.limit(200)
		.get();

	const articles = snapshot.docs.map((doc) => {
		const data = doc.data() || {};
		return {
			id: doc.id,
			title: data.title || "Untitled Article",
			summary: data.summary || null,
			status: data.status || "draft",
			coverImage: data.coverImage || null,
			media: Array.isArray(data.media) ? data.media : [],
			likesCount: Number.isFinite(data.likesCount) ? data.likesCount : 0,
			commentsCount: Number.isFinite(data.commentsCount) ? data.commentsCount : 0,
			createdAt: data.createdAt || null,
			updatedAt: data.updatedAt || null,
			publishedAt: data.publishedAt || null
		};
	});

	articles.sort((a, b) => {
		const getTime = (record) => {
			const published = record.publishedAt;
			const updated = record.updatedAt;
			const created = record.createdAt;
			const candidate = published || updated || created;
			if (!candidate) return 0;
			const date = candidate.toDate ? candidate.toDate() : new Date(candidate);
			const time = date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
			return time;
		};
		return getTime(b) - getTime(a);
	});

	return { articles };
});

const updateNewsStatus = functions.https.onCall(async (data, context) => {
	ensureDeveloper(context);

	const { id, status } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
	if (!ALLOWED_STATUSES.has(normalizedStatus)) {
		throw new functions.https.HttpsError("invalid-argument", "Unsupported status value.");
	}

	const docRef = admin.firestore().collection(NEWS_COLLECTION).doc(id.trim());
	await docRef.set(
		{
			status: normalizedStatus,
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		},
		{ merge: true }
	);

	if (normalizedStatus === "published") {
		await docRef.set(
			{
				publishedAt: admin.firestore.FieldValue.serverTimestamp()
			},
			{ merge: true }
		);
	}

	return { success: true };
});

const getNewsArticle = functions.https.onCall(async (data, context) => {
	ensureDeveloper(context);

	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const docRef = admin.firestore().collection(NEWS_COLLECTION).doc(id.trim());
	const snapshot = await docRef.get();

	if (!snapshot.exists) {
		throw new functions.https.HttpsError("not-found", "News article was not found.");
	}

	const docData = snapshot.data() || {};
	const rawMedia = Array.isArray(docData.media) ? docData.media : [];
	const legacyMedia = Array.isArray(docData.assets) ? docData.assets :
		Array.isArray(docData.attachments) ? docData.attachments :
			Array.isArray(docData.images) ? docData.images :
				Array.isArray(docData.inlineImages) ? docData.inlineImages : [];
	const media = rawMedia.length ? rawMedia : legacyMedia;
	const legacyCoverImage = docData.cover || docData.coverPhoto || docData.coverUrl || docData.heroImage || null;

	return {
		article: {
			id: snapshot.id,
			title: docData.title || "",
			contentHtml: docData.contentHtml || "",
			legacyContent: docData.content || docData.body || "",
			summary: docData.summary || "",
			status: docData.status || "draft",
			coverImage: docData.coverImage || null,
			legacyCoverImage,
			media,
			legacyMedia,
			inlineImages: Array.isArray(docData.inlineImages) ? docData.inlineImages : [],
			likesCount: Number.isFinite(docData.likesCount) ? docData.likesCount : 0,
			commentsCount: Number.isFinite(docData.commentsCount) ? docData.commentsCount : 0,
			createdAt: docData.createdAt || null,
			updatedAt: docData.updatedAt || null,
			publishedAt: docData.publishedAt || null,
			createdBy: docData.createdBy || null
		}
	};
});

const getPublishedNewsArticle = functions.https.onCall(async (data, context) => {
	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const docRef = getNewsRef(id.trim());
	const snapshot = await docRef.get();

	if (!snapshot.exists) {
		throw new functions.https.HttpsError("not-found", "News article was not found.");
	}

	const docData = snapshot.data() || {};
	if ((docData.status || "draft") !== "published") {
		throw new functions.https.HttpsError("permission-denied", "This news article is not available.");
	}

	let likedByCurrentUser = false;
	if (context.auth?.uid) {
		try {
			const likeDoc = await getLikesRef(id.trim()).doc(context.auth.uid).get();
			likedByCurrentUser = likeDoc.exists;
		} catch (error) {
			functions.logger.warn("Failed to resolve like status for user", { uid: context.auth.uid, id, error });
		}
	}

	const rawMedia = Array.isArray(docData.media) ? docData.media : [];
	const legacyMedia = Array.isArray(docData.assets) ? docData.assets :
		Array.isArray(docData.attachments) ? docData.attachments :
			Array.isArray(docData.images) ? docData.images :
				Array.isArray(docData.inlineImages) ? docData.inlineImages : [];
	const media = rawMedia.length ? rawMedia : legacyMedia;
	const legacyCoverImage = docData.cover || docData.coverPhoto || docData.coverUrl || docData.heroImage || null;

	return {
		article: {
			id: snapshot.id,
			title: docData.title || "",
			contentHtml: docData.contentHtml || "",
			legacyContent: docData.content || docData.body || "",
			summary: docData.summary || "",
			status: docData.status || "published",
			coverImage: docData.coverImage || null,
			legacyCoverImage,
			media,
			legacyMedia,
			inlineImages: Array.isArray(docData.inlineImages) ? docData.inlineImages : [],
			likesCount: Number.isFinite(docData.likesCount) ? docData.likesCount : 0,
			commentsCount: Number.isFinite(docData.commentsCount) ? docData.commentsCount : 0,
			createdAt: docData.createdAt || null,
			updatedAt: docData.updatedAt || null,
			publishedAt: docData.publishedAt || null,
			createdBy: docData.createdBy || null,
			likedByCurrentUser
		}
	};
});

const sanitizeComment = (value) => {
	if (typeof value !== "string") return "";
	return value.replace(/\s+/g, " ").trim();
};

const addNewsComment = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "You must be signed in to comment.");
	}

	const { id, message } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const sanitizedMessage = sanitizeComment(message);
	if (!sanitizedMessage) {
		throw new functions.https.HttpsError("invalid-argument", "Comment cannot be empty.");
	}
	if (sanitizedMessage.length > 1000) {
		throw new functions.https.HttpsError("invalid-argument", "Comment exceeds the 1000 character limit.");
	}

	const newsId = id.trim();
	const newsRef = getNewsRef(newsId);
	const commentRef = getCommentsRef(newsId).doc();

	const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
	const userData = userDoc.exists ? userDoc.data() || {} : {};
	const displayName = userData.displayName || context.auth.token?.name || context.auth.token?.email || context.auth.uid;
	const avatarUrl = userData.photoURL || context.auth.token?.picture || null;

	let createdAt = null;
	let commentsCount = 0;

	await admin.firestore().runTransaction(async (transaction) => {
		const newsSnapshot = await transaction.get(newsRef);
		if (!newsSnapshot.exists) {
			throw new functions.https.HttpsError("not-found", "News article not found.");
		}
		const newsData = newsSnapshot.data() || {};
		if ((newsData.status || "draft") !== "published") {
			throw new functions.https.HttpsError("permission-denied", "Comments are only allowed on published news.");
		}

		transaction.set(commentRef, {
			id: commentRef.id,
			uid: context.auth.uid,
			displayName,
			avatarUrl,
			message: sanitizedMessage,
			createdAt: admin.firestore.FieldValue.serverTimestamp()
		});

		transaction.update(newsRef, {
			commentsCount: admin.firestore.FieldValue.increment(1),
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		});
		commentsCount = (Number.isFinite(newsData.commentsCount) ? newsData.commentsCount : 0) + 1;
	});

	const createdSnapshot = await commentRef.get();
	createdAt = createdSnapshot.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp();

	return {
		comment: {
			id: commentRef.id,
			uid: context.auth.uid,
			displayName,
			avatarUrl,
			message: sanitizedMessage,
			createdAt
		},
		commentsCount
	};
});

const getPublishedNewsComments = functions.https.onCall(async (data) => {
	const { id, limit } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const newsId = id.trim();
	const newsRef = getNewsRef(newsId);
	const newsSnapshot = await newsRef.get();
	if (!newsSnapshot.exists) {
		throw new functions.https.HttpsError("not-found", "News article not found.");
	}
	const newsData = newsSnapshot.data() || {};
	if ((newsData.status || "draft") !== "published") {
		throw new functions.https.HttpsError("permission-denied", "Comments are only available on published news.");
	}

	const fetchLimit = Number.isInteger(limit) && limit > 0 && limit <= 200 ? limit : 100;
	const commentsSnapshot = await getCommentsRef(newsId)
		.orderBy("createdAt", "desc")
		.limit(fetchLimit)
		.get();

	const comments = commentsSnapshot.docs.map((doc) => {
		const data = doc.data() || {};
		return {
			id: doc.id,
			uid: data.uid || null,
			displayName: data.displayName || "Anonymous",
			avatarUrl: data.avatarUrl || null,
			message: data.message || "",
			createdAt: data.createdAt || null
		};
	});

	return { comments };
});

const toggleNewsLike = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "You must be signed in to like this article.");
	}

	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const newsId = id.trim();
	const newsRef = getNewsRef(newsId);
	const likeRef = getLikesRef(newsId).doc(context.auth.uid);
	let result = { liked: false, likesCount: 0 };

	await admin.firestore().runTransaction(async (transaction) => {
		const newsSnapshot = await transaction.get(newsRef);
		if (!newsSnapshot.exists) {
			throw new functions.https.HttpsError("not-found", "News article not found.");
		}
		const newsData = newsSnapshot.data() || {};
		if ((newsData.status || "draft") !== "published") {
			throw new functions.https.HttpsError("permission-denied", "Likes are available only on published news.");
		}

		const likeSnapshot = await transaction.get(likeRef);
		const increment = likeSnapshot.exists ? -1 : 1;

		if (likeSnapshot.exists) {
			transaction.delete(likeRef);
			result.liked = false;
		} else {
			transaction.set(likeRef, {
				uid: context.auth.uid,
				createdAt: admin.firestore.FieldValue.serverTimestamp()
			});
			result.liked = true;
		}

		const currentLikes = Number.isFinite(newsData.likesCount) ? newsData.likesCount : 0;
		const newLikes = Math.max(0, currentLikes + increment);
		transaction.update(newsRef, {
			likesCount: admin.firestore.FieldValue.increment(increment),
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		});
		result.likesCount = Math.max(0, newLikes);
	});

	return result;
});

const getNewsEngagement = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
	}

	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const newsId = id.trim();
	const newsRef = getNewsRef(newsId);
	const snapshot = await newsRef.get();
	if (!snapshot.exists) {
		throw new functions.https.HttpsError("not-found", "News article not found.");
	}

	const dataDoc = snapshot.data() || {};
	const likeSnapshot = await getLikesRef(newsId).doc(context.auth.uid).get();

	return {
		liked: likeSnapshot.exists,
		likesCount: Number.isFinite(dataDoc.likesCount) ? dataDoc.likesCount : 0,
		commentsCount: Number.isFinite(dataDoc.commentsCount) ? dataDoc.commentsCount : 0
	};
});

const deleteNewsArticle = functions.https.onCall(async (data, context) => {
	ensureDeveloper(context);

	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const docRef = admin.firestore().collection(NEWS_COLLECTION).doc(id.trim());
	const snapshot = await docRef.get();

	if (!snapshot.exists) {
		throw new functions.https.HttpsError("not-found", "News article was not found.");
	}

	const docData = snapshot.data() || {};
	const storageBucket = admin.storage().bucket();

	const extractRelativePath = (path) => {
		if (typeof path !== "string" || !path.trim()) return null;
		if (path.startsWith("gs://")) {
			const parts = path.replace("gs://", "").split("/");
			parts.shift(); // remove bucket name
			return parts.join("/");
		}
		return path;
	};

	const deleteFileIfExists = async (path) => {
		const relative = extractRelativePath(path);
		if (!relative) return;
		try {
			await storageBucket.file(relative).delete({ ignoreNotFound: true });
		} catch (error) {
			if (error.code === 404 || error.code === "404") {
				functions.logger.debug("Storage object already removed", { relative });
				return;
			}
			functions.logger.warn("Failed to delete storage object", { relative, error });
		}
	};

	const coverImage = docData.coverImage || {};
	await deleteFileIfExists(coverImage.storagePath);

	const media = Array.isArray(docData.media) ? docData.media : [];
	await Promise.all(media.map((item) => deleteFileIfExists(item.storagePath)));

	const inlineImages = Array.isArray(docData.inlineImages) ? docData.inlineImages : [];
	await Promise.all(inlineImages.map((item) => deleteFileIfExists(item.storagePath)));

	await docRef.delete();

	return { success: true };
});

module.exports = {
	listNewsArticles,
	listPublishedNews,
	addNewsComment,
	getPublishedNewsComments,
	toggleNewsLike,
	getNewsEngagement,
	updateNewsStatus,
	getNewsArticle,
	getPublishedNewsArticle,
	deleteNewsArticle,
	ensureDeveloper
};
