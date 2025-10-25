<template>
		<div class="news-wrapper">
			<video ref="videoRef" class="background-video" autoplay muted loop playsinline>
				<source src="/website background - home.mp4" type="video/mp4" />
			</video>
			<h1 class="homepage-title">Dev Tools</h1>
			<p class="homepage-p description">
				Stay updated with internal release notes, roadmap highlights, and developer announcements.
			</p>
			<section class="news-card card-standard token-card">
				<h2>Unity Plugin Token</h2>
				<p class="homepage-p muted">
					Use this token to sign into our Unity plugins and connected developer tools.
				</p>
				<div class="token-display" aria-live="polite">
					<span class="token-value" :class="{ placeholder: !firebaseCustomToken }" :title="firebaseCustomToken || ''">
						{{ truncatedFirebaseToken || 'Token not available. Sign in to generate one.' }}
					</span>
				<div class="token-actions">
					<button
						class="copy-button"
						type="button"
						@click="copyFirebaseToken"
						:disabled="!firebaseCustomToken"
					>
						{{ firebaseCopyFeedback }}
					</button>
					<button
						class="secondary-button"
						type="button"
						@click="mintFirebaseToken"
						:disabled="isMintingFirebaseToken || !isAuthenticated"
					>
						{{ refreshButtonText }}
					</button>
				</div>
			</div>
			<p class="homepage-p helper-text">
				Mint a new token whenever you need to authenticate against Firebase with SignInWithCustomToken.
			</p>
			<p v-if="mintErrorMessage" class="homepage-p error-text">
				{{ mintErrorMessage }}
			</p>
		</section>

		<section class="news-card card-standard">
			<h2>Coming Soon</h2>
			<p class="homepage-p muted">
				We’re curating the latest milestones and developer logs. Check back soon for updates.
			</p>
		</section>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'

const videoRef = ref(null)
const store = useStore()

const firebaseCustomToken = computed(() => store.getters['user/firebaseCustomToken'] || '')
const truncatedFirebaseToken = computed(() => {
	const token = firebaseCustomToken.value || ''
	if (!token) {
		return ''
	}
	if (token.length <= 24) {
		return token
	}
	return `${token.slice(0, 12)}...${token.slice(-8)}`
})
const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])

const firebaseCopyFeedback = ref('Unavailable')
const refreshButtonText = ref('Mint')
const isMintingFirebaseToken = ref(false)
const mintErrorMessage = ref('')

const timers = {
	firebase: null,
	mint: null
}

const defaultFeedback = {
	firebase: () => (firebaseCustomToken.value ? 'Copy' : 'Unavailable')
}

const resetFirebaseFeedback = () => {
	if (timers.firebase) {
		clearTimeout(timers.firebase)
		timers.firebase = null
	}
	firebaseCopyFeedback.value = defaultFeedback.firebase()
}

watch(
	firebaseCustomToken,
	() => {
		resetFirebaseFeedback()
		if (firebaseCustomToken.value) {
			mintErrorMessage.value = ''
		}
	},
	{ immediate: true }
)

const copyValue = async (value, feedbackRef, timerKey, label) => {
	if (!value) return

	if (!navigator?.clipboard?.writeText) {
		feedbackRef.value = 'Copy unavailable'
		return
	}

	try {
		await navigator.clipboard.writeText(value)
		feedbackRef.value = 'Copied!'
	} catch (error) {
		feedbackRef.value = 'Copy failed'
		console.error(`Failed to copy ${label}`, error)
		return
	}

	if (timers[timerKey]) {
		clearTimeout(timers[timerKey])
	}

	timers[timerKey] = setTimeout(() => {
		if (timerKey === 'firebase') {
			resetFirebaseFeedback()
		}
	}, 2000)
}

const copyFirebaseToken = () =>
	copyValue(firebaseCustomToken.value, firebaseCopyFeedback, 'firebase', 'Unity plugin credential')

const ensureMintButtonReset = () => {
	if (timers.mint) {
		clearTimeout(timers.mint)
		timers.mint = null
	}
	refreshButtonText.value = 'Mint'
}

const mintFirebaseToken = async () => {
	if (isMintingFirebaseToken.value) {
		return
	}

	isMintingFirebaseToken.value = true
	refreshButtonText.value = 'Minting...'

	try {
		const token = await store.dispatch('user/generateFirebaseCustomToken')
		if (token) {
			refreshButtonText.value = 'Minted'
			mintErrorMessage.value = ''
		} else {
			refreshButtonText.value = 'Unavailable'
			mintErrorMessage.value = 'Custom token unavailable. Please try again.'
		}
	} catch (error) {
		refreshButtonText.value = 'Mint failed'
		console.error('Failed to mint Firebase custom token', error)
		mintErrorMessage.value = 'Mint failed. Please check your access and try again.'
	}

	if (timers.mint) {
		clearTimeout(timers.mint)
	}

	timers.mint = setTimeout(() => {
		refreshButtonText.value = 'Mint'
	}, 2000)

	isMintingFirebaseToken.value = false
}

onMounted(() => {
	const video = videoRef.value
	if (video) {
		video.playbackRate = 0.6
	}
	if (isAuthenticated.value && !firebaseCustomToken.value) {
		mintFirebaseToken().catch((error) => {
			console.error('Failed to mint Firebase custom token on mount', error)
			ensureMintButtonReset()
			mintErrorMessage.value = 'Mint failed. Please check your access and try again.'
		})
	}
})

onBeforeUnmount(() => {
	const video = videoRef.value
	if (video) {
		video.pause()
	}
	Object.keys(timers).forEach((key) => {
		if (timers[key]) {
			clearTimeout(timers[key])
			timers[key] = null
		}
	})
})

watch(isAuthenticated, (authed) => {
	if (!authed) {
		if (isMintingFirebaseToken.value) {
			isMintingFirebaseToken.value = false
		}
		ensureMintButtonReset()
		mintErrorMessage.value = ''
		return
	}

	if (!firebaseCustomToken.value) {
		mintFirebaseToken().catch((error) => {
			console.error('Failed to mint Firebase custom token after auth change', error)
			ensureMintButtonReset()
			mintErrorMessage.value = 'Mint failed. Please check your access and try again.'
		})
	}
})
</script>

<style scoped>
	.background-video {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -2;
		background-color: #000;
	}

	.news-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: min(960px, 100%);
		padding: 0 16px 2rem;
		box-sizing: border-box;
		margin: 0 auto;
	}

	.description {
		max-width: 640px;
		margin: 0 auto;
		color: #b9bcc3;
	}

	.news-card {
		width: min(100%, 540px);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		text-align: center;
	}

	.muted {
		color: #c6cad3;
	}

	.token-card {
		align-items: stretch;
	}

	.token-display {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border: 1px solid #2a2f3b;
		border-radius: 0.75rem;
		background: rgba(7, 12, 24, 0.65);
		box-shadow: inset 0 0 0 1px rgba(115, 165, 255, 0.1);
		backdrop-filter: blur(6px);
	}

	.token-value {
		font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			'Liberation Mono', 'Courier New', monospace;
		font-size: 0.95rem;
		word-break: break-all;
		color: #e4e8f4;
	}

	.token-value.placeholder {
		color: #788197;
	}

.token-actions {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	flex-wrap: wrap;
	justify-content: flex-end;
}

	.token-actions.single-action {
		gap: 0;
	}

	.copy-button,
	.secondary-button {
		flex-shrink: 0;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: #05080f;
		background: linear-gradient(135deg, #8ec5ff 0%, #4f8bff 100%);
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
	}

	.secondary-button {
		background: rgba(69, 96, 150, 0.35);
		color: #cfd8f9;
		border: 1px solid rgba(142, 197, 255, 0.3);
	}

	.secondary-button:not(:disabled):hover {
		background: rgba(142, 197, 255, 0.2);
		box-shadow: 0 6px 12px rgba(79, 139, 255, 0.25);
		transform: translateY(-1px);
	}

	@media (max-width: 640px) {
		.token-display {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.token-actions {
			width: 100%;
			justify-content: stretch;
		}

		.copy-button,
		.secondary-button {
			width: 100%;
		}
	}

	.copy-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.copy-button:not(:disabled):hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 16px rgba(79, 139, 255, 0.35);
	}

	.secondary-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.helper-text {
		font-size: 0.85rem;
		color: #98a3bb;
		margin: 0;
	}

	.error-text {
		font-size: 0.85rem;
		color: #f87171;
		margin: 0.5rem 0 0;
	}
</style>
