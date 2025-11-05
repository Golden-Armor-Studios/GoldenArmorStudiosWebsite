<template>
  <section class="news-editor">
    <header class="editor-header">
      <h1>News Editor</h1>
      <p class="editor-subtitle">
        Craft announcements with rich formatting, embedded media, and a featured cover image.
      </p>
    </header>

    <form class="editor-form" @submit.prevent>
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
import { ref } from 'vue'

const title = ref('')
const coverPreview = ref('')
const coverName = ref('')
const contentHtml = ref('')
const selectedFont = ref('')
const selectedHeading = ref('P')

const coverInput = ref(null)
const contentImageInput = ref(null)
const editor = ref(null)

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
    coverPreview.value = e.target?.result || ''
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
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.cover-preview img {
  width: 100%;
  display: block;
}

.toolbar {
  background: rgba(10, 16, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
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
  font-size: 1.6rem;
  margin-bottom: 1.25rem;
}

.preview-card {
  background: rgba(9, 14, 22, 0.92);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4);
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
}

.preview-content :deep(img) {
  max-width: 100%;
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
}
</style>
