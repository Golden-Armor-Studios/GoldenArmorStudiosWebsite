<template>
	<div class="dashboard-wrapper">
		<video ref="videoRef" class="background-video" autoplay muted loop playsinline>
			<source src="/website background - dashboard.mp4" type="video/mp4" />
		</video>
		<header class="dashboard-header">
			<h1 class="homepage-title">Welcome back, {{ displayName }}!</h1>
			<p class="homepage-p subtitle">
				Here’s a quick overview of Golden Armor Studios. Use the links below to jump to live project data or team tools.
			</p>
			<div class="status-chips">
				<span class="status-chip" :class="{ donor: isDonor }">
					<span v-if="isDonor">Donor Supporter</span>
					<span v-else>Member</span>
				</span>
				<span v-if="isDeveloper" class="status-chip developer">Developer</span>
				<span v-if="isAdmin" class="status-chip admin">Admin</span>
			</div>
		</header>

		<section class="card-grid">
			<RouterLink class="card card-standard" to="/project-status">
				<h2 class="card-title">BattleDawnPro Status</h2>
				<p class="card-body">
					Check open issues, milestones, and repository metrics for the BattleDawnPro project in real time.
				</p>
				<span class="card-link">View BattleDawnPro →</span>
			</RouterLink>

			<RouterLink class="card card-standard" to="/coloriq-status">
				<h2 class="card-title">ColorIQ Status</h2>
				<p class="card-body">
					Stay up to date with ColorIQ progress, feature planning, and community feedback tasks.
				</p>
				<span class="card-link">View ColorIQ →</span>
			</RouterLink>
		</section>

		<section class="card-grid">
			<RouterLink class="card card-standard" to="/join-team">
				<h2 class="card-title">Apply or Refer</h2>
				<p class="card-body">
					Know someone who’d be a great fit? Point them to our application form or update your own submission.
				</p>
				<span class="card-link">Go to Join the Team →</span>
			</RouterLink>

			<RouterLink class="card card-standard" to="/community">
				<h2 class="card-title">Join the Community</h2>
				<p class="card-body">
					Pop into Discord to collaborate with the rest of the studio, share builds, and gather feedback.
				</p>
				<span class="card-link">Open Discord →</span>
			</RouterLink>
		</section>

		<section v-if="isAdmin" class="card-grid">
			<RouterLink class="card card-standard admin-card" to="/devs">
				<h2 class="card-title">Team Administration</h2>
				<p class="card-body">
					Review applicants, update user access groups, and manage team membership from a single console.
				</p>
				<span class="card-link">Open Team Admin →</span>
			</RouterLink>
		</section>

	<section class="card-grid wide-cards">
		<div class="card card-standard donation-summary">
			<div class="summary-header">
				<h2 class="card-title">Support Overview</h2>
				<button class="print-button" type="button" @click="printTransactions" :disabled="isFetchingTransactions || transactions.length === 0">
					Print transactions to date
				</button>
				</div>
				<p class="card-body muted" v-if="isFetchingTransactions">Loading your donation history…</p>
				<div v-else>
					<p class="total-amount">{{ formattedTotal }}</p>
					<p class="card-body muted" v-if="!transactions.length">No donations recorded yet. Thank you for your support!</p>
					<ul class="mini-stats" v-else>
						<li>
							<span class="stat-label">Transactions</span>
							<span class="stat-value">{{ transactions.length }}</span>
						</li>
						<li>
							<span class="stat-label">Currency</span>
							<span class="stat-value text-upper">{{ baseCurrency }}</span>
						</li>
					</ul>
				</div>
			</div>

			<div class="card card-standard donation-history">
				<h2 class="card-title">Recent Donations</h2>
				<p class="card-body muted" v-if="isFetchingTransactions">Loading transactions…</p>
				<p class="card-body muted" v-else-if="!transactions.length">No donation activity yet. Once supporters contribute, you’ll see the timeline here.</p>
				<div v-else class="table-scroll">
					<table class="transactions-table">
						<thead>
							<tr>
								<th>Date</th>
								<th>Amount</th>
								<th>Payment ID</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="txn in transactions.slice(0, 6)" :key="txn.paymentIntentId">
								<td>{{ formatTimestamp(txn.createdAtMs ?? txn.createdAt) }}</td>
								<td>{{ formatAmount(txn.amount, txn.currency) }}</td>
								<td class="payment-id">{{ txn.paymentIntentId }}</td>
							</tr>
						</tbody>
					</table>
					<p class="card-body extra-note" v-if="transactions.length > 6">
						Showcasing the latest 6 entries. Export to see everything.
					</p>
				</div>
		</div>
	</section>

	<section class="card-grid">
		<div class="card card-standard support-card">
			<h2 class="card-title">Support Future Worlds</h2>
			<p class="card-body">
				Player-backed development keeps experimental ideas alive. Donate to unlock supporter perks and help us brave new quests.
			</p>
			<form class="donation-form" @submit.prevent="handleDonate">
				<div class="field-row">
					<label for="donationAmountDashboard">Choose an amount</label>
					<select
						id="donationAmountDashboard"
						v-model="selectedAmount"
						:disabled="isProcessing || !isAuthenticated"
					>
						<option v-for="amount in presetAmounts" :key="amount" :value="amount">
							${{ amount }}
						</option>
						<option value="custom">Custom amount</option>
					</select>
				</div>

				<div v-if="selectedAmount === 'custom'" class="field-row">
					<label for="customAmountDashboard">Enter custom amount</label>
					<input
						id="customAmountDashboard"
						v-model="customAmount"
						type="number"
						min="1"
						step="1"
						placeholder="25"
						:disabled="isProcessing || !isAuthenticated"
					>
				</div>

				<div class="field-row">
					<label>Card details</label>
					<div ref="cardElementRef" class="card-element" :class="{ disabled: !isAuthenticated }"></div>
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
		</div>
	</section>
</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useStore } from 'vuex'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useToast } from 'vue-toastification'
import { loadStripe } from '@stripe/stripe-js'

const store = useStore()
const toast = useToast()
const profile = computed(() => store.state.user.profile)
const groups = computed(() => store.getters['user/userGroups'] || [])
const displayName = computed(() => profile.value?.displayName || profile.value?.email || 'Member')
const isAdmin = computed(() => groups.value.includes('admin'))
const isDeveloper = computed(() => groups.value.includes('developer'))
const isDonor = computed(() => groups.value.includes('donor'))
const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])

const videoRef = ref(null)
const transactions = ref([])
const totalAmount = ref(0)
const baseCurrency = ref('usd')
const isFetchingTransactions = ref(false)

const publishableKey = 'pk_live_51SJccOKYzIVp9MDU493vDCMnQbSGmnrhPAa6YXR0PzxoqRs5YX8AWrv8zvAmBHfKBc7tTT6MQKbNDZAIQcA8bgV900hbt7WfPc'
const presetAmounts = [10, 20, 50, 100]
const selectedAmount = ref(presetAmounts[0])
const customAmount = ref('')
const donationMessage = ref('')
const donationError = ref(false)
const isProcessing = ref(false)
const stripeInstance = ref(null)
const elements = ref(null)
const cardElementRef = ref(null)
const cardReady = ref(false)
let cardElement

const formattedTotal = computed(() => {
	const dollars = totalAmount.value / 100
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: baseCurrency.value.toUpperCase() }).format(dollars || 0)
})

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

const isDonateDisabled = computed(() => {
	if (!isAuthenticated.value) {
		return true
	}
	if (isProcessing.value || !cardReady.value) {
		return true
	}
	return !resolvedAmount.value
})

const resetDonationMessage = () => {
	donationMessage.value = ''
	donationError.value = false
}

const loadTransactions = async () => {
	if (!isAuthenticated.value) {
		transactions.value = []
		totalAmount.value = 0
		resetDonationMessage()
		if (cardElement) {
			cardElement.clear()
		}
		return
	}

	isFetchingTransactions.value = true
	try {
		const callable = httpsCallable(functions, 'getUserTransactions')
		const { data } = await callable()
		const rawTransactions = Array.isArray(data?.transactions) ? data.transactions : []
		transactions.value = rawTransactions
			.map((txn) => {
				let date = null
				if (txn.createdAt?.toDate) {
					date = txn.createdAt.toDate()
				} else if (typeof txn.createdAt === 'object' && txn.createdAt !== null && ('_seconds' in txn.createdAt)) {
					date = new Date((txn.createdAt._seconds || 0) * 1000 + Math.floor((txn.createdAt._nanoseconds || 0) / 1e6))
				} else if (typeof txn.createdAt === 'number') {
					date = new Date(txn.createdAt)
				} else if (typeof txn.createdAt === 'string') {
					date = new Date(txn.createdAt)
				}
				const createdAtMs = date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
				return {
					...txn,
					createdAt: createdAtMs ? date.toISOString() : null,
					createdAtMs
				}
			})
			.sort((a, b) => b.createdAtMs - a.createdAtMs)
		totalAmount.value = Number(data?.totalAmount) || 0
		baseCurrency.value = (data?.currency || 'usd').toLowerCase()
	} catch (error) {
		transactions.value = []
		totalAmount.value = 0
		toast.error(error?.message ?? 'Unable to load donation history.')
	} finally {
		isFetchingTransactions.value = false
	}
}

const handleDonate = async () => {
	resetDonationMessage()
	if (!isAuthenticated.value) {
		toast.info('Please sign in with GitHub before donating.')
		return
	}
	if (!resolvedAmount.value) {
		donationMessage.value = 'Please choose a valid amount.'
		donationError.value = true
		return
	}
	if (!stripeInstance.value || !elements.value || !cardElement) {
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

		const { error, paymentIntent } = await stripeInstance.value.confirmCardPayment(data.clientSecret, {
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
			await loadTransactions()
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

const formatAmount = (amount = 0, currency = 'usd') => {
	const dollars = Number(amount) / 100
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(dollars || 0)
}

const formatTimestamp = (timestamp) => {
	if (!timestamp) {
		return 'Unknown date'
	}
	let date
	if (typeof timestamp === 'number') {
		date = new Date(timestamp)
	} else if (typeof timestamp === 'string') {
		date = new Date(timestamp)
	} else if (timestamp?.toDate) {
		date = timestamp.toDate()
	} else if (typeof timestamp === 'object' && ('_seconds' in timestamp)) {
		date = new Date((timestamp._seconds || 0) * 1000 + Math.floor((timestamp._nanoseconds || 0) / 1e6))
	} else {
		date = new Date(timestamp)
	}
	if (Number.isNaN(date.getTime())) {
		return 'Unknown date'
	}
	return date.toLocaleString()
}

const printTransactions = () => {
	const rows = transactions.value
		.map((txn) => `
			<tr>
				<td>${formatTimestamp(txn.createdAtMs ?? txn.createdAt)}</td>
				<td>${formatAmount(txn.amount, txn.currency)}</td>
				<td>${txn.paymentIntentId}</td>
			</tr>
		`)
		.join('')
	const tableHtml = rows
		? `<table style="width:100%;border-collapse:collapse;font-family:Arial, sans-serif;">
			<thead>
				<tr>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Date</th>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Amount</th>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Payment ID</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`
		: '<p>No transactions found.</p>'
	const totalLine = `<p style="margin-top:16px;font-weight:bold;">Total: ${formattedTotal.value}</p>`
	const printWindow = window.open('', '_blank', 'width=600,height=800')
	printWindow?.document.write(`
		<html>
			<head><title>Donation History</title></head>
			<body style="padding:24px; font-family:Arial, sans-serif;">
				<h1>Donation History</h1>
				${tableHtml}
				${totalLine}
			</body>
		</html>
	`)
	printWindow?.document.close()
	printWindow?.print()
}

onMounted(() => {
	const video = videoRef.value
	if (video) {
		video.playbackRate = 1
	}

	const initStripe = async () => {
		if (stripeInstance.value) {
			return
		}
		stripeInstance.value = await loadStripe(publishableKey)
		if (!stripeInstance.value) {
			toast.error('Unable to initialise Stripe. Please try again later.')
			return
		}
		elements.value = stripeInstance.value.elements()
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
	}

	initStripe()
	loadTransactions()
})

onBeforeUnmount(() => {
	const video = videoRef.value
	if (video) {
		video.pause()
	}
	if (cardElement) {
		cardElement.destroy()
		cardElement = undefined
	}
	cardReady.value = false
})

watch(isAuthenticated, (value) => {
	if (value) {
		loadTransactions()
	} else {
		transactions.value = []
		totalAmount.value = 0
		resetDonationMessage()
		if (cardElement) {
			cardElement.clear()
		}
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

	.dashboard-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		width: min(1100px, 100%);
	}

	.dashboard-header {
		text-align: center;
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.subtitle {
		color: #d0d4dc;
		line-height: 1.6;
	}

	.status-chips {
		display: flex;
		justify-content: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.status-chip {
		padding: 0.35rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: #f6f7f9;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.status-chip.donor {
		background: rgba(75, 216, 122, 0.2);
		color: rgb(75, 216, 122);
	}

	.status-chip.developer {
		background: rgba(118, 164, 255, 0.2);
		color: rgb(118, 164, 255);
	}

	.status-chip.admin {
		background: rgba(255, 196, 86, 0.2);
		color: rgb(255, 196, 86);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		width: 100%;
		align-items: stretch;
	}

	.card-grid.wide-cards {
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.75rem;
		border-radius: 20px;
		text-decoration: none;
		color: inherit;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		height: 100%;
	}

	.card:hover {
		transform: translateY(-4px);
		box-shadow: 0 24px 54px rgba(0, 0, 0, 0.45);
	}

	.card-title {
		margin: 0;
		font-size: 1.5rem;
		color: #f6f7f9;
	}

	.card-body {
		color: #c6cad3;
		line-height: 1.6;
		flex: 1;
		margin: 0;
	}

	.card-link {
		color: rgb(75, 216, 122);
		font-weight: 700;
	}

	.card-actions {
		display: flex;
		justify-content: flex-start;
		margin-top: auto;
	}

	.card-link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem 1.4rem;
		border-radius: 999px;
		border: 1px solid rgba(75, 216, 122, 0.35);
		color: rgb(75, 216, 122);
		font-weight: 600;
		text-decoration: none;
		transition: transform 0.1s ease, box-shadow 0.2s ease, filter 0.2s ease;
	}

	.card-link-button:hover {
		filter: brightness(1.05);
		box-shadow: 0 10px 26px rgba(75, 216, 122, 0.25);
	}

	.card-link-button:active {
		transform: translateY(1px);
	}

	.support-card {
		align-items: center;
		max-width: 520px;
		margin: 0 auto;
		text-align: center;
		gap: 1.2rem;
	}

	.support-card .card-body {
		margin: 0;
	}

	.donation-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 100%;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-row label {
		font-weight: 700;
		color: #f6f7f9;
	}

	.field-row select,
	.field-row input {
		background: #12161b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		color: #f6f7f9;
		font-size: 1rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.field-row select:focus,
	.field-row input:focus {
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

	.card-element.disabled {
		opacity: 0.5;
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
		padding: 0.75rem 1rem;
		border-radius: 8px;
	}

	.success-message {
		color: rgb(75, 216, 122);
		background: rgba(75, 216, 122, 0.15);
		padding: 0.75rem 1rem;
		border-radius: 8px;
	}

	.signin-reminder {
		margin: 0;
		font-size: 0.9rem;
		color: #c6cad3;
	}


	.donation-summary {
		flex: 1 1 340px;
	}

	.donation-history {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 420px;
	}

	.donation-history > .table-scroll {
		flex: 1;
	}

	.summary-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.print-button {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #f6f7f9;
		border-radius: 999px;
		padding: 0.35rem 0.9rem;
		cursor: pointer;
		font-weight: 600;
	}

	.print-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.total-amount {
		margin: 0 0 0.75rem;
		font-size: 2rem;
		font-weight: 700;
		color: rgb(75, 216, 122);
	}

	.mini-stats {
		display: flex;
		gap: 1.25rem;
		padding: 0;
		margin: 1rem 0 0;
		list-style: none;
	}

	.mini-stats li {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-label {
		font-size: 0.85rem;
		color: #8b909a;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-value {
		font-weight: 700;
		color: #f6f7f9;
	}

	.text-upper {
		text-transform: uppercase;
	}

	.table-scroll {
		max-height: 280px;
		overflow-x: auto;
		overflow-y: auto;
		margin-top: 0.5rem;
		flex: 1;
	}

	.transactions-table {
		width: 100%;
		border-collapse: collapse;
		color: #d0d4dc;
		font-size: 0.95rem;
	}

	.transactions-table th,
	.transactions-table td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		text-align: left;
		vertical-align: top;
	}

	.transactions-table thead th {
		color: #f6f7f9;
		font-weight: 700;
	}

	.payment-id {
		font-family: 'Roboto Mono', monospace;
		font-size: 0.85rem;
		color: #8b909a;
		word-break: break-all;
	}

	.extra-note {
		font-size: 0.85rem;
		color: #8b909a;
		margin-top: 0.75rem;
	}

	@media (max-width: 768px) {
		.dashboard-wrapper {
			gap: 1.5rem;
		}

		.card {
			padding: 1.5rem;
		}

		.mini-stats {
			flex-direction: column;
			gap: 0.75rem;
		}
	}
</style>
