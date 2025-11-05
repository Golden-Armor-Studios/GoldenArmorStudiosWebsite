<template>
  <div class="public-news">
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
    <section class="news-list">
      <header class="header">
        <div>
          <h1>Studio News</h1>
          <p>Announcements, dev logs, and updates from Golden Armor Studio.</p>
        </div>
      </header>

      <div v-if="isLoading" class="state">Loading stories…</div>
      <div v-else-if="error" class="state error">{{ error }}</div>
      <div v-else-if="!articles.length" class="state">No stories have been published yet. Check back soon.</div>

      <ul v-else class="list">
        <li v-for="article in articles" :key="article.id" class="item" @click="openArticle(article.id)">
        <div class="card-media" :class="{ 'card-media--placeholder': !resolveCoverUrl(article) }">
          <img
            v-if="resolveCoverUrl(article)"
            :src="resolveCoverUrl(article)"
            alt="Cover image"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <div v-else class="media-placeholder">
            <span class="media-icon">📰</span>
            <span class="media-text">No cover image</span>
          </div>
        </div>
        <div class="meta">
          <div class="meta-body">
            <h2>{{ article.title }}</h2>
            <p class="summary">{{ article.summary || 'Dive in to read the full story.' }}</p>
            <div class="details">
              <span>Published {{ formatDate(article.publishedAt || article.updatedAt || article.createdAt) }}</span>
            </div>
          </div>
          <div class="engagement">
            <span class="engagement-item">
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
              <span>{{ article.likesCount ?? 0 }}</span>
            </span>
            <span class="engagement-item">
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
              <span>{{ article.commentsCount ?? 0 }}</span>
            </span>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="ghost-button">Read Story →</button>
        </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const router = useRouter()
const rawArticles = ref([])
const isLoading = ref(true)
const error = ref('')
const videoRef = ref(null)

const resolveCoverUrl = (article = {}) => {
  if (!article || typeof article !== 'object') return ''
  if (article.coverImage?.downloadUrl) return article.coverImage.downloadUrl
  const mediaEntry = Array.isArray(article.media)
    ? article.media.find((item) => item?.downloadUrl && item.type !== 'video')
    : null
  return mediaEntry?.downloadUrl || ''
}

const toDate = (value) => {
  if (!value) return null

  if (typeof value.toDate === 'function') {
    try {
      const converted = value.toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted
      }
    } catch (err) {
      console.warn('Failed to convert timestamp via toDate', err)
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
    year: 'numeric'
  }).format(date)
}

const articles = computed(() => {
  const records = Array.isArray(rawArticles.value) ? [...rawArticles.value] : []
  return records.sort((a, b) => {
    const aDate = toDate(a.publishedAt || a.updatedAt || a.createdAt)
    const bDate = toDate(b.publishedAt || b.updatedAt || b.createdAt)
    const aTime = aDate ? aDate.getTime() : 0
    const bTime = bDate ? bDate.getTime() : 0
    return bTime - aTime
  })
})

const loadArticles = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const loadNews = httpsCallable(functions, 'listPublishedNews')
    const response = await loadNews()
    rawArticles.value = Array.isArray(response.data?.articles) ? response.data.articles : []
  } catch (err) {
    console.error(err)
    error.value = err.message || 'Failed to load news.'
  } finally {
    isLoading.value = false
  }
}

const openArticle = (id) => {
  router.push({ name: 'NewsPublicPreview', params: { id } })
}

onMounted(loadArticles)

onMounted(() => {
  const video = videoRef.value
  if (video) {
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    video.playbackRate = 0.8
    const playPromise = video.play()
    if (playPromise?.catch) {
      playPromise.catch(() => {
        // iOS may require explicit interaction; leave video paused silently.
      })
    }
  }
})

onBeforeUnmount(() => {
  const video = videoRef.value
  if (video) {
    video.pause()
  }
})
</script>

<style scoped>
.public-news {
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

.news-list {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  color: #f0f4f8;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.header {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.header h1 {
  margin: 0;
  font-size: 2.25rem;
}

.header p {
  margin: 0;
  color: rgba(240, 244, 248, 0.7);
}

.state {
  text-align: center;
  padding: 2rem;
  color: rgba(240, 244, 248, 0.7);
}

.state.error {
  color: #ff8a8a;
}

.list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  flex-direction: column;
  background: rgba(17, 27, 39, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-width: 0;
}

.item:hover {
  transform: translateY(-4px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}

.card-media {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-media--placeholder {
  background: linear-gradient(145deg, rgba(13, 20, 30, 0.9), rgba(24, 36, 52, 0.9));
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.media-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  color: rgba(240, 244, 248, 0.65);
  font-size: 0.9rem;
}

.media-icon {
  font-size: 1.6rem;
}

.meta {
  flex: 1;
  padding: 1.5rem 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.meta h2 {
  margin: 0;
  font-size: 1.35rem;
}

.summary {
  margin: 0;
  color: rgba(240, 244, 248, 0.75);
  overflow-wrap: anywhere;
}

.details {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.6);
  justify-content: center;
  text-align: center;
  overflow-wrap: anywhere;
}

.meta-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.engagement {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: rgba(240, 244, 248, 0.7);
  margin-top: auto;
  justify-content: center;
}

.engagement-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.icon {
  width: 18px;
  height: 18px;
  color: rgba(240, 244, 248, 0.85);
}

.actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 1.5rem 1.5rem;
}

.ghost-button {
  border: none;
  background: transparent;
  color: rgba(240, 244, 248, 0.75);
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}

.ghost-button:hover {
  color: #4ee080;
}

@media (max-width: 768px) {
  .news-list {
    padding: 2rem 1rem 3rem;
  }
}
</style>
