<template>
	<div class="home-wrapper">
		<div class="background-base"></div>
		<video class="background-video" autoplay muted loop playsinline>
			<source src="/website background - home.mp4" type="video/mp4" />
		</video>
		<section class="hero">
			<div class="hero-content">
				<p class="studio-tag">Indie Game Studio</p>
				<h1 class="hero-title">Forging vibrant worlds for curious players.</h1>
				<p class="hero-subtitle">
					Golden Armor Studios is a collective of artists, programmers, and storytellers crafting thoughtful games for mobile and beyond.
					We blend nostalgic charm with modern design, empowering players to challenge their minds and collaborate in creative spaces.
				</p>
				<div class="hero-actions">
					<a class="primary-button" href="https://apps.apple.com" target="_blank" rel="noopener noreferrer">
						Explore on the App Store
					</a>
					<a class="secondary-button" href="https://github.com/Golden-Armor-Studios" target="_blank" rel="noopener noreferrer">
						View Our Projects
					</a>
				</div>
			</div>
		<div class="hero-media">
				<video class="hero-video" controls autoplay loop muted playsinline>
					<source src="/Color_IQ_Logo.mp4" type="video/mp4">
					Your browser does not support the video tag.
				</video>
				<p class="media-caption">Color IQ Pro — sharpen your perception in a world of shifting gradients.</p>
			</div>
		</section>

		<section class="pillars">
			<div class="pillar card-standard">
				<h2>Crafted Experiences</h2>
				<p>
					We obsess over tactile controls, readable interfaces, and rich soundscapes that let players slip effortlessly into focused play sessions.
					Every title we ship is tuned for quick delight and lasting mastery.
				</p>
			</div>
			<div class="pillar card-standard">
				<h2>Player First</h2>
				<p>
					Our community shapes our roadmap. From early prototypes to live updates, we listen, iterate, and release content that reflects the imagination of our players.
				</p>
			</div>
			<div class="pillar card-standard">
				<h2>Built for iOS</h2>
				<p>
					Golden Armor Studios maintains an active Apple developer license, delivering premium experiences optimised for iPhone, iPad, and Apple Silicon Macs.
					Expect native performance and seamless updates.
				</p>
			</div>
		</section>

	<section class="team">
			<h2>Meet the Guild</h2>
			<p>
				We’re a small guild of developers, composers, illustrators, and product thinkers rooted in collaborative storytelling.
				Our workflow blends remote-first flexibility with focused sprints, letting us ship fast while keeping polish front and centre.
			</p>
	<div class="team-developers">
		<h3 class="team-subtitle">Developers</h3>
		<div class="team-grid developers-grid">
			<a
				v-for="profile in developerProfiles"
				:key="profile.id"
				class="developer-profile-card"
				:href="profile.githubUrl || 'https://github.com/' + encodeURIComponent(profile.displayName.replace(/\s+/g, ''))"
				target="_blank"
				rel="noopener noreferrer"
			>
				<div class="developer-avatar">
					<img v-if="profile.photoURL" :src="profile.photoURL" :alt="`${profile.displayName} avatar`">
					<span v-else>{{ profile.initials }}</span>
				</div>
				<p class="developer-name">{{ profile.displayName }}</p>
			</a>
		</div>
	</div>
	<div class="team-donors" v-if="donorsSorted.length">
		<div class="team-top-donors" v-if="topDonors.length">
			<h3 class="team-subtitle">Top Donors</h3>
			<div class="team-grid top-donors-grid">
				<a
					v-for="profile in topDonors"
					:key="profile.id"
					class="developer-profile-card top-donor-card"
					:href="profile.githubUrl || 'https://github.com/' + encodeURIComponent(profile.displayName.replace(/\s+/g, ''))"
					target="_blank"
					rel="noopener noreferrer"
				>
					<div class="developer-avatar top-donor-avatar">
						<img v-if="profile.photoURL" :src="profile.photoURL" :alt="`${profile.displayName} avatar`">
						<span v-else>{{ profile.initials }}</span>
					</div>
					<p class="developer-name">{{ profile.displayName }}</p>
				</a>
			</div>
		</div>
		<h3 class="team-subtitle">Donors</h3>
		<div class="team-grid donors-grid">
			<a
				v-for="profile in remainingDonors"
				:key="profile.id"
				class="developer-profile-card"
				:href="profile.githubUrl || 'https://github.com/' + encodeURIComponent(profile.displayName.replace(/\s+/g, ''))"
				target="_blank"
				rel="noopener noreferrer"
			>
				<div class="developer-avatar">
					<img v-if="profile.photoURL" :src="profile.photoURL" :alt="`${profile.displayName} avatar`">
					<span v-else>{{ profile.initials }}</span>
				</div>
				<p class="developer-name">{{ profile.displayName }}</p>
			</a>
			<p v-if="!remainingDonors.length" class="no-donors">You could be the first donor displayed here!</p>
		</div>
	</div>
</section>

		<section class="call-to-action card-standard">
			<h2>Join the Adventure</h2>
			<p>
				Whether you’re a player seeking thoughtful experiences or a developer eager to collaborate, we’d love to hear from you.
				Follow our releases, share feedback, or reach out about partnerships.
			</p>
			<div class="cta-actions">
				<a class="primary-button" href="https://discord.gg" target="_blank" rel="noopener noreferrer">Join our Discord</a>
				<a class="secondary-button" href="mailto:hello@goldenarmorstudio.com">Contact the Studio</a>
			</div>
		</section>

	<section id="support" class="support card-standard">
			<h2>Support Future Worlds</h2>
			<p class="support-text">Player-backed development keeps experimental ideas alive. Donate to unlock supporter perks and help us brave new quests.</p>
			<form class="donation-form" @submit.prevent="handleDonate">
				<div class="field-row">
					<label for="donationAmount">Choose an amount</label>
					<select
						id="donationAmount"
						v-model="selectedAmount"
						:disabled="isProcessing"
					>
						<option v-for="amount in presetAmounts" :key="amount" :value="amount">
							${{ amount }}
						</option>
						<option value="custom">Custom amount</option>
					</select>
				</div>

				<div v-if="selectedAmount === 'custom'" class="field-row">
					<label for="customAmount">Enter custom amount</label>
					<input
						id="customAmount"
						v-model="customAmount"
						type="number"
						min="1"
						step="1"
						placeholder="25"
						:disabled="isProcessing"
					>
				</div>

				<div class="field-row">
					<label>Card details</label>
					<div ref="cardElementRef" class="card-element"></div>
				</div>

				<p v-if="donationMessage" :class="{ 'error-message': donationError, 'success-message': !donationError }">
					{{ donationMessage }}
				</p>

	<button
		type="submit"
		class="donate-button"
		:disabled="isDonateDisabled"
	>
		<span v-if="isProcessing">Processing…</span>
		<span v-else-if="!isAuthenticated">Sign in to donate</span>
		<span v-else>Donate {{ formattedAmount }}</span>
	</button>
				<p v-if="!isAuthenticated" class="signin-reminder">
					Sign in with GitHub from the navigation menu to support the studio.
				</p>
			</form>
		</section>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useToast } from 'vue-toastification'
import { loadStripe } from '@stripe/stripe-js'

const publishableKey = 'pk_live_51SJccOKYzIVp9MDU493vDCMnQbSGmnrhPAa6YXR0PzxoqRs5YX8AWrv8zvAmBHfKBc7tTT6MQKbNDZAIQcA8bgV900hbt7WfPc'

const store = useStore()
const toast = useToast()

const presetAmounts = [10, 20, 50, 100]
const selectedAmount = ref(presetAmounts[0])
const customAmount = ref('')
const donationMessage = ref('')
const donationError = ref(false)
const isProcessing = ref(false)
const stripe = ref(null)
const elements = ref(null)
const cardElementRef = ref(null)
const cardReady = ref(false)
let cardElement

const developerProfiles = ref([])
const donorsSorted = ref([])

const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])

const resolvedAmount = computed(() => {
	if (selectedAmount.value === 'custom') {
		const parsed = Number(customAmount.value)
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null
	}
	return selectedAmount.value
})

const formattedAmount = computed(() => {
	if (!resolvedAmount.value) {
		return ''
	}
	return `$${resolvedAmount.value}`
})

const topDonors = computed(() => donorsSorted.value.slice(0, 3))
const remainingDonors = computed(() => donorsSorted.value.slice(3))

const isDonateDisabled = computed(() => {
	if (isProcessing.value || !cardReady.value) {
		return true
	}
	if (!isAuthenticated.value) {
		return true
	}
	return !resolvedAmount.value
})

onMounted(async () => {
	fetchDeveloperProfiles()
	fetchDonorProfiles()
	stripe.value = await loadStripe(publishableKey)
	if (!stripe.value) {
		toast.error('Unable to initialise Stripe. Please try again later.')
		return
	}
	elements.value = stripe.value.elements()
	cardElement = elements.value.create('card', {
		style: {
			base: {
				color: '#f5f8fa',
				fontFamily: '"Inter", system-ui, sans-serif',
				fontSize: '16px',
				'::placeholder': {
					color: '#7d8590'
				}
			},
			invalid: {
				color: '#ff6b6b'
			}
		}
	})
	cardElement.mount(cardElementRef.value)
	cardReady.value = true
})

onBeforeUnmount(() => {
	if (cardElement) {
		cardElement.destroy()
	}
	cardReady.value = false
})

const resetMessage = () => {
	donationMessage.value = ''
	donationError.value = false
}

const handleDonate = async () => {
	resetMessage()
	if (!isAuthenticated.value) {
		toast.info('Please sign in with GitHub before donating.')
		return
	}
	if (!resolvedAmount.value) {
		donationMessage.value = 'Please choose a valid amount.'
		donationError.value = true
		return
	}
	if (!stripe.value || !elements.value || !cardElement) {
		donationMessage.value = 'Payment form is not ready. Refresh the page and try again.'
		donationError.value = true
		return
	}

	isProcessing.value = true
	try {
		const amountInCents = Math.round(resolvedAmount.value * 100)
		const createIntent = httpsCallable(functions, 'createStripePaymentIntent')
		const { data } = await createIntent({
			productId: 'donation',
			amount: amountInCents,
			currency: 'usd'
		})

		const { error, paymentIntent } = await stripe.value.confirmCardPayment(data.clientSecret, {
			payment_method: {
				card: cardElement
			}
		})

		if (error) {
			donationMessage.value = error.message || 'Payment failed. Please try another card.'
			donationError.value = true
			toast.error(donationMessage.value)
			return
		}

		if (paymentIntent?.status === 'succeeded') {
			try {
				const recordDonation = httpsCallable(functions, 'recordDonation')
				await recordDonation({ paymentIntentId: paymentIntent.id })
			} catch (recordError) {
				console.error('Failed to record donation', recordError)
				toast.warning('Donation processed, but we could not update your perks automatically. Please contact support if needed.')
			}

			donationMessage.value = 'Thank you for supporting Golden Armor Studios!'
			donationError.value = false
			toast.success('Donation successful!')
			customAmount.value = ''
			if (selectedAmount.value === 'custom') {
				selectedAmount.value = presetAmounts[0]
			}
			cardElement.clear()
		} else {
			donationMessage.value = 'Payment incomplete. Please verify your card details.'
			donationError.value = true
			toast.error(donationMessage.value)
		}
	} catch (error) {
		const message = error?.message ?? 'Unable to process the donation right now.'
		donationMessage.value = message
		donationError.value = true
		toast.error(message)
	} finally {
		isProcessing.value = false
	}
}

const mapMemberProfile = (profile) => {
	const displayName = (profile.githubDisplayName || profile.displayName || '').trim()
	const fallbackName = displayName || 'Supporter'
	const initials = fallbackName
		.split(' ')
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase())
		.slice(0, 2)
		.join('') || 'DEV'

	return {
		id: profile.id,
		displayName: fallbackName,
		photoURL: profile.photoURL || null,
		initials,
		githubUrl: profile.githubUrl || null,
		totalAmount: Number(profile.totalAmount) || 0,
		currency: profile.currency || 'usd'
	}
}

const fetchDeveloperProfiles = async () => {
	try {
		const callable = httpsCallable(functions, 'getDeveloperProfiles')
		const { data } = await callable()
		const profilesArray = Array.isArray(data?.profiles) ? data.profiles.map(mapMemberProfile) : []
		profilesArray.sort((a, b) => a.displayName.localeCompare(b.displayName))
		developerProfiles.value = profilesArray
	} catch (error) {
		console.error('Failed to load developer profiles', error)
	}
}

const fetchDonorProfiles = async () => {
	try {
		const callable = httpsCallable(functions, 'getDonorProfiles')
		const { data } = await callable()
		const profilesArray = Array.isArray(data?.profiles) ? data.profiles.map(mapMemberProfile) : []
		profilesArray.sort((a, b) => {
			if (b.totalAmount !== a.totalAmount) {
				return b.totalAmount - a.totalAmount
			}
			return a.displayName.localeCompare(b.displayName)
		})
		donorsSorted.value = profilesArray
	} catch (error) {
		console.error('Failed to load donor profiles', error)
	}
}
</script>

<style scoped>
	.home-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.5rem;
		width: min(1100px, 100%);
		min-height: calc(100vh - 120px);
	}

	.background-base {
		position: fixed;
		inset: 0;
		background: #000;
		z-index: -3;
	}

	.background-video {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -2;
	}

	.hero {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
	}

	.hero-content {
		flex: 1 1 320px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		text-align: left;
	}

	.studio-tag {
		margin: 0;
		font-weight: 700;
		color: rgb(75, 216, 122);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.hero-title {
		margin: 0;
		font-size: clamp(2.5rem, 5vw, 3.75rem);
		color: #f6f7f9;
	}

	.hero-subtitle {
		margin: 0;
		color: #d5d7de;
		line-height: 1.6;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.primary-button,
	.secondary-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.65rem 1.4rem;
		font-weight: 700;
		text-decoration: none;
		transition: transform 0.1s ease, filter 0.2s ease;
	}

	.primary-button {
		background: rgb(75, 216, 122);
		color: #0f1419;
	}

	.secondary-button {
		background: rgba(255, 255, 255, 0.15);
		color: #f5f8fa;
	}

	.primary-button:hover,
	.secondary-button:hover {
		filter: brightness(1.05);
	}

	.primary-button:active,
	.secondary-button:active {
		transform: translateY(1px);
	}

	.hero-media {
		flex: 1 1 320px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.hero-video {
		width: 100%;
		max-width: 420px;
		border-radius: 16px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
	}

	.media-caption {
		margin: 0;
		color: #d5d7de;
		font-size: 0.95rem;
	}

	.pillars {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		width: 100%;
		align-items: stretch;
	}

	.pillar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(4px);
		color: #d5d7de;
		padding: 1.75rem;
		border-radius: 20px;
		text-align: center;
		height: 100%;
	}

	.pillar h2 {
		margin: 0;
		color: #f6f7f9;
	}

	.pillar p {
		margin: 0;
		color: #d5d7de;
	}

	.highlight {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: #d5d7de;
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(4px);
		padding: 1.75rem;
		border-radius: 20px;
		text-align: center;
	}

	.feature-list {
		margin: 0 auto;
		padding-left: 1.2rem;
		color: #d5d7de;
		line-height: 1.6;
		max-width: 540px;
	}

	.inline-link {
		color: rgb(75, 216, 122);
		font-weight: 700;
		text-decoration: none;
	}

	.inline-link:hover {
		text-decoration: underline;
	}

	.team {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		color: #d5d7de;
		align-items: center;
		text-align: center;
		width: 100%;
		max-width: 960px;
		margin: 0 auto 2.5rem;
	}

	.team h2 {
		font-size: 2.4rem;
		margin: 0;
		color: #f6f7f9;
	}

	.team > p {
		font-size: 1.1rem;
		margin: 0;
		max-width: 720px;
	}

	.team-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		width: 100%;
	}

	.team-developers {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
	}

	.team-donors {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
		margin-top: 2.5rem;
	}

	.team-top-donors {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
	}

	.team-donors > .team-subtitle {
		margin-top: 2rem;
	}

	.team-donors .team-subtitle + .donors-grid {
		margin-top: 1.2rem;
	}

	.team-top-donors .team-subtitle {
		font-size: 1.8rem;
	}

	.team-subtitle {
		margin: 0;
		font-size: 1.3rem;
		color: #f6f7f9;
	}

	.developers-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		width: min(100%, 520px);
		justify-items: center;
	}

	.donors-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		width: min(100%, 520px);
		justify-items: center;
	}

	.top-donors-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 1.25rem;
		width: min(100%, 520px);
		justify-items: center;
	}

	.developer-profile-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		color: inherit;
		transition: transform 0.15s ease;
	}

	.developer-profile-card:hover {
		transform: translateY(-2px);
	}

	.developer-avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}

	.top-donor-avatar {
		width: 112px;
		height: 112px;
	}

	.top-donor-card {
		gap: 0.8rem;
	}

	.developer-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.developer-avatar span {
		font-size: 1.6rem;
		font-weight: 700;
		color: rgb(75, 216, 122);
	}

	.developer-name {
		margin: 0;
		color: #f6f7f9;
		font-weight: 600;
	}

	.no-donors {
		margin: 0.5rem 0 0;
		color: #b9bcc3;
		font-size: 0.95rem;
	}

	.call-to-action {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: #d5d7de;
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(4px);
		padding: 1.75rem;
		border-radius: 20px;
		text-align: center;
	}

	.cta-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}

	.support {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		color: #d5d7de;
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(4px);
		padding: 1.75rem;
		border-radius: 20px;
		align-items: center;
		text-align: center;
		max-width: 520px;
		margin: 0 auto;
	}

	.support-text {
		margin: 0;
		color: #d5d7de;
	}

	.donation-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label {
		font-weight: 700;
		color: #f6f7f9;
	}

	select,
	input {
		background: #12161b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		color: #f6f7f9;
		font-size: 1rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	select:focus,
	input:focus {
		outline: none;
		border-color: rgb(75, 216, 122);
		box-shadow: 0 0 0 3px rgba(75, 216, 122, 0.2);
	}

	.card-element {
		background: #12161b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.75rem;
		color: #f6f7f9;
	}

	.donate-button {
		background: rgb(75, 216, 122);
		color: #0f1419;
		font-weight: 700;
		border: none;
		border-radius: 10px;
		padding: 0.85rem 1.6rem;
		cursor: pointer;
		transition: filter 0.2s ease, transform 0.1s ease;
	}

	.donate-button:disabled {
		cursor: not-allowed;
		filter: grayscale(0.5);
	}

	.donate-button:hover:not(:disabled) {
		filter: brightness(1.05);
	}

	.donate-button:active:not(:disabled) {
		transform: translateY(1px);
	}

	.error-message {
		color: #ff6b6b;
		background: rgba(255, 107, 107, 0.15);
		padding: 0.75rem;
		border-radius: 8px;
	}

	.success-message {
		color: rgb(75, 216, 122);
		background: rgba(75, 216, 122, 0.15);
		padding: 0.75rem;
		border-radius: 8px;
	}

	.signin-reminder {
		color: #d5d7de;
		font-size: 0.95rem;
		margin: 0;
	}

	@media (max-width: 960px) {
		.hero {
			flex-direction: column;
			text-align: center;
		}

		.hero-content {
			text-align: center;
		}

		.hero-actions {
			justify-content: center;
		}
	}

	@media (max-width: 640px) {
		.home-wrapper {
			gap: 2rem;
		}

		.donation-form {
			gap: 0.85rem;
		}

		.card-element {
			padding: 0.65rem;
		}
	}
</style>
