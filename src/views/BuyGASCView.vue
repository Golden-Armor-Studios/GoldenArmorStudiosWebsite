<template>
	<div class="buy-wrapper">
		<div class="background-base"></div>
		<video class="background-video" autoplay muted loop playsinline>
			<source src="/website background - home.mp4" type="video/mp4">
		</video>
			<section class="support card-standard">
				<h1>GASC – New Crypto!</h1>
			<p class="support-text">
				Every GASC purchase bankrolls fresh prototypes while giving you early exposure to the studio’s on-chain economy—fuel development today and position for upside before broader marketplace liquidity arrives.
			</p>
			<div class="price-ticker" :class="priceTrend">
				<div class="ticker-card">
					<p class="ticker-label">ETH (USD)</p>
					<p class="ticker-value price-emphasis">{{ ethPriceDisplay }}</p>
				</div>
				<div class="ticker-card">
					<p class="ticker-label">GASC (per token)</p>
					<p class="ticker-value price-emphasis">{{ gascPriceDisplay }}</p>
				</div>
			</div>
			<form class="donation-form" @submit.prevent="handlePurchase">
				<div class="field-row">
					<label for="gascAmount">GASC amount</label>
					<input
						id="gascAmount"
						type="number"
						min="1"
						step="1"
						v-model.number="gascAmount"
						@input="refreshQuoteForAmount"
						:disabled="isProcessing"
					>
				</div>

				<div class="field-row estimate-row" :class="['estimate-row', totalTrend]">
					<label>Estimated total (incl. gas)</label>
					<p class="purchase-total price-emphasis">{{ gascUsdDisplay }}</p>
				</div>

				<div class="field-row">
					<label for="depositAddress">Deposit address</label>
					<input
						id="depositAddress"
						type="text"
						v-model.trim="depositAddress"
						placeholder="0x..."
						autocomplete="off"
						:disabled="isProcessing"
					>
				</div>

				<div class="field-row">
					<label>Card details</label>
					<div ref="cardElementRef" class="card-element"></div>
				</div>

				<p v-if="purchaseMessage" :class="{ 'error-message': purchaseError, 'success-message': !purchaseError }">
					{{ purchaseMessage }}
				</p>

				<button
					type="submit"
					class="donate-button"
					:disabled="isPurchaseDisabled"
				>
					<span v-if="isProcessing">Processing…</span>
					<span v-else-if="!isAuthenticated">Sign in to purchase</span>
					<span v-else>Buy {{ gascAmount }} GASC ({{ gascUsdDisplay }})</span>
				</button>
				<p v-if="!isAuthenticated" class="signin-reminder">
					Sign in with GitHub from the navigation menu to complete your purchase.
				</p>
			</form>
		</section>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { httpsCallable } from 'firebase/functions'
import { functions, analytics } from '@/firebase'
import { useToast } from 'vue-toastification'
import { loadStripe } from '@stripe/stripe-js'

const publishableKey = 'pk_live_51SJccOKYzIVp9MDU493vDCMnQbSGmnrhPAa6YXR0PzxoqRs5YX8AWrv8zvAmBHfKBc7tTT6MQKbNDZAIQcA8bgV900hbt7WfPc'

const store = useStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const gascQuote = ref({ ethUsd: null, tokensPerEther: 1000, basePrice: null, adjustment: 0, finalPrice: null, totalSold: 0, gasFeeUsd: 0 })
const lastFinalPrice = ref(null)
const lastUsdTotal = ref(null)
const priceIntervalId = ref(null)

const gascAmount = ref(100)
const depositAddress = ref('')
const purchaseMessage = ref('')
const purchaseError = ref(false)
const isProcessing = ref(false)
const stripe = ref(null)
const elements = ref(null)
const cardElementRef = ref(null)
const cardReady = ref(false)
let cardElement

const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])

const gascUsdValue = computed(() => {
	if (gascQuote.value.finalPrice == null) {
		return null
	}
	const parsed = Number(gascAmount.value)
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null
	}
	return gascQuote.value.finalPrice * parsed + (Number(gascQuote.value.gasFeeUsd) || 0)
})

const ethPriceDisplay = computed(() => gascQuote.value.ethUsd == null ? '—' : `$${gascQuote.value.ethUsd.toFixed(2)}`)
const gascPriceDisplay = computed(() => gascQuote.value.finalPrice == null ? '—' : `$${gascQuote.value.finalPrice.toFixed(4)}`)
const gascUsdDisplay = computed(() => gascUsdValue.value == null ? '$0.00' : `$${gascUsdValue.value.toFixed(2)}`)
const priceTrend = computed(() => {
	if (gascQuote.value.finalPrice == null || lastFinalPrice.value == null) {
		return 'neutral'
	}
	if (gascQuote.value.finalPrice > lastFinalPrice.value) {
		return 'up'
	}
	if (gascQuote.value.finalPrice < lastFinalPrice.value) {
		return 'down'
	}
	return 'neutral'
})

const totalTrend = computed(() => {
	if (gascUsdValue.value == null || lastUsdTotal.value == null) {
		return 'neutral'
	}
	if (gascUsdValue.value > lastUsdTotal.value) {
		return 'up'
	}
	if (gascUsdValue.value < lastUsdTotal.value) {
		return 'down'
	}
	return 'neutral'
})

const isPurchaseDisabled = computed(() => {
	if (isProcessing.value || !cardReady.value) {
		return true
	}
	return !gascUsdValue.value || !depositAddress.value.trim()
})

const fetchPriceQuote = async (overrideAmount = null) => {
	try {
		const callable = httpsCallable(functions, 'getGascPrice')
		const amount = Number(overrideAmount ?? gascAmount.value ?? 1)
		const { data } = await callable({ tokenAmount: amount })
		if (data?.success) {
			lastFinalPrice.value = gascQuote.value.finalPrice ?? lastFinalPrice.value
			lastUsdTotal.value = gascUsdValue.value ?? lastUsdTotal.value
			gascQuote.value = {
				ethUsd: Number(data.ethUsd) || null,
				tokensPerEther: Number(data.tokensPerEther) || 1000,
				basePrice: Number(data.basePrice) || null,
				adjustment: Number(data.adjustment) || 0,
				finalPrice: Number(data.finalPrice) || null,
				totalSold: Number(data.totalSold) || 0,
				gasFeeUsd: Number(data.gasFeeUsd) || 0
			}
			if (lastFinalPrice.value == null && gascQuote.value.finalPrice != null) {
				lastFinalPrice.value = gascQuote.value.finalPrice
			}
			if (lastUsdTotal.value == null && gascUsdValue.value != null) {
				lastUsdTotal.value = gascUsdValue.value
			}
		}
	} catch (error) {
		console.error('Failed to load GASC price', error)
	}
}

const refreshQuoteForAmount = () => {
	if (!isProcessing.value) {
		fetchPriceQuote()
	}
}

const resetPurchaseMessage = () => {
	purchaseMessage.value = ''
	purchaseError.value = false
}

const handlePurchase = async () => {
	resetPurchaseMessage()
	if (!isAuthenticated.value) {
		router.push({
			path: '/login',
			query: { redirect: route.fullPath }
		})
		return
	}
	if (!gascUsdValue.value || gascUsdValue.value <= 0) {
		purchaseMessage.value = 'Please enter a valid GASC amount.'
		purchaseError.value = true
		return
	}
	if (!depositAddress.value.trim()) {
		purchaseMessage.value = 'Please provide a deposit address.'
		purchaseError.value = true
		return
	}
	if (!stripe.value || !elements.value || !cardElement) {
		purchaseMessage.value = 'Payment form is not ready. Refresh the page and try again.'
		purchaseError.value = true
		return
	}

	isProcessing.value = true
	try {
		const amountInCents = Math.max(Math.round(gascUsdValue.value * 100), 50)
		const createIntent = httpsCallable(functions, 'createStripePaymentIntent')
		const { data } = await createIntent({
			productId: 'nft',
			amount: amountInCents,
			currency: 'usd'
		})

		const { error, paymentIntent } = await stripe.value.confirmCardPayment(data.clientSecret, {
			payment_method: {
				card: cardElement
			}
		})

		if (error) {
			purchaseMessage.value = error.message || 'Payment failed. Please try another card.'
			purchaseError.value = true
			toast.error(purchaseMessage.value)
			return
		}

		if (paymentIntent?.status === 'succeeded') {
			try {
				const purchaseCallable = httpsCallable(functions, 'purchaseNft')
				await purchaseCallable({
					paymentIntentId: paymentIntent.id,
					depositAddress: depositAddress.value.trim(),
					nftAmount: gascAmount.value
				})
			} catch (recordError) {
				console.error('Failed to finalize NFT purchase', recordError)
				toast.warning('Payment processed, but delivery could not be confirmed. Contact support with your payment ID.')
			}

			purchaseMessage.value = 'Purchase complete! Check your wallet for the incoming NFT.'
			purchaseError.value = false
			toast.success('Purchase successful!')
			depositAddress.value = ''
			cardElement.clear()
		} else {
			purchaseMessage.value = 'Payment incomplete. Please verify your card details.'
			purchaseError.value = true
			toast.error(purchaseMessage.value)
		}
	} catch (error) {
		const message = error?.message ?? 'Unable to process the purchase right now.'
		purchaseMessage.value = message
		purchaseError.value = true
		toast.error(message)
	} finally {
		isProcessing.value = false
	}
}

const mountMeta = () => {
	if (typeof document === 'undefined') {
		return
	}
	document.title = 'GASC – New Crypto! — Golden Armor Studio'
	const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://goldenarmorstudio.art/buy-gasc'
	const metaDefinitions = [
		{ name: 'description', content: 'Every GASC purchase bankrolls fresh prototypes while giving you early exposure to the studio’s on-chain economy.' },
		{ property: 'og:title', content: 'GASC - New Crypto!' },
		{ property: 'og:description', content: 'Every GASC purchase bankrolls fresh prototypes while giving you early exposure to the studio’s on-chain economy.' },
		{ property: 'og:url', content: shareUrl },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:image', content: 'https://goldenarmorstudio.art/Buy-GASC-COver.png' },
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: 'GASC - New Crypto!' },
		{ name: 'twitter:description', content: 'Every GASC purchase bankrolls fresh prototypes while giving you early exposure to the studio’s on-chain economy.' },
		{ name: 'twitter:image', content: 'https://goldenarmorstudio.art/Buy-GASC-COver.png' }
	]
	metaDefinitions.forEach((definition) => {
		const key = definition.name ? 'name' : 'property'
	const selector = `meta[${key}="${definition[key]}"]`
		let tag = document.head.querySelector(selector)
		if (!tag) {
			tag = document.createElement('meta')
			tag.setAttribute(key, definition[key])
			document.head.appendChild(tag)
		}
		tag.setAttribute('content', definition.content)
	})
}

onMounted(async () => {
	mountMeta()
	if (analytics && typeof analytics.logEvent === 'function') {
		analytics.logEvent('page_view', {
			page_location: typeof window !== 'undefined' ? window.location.href : undefined,
			page_title: 'GASC – New Crypto!'
		})
	}
	fetchPriceQuote()
	priceIntervalId.value = setInterval(fetchPriceQuote, 60000)
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
	if (priceIntervalId.value) {
		clearInterval(priceIntervalId.value)
	}
})
</script>

<style scoped>
	.buy-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.5rem;
		width: 100%;
		min-height: 100vh;
		margin: 0;
		padding: 0;
		background: transparent;
	}

	.background-base {
		position: fixed;
		inset: 0;
		background: #05080c;
		opacity: 0.85;
		z-index: -3;
	}

	.background-video {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.4;
		pointer-events: none;
		z-index: -2;
	}

	.support {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		color: #d5d7de;
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(4px);
		padding: 2rem;
		border-radius: 20px;
		align-items: center;
		text-align: center;
		max-width: 520px;
		width: 100%;
		position: relative;
		z-index: 1;
	}

	.support h1 {
		margin: 0;
		font-size: 1.9rem;
		color: #f6f7f9;
	}

	.support-text {
		margin: 0;
		color: #d5d7de;
		max-width: 360px;
	}

	.price-ticker {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: center;
		width: 100%;
	}

	.ticker-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		min-width: 160px;
	}

	.ticker-label {
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9aa5b6;
		margin: 0;
	}

	.price-emphasis {
		font-size: 1.6rem;
		font-weight: 800;
	}

	.donation-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 360px;
		margin: 0 auto;
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

	input {
		background: #12161b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		color: #f6f7f9;
		font-size: 1rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	input:focus {
		outline: none;
		border-color: rgb(75, 216, 122);
		box-shadow: 0 0 0 3px rgba(75, 216, 122, 0.2);
	}

	.card-element {
		background: transparent;
		border: none;
		padding: 0;
	}

	.donate-button {
		background: rgb(75, 216, 122);
		border: none;
		border-radius: 10px;
		color: #0f1419;
		font-weight: 700;
		padding: 0.85rem 1rem;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.donate-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.signin-reminder {
		margin: 0;
		font-size: 0.9rem;
		color: #b9bcc3;
	}

	.error-message {
		color: #ff6b6b;
	}

	.success-message {
		color: #4bd87a;
	}

	@media (max-width: 600px) {
		.support {
			padding: 1.5rem;
		}

		.ticker-card {
			min-width: 120px;
		}
	}
</style>
