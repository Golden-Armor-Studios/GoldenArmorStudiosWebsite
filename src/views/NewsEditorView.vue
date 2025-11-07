<template>
  <section class="news-editor">
    <header class="editor-header">
      <h1>News Editor</h1>
      <p class="editor-subtitle">
        Craft announcements with rich formatting, embedded media, and a featured cover image tailored for iOS layouts.
      </p>
    </header>

    <div v-if="isLoading" class="editor-state">Loading article…</div>
    <div v-else-if="loadError" class="editor-state error">{{ loadError }}</div>

    <div v-else class="editor-layout">
      <form class="editor-form" @submit.prevent>
        <label class="editor-label" for="news-title">Article Title</label>
        <input
          id="news-title"
          v-model="title"
          type="text"
          class="title-input"
          placeholder="Enter a compelling headline"
        />

        <section class="media-section">
          <header class="media-header">
            <h2>Featured Cover</h2>
            <p>Upload, zoom, and crop the image exactly how it should appear in the iOS layouts.</p>
          </header>
          <div class="cover-controls">
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
            <span v-if="coverName" class="cover-name" :title="coverName">{{ coverName }}</span>
            <span v-if="coverUploadMessage" class="cover-hint">{{ coverUploadMessage }}</span>
          </div>

          <div
            v-if="coverState.imageReady"
            ref="cropStage"
            class="crop-stage"
            @pointerdown="startDrag"
            @pointermove="handleDrag"
            @pointerup="endDrag"
            @pointerleave="endDrag"
          >
            <img
              ref="coverImage"
              :src="coverState.displaySource"
              alt="Cover image crop"
              class="cover-image"
              draggable="false"
              :style="coverImageStyle"
            />
            <div class="crop-frame" aria-hidden="true"></div>
            <div v-if="coverState.uploading" class="upload-overlay">
              <span>Uploading latest crop…</span>
            </div>
          </div>

          <div v-if="coverState.imageReady" class="crop-controls">
            <label>
              Zoom
              <input
                type="range"
                :min="coverState.minZoom"
                :max="coverState.maxZoom"
                step="0.01"
                v-model.number="coverState.zoom"
              />
            </label>
            <button
              type="button"
              class="ghost-button"
              @click="centerImage"
            >
              Re-center
            </button>
          </div>
        </section>

        <section class="media-section">
          <header class="media-header">
            <h2>Inline Media</h2>
            <p>Upload a video to add it directly to the article body. Videos stay responsive inside the editor.</p>
          </header>
          <div class="video-controls">
            <input
              ref="videoInput"
              type="file"
              accept="video/*"
              class="sr-only"
              @change="handleVideoChange"
            />
            <button type="button" class="ghost-button" @click="triggerVideoUpload">
              Upload Video
            </button>
            <span v-if="videoUploadMessage" class="video-hint">{{ videoUploadMessage }}</span>
          </div>
          <div v-if="videoControlsVisible" class="video-width-controls">
            <label for="video-width">Selected video width</label>
            <input
              id="video-width"
              type="range"
              min="40"
              max="100"
              step="5"
              v-model.number="videoWidthPct"
              @input="updateActiveVideoWidth"
            />
            <span>{{ videoWidthPct }}%</span>
            <button type="button" class="ghost-button" @click="clearActiveVideo">Done</button>
          </div>
        </section>

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
        @keyup="saveSelection"
        @mouseup="saveSelection"
        @mouseleave="saveSelection"
        @touchend="saveSelection"
      ></div>

      <div class="form-actions">
        <button type="button" class="primary-button" @click="saveArticle" :disabled="isSaving">
          {{ isSaving ? 'Saving…' : 'Save Article' }}
        </button>
        <span v-if="saveSuccess" class="save-message success">{{ saveSuccess }}</span>
        <span v-if="saveError" class="save-message error">{{ saveError }}</span>
      </div>
    </form>

      <aside class="preview-panel">
        <h2>Live Preview</h2>
        <div class="preview-grid">
          <article class="preview-card-mobile">
            <div class="preview-cover" :class="{ 'preview-cover--empty': !coverPreviewUrl }">
              <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="Mobile cover" loading="lazy" />
              <div v-else class="preview-cover-placeholder">
                <span>Upload a cover to see the iOS card preview</span>
              </div>
            </div>
            <div class="preview-card-body">
              <h3>{{ title || 'Untitled Article' }}</h3>
              <p>{{ truncatedSummary }}</p>
              <div class="preview-meta">
                <span>{{ previewTimestamp }}</span>
                <div class="preview-engagement">
                  <span class="icon-row">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M5 21h14a2 2 0 0 0 2-2v-6c0-1.1-.9-2-2-2h-5.28l.74-3.7.02-.3c0-.41-.17-.8-.46-1.09L13 4l-6 6.33V21Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    <span>0</span>
                  </span>
                  <span class="icon-row">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    <span>0</span>
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article class="preview-detail">
            <header class="detail-header">
              <div>
                <p class="detail-label">{{ previewTimestamp }}</p>
                <h3>{{ title || 'Untitled Article' }}</h3>
              </div>
              <div class="detail-engagement">
                <span class="icon-row">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12.1 20.3 4.5 13a5 5 0 0 1 0-7.1 5 5 0 0 1 7.1 0l.4.4.4-.4a5 5 0 0 1 7.1 0 5 5 0 0 1 0 7.1l-7.6 7.3Z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span>0</span>
                </span>
                <span class="icon-row">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span>0</span>
                </span>
              </div>
            </header>
            <div class="detail-cover" :class="{ 'detail-cover--empty': !coverPreviewUrl }">
              <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="Detail cover" />
            </div>
            <main class="detail-content" v-html="contentHtml"></main>
          </article>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { functions, storage } from '../firebase'
import { FFmpeg } from '@ffmpeg/ffmpeg'

const COVER_ASPECT_RATIO = 4 / 2.3 // width / height
const COVER_OUTPUT_WIDTH = 1280
const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/'
const FFMPEG_CORE_JS = `${FFMPEG_CORE_BASE}ffmpeg-core.js`
const FFMPEG_CORE_WASM = `${FFMPEG_CORE_BASE}ffmpeg-core.wasm`

const title = ref('')
const coverName = ref('')
const coverPreviewUrl = ref('')
const contentHtml = ref('')
const selectedFont = ref('')
const selectedHeading = ref('P')

const coverInput = ref(null)
const contentImageInput = ref(null)
const videoInput = ref(null)
const editor = ref(null)
const cropStage = ref(null)
const coverImage = ref(null)

const isLoading = ref(false)
const loadError = ref('')
const coverUploadMessage = ref('')
const videoUploadMessage = ref('')
const transcodingState = reactive({
  loading: false,
  progress: 0,
  error: ''
})
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

const mediaItems = ref([])
const coverMeta = ref(null)

const activeVideo = ref(null)
const videoWidthPct = ref(100)
const videoControlsVisible = computed(() => Boolean(activeVideo.value))

const route = useRoute()

const coverState = reactive({
  displaySource: '',
  imageElement: null,
  imageReady: false,
  naturalWidth: 0,
  naturalHeight: 0,
  zoom: 1,
  minZoom: 1,
  maxZoom: 3,
  position: { x: 0, y: 0 },
  containerWidth: 0,
  containerHeight: 0,
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  uploading: false,
  uploadError: ''
})

let resizeObserver = null
let coverUploadTimeout = null
let savedRange = null
const ffmpegInstance = new FFmpeg()
let ffmpegLoadingPromise = null
let ffmpegReady = false
let ffmpegProgressConfigured = false

const sanitizeFileName = (value) => {
  if (typeof value !== 'string' || !value.trim()) return 'file'
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

const randomSuffix = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 12)
}

const buildStoragePath = (folder, fileName, extension) => {
  const base = sanitizeFileName(fileName ? fileName.replace(/\.[^.]+$/, '') : 'asset')
  const ext = extension || (fileName?.includes('.') ? fileName.split('.').pop() : 'bin')
  return `${folder}/${base}-${Date.now()}-${randomSuffix()}.${ext}`
}

const uploadBlobToStorage = async (folder, blob, contentType, originalName) => {
  const extension = contentType?.split('/')[1] || 'jpg'
  const path = buildStoragePath(folder, originalName || 'image', extension)
  const storageReference = storageRef(storage, path)
  await uploadBytes(storageReference, blob, { contentType })
  const downloadUrl = await getDownloadURL(storageReference)
  return {
    downloadUrl,
    storagePath: `gs://${storage.app.options.storageBucket}/${path}`,
    fileName: path.split('/').pop(),
    contentType
  }
}

const resolveContentType = (file, extension) => {
  if (file.type && typeof file.type === 'string' && file.type.trim()) {
    return file.type
  }
  const ext = typeof extension === 'string' ? extension.toLowerCase() : ''
  if (['mp4', 'm4v', 'mov'].includes(ext)) return 'video/mp4'
  if (['webm'].includes(ext)) return 'video/webm'
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (['png'].includes(ext)) return 'image/png'
  if (['gif'].includes(ext)) return 'image/gif'
  return 'application/octet-stream'
}

const toUint8Array = async (input) => {
  if (input instanceof Uint8Array) {
    return input
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }
  if (typeof input === 'string') {
    const response = await fetch(input)
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${response.status}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
  if (input && typeof input.arrayBuffer === 'function') {
    return new Uint8Array(await input.arrayBuffer())
  }
  throw new Error('Unsupported file input type for FFmpeg.')
}

const uploadFileToStorage = async (folder, file) => {
  const extension = file.name?.split('.').pop() || file.type?.split('/').pop() || 'bin'
  const path = buildStoragePath(folder, file.name || 'media', extension)
  const storageReference = storageRef(storage, path)
  const contentType = resolveContentType(file, extension)
  await uploadBytes(storageReference, file, {
    contentType,
    cacheControl: 'public,max-age=86400'
  })
  const downloadUrl = await getDownloadURL(storageReference)
  return {
    downloadUrl,
    storagePath: `gs://${storage.app.options.storageBucket}/${path}`,
    fileName: path.split('/').pop(),
    contentType
  }
}

const getFfmpeg = async () => {
  if (typeof window === 'undefined') {
    throw new Error('FFmpeg is only available in the browser environment.')
  }
  if (!ffmpegProgressConfigured) {
    ffmpegInstance.on('progress', ({ ratio }) => {
      if (!transcodingState.loading) return
      const value = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
      transcodingState.progress = value
      const pct = Math.round(value * 100)
      videoUploadMessage.value = `Transcoding video… ${pct}%`
    })
    ffmpegProgressConfigured = true
  }

  if (!ffmpegReady) {
    if (!ffmpegLoadingPromise) {
      ffmpegLoadingPromise = ffmpegInstance.load({
        coreURL: FFMPEG_CORE_JS,
        wasmURL: FFMPEG_CORE_WASM
      }).then(() => {
        ffmpegReady = true
      })
    }
    await ffmpegLoadingPromise
    ffmpegLoadingPromise = null
  }

  return ffmpegInstance
}

const transcodeVideoForIOS = async (file) => {
  transcodingState.loading = true
  transcodingState.progress = 0
  transcodingState.error = ''
  videoUploadMessage.value = 'Preparing video encoder…'
  try {
    const ffmpeg = await getFfmpeg()
    videoUploadMessage.value = 'Transcoding video…'
    const extension = (file.name?.split('.').pop() || 'mp4').toLowerCase()
    const inputName = `input-${Date.now()}.${extension}`
    const outputName = `output-${Date.now()}.mp4`
    const sourceData = await toUint8Array(file)
    await ffmpeg.writeFile(inputName, sourceData)
    await ffmpeg.exec([
      '-i',
      inputName,
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      outputName
    ])
    transcodingState.progress = 1
    videoUploadMessage.value = 'Transcoding video… 100%'
    const data = await ffmpeg.readFile(outputName)
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
    const blob = new Blob([data], { type: 'video/mp4' })
    const safeName = `${sanitizeFileName(file.name.replace(/\.[^.]+$/, '') || 'video')}-ios.mp4`
    const reencodedFile = new File([blob], safeName, { type: 'video/mp4' })
    videoUploadMessage.value = 'Transcode complete. Uploading…'
    return reencodedFile
  } catch (error) {
    console.error('Video transcode failed', error)
    transcodingState.error = 'Unable to transcode video for iOS compatibility.'
    videoUploadMessage.value = 'Transcode failed. Uploading original file.'
    return file
  } finally {
    transcodingState.loading = false
    transcodingState.progress = 0
  }
}

const saveArticle = async () => {
  if (isSaving.value) return
  saveError.value = ''
  saveSuccess.value = ''

  const cleanedTitle = title.value.trim()
  const cleanedHtml = getEditorHtml().trim()

  if (!cleanedTitle) {
    saveError.value = 'A title is required before saving.'
    return
  }

  if (!cleanedHtml) {
    saveError.value = 'Please add article content before saving.'
    return
  }

  if (!coverMeta.value) {
    saveError.value = 'Upload and position a cover image before saving.'
    return
  }

  isSaving.value = true
  try {
    const createArticle = httpsCallable(functions, 'createNewsArticle')
    const payload = {
      title: cleanedTitle,
      contentHtml: cleanedHtml,
      coverImage: coverMeta.value,
      media: Array.isArray(mediaItems.value) ? mediaItems.value : [],
      summary: plainText.value ? plainText.value.slice(0, 240) : null,
      status: 'draft'
    }

    const articleId = route.query.id
    if (articleId) {
      payload.id = articleId
    }

    await createArticle(payload)
    saveSuccess.value = articleId ? 'Article updated successfully.' : 'Article saved successfully.'
  } catch (error) {
    console.error(error)
    saveError.value = error.message || 'Unable to save article.'
  } finally {
    isSaving.value = false
  }
}

const coverImageStyle = computed(() => {
  if (!coverState.imageReady) return {}
  const width = coverState.naturalWidth * coverState.zoom
  const height = coverState.naturalHeight * coverState.zoom
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${coverState.position.x}px, ${coverState.position.y}px)`
  }
})

const plainText = computed(() => {
  const div = document.createElement('div')
  div.innerHTML = contentHtml.value || ''
  return div.textContent?.trim() || ''
})

const truncatedSummary = computed(() => {
  const text = plainText.value
  if (!text) return 'Draft your article to preview it here.'
  if (text.length <= 140) return text
  return `${text.slice(0, 137)}…`
})

const getEditorHtml = () => {
  if (!editor.value) return ''
  const clone = editor.value.cloneNode(true)
  clone.querySelectorAll('.video-insert-handle').forEach((handle) => handle.remove())
  return clone.innerHTML || ''
}

const previewTimestamp = computed(() => {
  const now = new Date()
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(now)
})

const resetCoverState = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (coverState.displaySource && coverState.displaySource.startsWith('blob:')) {
    URL.revokeObjectURL(coverState.displaySource)
  }
  coverState.displaySource = ''
  coverState.imageElement = null
  coverState.imageReady = false
  coverState.naturalWidth = 0
  coverState.naturalHeight = 0
  coverState.zoom = 1
  coverState.minZoom = 1
  coverState.maxZoom = 3
  coverState.position.x = 0
  coverState.position.y = 0
  coverState.containerWidth = 0
  coverState.containerHeight = 0
  coverState.uploading = false
  coverState.uploadError = ''
  coverMeta.value = null
  coverPreviewUrl.value = ''
}

const resetEditor = () => {
  title.value = ''
  contentHtml.value = ''
  coverName.value = ''
  mediaItems.value = []
  coverUploadMessage.value = ''
  videoUploadMessage.value = ''
  saveError.value = ''
  saveSuccess.value = ''
  isSaving.value = false
  resetCoverState()
  nextTick(() => {
    if (editor.value) {
      editor.value.innerHTML = ''
    }
  })
}

const triggerCoverUpload = () => {
  coverInput.value?.click()
}

const handleCoverChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  coverUploadMessage.value = 'Processing cover…'
  coverName.value = file.name
  const objectUrl = URL.createObjectURL(file)
  loadCoverImage(objectUrl, file.name)
  scheduleCoverUpload(true)
  event.target.value = ''
}

const loadCoverImage = (source, fileName) => {
  if (!source) return
  if (coverState.displaySource && coverState.displaySource !== source && coverState.displaySource.startsWith('blob:')) {
    URL.revokeObjectURL(coverState.displaySource)
  }
  coverState.displaySource = source
  coverState.imageReady = false
  coverState.uploadError = ''

  const image = new Image()
  image.onload = () => {
    coverState.imageElement = image
    coverState.naturalWidth = image.naturalWidth
    coverState.naturalHeight = image.naturalHeight
    coverState.imageReady = true
    nextTick(() => {
      updateContainerSize()
      recalcZoomBounds(true)
      centerImage()
      setupResizeObserver()
      coverUploadMessage.value = `Cover ready • ${fileName || 'image'}`
      scheduleCoverUpload(true)
    })
  }
  image.onerror = () => {
    coverState.uploadError = 'Unable to load cover. Try another image.'
    coverUploadMessage.value = 'Cover failed to load.'
    coverState.imageReady = false
  }
  image.crossOrigin = 'anonymous'
  image.src = source
}

const updateContainerSize = () => {
  if (!cropStage.value) return
  const rect = cropStage.value.getBoundingClientRect()
  coverState.containerWidth = rect.width
  coverState.containerHeight = rect.height
}

const clampPosition = () => {
  if (!coverState.imageReady) return
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
  if (!coverState.imageReady) return
  const width = coverState.naturalWidth * coverState.zoom
  const height = coverState.naturalHeight * coverState.zoom
  coverState.position.x = (coverState.containerWidth - width) / 2
  coverState.position.y = (coverState.containerHeight - height) / 2
  clampPosition()
}

const recalcZoomBounds = (forceCenter = false) => {
  if (!coverState.imageReady || !coverState.containerWidth || !coverState.containerHeight) return
  const minZoom = Math.max(
    coverState.containerWidth / coverState.naturalWidth,
    coverState.containerHeight / coverState.naturalHeight
  )
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
  if (!cropStage.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    updateContainerSize()
    recalcZoomBounds()
  })
  resizeObserver.observe(cropStage.value)
}

const startDrag = (event) => {
  if (!coverState.imageReady) return
  coverState.dragging = true
  coverState.pointerId = event.pointerId
  coverState.startX = event.clientX
  coverState.startY = event.clientY
  coverState.originX = coverState.position.x
  coverState.originY = coverState.position.y
  event.currentTarget.setPointerCapture(event.pointerId)
}

const handleDrag = (event) => {
  if (!coverState.dragging || event.pointerId !== coverState.pointerId) return
  coverState.position.x = coverState.originX + (event.clientX - coverState.startX)
  coverState.position.y = coverState.originY + (event.clientY - coverState.startY)
  clampPosition()
}

const endDrag = (event) => {
  if (!coverState.dragging || event.pointerId !== coverState.pointerId) return
  coverState.dragging = false
  event.currentTarget.releasePointerCapture(event.pointerId)
  clampPosition()
  scheduleCoverUpload()
}

const generateCoverBlob = () =>
  new Promise((resolve, reject) => {
    if (!coverState.imageReady || !coverState.imageElement || !coverState.containerWidth || !coverState.containerHeight) {
      reject(new Error('Cover not ready'))
      return
    }

    const canvas = document.createElement('canvas')
    const outputWidth = COVER_OUTPUT_WIDTH
    const outputHeight = Math.round(outputWidth / COVER_ASPECT_RATIO)
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas rendering failed'))
      return
    }

    const zoom = coverState.zoom
    const sourceX = Math.max(0, (-coverState.position.x) / zoom)
    const sourceY = Math.max(0, (-coverState.position.y) / zoom)
    const sourceWidth = Math.min(coverState.naturalWidth, coverState.containerWidth / zoom)
    const sourceHeight = Math.min(coverState.naturalHeight, coverState.containerHeight / zoom)

    try {
      ctx.drawImage(
        coverState.imageElement,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )
    } catch (error) {
      reject(error)
      return
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create cover blob'))
        } else {
          resolve(blob)
        }
      },
      'image/jpeg',
      0.92
    )
  })

const performCoverUpload = async () => {
  if (!coverState.imageReady) return
  coverState.uploading = true
  coverState.uploadError = ''
  try {
    const blob = await generateCoverBlob()
    const meta = await uploadBlobToStorage('editor/cover-final', blob, 'image/jpeg', coverName.value || 'cover')
    coverMeta.value = meta
    coverPreviewUrl.value = meta.downloadUrl
    coverUploadMessage.value = 'Latest crop uploaded.'
  } catch (error) {
    console.error(error)
    coverState.uploadError = 'Failed to upload cropped image.'
    coverUploadMessage.value = 'Upload failed. Adjust crop to retry.'
  } finally {
    coverState.uploading = false
  }
}

const scheduleCoverUpload = (immediate = false) => {
  if (!coverState.imageReady) return
  if (coverUploadTimeout) {
    clearTimeout(coverUploadTimeout)
    coverUploadTimeout = null
  }
  coverUploadTimeout = setTimeout(() => {
    performCoverUpload()
  }, immediate ? 150 : 600)
}

const triggerVideoUpload = () => {
  saveSelection()
  videoInput.value?.click()
}

const handleVideoChange = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  videoUploadMessage.value = 'Processing video…'
  try {
    const prepared = await transcodeVideoForIOS(file)
    const meta = await uploadFileToStorage('editor', prepared)
    mediaItems.value = [...mediaItems.value, { ...meta, type: 'video' }]
    insertVideoIntoEditor(meta)
    videoUploadMessage.value = `Video uploaded • ${meta.fileName}`
  } catch (error) {
    console.error(error)
    videoUploadMessage.value = 'Video upload failed.'
  } finally {
    event.target.value = ''
  }
}

const ensureVideoHandles = (figureEl) => {
  if (!figureEl) return
  if (!figureEl.querySelector('.video-insert-handle--top')) {
    const topHandle = document.createElement('div')
    topHandle.className = 'video-insert-handle video-insert-handle--top'
    topHandle.dataset.position = 'before'
    figureEl.insertBefore(topHandle, figureEl.firstChild)
  }
  if (!figureEl.querySelector('.video-insert-handle--bottom')) {
    const bottomHandle = document.createElement('div')
    bottomHandle.className = 'video-insert-handle video-insert-handle--bottom'
    bottomHandle.dataset.position = 'after'
    figureEl.appendChild(bottomHandle)
  }
}

const decorateVideoFigures = () => {
  if (!editor.value) return
  editor.value.querySelectorAll('figure.wysiwyg-video').forEach((figure) => ensureVideoHandles(figure))
}

const insertParagraphAroundVideo = (figureEl, before) => {
  if (!editor.value || !figureEl?.parentNode) return
  const paragraph = document.createElement('p')
  paragraph.innerHTML = '<br>'
  if (before) {
    figureEl.parentNode.insertBefore(paragraph, figureEl)
  } else if (figureEl.nextSibling) {
    figureEl.parentNode.insertBefore(paragraph, figureEl.nextSibling)
  } else {
    figureEl.parentNode.appendChild(paragraph)
  }
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  saveSelection()
  handleEditorInput()
}

const insertVideoIntoEditor = (meta) => {
  if (!editor.value) return
  editor.value.focus()
  restoreSelection()
  const html = `
    <figure class="wysiwyg-video">
      <div class="video-insert-handle video-insert-handle--top" data-position="before"></div>
      <video
        src="${meta.downloadUrl}"
        controls
        playsinline
        webkit-playsinline
        preload="metadata"
        data-storage-path="${meta.storagePath}"
        data-file-name="${meta.fileName}"
        style="max-width: 100%; width: 100%;"
      ></video>
      <div class="video-insert-handle video-insert-handle--bottom" data-position="after"></div>
    </figure>
  `
  const inserted = document.execCommand('insertHTML', false, html)
  if (!inserted) {
    editor.value.insertAdjacentHTML('beforeend', html)
  }
  const inputEvent = new Event('input', { bubbles: true })
  editor.value.dispatchEvent(inputEvent)
  nextTick(() => {
    handleEditorInput()
    saveSelection()
    decorateVideoFigures()
  })
}

const clearActiveVideo = () => {
  activeVideo.value = null
}

const updateActiveVideoWidth = () => {
  if (!activeVideo.value) return
  activeVideo.value.style.maxWidth = `${videoWidthPct.value}%`
  activeVideo.value.style.width = '100%'
  activeVideo.value.style.margin = '0 auto'
  if (activeVideo.value.closest('.wysiwyg-video')) {
    activeVideo.value.closest('.wysiwyg-video').style.textAlign = 'center'
  }
  handleEditorInput()
}

const onEditorClick = (event) => {
  const handleEl = event.target?.closest('.video-insert-handle')
  if (handleEl && editor.value?.contains(handleEl)) {
    const figureEl = handleEl.closest('figure.wysiwyg-video')
    if (figureEl) {
      insertParagraphAroundVideo(figureEl, handleEl.dataset.position === 'before')
    }
    event.preventDefault()
    return
  }

  const videoEl = event.target?.closest('video')
  if (!videoEl || !editor.value?.contains(videoEl)) {
    activeVideo.value = null
    return
  }
  activeVideo.value = videoEl
  const rawWidth = parseFloat(videoEl.style.maxWidth?.replace('%', '')) || 100
  videoWidthPct.value = Math.min(100, Math.max(40, rawWidth))
}

const saveSelection = () => {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange()
  }
}

const restoreSelection = () => {
  const selection = window.getSelection()
  if (selection && savedRange) {
    selection.removeAllRanges()
    selection.addRange(savedRange)
  }
}

const applyFormat = (command, value = null) => {
  document.execCommand(command, false, value)
  editor.value?.focus()
  saveSelection()
  handleEditorInput()
}

const applyFont = () => {
  if (selectedFont.value) {
    document.execCommand('fontName', false, selectedFont.value)
  } else {
    document.execCommand('removeFormat', false, null)
  }
  editor.value?.focus()
  saveSelection()
  handleEditorInput()
}

const applyHeading = () => {
  const tag = selectedHeading.value || 'P'
  document.execCommand('formatBlock', false, tag)
  editor.value?.focus()
  saveSelection()
  handleEditorInput()
}

const handleEditorInput = () => {
  contentHtml.value = getEditorHtml()
}

const openLinkDialog = () => {
  const url = window.prompt('Enter URL')
  if (url) {
    document.execCommand('createLink', false, url)
  }
  editor.value?.focus()
  saveSelection()
  handleEditorInput()
}

const triggerContentImage = () => {
  saveSelection()
  contentImageInput.value?.click()
}

const handleContentImage = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const value = e.target?.result
    if (!value) return
    restoreSelection()
    document.execCommand('insertImage', false, value)
    editor.value?.focus()
    saveSelection()
    handleEditorInput()
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

const hydrateCoverFromRemote = async (url, fileName) => {
  try {
    const response = await fetch(url, { mode: 'cors' })
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    coverName.value = fileName || 'cover'
    loadCoverImage(objectUrl, fileName || 'cover')
  } catch (error) {
    console.warn('Unable to hydrate cover from remote', error)
    coverState.uploadError = 'Unable to load cover for editing.'
    coverUploadMessage.value = 'Cover preview unavailable.'
  }
}

const loadArticleIfNeeded = async () => {
  const id = route.query.id
  if (!id) {
    resetEditor()
    return
  }
  isLoading.value = true
  loadError.value = ''
  resetEditor()
  try {
    const fetchArticle = httpsCallable(functions, 'getNewsArticle')
    const response = await fetchArticle({ id })
    const article = response.data?.article
    if (!article) {
      throw new Error('Article not found.')
    }

    title.value = article.title || ''
    contentHtml.value = article.contentHtml || ''
    mediaItems.value = Array.isArray(article.media) ? article.media : []
    coverMeta.value = article.coverImage || null
    if (article.coverImage?.downloadUrl) {
      coverPreviewUrl.value = article.coverImage.downloadUrl
      await hydrateCoverFromRemote(article.coverImage.downloadUrl, article.coverImage.fileName || 'cover')
    }

    await nextTick()
    if (editor.value) {
      editor.value.innerHTML = contentHtml.value
      decorateVideoFigures()
      handleEditorInput()
    }
  } catch (error) {
    console.error(error)
    loadError.value = error.message || 'Unable to load article.'
    resetEditor()
  } finally {
    isLoading.value = false
  }
}

watch(
  () => route.query.id,
  () => {
    loadArticleIfNeeded()
  },
  { immediate: true }
)

watch(
  () => coverState.zoom,
  (newZoom, oldZoom) => {
    if (!coverState.imageReady) return
    if (typeof oldZoom === 'number') {
      const prevWidth = coverState.naturalWidth * oldZoom
      const prevHeight = coverState.naturalHeight * oldZoom
      if (prevWidth && prevHeight) {
        const centerXRatio = (coverState.containerWidth / 2 - coverState.position.x) / prevWidth
        const centerYRatio = (coverState.containerHeight / 2 - coverState.position.y) / prevHeight
        const newWidth = coverState.naturalWidth * newZoom
        const newHeight = coverState.naturalHeight * newZoom
        coverState.position.x = coverState.containerWidth / 2 - centerXRatio * newWidth
        coverState.position.y = coverState.containerHeight / 2 - centerYRatio * newHeight
      }
    }
    clampPosition()
    scheduleCoverUpload()
  }
)

watch(
  () => [coverState.position.x, coverState.position.y],
  () => {
    if (!coverState.dragging) {
      scheduleCoverUpload()
    }
  }
)

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (coverUploadTimeout) {
    clearTimeout(coverUploadTimeout)
  }
  if (coverState.displaySource && coverState.displaySource.startsWith('blob:')) {
    URL.revokeObjectURL(coverState.displaySource)
  }
  if (editor.value) {
    editor.value.removeEventListener('click', onEditorClick)
  }
  document.removeEventListener('click', handleDocumentClick)
})

const handleDocumentClick = (event) => {
  if (!editor.value) return
  if (editor.value.contains(event.target)) return
  activeVideo.value = null
}

nextTick(() => {
  if (editor.value) {
    editor.value.addEventListener('click', onEditorClick)
  }
  document.addEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.news-editor {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  color: #f0f4f8;
}

.editor-header {
  margin-bottom: 2rem;
  text-align: center;
}

.editor-header h1 {
  font-size: 2.8rem;
  margin-bottom: 0.5rem;
}

.editor-subtitle {
  font-size: 1.05rem;
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

.editor-layout {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.editor-form {
  background: rgba(17, 27, 39, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.editor-label {
  display: block;
  font-weight: 600;
  color: rgba(240, 244, 248, 0.9);
  margin-bottom: 0.75rem;
}

.title-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(13, 20, 30, 0.9);
  color: inherit;
  padding: 0.85rem 1rem;
  font-size: 1.15rem;
  transition: border-color 0.2s ease;
}

.title-input:focus {
  outline: none;
  border-color: #4ee080;
  box-shadow: 0 0 0 3px rgba(78, 224, 128, 0.2);
}

.media-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.media-header h2 {
  font-size: 1.25rem;
  margin-bottom: 0.2rem;
}

.media-header p {
  font-size: 0.95rem;
  color: rgba(240, 244, 248, 0.65);
}

.cover-controls,
.video-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.cover-name {
  font-size: 0.9rem;
  color: rgba(240, 244, 248, 0.75);
}

.cover-hint,
.video-hint {
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.6);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
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

.crop-stage {
  position: relative;
  width: 100%;
  aspect-ratio: calc(4 / 2.3);
  background: rgba(12, 19, 30, 0.85);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
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
  border-radius: 18px;
  pointer-events: none;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 14, 22, 0.45);
  color: rgba(240, 244, 248, 0.9);
  font-size: 0.95rem;
}

.crop-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.crop-controls input[type='range'] {
  width: 180px;
}

.video-width-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.video-width-controls input[type='range'] {
  flex: 1;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(10, 16, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 0.85rem 1rem;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
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
  gap: 0.2rem;
  font-size: 0.85rem;
}

.underline {
  text-decoration: underline;
}

.strike {
  text-decoration: line-through;
}

.editor-surface {
  min-height: 360px;
  padding: 1.25rem 1.5rem;
  background: rgba(9, 14, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  color: #f0f4f8;
  line-height: 1.7;
}

.editor-surface:focus {
  outline: none;
  border-color: #4ee080;
  box-shadow: 0 0 0 3px rgba(78, 224, 128, 0.2);
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.primary-button {
  padding: 0.65rem 1.5rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #4ee080, #2ecc71);
  color: #09161e;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.primary-button:not(:disabled):hover,
.primary-button:not(:disabled):focus {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(78, 224, 128, 0.35);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: progress;
  box-shadow: none;
}

.save-message {
  font-size: 0.9rem;
}

.save-message.success {
  color: #4ee080;
}

.save-message.error {
  color: #ff7b7b;
}

.editor-surface :deep(img) {
  max-width: 100%;
  border-radius: 14px;
  margin: 1rem 0;
}

.editor-surface :deep(video) {
  display: block;
  max-width: 100%;
  border-radius: 14px;
  margin: 1.5rem auto;
  background: rgba(0, 0, 0, 0.2);
}

.editor-surface :deep(figure.wysiwyg-video) {
  margin: 1.5rem 0;
}

.editor-surface :deep(.video-insert-handle) {
  display: block;
  height: 12px;
  cursor: text;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.editor-surface :deep(.video-insert-handle--top) {
  margin-bottom: 6px;
}

.editor-surface :deep(.video-insert-handle--bottom) {
  margin-top: 6px;
}

.editor-surface :deep(.video-insert-handle:hover) {
  background: rgba(78, 224, 128, 0.18);
}

.preview-panel {
  background: rgba(12, 20, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 1.75rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 420px;
  align-self: center;
}

.preview-panel h2 {
  font-size: 1.4rem;
  text-align: center;
}

.preview-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-card-mobile {
  background: rgba(9, 14, 22, 0.92);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: hidden;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 560px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.preview-card-mobile::-webkit-scrollbar {
  display: none;
}

.preview-cover {
  position: relative;
  background: rgba(12, 20, 30, 0.85);
}

.preview-cover img {
  width: 100%;
  display: block;
}

.preview-cover--empty {
  height: 180px;
}

.preview-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  color: rgba(240, 244, 248, 0.6);
  padding: 0 1.5rem;
  text-align: center;
}

.preview-card-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-card-body h3 {
  font-size: 1.2rem;
}

.preview-card-body p {
  font-size: 0.95rem;
  color: rgba(240, 244, 248, 0.75);
}

.preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.6);
}

.preview-engagement {
  display: flex;
  gap: 0.75rem;
}

.icon-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.icon-row svg {
  width: 18px;
  height: 18px;
}

.preview-detail {
  background: rgba(9, 14, 22, 0.92);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 560px;
  width: 100%;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: rgba(12, 20, 30, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.detail-header h3 {
  margin-top: 0.4rem;
}

.detail-label {
  font-size: 0.85rem;
  color: rgba(240, 244, 248, 0.6);
}

.detail-engagement {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.detail-cover {
  background: rgba(12, 19, 30, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
}

.detail-cover img {
  width: 100%;
  display: block;
}

.detail-cover--empty {
  background: rgba(255, 255, 255, 0.05);
}

.detail-content {
  flex: 1;
  overflow-y: hidden;
  padding: 1.25rem 1.5rem;
}

.detail-content :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.6;
  font-size: 0.95rem;
}

.detail-content :deep(img) {
  display: block;
  max-width: 100%;
  border-radius: 14px;
  margin: 1rem 0;
}

.detail-content :deep(video) {
  display: block;
  max-width: 100%;
  border-radius: 14px;
  margin: 1.25rem auto;
  height: auto;
}

@media (max-width: 768px) {
  .editor-form {
    padding: 1.5rem;
  }
  .preview-panel {
    padding: 1.25rem;
  }
}
</style>
