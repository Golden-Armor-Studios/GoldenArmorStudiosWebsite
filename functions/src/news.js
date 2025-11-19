"use strict";

const admin = require("firebase-admin");
const functions = require("firebase-functions");

const NEWS_COLLECTION = "news";
const ALLOWED_STATUSES = new Set(["draft", "published", "archived"]);
const DEFAULT_ORIGIN = "https://goldenarmorstudio.art";
const DEFAULT_IMAGE = `${DEFAULT_ORIGIN}/GoldenArmorStudio_WebPack/og-image.png`;
const SITE_NAME = "Golden Armor Studio";
const ARTICLE_CACHE_TTL_MS = 60 * 1000;
const articleCache = new Map();

const getNewsRef = (newsId) => admin.firestore().collection(NEWS_COLLECTION).doc(newsId);
const getCommentsRef = (newsId) => getNewsRef(newsId).collection("comments");
const getLikesRef = (newsId) => getNewsRef(newsId).collection("likes");
const getCommentLikesRef = (newsId, commentId) => getCommentsRef(newsId).doc(commentId).collection("likes");
const getCommentFlagsRef = (newsId, commentId) => getCommentsRef(newsId).doc(commentId).collection("flags");

const sanitizeArticleForCache = (articleData) => {
  if (!articleData || typeof articleData !== "object") return null;
  const sanitized = { ...articleData };
  if ("likedByCurrentUser" in sanitized) {
    delete sanitized.likedByCurrentUser;
  }
  return sanitized;
};

const getCachedArticle = (newsId, requirePublished = false) => {
  const cached = articleCache.get(newsId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ARTICLE_CACHE_TTL_MS) {
    articleCache.delete(newsId);
    return null;
  }
  if (requirePublished && (cached.data.status || "draft") !== "published") {
    return null;
  }
  return { ...cached.data };
};

const setCachedArticle = (newsId, articleData) => {
  if (!newsId || !articleData) return;
  const sanitized = sanitizeArticleForCache(articleData);
  if (!sanitized) return;
  articleCache.set(newsId, {
    timestamp: Date.now(),
    data: sanitized
  });
};

const clearArticleCache = (newsId) => {
  if (newsId) {
    articleCache.delete(newsId);
  }
};

const formatArticleRecord = (snapshot) => {
  if (!snapshot?.exists) return null;
  const docData = snapshot.data() || {};
  const rawMedia = Array.isArray(docData.media) ? docData.media : [];
  const legacyMedia = Array.isArray(docData.assets) ? docData.assets :
    Array.isArray(docData.attachments) ? docData.attachments :
      Array.isArray(docData.images) ? docData.images :
        Array.isArray(docData.inlineImages) ? docData.inlineImages : [];
  const media = rawMedia.length ? rawMedia : legacyMedia;
  const legacyCoverImage = docData.cover || docData.coverPhoto || docData.coverUrl || docData.heroImage || null;

  return {
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
    createdBy: docData.createdBy || null,
    likedByCurrentUser: docData.likedByCurrentUser || false
  };
};

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

	const articleId = id.trim();
	const docRef = getNewsRef(articleId);
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

	try {
		const snapshot = await docRef.get();
		if (snapshot.exists) {
			setCachedArticle(articleId, formatArticleRecord(snapshot));
		} else {
			clearArticleCache(articleId);
		}
	} catch (error) {
		functions.logger.warn("Failed to refresh cache after status update", { id: articleId, error });
	}

	return { success: true };
});

const getNewsArticle = functions.https.onCall(async (data, context) => {
	ensureDeveloper(context);

	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const articleId = id.trim();
	const cached = getCachedArticle(articleId, false);
	if (cached) {
		return { article: cached };
	}

	const docRef = getNewsRef(articleId);
	const snapshot = await docRef.get();

	if (!snapshot.exists) {
		throw new functions.https.HttpsError("not-found", "News article was not found.");
	}

	const formatted = formatArticleRecord(snapshot);
	setCachedArticle(articleId, formatted);

	return {
		article: formatted
	};
});

const getPublishedNewsArticle = functions.https.onCall(async (data, context) => {
	const { id } = data || {};
	if (typeof id !== "string" || !id.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}

	const newsId = id.trim();
	let baseArticle = getCachedArticle(newsId, true);

	if (!baseArticle) {
		const snapshot = await getNewsRef(newsId).get();
		if (!snapshot.exists) {
			throw new functions.https.HttpsError("not-found", "News article was not found.");
		}

		const formatted = formatArticleRecord(snapshot);
		if ((formatted.status || "draft") !== "published") {
			throw new functions.https.HttpsError("permission-denied", "This news article is not available.");
		}

		setCachedArticle(newsId, formatted);
		baseArticle = formatted;
	}

	let likedByCurrentUser = false;
	if (context.auth?.uid) {
		try {
			const likeDoc = await getLikesRef(newsId).doc(context.auth.uid).get();
			likedByCurrentUser = likeDoc.exists;
		} catch (error) {
			functions.logger.warn("Failed to resolve like status for user", { uid: context.auth.uid, id: newsId, error });
		}
	}

	return {
		article: {
			...baseArticle,
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
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
			updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			likesCount: 0,
			flagsCount: 0
		});

		transaction.update(newsRef, {
			commentsCount: admin.firestore.FieldValue.increment(1),
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		});
		commentsCount = (Number.isFinite(newsData.commentsCount) ? newsData.commentsCount : 0) + 1;
	});

	const createdSnapshot = await commentRef.get();
	createdAt = createdSnapshot.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp();

	try {
		const cachedArticle = getCachedArticle(newsId);
		if (cachedArticle) {
			setCachedArticle(newsId, {
				...cachedArticle,
				commentsCount
			});
		}
	} catch (error) {
		functions.logger.debug("Failed to update cached article after comment", { id: newsId, error });
	}

	return {
		comment: {
			id: commentRef.id,
			uid: context.auth.uid,
			displayName,
			avatarUrl,
			message: sanitizedMessage,
			createdAt,
			likesCount: 0,
			likedByCurrentUser: false,
			flagsCount: 0,
			flaggedByCurrentUser: false
		},
		commentsCount
	};
});

const getPublishedNewsComments = functions.https.onCall(async (data, context) => {
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

	const viewerUid = context.auth?.uid || null;

	const comments = await Promise.all(commentsSnapshot.docs.map(async (doc) => {
		const data = doc.data() || {};
		let likedByCurrentUser = false;
		let flaggedByCurrentUser = false;
		if (viewerUid) {
			try {
				const likeSnapshot = await getCommentLikesRef(newsId, doc.id).doc(viewerUid).get();
				likedByCurrentUser = likeSnapshot.exists;
			} catch (error) {
				functions.logger.debug("Failed to fetch comment like state", { newsId, commentId: doc.id, uid: viewerUid, error });
			}
			try {
				const flagSnapshot = await getCommentFlagsRef(newsId, doc.id).doc(viewerUid).get();
				flaggedByCurrentUser = flagSnapshot.exists;
			} catch (error) {
				functions.logger.debug("Failed to fetch comment flag state", { newsId, commentId: doc.id, uid: viewerUid, error });
			}
		}
		return {
			id: doc.id,
			uid: data.uid || null,
			displayName: data.displayName || "Anonymous",
			avatarUrl: data.avatarUrl || null,
			message: data.message || "",
			createdAt: data.createdAt || null,
			likesCount: Number.isFinite(data.likesCount) ? data.likesCount : 0,
			likedByCurrentUser,
			flagsCount: Number.isFinite(data.flagsCount) ? data.flagsCount : 0,
			flaggedByCurrentUser
		};
	}));

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

	try {
		const cachedArticle = getCachedArticle(newsId);
		if (cachedArticle) {
			setCachedArticle(newsId, {
				...cachedArticle,
				likesCount: result.likesCount
			});
		}
	} catch (error) {
		functions.logger.debug("Failed to update cached article after like toggle", { id: newsId, uid: context.auth.uid, error });
	}

	return result;
});

const toggleNewsCommentLike = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "You must be signed in to like a comment.");
	}

	const { newsId, commentId } = data || {};
	if (typeof newsId !== "string" || !newsId.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}
	if (typeof commentId !== "string" || !commentId.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid comment ID is required.");
	}

	const trimmedNewsId = newsId.trim();
	const trimmedCommentId = commentId.trim();
	const newsRef = getNewsRef(trimmedNewsId);
	const commentRef = getCommentsRef(trimmedNewsId).doc(trimmedCommentId);
	const likeRef = getCommentLikesRef(trimmedNewsId, trimmedCommentId).doc(context.auth.uid);
	const result = {
		liked: false,
		likesCount: 0
	};

	await admin.firestore().runTransaction(async (transaction) => {
		const newsSnapshot = await transaction.get(newsRef);
		if (!newsSnapshot.exists) {
			throw new functions.https.HttpsError("not-found", "News article not found.");
		}
		const newsData = newsSnapshot.data() || {};
		if ((newsData.status || "draft") !== "published") {
			throw new functions.https.HttpsError("permission-denied", "Comments are only available on published news.");
		}

		const commentSnapshot = await transaction.get(commentRef);
		if (!commentSnapshot.exists) {
			throw new functions.https.HttpsError("not-found", "Comment not found.");
		}
		const commentData = commentSnapshot.data() || {};

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

		const currentLikes = Number.isFinite(commentData.likesCount) ? commentData.likesCount : 0;
		const newLikes = Math.max(0, currentLikes + increment);
		result.likesCount = newLikes;

		transaction.update(commentRef, {
			likesCount: admin.firestore.FieldValue.increment(increment),
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		});
	});

	return result;
});

const toggleNewsCommentFlag = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError("unauthenticated", "You must be signed in to flag a comment.");
	}

	const { newsId, commentId } = data || {};
	if (typeof newsId !== "string" || !newsId.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid article ID is required.");
	}
	if (typeof commentId !== "string" || !commentId.trim()) {
		throw new functions.https.HttpsError("invalid-argument", "A valid comment ID is required.");
	}

	const trimmedNewsId = newsId.trim();
	const trimmedCommentId = commentId.trim();
	const newsRef = getNewsRef(trimmedNewsId);
	const commentRef = getCommentsRef(trimmedNewsId).doc(trimmedCommentId);
	const flagRef = getCommentFlagsRef(trimmedNewsId, trimmedCommentId).doc(context.auth.uid);
	const result = {
		flagged: false,
		flagsCount: 0
	};

	await admin.firestore().runTransaction(async (transaction) => {
		const newsSnapshot = await transaction.get(newsRef);
		if (!newsSnapshot.exists) {
			throw new functions.https.HttpsError("not-found", "News article not found.");
		}
		const newsData = newsSnapshot.data() || {};
		if ((newsData.status || "draft") !== "published") {
			throw new functions.https.HttpsError("permission-denied", "Comments are only available on published news.");
		}

		const commentSnapshot = await transaction.get(commentRef);
		if (!commentSnapshot.exists) {
			throw new functions.https.HttpsError("not-found", "Comment not found.");
		}
		const commentData = commentSnapshot.data() || {};

		const flagSnapshot = await transaction.get(flagRef);
		const increment = flagSnapshot.exists ? -1 : 1;

		if (flagSnapshot.exists) {
			transaction.delete(flagRef);
			result.flagged = false;
		} else {
			transaction.set(flagRef, {
				uid: context.auth.uid,
				createdAt: admin.firestore.FieldValue.serverTimestamp()
			});
			result.flagged = true;
		}

		const currentFlags = Number.isFinite(commentData.flagsCount) ? commentData.flagsCount : 0;
		const newFlags = Math.max(0, currentFlags + increment);
		result.flagsCount = newFlags;

		transaction.update(commentRef, {
			flagsCount: admin.firestore.FieldValue.increment(increment),
			updatedAt: admin.firestore.FieldValue.serverTimestamp()
		});
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

	const articleId = id.trim();
	const docRef = getNewsRef(articleId);
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
	clearArticleCache(articleId);

	return { success: true };
});

const stripHtmlToPlainText = (value = "") => {
	if (typeof value !== "string" || !value.trim()) return "";
	return value
		.replace(/<\s*\/?\s*script[^>]*>/gi, "")
		.replace(/<\/?(style|script)[^>]*>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

const buildShareHtml = (meta) => {
  const {
    title,
    description,
    image,
    url,
    redirectUrl,
    status = "draft",
    noindex = false,
    storageKey,
    payload
  } = meta;

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${image}">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
    <meta name="twitter:site" content="@GoldenArmorSt">
    ${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
    <link rel="canonical" href="${url}">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 2.5rem 1.5rem;
        background: #04070c;
        color: #f6f8fb;
        display: flex;
        justify-content: center;
      }
      .container {
        max-width: 640px;
        text-align: center;
      }
      h1 {
        font-size: 1.8rem;
        margin-bottom: 1rem;
      }
      p {
        line-height: 1.5;
        color: rgba(246, 248, 251, 0.8);
      }
      img {
        width: 100%;
        max-width: 512px;
        border-radius: 18px;
        margin: 2rem auto;
        display: block;
      }
      .status {
        display: inline-block;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: rgba(78, 224, 128, 0.18);
        border: 1px solid rgba(78, 224, 128, 0.42);
        color: #4ee080;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }
      .cta {
        margin-top: 2rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: #4ee080;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="status">Status: ${status}</div>
      <h1>${title}</h1>
      <p>${description}</p>
      <img src="${image}" alt="Article cover">
      <p>Loading the latest version of this article…</p>
      <a class="cta" href="${redirectUrl}">Continue to article →</a>
    </div>
    <script>
      ${storageKey && payload ? `
      try {
        window.sessionStorage.setItem('${storageKey}', '${payload}');
      } catch (e) {}
      ` : ""}
      try {
        window.location.replace("${redirectUrl}");
      } catch (e) {
        window.location.href = "${redirectUrl}";
      }
    </script>
  </body>
</html>`;
};

const renderNewsShare = functions.https.onRequest(async (req, res) => {
	try {
		const idMatch = req.path.match(/\/news\/([^/?#]+)/i);
		const newsId = idMatch ? idMatch[1] : null;
		if (!newsId) {
			res.status(400).send("Missing article identifier.");
			return;
		}

		const snapshot = await getNewsRef(newsId).get();
		if (!snapshot.exists) {
		res.status(404).send(buildShareHtml({
			title: `${SITE_NAME} | Not Found`,
			description: "The requested article could not be located.",
			image: DEFAULT_IMAGE,
			url: `${DEFAULT_ORIGIN}/news/${newsId}`,
			redirectUrl: `${DEFAULT_ORIGIN}/news`,
			status: "not-found",
			noindex: true
		}));
		return;
	}

	const data = snapshot.data() || {};
	const rawMedia = Array.isArray(data.media) ? data.media : [];
	const legacyMedia = Array.isArray(data.assets) ? data.assets :
		Array.isArray(data.attachments) ? data.attachments :
			Array.isArray(data.images) ? data.images :
				Array.isArray(data.inlineImages) ? data.inlineImages : [];
	const media = rawMedia.length ? rawMedia : legacyMedia;
	const legacyCoverImage = data.cover || data.coverPhoto || data.coverUrl || data.heroImage || null;
	const coverImage = data.coverImage?.downloadUrl || data.coverUrl || data.cover || DEFAULT_IMAGE;
	const descriptionSource =
		data.summary ||
		stripHtmlToPlainText(data.contentHtml) ||
		stripHtmlToPlainText(data.content) ||
		stripHtmlToPlainText(data.body) ||
		"A new update from Golden Armor Studio.";

	const description = descriptionSource.length > 200 ? `${descriptionSource.slice(0, 197)}…` : descriptionSource;
	const articlePayload = {
		id: snapshot.id,
		title: data.title || "",
		contentHtml: data.contentHtml || "",
		legacyContent: data.content || data.body || "",
		summary: data.summary || "",
		status: data.status || "draft",
		coverImage: data.coverImage || null,
		legacyCoverImage,
		media,
		legacyMedia,
		inlineImages: Array.isArray(data.inlineImages) ? data.inlineImages : [],
		likesCount: Number.isFinite(data.likesCount) ? data.likesCount : 0,
		commentsCount: Number.isFinite(data.commentsCount) ? data.commentsCount : 0,
		createdAt: data.createdAt || null,
		updatedAt: data.updatedAt || null,
		publishedAt: data.publishedAt || null,
		createdBy: data.createdBy || null
	};
	setCachedArticle(newsId, articlePayload);
	const storageKey = `gas:news:${newsId}`;
	const payload = Buffer.from(JSON.stringify({
		article: articlePayload,
		cachedAt: Date.now()
	})).toString("base64");

	const responseHtml = buildShareHtml({
		title: data.title ? `${data.title} | ${SITE_NAME}` : SITE_NAME,
		description,
		image: coverImage,
		url: `${DEFAULT_ORIGIN}/news/${newsId}`,
		redirectUrl: `${DEFAULT_ORIGIN}/app/news/${newsId}`,
		storageKey,
		payload,
		status: data.status || "draft",
		noindex: (data.status || "draft") !== "published"
	});

		res.set("Cache-Control", "public, max-age=300, s-maxage=600");
		res.status(200).send(responseHtml);
	} catch (error) {
		functions.logger.error("renderNewsShare failed", error);
		res.status(500).send(buildShareHtml({
			title: `${SITE_NAME} | Error`,
			description: "We ran into an issue while loading this article.",
			image: DEFAULT_IMAGE,
			url: `${DEFAULT_ORIGIN}`,
			redirectUrl: `${DEFAULT_ORIGIN}/news`,
			status: "error",
			noindex: true
		}));
	}
});

const renderBuyGascShare = functions.https.onRequest(async (_req, res) => {
	try {
		const responseHtml = buildShareHtml({
			title: `${SITE_NAME} | GASC - New Crypto!`,
			description: "Every GASC purchase bankrolls fresh prototypes while giving you early exposure to the studio’s on-chain economy.",
			image: "https://goldenarmorstudio.art/Buy-GASC-COver.png",
			url: `${DEFAULT_ORIGIN}/buy-gasc`,
			redirectUrl: `${DEFAULT_ORIGIN}/app/buy-gasc`,
			status: "public",
			noindex: false
		});

		res.set("Cache-Control", "public, max-age=300, s-maxage=600");
		res.status(200).send(responseHtml);
	} catch (error) {
		functions.logger.error("renderBuyGascShare failed", error);
		res.status(500).send(buildShareHtml({
			title: `${SITE_NAME} | GASC - New Crypto!`,
			description: "We ran into an issue while preparing the checkout page.",
			image: DEFAULT_IMAGE,
			url: `${DEFAULT_ORIGIN}/buy-gasc`,
			redirectUrl: `${DEFAULT_ORIGIN}/app/buy-gasc`,
			status: "error",
			noindex: true
		}));
	}
});

module.exports = {
	listNewsArticles,
	listPublishedNews,
	addNewsComment,
	getPublishedNewsComments,
	toggleNewsLike,
	toggleNewsCommentLike,
	toggleNewsCommentFlag,
	getNewsEngagement,
	updateNewsStatus,
	getNewsArticle,
	getPublishedNewsArticle,
	deleteNewsArticle,
	ensureDeveloper,
	renderNewsShare,
	renderBuyGascShare
};
