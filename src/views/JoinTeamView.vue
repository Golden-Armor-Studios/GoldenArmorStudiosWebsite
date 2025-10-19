<template>
	<div class="form-wrapper">
		<h1 class="homepage-title">Join the Team</h1>
		<p class="homepage-p description">
			We’re excited to learn more about you! Fill out the form below and we’ll review your application.
		</p>

		<section v-if="!isAuthenticated" class="notice-card card-standard">
			<p class="homepage-p">Please sign in to submit your application.</p>
			<RouterLink class="homepage-link" to="/login">Go to Login</RouterLink>
		</section>

		<form v-else class="application-form" @submit.prevent="handleSubmit">
			<div class="field">
				<label for="developerType">What type of developer are you?</label>
				<select id="developerType" v-model="form.developerType" required>
					<option disabled value="">Select a role</option>
					<option value="Game Programmer">Game Programmer</option>
					<option value="Tester">Tester</option>
					<option value="Artist">Artist</option>
					<option value="Designer">Designer</option>
					<option value="Producer">Producer</option>
					<option value="Other">Other</option>
				</select>
			</div>

			<div class="field">
				<label for="experience">How many years of experience do you have?</label>
				<input
					id="experience"
					v-model.number="form.experience"
					type="number"
					min="0"
					step="0.5"
					required
					placeholder="e.g. 2.5"
				>
			</div>

			<div class="field">
				<label>What are the languages you use?</label>
				<div class="tag-input">
					<ul class="tag-list">
						<li v-for="(language, index) in form.languages" :key="language" class="tag-chip">
							<span>{{ language }}</span>
							<button type="button" class="tag-remove" @click="removeLanguage(index)" aria-label="Remove language">×</button>
						</li>
					</ul>
					<input
						v-model="languageInput"
						type="text"
						placeholder="Type a language and press Enter"
						@keydown.enter.prevent="addLanguage"
						@keydown="handleLanguageKeydown"
					>
					<button type="button" class="add-tag" @click="addLanguage">Add</button>
				</div>
			</div>

			<div class="field">
				<label for="address">What is your address?</label>
				<input id="address" v-model="form.address" type="text" autocomplete="street-address" required>
			</div>

			<div class="field">
				<label for="phone">Phone number</label>
				<input id="phone" v-model="form.phone" type="tel" autocomplete="tel" required>
			</div>

			<div class="field">
				<label for="portfolio">Portfolio link</label>
				<input id="portfolio" v-model="form.portfolio" type="url" placeholder="https://example.com" required>
			</div>

			<div class="field">
				<label for="otherLinks">Any other links?</label>
				<textarea
					id="otherLinks"
					v-model="form.otherLinks"
					rows="3"
					placeholder="Share GitHub, LinkedIn, ArtStation, etc."
				></textarea>
			</div>

			<div class="field">
				<label for="about">Tell us a little about yourself</label>
				<textarea
					id="about"
					v-model="form.about"
					rows="5"
					required
					placeholder="Share your passions, goals, or favorite projects."
				></textarea>
			</div>

			<div v-if="errorMessage" class="error-message" role="alert">
				{{ errorMessage }}
			</div>
			<div v-if="successMessage" class="success-message" role="status">
				{{ successMessage }}
			</div>

			<div class="actions">
				<button type="submit" class="submit-button" :disabled="isSubmitting">
					<span v-if="isSubmitting">Submitting...</span>
					<span v-else>Submit Application</span>
				</button>
			</div>
		</form>
	</div>
</template>

<script setup>
	import { computed, reactive, ref } from 'vue'
	import { RouterLink } from 'vue-router'
	import { useStore } from 'vuex'
	import { httpsCallable } from 'firebase/functions'
	import { useToast } from 'vue-toastification'
	import { functions } from '@/firebase'

	const store = useStore()
	const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])
	const toast = useToast()

	const form = reactive({
		developerType: '',
		experience: null,
		languages: [],
		address: '',
		phone: '',
		portfolio: '',
		otherLinks: '',
		about: ''
	})

	const languageInput = ref('')
	const isSubmitting = ref(false)
	const errorMessage = ref('')
	const successMessage = ref('')

	const addLanguage = () => {
		const value = languageInput.value.trim()
		if (!value) {
			return
		}

		const language = value.replace(/,+$/, '')
		if (language && !form.languages.includes(language)) {
			form.languages.push(language)
		}
		languageInput.value = ''
	}

	const removeLanguage = (index) => {
		form.languages.splice(index, 1)
	}

	const handleLanguageKeydown = (event) => {
		if (event.key === ',') {
			event.preventDefault()
			addLanguage()
		}
	}

	const resetMessages = () => {
		errorMessage.value = ''
		successMessage.value = ''
	}

	const resetForm = () => {
		form.developerType = ''
		form.experience = null
		form.languages = []
		form.address = ''
		form.phone = ''
		form.portfolio = ''
		form.otherLinks = ''
		form.about = ''
		languageInput.value = ''
	}

	const handleSubmit = async () => {
		resetMessages()
		isSubmitting.value = true

		try {
			const submitApplication = httpsCallable(functions, 'submitTeamApplication')
			await submitApplication({
				developerType: form.developerType,
				experience: form.experience,
				languages: form.languages,
				address: form.address,
				phone: form.phone,
				portfolio: form.portfolio,
				otherLinks: form.otherLinks,
				about: form.about
			})

			successMessage.value = 'Application submitted! We will reach out after we review your details.'
			toast.success('Application submitted! We will be in touch soon.')
			resetForm()
		} catch (error) {
			errorMessage.value = error?.message ?? 'Unable to submit application. Please try again.'
			toast.error(errorMessage.value)
		} finally {
			isSubmitting.value = false
		}
	}
</script>

<style scoped>
	.form-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: min(960px, 100%);
	}

	.description {
		max-width: 600px;
		margin: 0 auto;
		color: #b9bcc3;
	}

	.notice-card {
		background: #1f2329;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.application-form {
		width: 100%;
		background: #1f2329;
		padding: 2rem;
		border-radius: 16px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-weight: 700;
		color: #f6f7f9;
	}

	input,
	select,
	textarea {
		background: #12161b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		color: #f6f7f9;
		font-size: 1rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: rgb(75, 216, 122);
		box-shadow: 0 0 0 3px rgba(75, 216, 122, 0.2);
	}

	textarea {
		resize: vertical;
		min-height: 120px;
	}

	.tag-input {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		background: #12161b;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.75rem;
	}

	.tag-input input {
		flex: 1;
		min-width: 180px;
		background: transparent;
		border: none;
		padding: 0;
		box-shadow: none;
	}

	.tag-input input:focus {
		border: none;
		box-shadow: none;
		outline: none;
	}

	.tag-list {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.6rem;
		border-radius: 999px;
		background: rgba(75, 216, 122, 0.2);
		color: rgb(75, 216, 122);
		font-weight: 600;
	}

	.tag-remove {
		background: transparent;
		border: none;
		color: inherit;
		font-size: 1rem;
		cursor: pointer;
		line-height: 1;
	}

	.add-tag {
		background: rgba(75, 216, 122, 0.2);
		color: rgb(75, 216, 122);
		border: none;
		border-radius: 999px;
		padding: 0.35rem 0.85rem;
		cursor: pointer;
		font-weight: 600;
		transition: filter 0.2s ease;
	}

	.add-tag:hover {
		filter: brightness(1.1);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.submit-button {
		background: rgb(75, 216, 122);
		color: #0f1419;
		font-weight: 700;
		border: none;
		border-radius: 10px;
		padding: 0.85rem 1.6rem;
		cursor: pointer;
		transition: filter 0.2s ease, transform 0.1s ease;
	}

	.submit-button:disabled {
		cursor: not-allowed;
		filter: grayscale(0.5);
	}

	.submit-button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.submit-button:active:not(:disabled) {
		transform: translateY(1px);
	}

	.error-message {
		color: #ff6b6b;
		background: rgba(255, 107, 107, 0.1);
		padding: 0.75rem 1rem;
		border-radius: 8px;
	}

	.success-message {
		color: rgb(75, 216, 122);
		background: rgba(75, 216, 122, 0.1);
		padding: 0.75rem 1rem;
		border-radius: 8px;
	}

	@media (max-width: 640px) {
		.application-form {
			padding: 1.25rem;
		}

		.actions {
			justify-content: center;
		}
	}
</style>
