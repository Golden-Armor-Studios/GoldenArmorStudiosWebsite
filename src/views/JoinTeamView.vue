<template>
	<div class="form-wrapper">
		<video ref="videoRef" class="background-video" autoplay muted loop playsinline>
			<source src="/website background - join team.mp4" type="video/mp4" />
		</video>
		<section v-if="!isAuthenticated" class="notice-card">
			<p class="homepage-p">Please sign in to submit your application.</p>
			<RouterLink class="homepage-link" to="/login">Go to Login</RouterLink>
		</section>

		<form v-else class="application-form" @submit.prevent="handleSubmit">
			<header class="form-header">
				<h1 class="homepage-title">Join the Team</h1>
				<p class="homepage-p description">
					We’re excited to learn more about you! Fill out the form below and we’ll review your application.
				</p>
			</header>

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

			<div class="field-group address-group">
				<div class="field">
					<label for="street">Street address</label>
					<input id="street" v-model="form.street" type="text" autocomplete="street-address" required>
				</div>
				<div class="field">
					<label for="city">City</label>
					<input id="city" v-model="form.city" type="text" autocomplete="address-level2" required>
				</div>
				<div class="field state-field">
					<label for="state">State</label>
					<select id="state" v-model="form.state" autocomplete="address-level1" required>
						<option disabled value="">Select state</option>
						<option v-for="stateOption in stateOptions" :key="stateOption" :value="stateOption">
							{{ stateOption }}
						</option>
					</select>
				</div>
				<div class="field zip-field">
					<label for="postalCode">ZIP code</label>
					<input
						id="postalCode"
						v-model="form.postalCode"
						type="text"
						autocomplete="postal-code"
						pattern="\\d{5}(-\\d{4})?"
						placeholder="e.g. 94105"
						required
					>
				</div>
			</div>

			<div class="field">
				<label for="phone">Phone number</label>
				<input id="phone" v-model="form.phone" type="tel" autocomplete="tel" required>
			</div>

		<div class="field">
			<label for="portfolio">Portfolio link</label>
			<input id="portfolio" v-model="form.portfolio" type="url" placeholder="https://example.com">
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
	import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
	import { RouterLink } from 'vue-router'
	import { useStore } from 'vuex'
	import { httpsCallable } from 'firebase/functions'
	import { useToast } from 'vue-toastification'
	import { functions } from '@/firebase'

	const store = useStore()
	const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])
	const toast = useToast()

	const US_STATES = [
		'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
	]

	const form = reactive({
		developerType: '',
		experience: null,
		languages: [],
		street: '',
		city: '',
		state: '',
		postalCode: '',
		phone: '',
		portfolio: '',
		otherLinks: '',
		about: ''
	})

	const videoRef = ref(null)
	const stateOptions = US_STATES
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
		form.street = ''
		form.city = ''
		form.state = ''
		form.postalCode = ''
		form.phone = ''
		form.portfolio = ''
		form.otherLinks = ''
		form.about = ''
		languageInput.value = ''
	}

	const buildAddress = () => {
		return [form.street, `${form.city}, ${form.state} ${form.postalCode}`.trim()].filter(Boolean).join('\n')
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
				address: buildAddress(),
				phone: form.phone,
				portfolio: form.portfolio || null,
				otherLinks: form.otherLinks || null,
				about: form.about || null
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

	onMounted(() => {
		const video = videoRef.value
		if (video) {
			video.playbackRate = 1
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
	.background-video {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -2;
		background-color: #000;
	}

	.form-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 4rem 1.5rem;
		box-sizing: border-box;
	}

	.description {
		max-width: 600px;
		margin: 0 auto;
		color: #b9bcc3;
	}

	.notice-card {
		background: rgba(8, 12, 18, 0.85);
		padding: 2rem;
		border-radius: 20px;
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(6px);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: min(480px, 100%);
	}

	.form-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.application-form {
		width: 100%;
		background: rgba(8, 12, 18, 0.85);
		padding: 2rem;
		border-radius: 20px;
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(6px);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.address-group {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.address-group .state-field,
	.address-group .zip-field {
		display: flex;
		flex-direction: column;
	}

	.address-group .state-field select {
		text-transform: uppercase;
	}

	.address-group .zip-field input {
		max-width: 160px;
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

		.address-group {
			grid-template-columns: 1fr;
		}

		.address-group .zip-field input {
			max-width: none;
		}

		.actions {
			justify-content: center;
		}
	}
</style>
