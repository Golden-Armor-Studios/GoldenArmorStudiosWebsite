<template>
	<div class="login-wrapper">
		<h1 class="homepage-title">Member Login</h1>
		<p class="homepage-p guidance">
			Sign in with GitHub to continue.
		</p>
		<p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
		<div class="actions-row">
			<button
				type="button"
				class="github-button"
				@click="handleGithubLogin"
				:disabled="isGithubLoading"
			>
				<span class="github-button__content">
					<svg
						v-if="!isGithubLoading"
						class="github-icon"
						viewBox="0 0 16 16"
						aria-hidden="true"
					>
						<path
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
							fill="currentColor"
						/>
					</svg>
					<span>
						<span v-if="isGithubLoading">Connecting to GitHub...</span>
						<span v-else>Sign in with GitHub</span>
					</span>
				</span>
			</button>
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import { useRoute, useRouter } from 'vue-router'
	import { useStore } from 'vuex'
	import { useToast } from 'vue-toastification'

	const store = useStore()
	const router = useRouter()
	const route = useRoute()
	const toast = useToast()

	const errorMessage = ref('')
	const isGithubLoading = ref(false)

	const handleGithubLogin = async () => {
		errorMessage.value = ''
		isGithubLoading.value = true

		try {
		await store.dispatch('user/loginWithGithub')
		toast.success('Signed in with GitHub!')
		router.push({ path: typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard' })
		} catch (error) {
			errorMessage.value = error?.message ?? 'Unable to sign in with GitHub.'
			toast.error(errorMessage.value)
		} finally {
			isGithubLoading.value = false
		}
	}
</script>

<style scoped>
	.login-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.guidance {
		max-width: 320px;
		color: #d0d4dc;
	}

	.github-button {
		padding: 0.7rem 1.1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-weight: 700;
		cursor: pointer;
		transition: filter 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
	}

	.github-button:disabled {
		cursor: not-allowed;
		filter: grayscale(0.5);
	}

	.github-button {
		background: #24292f;
		color: #f5f8fa;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: min(320px, 90vw);
		gap: 0.75rem;
		box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35);
	}

	.github-button:not(:disabled):hover {
		filter: brightness(1.1);
		box-shadow: 0 14px 28px rgba(0, 0, 0, 0.4);
	}

	.github-button:not(:disabled):active {
		transform: translateY(1px);
	}

	.actions-row {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.error-message {
		color: #ff6b6b;
		font-size: 0.95rem;
		min-height: 1.2rem;
		text-align: center;
	}

	.github-button__content {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		font-weight: 700;
	}

	.github-icon {
		width: 22px;
		height: 22px;
	}
</style>
