<template>
  <section class="news-list">
    <header class="header">
      <div>
        <h1>News Manager</h1>
        <p>Review, publish, or archive your saved articles.</p>
      </div>
      <RouterLink class="primary-button" to="/news-editor">Create Article</RouterLink>
    </header>

    <div class="toolbar-row">
      <label class="sort-control" for="news-sort">
        Sort by
        <select id="news-sort" v-model="sortOrder">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </label>
    </div>

    <div v-if="isLoading" class="state">Loading articles…</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <div v-else-if="!sortedItems.length" class="state">No articles found. Create your first story.</div>

    <ul v-else class="list">
      <li v-for="article in sortedItems" :key="article.id" class="item">
        <div
          class="card-media"
          :class="{ 'card-media--placeholder': !resolveCoverUrl(article) }"
        >
          <img
            v-if="resolveCoverUrl(article)"
            :src="resolveCoverUrl(article)"
            alt="Cover image"
            referrerpolicy="no-referrer"
            loading="lazy"
          />
          <div v-else class="media-placeholder">
            <span class="media-icon">📰</span>
            <span class="media-text">Add a cover image</span>
          </div>
        </div>
        <div class="meta">
          <h2>{{ article.title }}</h2>
          <p class="summary">{{ article.summary || 'No summary provided.' }}</p>
          <div class="details">
            <span>Created {{ formatDate(article.createdAt) }}</span>
            <span v-if="article.updatedAt">Updated {{ formatDate(article.updatedAt) }}</span>
          </div>
        </div>
        <div class="actions">
          <label>
            Status
            <select v-model="article.status" @change="updateStatus(article)">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div class="buttons">
            <button type="button" class="secondary-button" @click="editArticle(article.id)">Edit</button>
            <button type="button" class="ghost-button" @click="viewArticle(article.id)">View</button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useToast } from 'vue-toastification'

const toast = useToast()
const router = useRouter()
const newsItems = ref([])
const isLoading = ref(true)
const error = ref('')
const sortOrder = ref('desc')

const resolveCoverUrl = (article = {}) => {
  if (!article || typeof article !== 'object') return ''
  if (article.coverImage?.downloadUrl) {
    return article.coverImage.downloadUrl
  }
  const mediaEntry = Array.isArray(article.media)
    ? article.media.find((item) => item?.downloadUrl)
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
    } catch (error) {
      console.warn('Failed to convert Firestore timestamp via toDate', error)
    }
  }

  if (typeof value === 'object' && value !== null) {
    const seconds = value._seconds ?? value.seconds
    const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const millis = seconds * 1000 + Math.floor(nanoseconds / 1e6)
      const date = new Date(millis)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDate = (timestamp) => {
  const date = toDate(timestamp)
  if (!date || Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

const loadArticles = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const loadNews = httpsCallable(functions, 'listNewsArticles')
    const response = await loadNews()
    const articles = Array.isArray(response.data?.articles) ? response.data.articles : []
    newsItems.value = await enrichArticlesWithCover(articles)
  } catch (err) {
    console.error(err)
    error.value = err.message || 'Failed to load articles.'
  } finally {
    isLoading.value = false
  }
}

const enrichArticlesWithCover = async (articles) => {
  const detailCallable = httpsCallable(functions, 'getNewsArticle')
  const tasks = articles.map(async (article) => {
    if (resolveCoverUrl(article)) {
      return article
    }
    try {
      const response = await detailCallable({ id: article.id })
      const detailed = response.data?.article
      if (detailed) {
        return {
          ...article,
          coverImage: detailed.coverImage || article.coverImage || null,
          media: detailed.media || article.media || []
        }
      }
    } catch (detailError) {
      console.warn('Unable to load cover image for article', article.id, detailError)
    }
    return article
  })

  return Promise.all(tasks)
}

const sortedItems = computed(() => {
  const items = Array.isArray(newsItems.value) ? [...newsItems.value] : []
  return items.sort((a, b) => {
    const aDate = toDate(a.updatedAt || a.createdAt)
    const bDate = toDate(b.updatedAt || b.createdAt)
    const aTime = aDate ? aDate.getTime() : 0
    const bTime = bDate ? bDate.getTime() : 0
    if (sortOrder.value === 'asc') {
      return aTime - bTime
    }
    return bTime - aTime
  })
})


const updateStatus = async (article) => {
  try {
    const update = httpsCallable(functions, 'updateNewsStatus')
    await update({ id: article.id, status: article.status })
    toast.success('Status updated')
  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Failed to update status')
    await loadArticles()
  }
}

const editArticle = (id) => {
  router.push({ name: 'NewsEditor', query: { id } })
}

const viewArticle = (id) => {
  router.push({ name: 'NewsAdminPreview', params: { id } })
}

onMounted(loadArticles)
</script>

<style scoped>
.news-list {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  color: #f0f4f8;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.primary-button {
  padding: 0.75rem 1.75rem;
  border-radius: 999px;
  border: none;
  background: #4ee080;
  color: #0a0f16;
  font-weight: 600;
  cursor: pointer;
}

.state {
  text-align: center;
  padding: 2rem;
  color: rgba(240, 244, 248, 0.7);
}

.state.error {
  color: #ff8a8a;
}

.toolbar-row {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  background: rgba(17, 27, 39, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
}

.sort-control select {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  outline: none;
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

.meta h2 {
  margin: 0 0 0.5rem;
}

.meta {
  flex: 1;
  padding: 1.5rem 1.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary {
  margin: 0 0 0.75rem;
  color: rgba(240, 244, 248, 0.75);
}

.details {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.6);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.actions select {
  background: rgba(12, 18, 28, 0.9);
  color: inherit;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.secondary-button,
.ghost-button {
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  cursor: pointer;
}

.secondary-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
}

.ghost-button {
  border: none;
  background: transparent;
  color: rgba(240, 244, 248, 0.75);
}

@media (max-width: 768px) {
  .item {
    flex-direction: column;
  }
  .actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
