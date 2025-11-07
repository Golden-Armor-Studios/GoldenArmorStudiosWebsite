<template>
  <div class="news-preview-wrapper">
    <video
      ref="videoRef"
      class="background-video"
      autoplay
      muted
      loop
      playsinline
      webkit-playsinline
      preload="auto"
    >
      <source src="/website background - discord.mp4" type="video/mp4" />
    </video>
  <section class="news-preview">
    <header class="preview-header">
      <button type="button" class="back-button" @click="goBack">
        ← Back to News Manager
      </button>
      <div class="meta-block">
        <p class="status-pill" :class="articleStatusClass">{{ article?.status || 'draft' }}</p>
        <p class="timestamp">
          <strong>Created:</strong> {{ formatDate(article?.createdAt) }}
          <span v-if="article?.updatedAt">
            • <strong>Updated:</strong> {{ formatDate(article?.updatedAt) }}
          </span>
        </p>
      </div>
    </header>

    <div v-if="isLoading" class="state">Loading article…</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <article v-else-if="article" class="preview-body">
      <div class="cover-wrapper">
        <img v-if="article.coverImage?.downloadUrl" :src="article.coverImage.downloadUrl" alt="Cover image" />
        <div
          v-if="(article.status || 'draft') === 'published'"
          class="engagement-bar floating"
        >
          <button
            type="button"
            class="like-button"
            :class="{ liked: hasLiked }"
            :disabled="isTogglingLike || !isAuthenticated"
            @click="toggleLike"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12.1 20.3 4.5 13a5 5 0 0 1 0-7.1 5 5 0 0 1 7.1 0l.4.4.4-.4a5 5 0 0 1 7.1 0 5 5 0 0 1 0 7.1l-7.6 7.3Z"
                :fill="hasLiked ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ hasLiked ? 'Unlike' : 'Like' }}</span>
          </button>
          <span class="engagement-count">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 21h14a2 2 0 0 0 2-2v-6c0-1.1-.9-2-2-2h-5.28l.74-3.7.02-.3c0-.41-.17-.8-.46-1.09L13 4l-6 6.33V21Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ likesCount }}</span>
          </span>
          <span class="engagement-count">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ commentCountDisplay }}</span>
          </span>
        </div>
      </div>
      <div class="article-shell">
        <h1>{{ article.title }}</h1>
        <div class="content">
          <template v-for="segment in articleContentSegments" :key="segment.id">
            <div
              v-if="segment.type === 'html'"
              class="content-segment"
              v-html="segment.html"
            ></div>
            <NewsVideoPlayer
              v-else
              :src="segment.src"
              :poster="segment.poster || null"
              :title="article.title"
              context="News Detail"
            />
          </template>
        </div>
      </div>
    </article>

    <section
      v-if="article && (article.status || 'draft') === 'published'"
      class="comments-section"
    >
      <h2>Comments ({{ commentCountDisplay }})</h2>

      <div v-if="isAuthenticated" class="comment-form">
        <textarea
          v-model="commentMessage"
          rows="3"
          placeholder="Share your thoughts..."
        ></textarea>
        <div class="comment-actions">
          <button
            type="button"
            class="primary-button"
            :disabled="isSubmittingComment || !commentMessage.trim()"
            @click="submitComment"
          >
            <span v-if="isSubmittingComment">Posting…</span>
            <span v-else>Post Comment</span>
          </button>
          <span class="comment-helper">Posting as {{ currentDisplayName }}</span>
        </div>
      </div>
      <div v-else class="comment-signin">
        <RouterLink class="signin-link" to="/login">Sign in</RouterLink>
        to join the discussion.
      </div>

      <div v-if="isLoadingComments" class="comments-loading">Loading comments…</div>
      <ul v-else-if="comments.length" class="comment-list">
        <li v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="comment-avatar-stack">
            <div class="comment-avatar">
              <img v-if="comment.avatarUrl" :src="comment.avatarUrl" alt="Comment author avatar" />
              <span v-else>{{ getInitial(comment.displayName) }}</span>
            </div>
            <button
              type="button"
              class="comment-flag-button"
              :class="{ flagged: comment.flaggedByCurrentUser }"
              :disabled="isCommentFlagPending(comment.id)"
              @click="requestCommentFlag(comment)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 2.5h7.2l.42 1.38a.5.5 0 0 0 .48.35H13a.5.5 0 0 1 .5.5V10a.5.5 0 0 1-.5.5h-1.8a.5.5 0 0 0-.48.35L10.2 12H3V2.5Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 2.5v11"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
              </svg>
              <span>{{ comment.flagsCount || 0 }}</span>
            </button>
          </div>
          <div class="comment-card">
            <div class="comment-card-header">
              <div class="comment-meta">
                <span class="comment-author">{{ comment.displayName || 'Anonymous' }}</span>
                <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
              </div>
              <button
                type="button"
                class="comment-like-button"
                :class="{ liked: comment.likedByCurrentUser }"
                :disabled="isCommentLikePending(comment.id)"
                @click="toggleCommentLike(comment)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M10.45 17.4a1 1 0 0 1-.9 0c-2.3-1.2-7.55-4.42-7.55-9.15 0-2.4 1.8-4.25 4.12-4.25 1.32 0 2.52.63 3.33 1.72.81-1.09 2.01-1.72 3.33-1.72 2.32 0 4.12 1.85 4.12 4.25 0 4.73-5.25 7.95-7.55 9.15Z"
                    :fill="comment.likedByCurrentUser ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>{{ comment.likesCount || 0 }}</span>
              </button>
            </div>
            <p class="comment-message">{{ comment.message }}</p>
          </div>
        </li>
      </ul>
      <div v-else class="no-comments">Be the first to leave a comment.</div>
    </section>
    <transition name="modal-fade">
      <div v-if="commentFlagModal.open" class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal-dialog">
          <h3>Flag Comment</h3>
          <p>Do you want to flag this comment as inappropriate?</p>
          <div class="modal-actions">
            <button type="button" class="ghost-button" @click="cancelCommentFlag">Cancel</button>
            <button type="button" class="primary-button" @click="confirmCommentFlag">Yes, flag it</button>
          </div>
        </div>
      </div>
    </transition>
  </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useStore } from 'vuex'
import { useToast } from 'vue-toastification'
import NewsVideoPlayer from '../components/NewsVideoPlayer.vue'

const route = useRoute()
const router = useRouter()
const store = useStore()
const toast = useToast()
const videoRef = ref(null)

const article = ref(null)
const isLoading = ref(true)
const error = ref('')
const comments = ref([])
const isLoadingComments = ref(true)
const commentMessage = ref('')
const isSubmittingComment = ref(false)
const likesCount = ref(0)
const hasLiked = ref(false)
const isTogglingLike = ref(false)
const commentLikePending = ref(new Set())
const commentFlagPending = ref(new Set())
const commentFlagModal = reactive({
  open: false,
  comment: null
})
const articleContentSegments = computed(() => {
  const html = article.value?.contentHtml
  if (!html || typeof window === 'undefined') return []
  const root = document.createElement('div')
  root.innerHTML = html
  const placeholderPrefix = '__VIDEO_SEGMENT__'
  const videoSegments = []

  Array.from(root.querySelectorAll('figure.wysiwyg-video, video')).forEach((node) => {
    const videoEl = node.nodeName === 'VIDEO' ? node : node.querySelector('video')
    if (!videoEl) return
    const src = videoEl.getAttribute('src')
    if (!src) return
    const marker = `${placeholderPrefix}${videoSegments.length}__`
    const textNode = document.createTextNode(marker)
    node.parentNode?.insertBefore(textNode, node)
    node.parentNode?.removeChild(node)
    videoSegments.push({
      src,
      poster: videoEl.getAttribute('poster') || null,
      id: `video-${videoSegments.length}`,
      marker
    })
  })

  const htmlString = root.innerHTML
  const regex = new RegExp(`${placeholderPrefix}(\\d+)__`, 'g')
  const segments = []
  let lastIndex = 0
  let match

  const pushHtml = (chunk) => {
    const trimmed = chunk.trim()
    if (trimmed) {
      segments.push({
        type: 'html',
        html: trimmed,
        id: `html-${segments.length}`
      })
    }
  }

  while ((match = regex.exec(htmlString)) !== null) {
    const chunk = htmlString.slice(lastIndex, match.index)
    pushHtml(chunk)
    const videoIndex = Number(match[1])
    const videoData = videoSegments[videoIndex]
    if (videoData) {
      segments.push({
        type: 'video',
        src: videoData.src,
        poster: videoData.poster,
        id: videoData.id
      })
    }
    lastIndex = regex.lastIndex
  }

  const tail = htmlString.slice(lastIndex)
  pushHtml(tail)

  return segments
})

const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])
const currentUser = computed(() => store.state.user?.profile || null)
const currentDisplayName = computed(() => currentUser.value?.displayName || currentUser.value?.email || 'You')

const analyticsCategory = computed(() => {
  const title = article.value?.title
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  return 'News Article'
})

const trackEngagementEvent = (action, params = {}) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', action, {
    event_category: analyticsCategory.value,
    event_label: article.value?.id || 'unknown-article',
    ...params
  })
}

const setCommentLikePending = (id, pending) => {
  const next = new Set(commentLikePending.value)
  if (pending) {
    next.add(id)
  } else {
    next.delete(id)
  }
  commentLikePending.value = next
}

const isCommentLikePending = (id) => commentLikePending.value.has(id)

const setCommentFlagPending = (id, pending) => {
  const next = new Set(commentFlagPending.value)
  if (pending) {
    next.add(id)
  } else {
    next.delete(id)
  }
  commentFlagPending.value = next
}

const isCommentFlagPending = (id) => commentFlagPending.value.has(id)

const toDate = (value) => {
  if (!value) return null

  if (typeof value.toDate === 'function') {
    try {
      const converted = value.toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted
      }
    } catch (err) {
      console.warn('Failed to convert timestamp with toDate()', err)
    }
  }

  if (typeof value === 'object' && value !== null) {
    const seconds = value._seconds ?? value.seconds
    const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0
    if (typeof seconds === 'number') {
      const millis = seconds * 1000 + Math.floor(nanoseconds / 1e6)
      const parsed = new Date(millis)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDate = (value) => {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

const isPublicView = computed(() => Boolean(route.meta?.publicNews))

const articleStatusClass = computed(() => {
  const status = article.value?.status || 'draft'
  return `status-${status}`
})

const goBack = () => {
  if (isPublicView.value) {
    router.push({ name: 'NewsPublicList' })
  } else {
    router.push({ name: 'ManageNews' })
  }
}

const canEngage = computed(() => isAuthenticated.value && !isLoading.value)
const commentCountDisplay = computed(() => article.value?.commentsCount ?? comments.value.length)

const loadArticle = async () => {
  const id = route.params.id
  if (!id) {
    error.value = 'No article ID provided.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = ''
  try {
    const callableName = isPublicView.value ? 'getPublishedNewsArticle' : 'getNewsArticle'
    const loader = httpsCallable(functions, callableName)
    let response = await loader({ id })

    if (!isPublicView.value && !response.data?.article) {
      // Fallback to published fetch in case article lost restricted fields but is public.
      const fallback = httpsCallable(functions, 'getPublishedNewsArticle')
      response = await fallback({ id })
    }

    const record = response.data?.article
    if (!record) {
      throw new Error('Article data not found.')
    }
    article.value = record
    likesCount.value = record.likesCount ?? 0
    hasLiked.value = Boolean(record.likedByCurrentUser)

    if ((record.status || 'draft') === 'published') {
      await Promise.all([loadComments(), refreshEngagement()])
    } else {
      comments.value = []
      isLoadingComments.value = false
    }
  } catch (err) {
    console.error(err)
    error.value = err.message || 'Failed to load article.'
  } finally {
    isLoading.value = false
  }
}

const loadComments = async () => {
  if (!article.value?.id) {
    comments.value = []
    return
  }
  isLoadingComments.value = true
  try {
    const callable = httpsCallable(functions, 'getPublishedNewsComments')
    const response = await callable({ id: article.value.id, limit: 100 })
    const raw = Array.isArray(response.data?.comments) ? response.data.comments : []
    comments.value = raw.map((comment) => ({
      ...comment,
      likesCount: typeof comment.likesCount === 'number' ? comment.likesCount : 0,
      likedByCurrentUser: Boolean(comment.likedByCurrentUser)
    }))
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Unable to load comments.')
  } finally {
    isLoadingComments.value = false
  }
}

const refreshEngagement = async () => {
  if (!article.value?.id) {
    return
  }
  likesCount.value = article.value.likesCount ?? likesCount.value
  if (!isAuthenticated.value) {
    hasLiked.value = false
    return
  }
  try {
    const engagementCallable = httpsCallable(functions, 'getNewsEngagement')
    const response = await engagementCallable({ id: article.value.id })
    if (response.data) {
      likesCount.value = response.data.likesCount ?? likesCount.value
      hasLiked.value = Boolean(response.data.liked)
      if (typeof response.data.commentsCount === 'number') {
        article.value = {
          ...article.value,
          commentsCount: response.data.commentsCount
        }
      }
      if (typeof response.data.likesCount === 'number') {
        article.value = {
          ...article.value,
          likesCount: response.data.likesCount
        }
      }
    }
  } catch (err) {
    console.error(err)
  }
}

const toggleLike = async () => {
  if (!canEngage.value || !article.value?.id || isTogglingLike.value) {
    if (!isAuthenticated.value) {
      toast.info('Sign in to like this article.')
    }
    trackEngagementEvent('like_click', { authenticated: isAuthenticated.value ? 'yes' : 'no' })
    return
  }
  trackEngagementEvent('like_click', { authenticated: 'yes', current_state: hasLiked.value ? 'liked' : 'unliked' })
  isTogglingLike.value = true
  try {
    const toggleCallable = httpsCallable(functions, 'toggleNewsLike')
    const response = await toggleCallable({ id: article.value.id })
    hasLiked.value = Boolean(response.data?.liked)
    if (typeof response.data?.likesCount === 'number') {
      likesCount.value = Math.max(0, response.data.likesCount)
    } else {
      likesCount.value += hasLiked.value ? 1 : -1
      likesCount.value = Math.max(0, likesCount.value)
    }
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Unable to update like.')
  } finally {
    isTogglingLike.value = false
  }
}

const toggleCommentLike = async (comment) => {
  if (!article.value?.id || !comment?.id) {
    return
  }

  trackEngagementEvent('comment_like_click', {
    authenticated: isAuthenticated.value ? 'yes' : 'no',
    comment_id: comment.id,
    current_state: comment.likedByCurrentUser ? 'liked' : 'unliked'
  })

  if (!isAuthenticated.value) {
    toast.info('Sign in to like comments.')
    return
  }

  if (isCommentLikePending(comment.id)) {
    return
  }

  setCommentLikePending(comment.id, true)
  try {
    const callable = httpsCallable(functions, 'toggleNewsCommentLike')
    const response = await callable({ newsId: article.value.id, commentId: comment.id })
    const updated = comments.value.find((item) => item.id === comment.id)
    if (updated) {
      if (typeof response.data?.likesCount === 'number') {
        updated.likesCount = Math.max(0, response.data.likesCount)
      }
      if (typeof response.data?.liked !== 'undefined') {
        updated.likedByCurrentUser = Boolean(response.data.liked)
      }
    }
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Unable to update comment like.')
  } finally {
    setCommentLikePending(comment.id, false)
  }
}

const performCommentFlagToggle = async (comment) => {
  if (!article.value?.id || !comment?.id) {
    return
  }

  trackEngagementEvent('comment_flag_click', {
    authenticated: isAuthenticated.value ? 'yes' : 'no',
    comment_id: comment.id,
    current_state: comment.flaggedByCurrentUser ? 'flagged' : 'unflagged'
  })

  if (!isAuthenticated.value) {
    toast.info('Sign in to report comments.')
    return
  }

  if (isCommentFlagPending(comment.id)) {
    return
  }

  setCommentFlagPending(comment.id, true)
  try {
    const callable = httpsCallable(functions, 'toggleNewsCommentFlag')
    const response = await callable({ newsId: article.value.id, commentId: comment.id })
    const updated = comments.value.find((item) => item.id === comment.id)
    if (updated) {
      if (typeof response.data?.flagsCount === 'number') {
        updated.flagsCount = Math.max(0, response.data.flagsCount)
      }
      if (typeof response.data?.flagged !== 'undefined') {
        updated.flaggedByCurrentUser = Boolean(response.data.flagged)
      }
    }
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Unable to update comment flag.')
  } finally {
    setCommentFlagPending(comment.id, false)
  }
}

const requestCommentFlag = (comment) => {
  if (!comment || !article.value?.id) return
  if (!comment.flaggedByCurrentUser) {
    commentFlagModal.comment = comment
    commentFlagModal.open = true
    return
  }
  performCommentFlagToggle(comment)
}

const confirmCommentFlag = () => {
  if (!commentFlagModal.comment) return
  const target = commentFlagModal.comment
  commentFlagModal.open = false
  commentFlagModal.comment = null
  performCommentFlagToggle(target)
}

const cancelCommentFlag = () => {
  commentFlagModal.open = false
  commentFlagModal.comment = null
}

const submitComment = async () => {
  if (!canEngage.value || !article.value?.id || isSubmittingComment.value) {
    if (!isAuthenticated.value) {
      toast.info('Sign in to add a comment.')
    }
    trackEngagementEvent('comment_submit_click', { authenticated: isAuthenticated.value ? 'yes' : 'no' })
    return
  }
  const trimmed = commentMessage.value.replace(/\s+/g, ' ').trim()
  if (!trimmed) {
    toast.error('Please write a comment before submitting.')
    return
  }
  isSubmittingComment.value = true
  try {
    trackEngagementEvent('comment_submit_click', {
      authenticated: 'yes',
      message_length: trimmed.length
    })
    const addComment = httpsCallable(functions, 'addNewsComment')
    const response = await addComment({ id: article.value.id, message: trimmed })
    const newComment = response.data?.comment
    if (newComment) {
      const hydrated = {
        ...newComment,
        likesCount: typeof newComment.likesCount === 'number' ? newComment.likesCount : 0,
        likedByCurrentUser: Boolean(newComment.likedByCurrentUser)
      }
      comments.value = [hydrated, ...comments.value]
      article.value = {
        ...article.value,
        commentsCount: typeof response.data?.commentsCount === 'number'
          ? response.data.commentsCount
          : (article.value.commentsCount ?? 0) + 1
      }
      commentMessage.value = ''
      toast.success('Comment added!')
    }
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Unable to post comment.')
  } finally {
    isSubmittingComment.value = false
  }
}

const handleGlobalKeydown = (event) => {
  if (event.key === 'Escape' && commentFlagModal.open) {
    event.preventDefault()
    cancelCommentFlag()
  }
}

const getInitial = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '?'
  return value.trim().charAt(0).toUpperCase()
}

onMounted(() => {
  loadArticle()
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
})

watch(isAuthenticated, (authenticated) => {
  if (authenticated && article.value?.id) {
    refreshEngagement()
  } else if (!authenticated) {
    hasLiked.value = false
    likesCount.value = article.value?.likesCount ?? 0
  }
})

onMounted(() => {
  const video = videoRef.value
  if (video) {
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    video.playbackRate = 0.8
    video.load()
  }
})

onBeforeUnmount(() => {
  const video = videoRef.value
  if (video) {
    video.pause()
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})
</script>

<style scoped>
.news-preview-wrapper {
  position: relative;
  min-height: 100vh;
}

.background-video {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -2;
}

.news-preview {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0;
  color: #f0f4f8;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}

.back-button {
  background: none;
  border: none;
  color: #4ee080;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  transition: background 0.2s ease;
}

.back-button:hover {
  background: rgba(78, 224, 128, 0.18);
}

.meta-block {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.status-pill {
  margin: 0;
  padding: 0.2rem 0.9rem;
  border-radius: 999px;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.08);
}

.status-draft {
  color: #f0d37a;
  background: rgba(240, 211, 122, 0.12);
}

.status-published {
  color: #4ee080;
  background: rgba(78, 224, 128, 0.12);
}

.status-archived {
  color: #9ea6b8;
  background: rgba(158, 166, 184, 0.12);
}

.timestamp {
  margin: 0;
  color: rgba(240, 244, 248, 0.7);
  font-size: 0.9rem;
}

.state {
  padding: 2rem;
  text-align: center;
  color: rgba(240, 244, 248, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(14, 22, 34, 0.85);
}

.state.error {
  color: #ff8a8a;
  border-color: rgba(255, 138, 138, 0.4);
}

.preview-body {
  background: rgba(12, 19, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  width: 100%;
}

.cover-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
}

.cover-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.engagement-bar.floating {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 1rem);
  right: 1rem;
  background: rgba(6, 10, 18, 0.65);
  backdrop-filter: blur(6px);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 0.45rem 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.article-shell {
  padding: 2.5rem 2.75rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.article-shell h1 {
  margin: 0;
  font-size: 2.25rem;
  line-height: 1.2;
}

.article-shell .summary {
  margin: 0;
  font-size: 1.05rem;
  color: rgba(240, 244, 248, 0.75);
}

.engagement-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0 1rem;
}

.engagement-bar.inline {
  margin-bottom: 0;
}

.like-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #f0f4f8;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.like-button.liked {
  border-color: rgba(78, 224, 128, 0.8);
  background: rgba(78, 224, 128, 0.16);
  color: #4ee080;
}

.like-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.engagement-count {
  color: rgba(240, 244, 248, 0.7);
  font-size: 0.95rem;
}

.icon {
  width: 18px;
  height: 18px;
  color: rgba(240, 244, 248, 0.85);
}

.primary-button {
  padding: 0.65rem 1.6rem;
  border-radius: 999px;
  border: none;
  background: #4ee080;
  color: #0a0f16;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.primary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.primary-button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(78, 224, 128, 0.35);
}

.content :deep(p) {
  margin-bottom: 1.25rem;
  line-height: 1.7;
  font-size: 1.05rem;
  overflow-wrap: break-word;
}

.content :deep(img) {
  width: 100%;
  max-width: 100%;
  margin: 1.5rem 0;
  border-radius: 16px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
}

.content :deep(video) {
  display: none !important;
}

.content-segment {
  display: block;
}

.content-segment:not(:last-child) {
  margin-bottom: 1.5rem;
}

.content :deep(h2),
.content :deep(h3),
.content :deep(h4) {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.comments-section {
  background: rgba(12, 19, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 2rem 2.25rem 2.5rem;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comments-section h2 {
  margin: 0;
  font-size: 1.6rem;
}

.comment-form textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(13, 20, 30, 0.92);
  color: #f0f4f8;
  padding: 0.85rem 1rem;
  box-sizing: border-box;
  resize: vertical;
  font-size: 1rem;
}

.comment-actions {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.comment-helper {
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.6);
}

.comment-signin {
  font-size: 0.95rem;
  color: rgba(240, 244, 248, 0.7);
}

.signin-link {
  color: #4ee080;
  font-weight: 600;
  text-decoration: none;
  margin-right: 0.4rem;
}

.signin-link:hover {
  text-decoration: underline;
}

.comments-loading {
  font-size: 0.95rem;
  color: rgba(240, 244, 248, 0.75);
}

.comment-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.comment-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.comment-avatar-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
  min-width: 48px;
}

.comment-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: rgba(240, 244, 248, 0.85);
  overflow: hidden;
  flex-shrink: 0;
}

.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-card {
  flex: 1;
  background: rgba(14, 24, 36, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 0.9rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
}

.comment-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.comment-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.65);
}

.comment-author {
  font-weight: 600;
  color: #f0f4f8;
}

.comment-date {
  font-size: 0.8rem;
}

.comment-message {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
  color: rgba(240, 244, 248, 0.92);
}

.comment-like-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(240, 244, 248, 0.85);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
  font-size: 0.8rem;
}

.comment-like-button svg {
  width: 16px;
  height: 16px;
}

.comment-like-button:hover:not(:disabled),
.comment-like-button:focus-visible:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  outline: none;
  transform: translateY(-1px);
}

.comment-like-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-like-button.liked {
  background: rgba(78, 224, 128, 0.18);
  border-color: rgba(78, 224, 128, 0.4);
  color: #4ee080;
}

.comment-flag-button {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(240, 244, 248, 0.75);
  font-size: 0.7rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.comment-flag-button svg {
  width: 14px;
  height: 14px;
}

.comment-flag-button:hover:not(:disabled),
.comment-flag-button:focus-visible:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.22);
  outline: none;
  transform: translateY(-1px);
}

.comment-flag-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.comment-flag-button.flagged {
  background: rgba(255, 122, 122, 0.2);
  border-color: rgba(255, 122, 122, 0.4);
  color: #ff8b8b;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4, 10, 18, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 1000;
}

.modal-dialog {
  background: rgba(12, 20, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  padding: 1.75rem 2rem;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  max-width: 420px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}

.modal-dialog h3 {
  margin: 0;
  font-size: 1.35rem;
  color: #f0f4f8;
}

.modal-dialog p {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(240, 244, 248, 0.72);
}

.modal-actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.no-comments {
  font-size: 0.95rem;
  color: rgba(240, 244, 248, 0.65);
}

@media (max-width: 768px) {
  .article-shell {
    padding: 1.75rem 1.5rem 2.5rem;
  }

  .comments-section {
    padding: 1.75rem 1.5rem 2rem;
  }

  .cover-wrapper {
    aspect-ratio: auto;
  }
}

@media (max-width: 600px) {
  .news-preview {
    padding: 0;
  }

  .preview-body {
    border-radius: 16px;
  }
}
</style>
