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
		<div class="card card-standard transaction-ledger">
			<div class="summary-header">
				<h2 class="card-title">GASC Transactions</h2>
				<button class="print-button" type="button" @click="printTransactions" :disabled="isFetchingTransactions || nftTransactions.length === 0">
					Export history
				</button>
			</div>
			<p class="card-body muted" v-if="isFetchingTransactions">Loading purchase history…</p>
			<p class="card-body muted" v-else-if="!nftTransactions.length">No GASC purchases recorded yet.</p>
			<div v-else class="table-scroll">
				<table class="transactions-table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Deposit Address</th>
							<th>Coins</th>
							<th>Paid</th>
							<th>Price @ Purchase</th>
							<th>Current 1&nbsp;GASC</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="txn in nftTransactions" :key="txn.paymentIntentId">
							<td>{{ formatTimestamp(txn.createdAtMs ?? txn.createdAt) }}</td>
							<td class="address-cell" :title="txn.depositAddress || '—'">{{ formatAddress(txn.depositAddress) }}</td>
							<td>{{ formatCoins(txn.nftAmount) }}</td>
							<td>{{ formatAmount(txn.amount, txn.currency) }}</td>
							<td>{{ formatPricePerCoin(txn) }}</td>
							<td>{{ currentPriceDisplay }}</td>
						</tr>
					</tbody>
				</table>
			</div>
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
const isFetchingTransactions = ref(false)
const currentGascPrice = ref(null)

const nftTransactions = computed(() =>
	transactions.value.filter((txn) => txn.type === 'nft_purchase')
)
const currentPriceDisplay = computed(() => {
	if (currentGascPrice.value == null) {
		return '—'
	}
	return formatUsd(currentGascPrice.value)
})

const loadTransactions = async () => {
	if (!isAuthenticated.value) {
		transactions.value = []
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
	} catch (error) {
		transactions.value = []
		toast.error(error?.message ?? 'Unable to load transactions.')
	} finally {
		isFetchingTransactions.value = false
	}
}

const loadCurrentPrice = async () => {
	try {
		const callable = httpsCallable(functions, 'getGascPrice')
		const { data } = await callable({ tokenAmount: 1 })
		if (data?.success) {
			currentGascPrice.value = Number(data.finalPrice) || null
		} else {
			currentGascPrice.value = null
		}
	} catch (error) {
		console.error('Failed to load GASC price', error)
		currentGascPrice.value = null
	}
}

const formatAmount = (amount = 0, currency = 'usd') => {
	const dollars = Number(amount) / 100
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(dollars || 0)
}

const formatUsd = (value = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

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

const formatAddress = (address) => {
	if (!address) {
		return '—'
	}
	if (address.length <= 14) {
		return address
	}
	return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const formatCoins = (amount) => {
	const parsed = Number(amount)
	if (!Number.isFinite(parsed)) {
		return '—'
	}
	return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const formatPricePerCoin = (txn) => {
	const coins = Number(txn.nftAmount)
	if (!Number.isFinite(coins) || coins <= 0) {
		return '—'
	}
	const dollars = Number(txn.amount) / 100
	if (!Number.isFinite(dollars)) {
		return '—'
	}
	return formatUsd(dollars / coins)
}

const printTransactions = () => {
	const rows = nftTransactions.value
		.map((txn) => `
			<tr>
				<td>${formatTimestamp(txn.createdAtMs ?? txn.createdAt)}</td>
				<td>${formatAddress(txn.depositAddress)}</td>
				<td>${formatCoins(txn.nftAmount)}</td>
				<td>${formatAmount(txn.amount, txn.currency)}</td>
				<td>${formatPricePerCoin(txn)}</td>
			</tr>
		`)
		.join('')
	const tableHtml = rows
		? `<table style="width:100%;border-collapse:collapse;font-family:Arial, sans-serif;">
			<thead>
				<tr>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Date</th>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Address</th>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Coins</th>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Paid</th>
					<th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Price @ Purchase</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`
		: '<p>No transactions found.</p>'
	const printWindow = window.open('', '_blank', 'width=600,height=800')
	printWindow?.document.write(`
		<html>
			<head><title>GASC Transactions</title></head>
			<body style="padding:24px; font-family:Arial, sans-serif;">
				<h1>GASC Transactions</h1>
				${tableHtml}
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
	loadTransactions()
	loadCurrentPrice()
})

onBeforeUnmount(() => {
	const video = videoRef.value
	if (video) {
		video.pause()
	}
})

watch(isAuthenticated, (value) => {
	if (value) {
		loadTransactions()
		loadCurrentPrice()
	} else {
		transactions.value = []
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

	.transaction-ledger {
		gap: 1rem;
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
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		color: rgba(255, 255, 255, 0.7);
	}

	.address-cell {
		font-family: 'Roboto Mono', monospace;
		word-break: break-all;
		max-width: 240px;
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
