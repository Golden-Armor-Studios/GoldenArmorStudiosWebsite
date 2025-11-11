<template>
  <div class="news-video-player" :data-context="normalizedContext">
    <div
      ref="playerRef"
      class="news-video-player__inner"
      @mousemove="handlePointerActivity"
      @mouseenter="handlePointerActivity"
      @mouseleave="handlePointerLeave"
      @touchstart.passive="handlePointerActivity"
      @focusin="handlePointerActivity"
    >
      <video
        ref="videoEl"
        class="news-video-player__video"
        :src="src"
        :poster="poster || undefined"
        preload="metadata"
        playsinline
        webkit-playsinline
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @volumechange="onVolumeChange"
        @seeking="onSeeking"
      ></video>

      <button
        v-if="showOverlayPlay"
        type="button"
        class="news-video-player__big-play"
        @click="() => togglePlay('overlay')"
        aria-label="Play video"
      >
        <img class="news-video-player__big-play-image" src="/PlayerPlayIcon.png" alt="" aria-hidden="true" />
      </button>

      <div
        class="news-video-player__controls"
        :class="{ 'news-video-player__controls--visible': controlsVisible }"
      >
        <button
          type="button"
          class="control-button"
          @click="() => togglePlay('controls')"
          :aria-label="isPlaying ? 'Pause video' : 'Play video'"
        >
          <svg v-if="!isPlaying" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 3.2v11.6L14.2 9 4 3.2Z" fill="currentColor" />
          </svg>
          <svg v-else viewBox="0 0 18 18" aria-hidden="true">
            <rect x="4" y="3" width="3" height="12" rx="1" fill="currentColor" />
            <rect x="11" y="3" width="3" height="12" rx="1" fill="currentColor" />
          </svg>
        </button>

        <div class="progress-group">
          <input
            class="progress-slider"
            type="range"
            min="0"
            :max="Math.max(duration, 0.1)"
            step="0.1"
            :value="scrubValue"
            @input="handleScrub"
            @change="commitScrub"
            aria-label="Seek video"
          />
          <span class="timecode">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        </div>

        <button
          type="button"
          class="control-button"
          @click="toggleMute"
          :aria-label="isMuted ? 'Unmute video' : 'Mute video'"
        >
          <svg v-if="isMuted" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="m11.5 6.5 4 4m0-4-4 4m-2.5-8-4.1 3.3H3v5.4h1.9l4.1 3.3V2.5Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
          <svg v-else viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M9 2.5 4.9 5.8H3v5.4h1.9L9 14.5V2.5Zm5 2.8c1 .9 1.6 2.2 1.6 3.7 0 1.4-.6 2.7-1.6 3.6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
        </button>

        <button
          v-if="fullscreenButtonVisible"
          type="button"
          class="control-button"
          @click="toggleFullscreen"
          :aria-label="isFullscreen ? 'Exit full screen' : 'Enter full screen'"
        >
          <svg v-if="!isFullscreen" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M6.5 3H3v3.5M11.5 3H15v3.5M3 11.5V15h3.5M11.5 15H15v-3.5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
          <svg v-else viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M7 4H4v3m7-3h3v3M7 14H4v-3m7 3h3v-3"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  poster: {
    type: String,
    default: null
  },
  title: {
    type: String,
    default: ''
  },
  context: {
    type: String,
    default: ''
  }
})

const videoEl = ref(null)
const playerRef = ref(null)
const isPlaying = ref(false)
const isMuted = ref(false)
const isFullscreen = ref(false)
const duration = ref(0)
const currentTime = ref(0)
const scrubbing = ref(false)
const pendingScrub = ref(0)
const skipNextSeekEvent = ref(false)
const controlsVisible = ref(true)
const pointerInside = ref(false)
let hideControlsTimer = null

const normalizedContext = computed(() => (props.context || '').trim() || 'News')
const analyticsTitle = computed(() => {
  if (normalizedContext.value.toLowerCase() === 'editor') {
    return 'Editor'
  }
  return props.title?.trim() || 'Untitled Video'
})

const buildCategory = (action) => `${analyticsTitle.value} - ${action}`

const reportEvent = (action, extra = {}) => {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', action, {
    event_category: buildCategory(action),
    event_label: props.src,
    video_context: normalizedContext.value,
    video_title: analyticsTitle.value,
    ...extra
  })
}

const showOverlayPlay = computed(() => !isPlaying.value)
const scrubValue = computed(() => (scrubbing.value ? pendingScrub.value : currentTime.value))

const formatTime = (value) => {
  if (!Number.isFinite(value)) return '0:00'
  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const clearHideTimer = () => {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }
}

const scheduleHideControls = (delay = 2400) => {
  clearHideTimer()
  if (!isPlaying.value) {
    controlsVisible.value = true
    return
  }
  hideControlsTimer = setTimeout(() => {
    controlsVisible.value = false
  }, delay)
}

const handlePointerActivity = () => {
  pointerInside.value = true
  controlsVisible.value = true
  scheduleHideControls()
}

const handlePointerLeave = () => {
  pointerInside.value = false
  if (!isPlaying.value) return
  clearHideTimer()
  controlsVisible.value = false
}

const syncMutedState = () => {
  if (!videoEl.value) return
  isMuted.value = Boolean(videoEl.value.muted)
}

const resetPlayerState = () => {
  clearHideTimer()
  isPlaying.value = false
  isMuted.value = false
  isFullscreen.value = false
  duration.value = 0
  currentTime.value = 0
  scrubbing.value = false
  pendingScrub.value = 0
  skipNextSeekEvent.value = false
  controlsVisible.value = true
}

const togglePlay = async (source = 'controls') => {
  if (!videoEl.value) return
  if (isPlaying.value) {
    reportEvent('video_pause_button', { source })
    videoEl.value.pause()
    return
  }
  reportEvent('video_play_button', { source })
  try {
    const playPromise = videoEl.value.play()
    if (playPromise?.catch) {
      await playPromise
    }
  } catch (error) {
    reportEvent('video_play_error', {
      source,
      error_message: error?.message || 'playback_failed'
    })
  }
}

const toggleMute = () => {
  if (!videoEl.value) return
  const nextMuted = !videoEl.value.muted
  videoEl.value.muted = nextMuted
  reportEvent(nextMuted ? 'video_mute_button' : 'video_unmute_button')
}

const supportsFullscreen = () => {
  if (typeof document === 'undefined') return false
  if (videoEl.value?.webkitEnterFullscreen) return true
  if (playerRef.value?.requestFullscreen) return true
  if (playerRef.value?.webkitRequestFullscreen) return true
  return Boolean(document.fullscreenEnabled)
}

const fullscreenButtonVisible = computed(() => supportsFullscreen())

const requestFullscreen = async () => {
  if (playerRef.value?.requestFullscreen) {
    await playerRef.value.requestFullscreen()
    return true
  }
  if (playerRef.value?.webkitRequestFullscreen) {
    playerRef.value.webkitRequestFullscreen()
    return true
  }
  if (videoEl.value?.webkitEnterFullscreen) {
    videoEl.value.webkitEnterFullscreen()
    return true
  }
  return false
}

const exitFullscreen = async () => {
  if (typeof document !== 'undefined' && document.fullscreenElement) {
    await document.exitFullscreen()
    return true
  }
  if (videoEl.value?.webkitExitFullscreen) {
    videoEl.value.webkitExitFullscreen()
    return true
  }
  return false
}

const toggleFullscreen = async () => {
  if (isFullscreen.value) {
    reportEvent('video_fullscreen_exit_button')
    const success = await exitFullscreen()
    if (!success) {
      reportEvent('video_fullscreen_exit_denied')
    }
    return
  }
  reportEvent('video_fullscreen_enter_button')
  const success = await requestFullscreen()
  if (!success) {
    reportEvent('video_fullscreen_denied')
  }
}

const onPlay = () => {
  isPlaying.value = true
  controlsVisible.value = true
  scheduleHideControls(pointerInside.value ? 1000 : 250)
  reportEvent('video_play')
}

const onPause = () => {
  isPlaying.value = false
  controlsVisible.value = true
  clearHideTimer()
  const current = videoEl.value?.currentTime || 0
  reportEvent('video_pause', { value: Math.floor(current) })
}

const onEnded = () => {
  isPlaying.value = false
  controlsVisible.value = true
  clearHideTimer()
  const total = videoEl.value?.duration || 0
  reportEvent('video_complete', { value: Math.floor(total) })
}

const onVolumeChange = () => {
  syncMutedState()
  reportEvent(isMuted.value ? 'video_mute' : 'video_unmute')
}

const onSeeking = () => {
  if (skipNextSeekEvent.value) {
    skipNextSeekEvent.value = false
    return
  }
  if (scrubbing.value) return
  reportEvent('video_seek', { value: Math.floor(videoEl.value?.currentTime || 0) })
}

const onLoadedMetadata = () => {
  if (!videoEl.value) return
  duration.value = Number.isFinite(videoEl.value.duration) ? videoEl.value.duration : 0
  currentTime.value = Number.isFinite(videoEl.value.currentTime) ? videoEl.value.currentTime : 0
  syncMutedState()
}

const onTimeUpdate = () => {
  if (scrubbing.value) return
  currentTime.value = videoEl.value?.currentTime || 0
}

const handleScrub = (event) => {
  const value = Number(event.target.value)
  scrubbing.value = true
  skipNextSeekEvent.value = false
  pendingScrub.value = Number.isFinite(value) ? value : 0
  currentTime.value = pendingScrub.value
}

const commitScrub = async (event) => {
  const value = Number(event.target.value)
  scrubbing.value = false
  pendingScrub.value = 0
  if (!videoEl.value || !Number.isFinite(value)) {
    skipNextSeekEvent.value = false
    return
  }
  skipNextSeekEvent.value = true
  videoEl.value.currentTime = value
  currentTime.value = value
  reportEvent('video_seek', { value: Math.floor(value), interaction: 'scrub' })
  if (isPlaying.value) {
    try {
      const playPromise = videoEl.value.play()
      if (playPromise?.catch) await playPromise
    } catch (error) {
      reportEvent('video_play_error', {
        source: 'seek-resume',
        error_message: error?.message || 'playback_failed'
      })
    }
  }
  setTimeout(() => {
    skipNextSeekEvent.value = false
  }, 0)
}

const onDocumentFullscreenChange = () => {
  if (typeof document === 'undefined') return
  const active =
    document.fullscreenElement === playerRef.value ||
    document.fullscreenElement === videoEl.value ||
    document.webkitFullscreenElement === playerRef.value
  if (active) {
    isFullscreen.value = true
    reportEvent('video_fullscreen_enter')
    scheduleHideControls()
  } else if (isFullscreen.value) {
    isFullscreen.value = false
    reportEvent('video_fullscreen_exit')
    controlsVisible.value = true
    clearHideTimer()
  }
}

const onWebkitBeginFullscreen = () => {
  isFullscreen.value = true
  reportEvent('video_fullscreen_enter', { method: 'webkit' })
  scheduleHideControls()
}

const onWebkitEndFullscreen = () => {
  if (!isFullscreen.value) return
  isFullscreen.value = false
  reportEvent('video_fullscreen_exit', { method: 'webkit' })
  controlsVisible.value = true
  clearHideTimer()
}

const bindFullscreenListeners = () => {
  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', onDocumentFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onDocumentFullscreenChange)
  }
  if (videoEl.value) {
    videoEl.value.addEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen)
    videoEl.value.addEventListener('webkitendfullscreen', onWebkitEndFullscreen)
  }
}

const unbindFullscreenListeners = () => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onDocumentFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onDocumentFullscreenChange)
  }
  if (videoEl.value) {
    videoEl.value.removeEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen)
    videoEl.value.removeEventListener('webkitendfullscreen', onWebkitEndFullscreen)
  }
}

onMounted(() => {
  nextTick(() => {
    syncMutedState()
    scheduleHideControls()
  })
  bindFullscreenListeners()
})

onBeforeUnmount(() => {
  clearHideTimer()
  unbindFullscreenListeners()
})

watch(
  () => props.src,
  async () => {
    resetPlayerState()
    await nextTick()
    if (videoEl.value) {
      videoEl.value.load()
    }
  }
)
</script>

<style scoped>
.news-video-player {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  background: #01060e;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
}

.news-video-player__inner {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
}

.news-video-player__video {
  display: block;
  width: 100%;
  height: auto;
  background: #000;
}

.news-video-player__big-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  transition: background 0.25s ease;
  border: none;
  cursor: pointer;
}

.news-video-player__big-play-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.news-video-player__big-play:hover,
.news-video-player__big-play:focus-visible {
  background: rgba(0, 0, 0, 0.72);
  outline: none;
}

.news-video-player__controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(180deg, rgba(2, 8, 18, 0) 0%, rgba(2, 8, 18, 0.82) 100%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.news-video-player__controls--visible {
  opacity: 1;
  pointer-events: auto;
}

.control-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #f0f4f8;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.control-button:hover,
.control-button:focus-visible {
  background: rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
  outline: none;
}

.control-button svg {
  width: 18px;
  height: 18px;
}

.progress-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.progress-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  outline: none;
}

.progress-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4ee080;
  box-shadow: 0 0 0 4px rgba(78, 224, 128, 0.25);
  cursor: pointer;
}

.progress-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4ee080;
  border: none;
  box-shadow: 0 0 0 4px rgba(78, 224, 128, 0.25);
  cursor: pointer;
}

.timecode {
  font-size: 0.8rem;
  color: rgba(240, 244, 248, 0.85);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .news-video-player__controls {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .progress-group {
    order: 3;
    width: 100%;
  }

  .timecode {
    font-size: 0.75rem;
  }
}
</style>
