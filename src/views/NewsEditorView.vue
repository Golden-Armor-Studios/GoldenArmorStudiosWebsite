<template>
  <section class="news-editor">
    <header class="editor-header">
      <h1>News Editor</h1>
      <p class="editor-subtitle">
        Craft announcements with rich formatting, embedded media, and a featured cover image.
      </p>
    </header>

    <div v-if="isLoading" class="editor-state">Loading article…</div>
    <div v-else-if="loadError" class="editor-state error">{{ loadError }}</div>

    <form v-else class="editor-form" @submit.prevent>
      <label class="editor-label" for="news-title">Article Title</label>
      <input
        id="news-title"
        v-model="title"
        type="text"
        class="title-input"
        placeholder="Enter a compelling headline"
      />

      <label class="editor-label" for="cover-upload">Cover Image</label>
      <div class="cover-upload">
        <input
          id="cover-upload"
          ref="coverInput"
          type="file"
          accept="image/*"
          class="sr-only"
          @change="handleCoverChange"
        />
        <button type="button" class="ghost-button" @click="triggerCoverUpload">
          Upload Cover Photo
        </button>
        <span v-if="coverName" class="cover-name">{{ coverName }}</span>
      </div>

      <div v-if="coverState.imageLoaded" class="cover-editor">
        <div
          ref="cropStage"
          class="crop-stage"
          @pointerdown="startDrag"
          @pointermove="handleDrag"
          @pointerup="endDrag"
          @pointerleave="endDrag"
        >
          <img
            :src="coverState.source"
            alt="Cover positioning"
            class="cover-image"
            draggable="false"
            :style="coverImageStyle"
          />
          <div class="crop-frame" aria-hidden="true"></div>
        </div>
        <div class="crop-controls">
          <label class="field-group">
            Zoom
            <input
              type="range"
              :min="coverState.minZoom"
              :max="coverState.maxZoom"
              step="0.01"
              v-model.number="coverState.zoom"
            />
          </label>
        </div>
      </div>

      <div v-if="coverPreview" class="cover-preview">
        <img :src="coverPreview" alt="Cover preview" />
      </div>

      <div class="toolbar" role="group" aria-label="Formatting toolbar">
        <div class="toolbar-row">
          <button type="button" class="tool" @click="applyFormat('bold')" title="Bold (Cmd+B)"><strong>B</strong></button>
          <button type="button" class="tool" @click="applyFormat('italic')" title="Italic (Cmd+I)"><em>I</em></button>
          <button type="button" class="tool" @click="applyFormat('underline')" title="Underline (Cmd+U)"><span class="underline">U</span></button>
          <button type="button" class="tool" @click="applyFormat('strikeThrough')" title="Strikethrough"><span class="strike">S</span></button>
          <div class="divider" aria-hidden="true"></div>
          <button type="button" class="tool" @click="applyFormat('insertUnorderedList')" title="Bullet list">• List</button>
          <button type="button" class="tool" @click="applyFormat('insertOrderedList')" title="Numbered list">1. List</button>
          <div class="divider" aria-hidden="true"></div>
          <button type="button" class="tool" @click="applyFormat('justifyLeft')" title="Align left">⟸</button>
          <button type="button" class="tool" @click="applyFormat('justifyCenter')" title="Center">⇔</button>
          <button type="button" class="tool" @click="applyFormat('justifyRight')" title="Align right">⟹</button>
        </div>

        <div class="toolbar-row">
          <label class="field-group">
            Font
            <select class="toolbar-select" v-model="selectedFont" @change="applyFont">
              <option value="">Default</option>
              <option value="Merriweather">Merriweather</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Source Sans Pro">Source Sans Pro</option>
            </select>
          </label>
          <label class="field-group">
            Heading
            <select class="toolbar-select" v-model="selectedHeading" @change="applyHeading">
              <option value="P">Paragraph</option>
              <option value="H2">Heading 2</option>
              <option value="H3">Heading 3</option>
              <option value="H4">Heading 4</option>
            </select>
          </label>
          <div class="divider" aria-hidden="true"></div>
          <button type="button" class="tool" @click="openLinkDialog" title="Insert link">🔗 Link</button>
          <input ref="contentImageInput" class="sr-only" type="file" accept="image/*" @change="handleContentImage" />
          <button type="button" class="tool" @click="triggerContentImage" title="Insert image">🖼️ Image</button>
        </div>
      </div>

      <div
        ref="editor"
        class="editor-surface"
        contenteditable
        role="textbox"
        aria-multiline="true"
        spellcheck="true"
        @input="handleEditorInput"
      ></div>
    </form>

    <section class="preview">
      <h2>Live Preview</h2>
      <article class="preview-card">
        <img v-if="coverPreview" :src="coverPreview" alt="Cover preview" class="preview-cover" />
        <div class="preview-body">
          <h3 class="preview-title">{{ title || 'Untitled Article' }}</h3>
          <div class="preview-content" v-html="contentHtml"></div>
        </div>
      </article>
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const title = ref('')
const coverPreview = ref('')
const coverName = ref('')
const contentHtml = ref('')
const selectedFont = ref('')
const selectedHeading = ref('P')

const coverInput = ref(null)
const contentImageInput = ref(null)
const editor = ref(null)
const cropStage = ref(null)
const isLoading = ref(false)
const loadError = ref('')

const route = useRoute()

const coverState = reactive({
  source: '',
  fileName: '',
  naturalWidth: 0,
  naturalHeight: 0,
  imageLoaded: false,
  zoom: 1,
  minZoom: 1,
  maxZoom: 3,
  position: { x: 0, y: 0 },
  containerWidth: 0,
  containerHeight: 0
})

const dragState = reactive({
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0
})

let resizeObserver = null

const coverImageStyle = computed(() => {
  if (!coverState.imageLoaded) {
    return {}
  }
  const width = coverState.naturalWidth * coverState.zoom
  const height = coverState.naturalHeight * coverState.zoom
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${coverState.position.x}px, ${coverState.position.y}px)`
  }
})

const resetCoverState = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  coverState.source = ''
  coverState.fileName = ''
  coverState.naturalWidth = 0
  coverState.naturalHeight = 0
  coverState.imageLoaded = false
  coverState.zoom = 1
  coverState.minZoom = 1
  coverState.maxZoom = 3
  coverState.position.x = 0
  coverState.position.y = 0
  coverState.containerWidth = 0
  coverState.containerHeight = 0
}

const resetEditor = () => {
  title.value = ''
  coverPreview.value = ''
  coverName.value = ''
  contentHtml.value = ''
  resetCoverState()
  nextTick(() => {
    if (editor.value) {
      editor.value.innerHTML = ''
    }
  })
}

const applyFormat = (command, value = null) => {
  document.execCommand(command, false, value)
  editor.value?.focus()
}

const applyFont = () => {
  if (selectedFont.value) {
    document.execCommand('fontName', false, selectedFont.value)
  } else {
    document.execCommand('removeFormat', false, null)
  }
  editor.value?.focus()
}

const applyHeading = () => {
  const tag = selectedHeading.value || 'P'
  document.execCommand('formatBlock', false, tag)
  editor.value?.focus()
}

const handleEditorInput = () => {
  contentHtml.value = editor.value?.innerHTML || ''
}

const openLinkDialog = () => {
  const url = window.prompt('Enter URL')
  if (url) {
    document.execCommand('createLink', false, url)
  }
  editor.value?.focus()
}

const triggerCoverUpload = () => {
  coverInput.value?.click()
}

const handleCoverChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  coverName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    const value = e.target?.result
    if (!value) return
    coverPreview.value = value
    loadCoverImage(value, file.name)
  }
  reader.readAsDataURL(file)
}

const triggerContentImage = () => {
  contentImageInput.value?.click()
}

const handleContentImage = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const value = e.target?.result
    if (!value) return
    document.execCommand('insertImage', false, value)
    editor.value?.focus()
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

const updateContainerSize = () => {
  if (!cropStage.value) return
  const rect = cropStage.value.getBoundingClientRect()
  coverState.containerWidth = rect.width
  coverState.containerHeight = rect.height
}

const clampPosition = () => {
  const width = coverState.naturalWidth * coverState.zoom
  const height = coverState.naturalHeight * coverState.zoom
  const minX = Math.min(0, coverState.containerWidth - width)
  const minY = Math.min(0, coverState.containerHeight - height)

  if (width <= coverState.containerWidth) {
    coverState.position.x = (coverState.containerWidth - width) / 2
  } else {
    coverState.position.x = Math.min(0, Math.max(minX, coverState.position.x))
  }

  if (height <= coverState.containerHeight) {
    coverState.position.y = (coverState.containerHeight - height) / 2
  } else {
    coverState.position.y = Math.min(0, Math.max(minY, coverState.position.y))
  }
}

const centerImage = () => {
  const width = coverState.naturalWidth * coverState.zoom
  const height = coverState.naturalHeight * coverState.zoom
  coverState.position.x = (coverState.containerWidth - width) / 2
  coverState.position.y = (coverState.containerHeight - height) / 2
  clampPosition()
}

const recalcZoomBounds = (forceCenter = false) => {
  if (!coverState.imageLoaded) return
  updateContainerSize()
  if (!coverState.containerWidth || !coverState.containerHeight) return
  const minZoom = Math.max(
    coverState.containerWidth / coverState.naturalWidth,
    coverState.containerHeight / coverState.naturalHeight
  )
  if (!Number.isFinite(minZoom) || minZoom <= 0) return
  coverState.minZoom = minZoom
  coverState.maxZoom = Math.max(minZoom * 3, minZoom + 0.5)
  if (forceCenter || coverState.zoom < coverState.minZoom) {
    coverState.zoom = coverState.minZoom
    centerImage()
  } else if (coverState.zoom > coverState.maxZoom) {
    coverState.zoom = coverState.maxZoom
    clampPosition()
  } else {
    clampPosition()
  }
}

const setupResizeObserver = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (typeof ResizeObserver === 'undefined' || !cropStage.value) return
  resizeObserver = new ResizeObserver(() => {
    updateContainerSize()
    recalcZoomBounds()
  })
  resizeObserver.observe(cropStage.value)
}

const loadCoverImage = (source, fileName) => {
  resetCoverState()
  coverState.source = source
  coverState.fileName = fileName || ''
  const image = new Image()
  image.onload = () => {
    coverState.naturalWidth = image.naturalWidth
    coverState.naturalHeight = image.naturalHeight
    coverState.imageLoaded = true
    nextTick(() => {
      updateContainerSize()
      recalcZoomBounds(true)
      centerImage()
      setupResizeObserver()
    })
  }
  image.onerror = () => {
    resetCoverState()
  }
  image.src = source
}

const startDrag = (event) => {
  if (!coverState.imageLoaded) return
  dragState.active = true
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.originX = coverState.position.x
  dragState.originY = coverState.position.y
  event.currentTarget.setPointerCapture(event.pointerId)
}

const handleDrag = (event) => {
  if (!dragState.active || event.pointerId !== dragState.pointerId) return
  coverState.position.x = dragState.originX + (event.clientX - dragState.startX)
  coverState.position.y = dragState.originY + (event.clientY - dragState.startY)
  clampPosition()
}

const endDrag = (event) => {
  if (!dragState.active || event.pointerId !== dragState.pointerId) return
  dragState.active = false
  event.currentTarget.releasePointerCapture(event.pointerId)
  clampPosition()
}

const handleZoomChange = (newZoom, oldZoom) => {
  if (!coverState.imageLoaded) return
  if (typeof oldZoom !== 'number') {
    clampPosition()
    return
  }
  const clampedZoom = Math.min(Math.max(newZoom, coverState.minZoom), coverState.maxZoom)
  if (clampedZoom !== newZoom) {
    coverState.zoom = clampedZoom
    return
  }
  const prevWidth = coverState.naturalWidth * oldZoom
  const prevHeight = coverState.naturalHeight * oldZoom
  if (!prevWidth || !prevHeight) {
    clampPosition()
    return
  }
  const centerXRatio = (coverState.containerWidth / 2 - coverState.position.x) / prevWidth
  const centerYRatio = (coverState.containerHeight / 2 - coverState.position.y) / prevHeight
  const newWidth = coverState.naturalWidth * newZoom
  const newHeight = coverState.naturalHeight * newZoom
  coverState.position.x = coverState.containerWidth / 2 - centerXRatio * newWidth
  coverState.position.y = coverState.containerHeight / 2 - centerYRatio * newHeight
  clampPosition()
}

const loadArticleIfNeeded = async () => {
  const id = route.query.id
  if (!id) {
    loadError.value = ''
    isLoading.value = false
    resetEditor()
    return
  }

  isLoading.value = true
  loadError.value = ''
  resetCoverState()
  try {
    const fetchArticle = httpsCallable(functions, 'getNewsArticle')
    const response = await fetchArticle({ id })
    const article = response.data?.article
    if (!article) {
      throw new Error('Article not found.')
    }

    title.value = article.title || ''
    coverPreview.value = article.coverImage?.downloadUrl || ''
    coverName.value = article.coverImage?.fileName || ''
    const html = article.contentHtml || ''
    contentHtml.value = html

    isLoading.value = false
    await nextTick()
    if (editor.value) {
      editor.value.innerHTML = html
    }
  } catch (error) {
    console.error(error)
    loadError.value = error.message || 'Unable to load article.'
    isLoading.value = false
    resetCoverState()
    title.value = ''
    coverPreview.value = ''
    coverName.value = ''
    contentHtml.value = ''
    await nextTick()
    if (editor.value) {
      editor.value.innerHTML = ''
    }
  }
}

watch(() => route.query.id, loadArticleIfNeeded, { immediate: true })
watch(() => coverState.zoom, handleZoomChange)
watch(() => coverState.imageLoaded, (loaded) => {
  if (loaded) {
    nextTick().then(() => {
      updateContainerSize()
      recalcZoomBounds(true)
      centerImage()
      setupResizeObserver()
    })
  } else if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
watch(() => coverState.containerWidth, () => {
  if (coverState.imageLoaded) {
    recalcZoomBounds()
  }
})
watch(() => coverState.containerHeight, () => {
  if (coverState.imageLoaded) {
    recalcZoomBounds()
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.news-editor {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  color: #f0f4f8;
}

.editor-header {
  margin-bottom: 2rem;
  text-align: center;
}

.editor-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.editor-subtitle {
  font-size: 1rem;
  color: rgba(240, 244, 248, 0.7);
}

.editor-state {
  padding: 1rem 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(17, 27, 39, 0.9);
  border-radius: 14px;
  color: rgba(240, 244, 248, 0.85);
  margin-bottom: 1.5rem;
  text-align: center;
}

.editor-state.error {
  border-color: rgba(255, 138, 138, 0.45);
  color: #ff9f9f;
}

.editor-form {
  background: rgba(17, 27, 39, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1.75rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.editor-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.title-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(13, 20, 30, 0.9);
  color: #f0f4f8;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  transition: border-color 0.2s ease;
}

.title-input:focus {
  outline: none;
  border-color: #4ee080;
  box-shadow: 0 0 0 3px rgba(78, 224, 128, 0.2);
}

.cover-upload {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.ghost-button {
  padding: 0.5rem 1.25rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.ghost-button:hover,
.ghost-button:focus {
  background: rgba(78, 224, 128, 0.2);
  border-color: #4ee080;
}

.cover-name {
  font-size: 0.9rem;
  color: rgba(240, 244, 248, 0.75);
}

.cover-preview {
  margin-bottom: 1.5rem;
  border-radius: 16px;
  overflow: hidden;
}

.cover-preview img {
  width: 100%;
  display: block;
}

.cover-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.crop-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: rgba(12, 19, 30, 0.85);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: grab;
}

.crop-stage:active {
  cursor: grabbing;
}

.cover-image {
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
  pointer-events: none;
}

.crop-frame {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  pointer-events: none;
}

.crop-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.crop-controls input[type='range'] {
  width: 180px;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.tool {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.tool:hover,
.tool:focus {
  background: rgba(78, 224, 128, 0.2);
  border-color: #4ee080;
}

.toolbar-select {
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(12, 18, 28, 0.95);
  color: inherit;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.editor-surface {
  min-height: 320px;
  padding: 1rem 1.25rem;
  background: rgba(9, 14, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  color: #f0f4f8;
  line-height: 1.6;
}

.editor-surface:focus {
  outline: none;
  border-color: #4ee080;
  box-shadow: 0 0 0 3px rgba(78, 224, 128, 0.2);
}

.preview {
  margin-top: 3rem;
}

.preview h2 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.preview-card {
  background: rgba(9, 14, 22, 0.92);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.preview-cover {
  width: 100%;
  display: block;
}

.preview-body {
  padding: 1.5rem;
}

.preview-title {
  font-size: 1.8rem;
  margin-bottom: 1rem;
}

.preview-content :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.6;
}

.preview-content :deep(img) {
  max-width: 100%;
  border-radius: 12px;
  margin: 1rem 0;
}

.preview-content :deep(video) {
  width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 1rem 0;
}

.preview-content :deep(a) {
  color: #4ee080;
  text-decoration: underline;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  margin-left: 1.4rem;
}

.divider {
  width: 1px;
  height: 1.5rem;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 0.5rem;
}

.underline {
  text-decoration: underline;
}

.strike {
  text-decoration: line-through;
}

@media (max-width: 768px) {
  .toolbar-row {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-form {
    padding: 1.25rem;
  }

  .crop-stage {
    border-radius: 14px;
  }
}
</style>
