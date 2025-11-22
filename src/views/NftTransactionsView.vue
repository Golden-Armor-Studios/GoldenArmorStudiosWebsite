<template>
	<div class="nft-admin-wrapper">
		<video class="background-video" autoplay muted loop playsinline>
			<source src="/website background - repos.mp4" type="video/mp4">
		</video>

		<section class="card-standard admin-card">
			<header class="header">
				<div class="headline">
					<p class="eyebrow">ADMIN · FINANCE</p>
					<h1>NFT Transactions</h1>
					<p class="intro">
						Live feed of every on-site GASC purchase. Pending rows require on-chain follow up; paid rows include a confirmed transaction hash.
					</p>
					<p class="issuer-line">
						Issuer wallet ({{ ownerAddressShort }}) balance
						<span class="treasury-inline">
							Treasury:
							<a
								:href="treasuryAddressUrl"
								target="_blank"
								rel="noopener noreferrer"
								class="treasury-address"
								:title="TREASURY_ADDRESS"
							>
								{{ TREASURY_ADDRESS }}
							</a>
						</span>
						<span class="issuer-value" :class="{ warning: issuerBalanceEth !== null && issuerBalanceEth < MIN_RECOMMENDED_BALANCE }">
							<span v-if="issuerBalanceLoading">Checking…</span>
							<span v-else>{{ issuerBalanceDisplay }}</span>
						</span>
					</p>
				</div>
			</header>

			<div class="status-pills">
				<button
					v-for="option in statusOptions"
					:key="option.value"
					type="button"
					:class="['status-pill', { active: statusFilter === option.value }]"
					@click="setStatusFilter(option.value)"
				>
					<span class="label">{{ option.label }}</span>
					<span class="count">{{ option.count }}</span>
				</button>
			</div>

			<div class="table-scroll" v-if="!isLoading && filteredTransactions.length">
				<table class="nft-table">
					<thead>
						<tr>
							<th>Status</th>
							<th>Date</th>
							<th>Buyer</th>
							<th>Deposit Address</th>
							<th>Coins</th>
							<th>Paid (USD)</th>
							<th>Stripe Status</th>
							<th>On-chain Status</th>
							<th>Tx Hash</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="txn in filteredTransactions" :key="txn.id">
							<td>
								<span class="status-chip" :class="txn.status">
									{{ formatStatusLabel(txn.status) }}
								</span>
							</td>
							<td>{{ formatTimestamp(txn.createdAtMs ?? txn.createdAt) }}</td>
							<td class="buyer-cell">
								<span class="buyer-name">{{ txn.uid || '—' }}</span>
								<span class="buyer-email" v-if="txn.userEmail">{{ txn.userEmail }}</span>
								<span class="payment-id" v-if="txn.paymentIntentId">PI: {{ txn.paymentIntentId }}</span>
							</td>
							<td class="address-cell" :title="txn.depositAddress || '—'">{{ formatAddress(txn.depositAddress) }}</td>
							<td>{{ formatCoins(txn.nftAmount) }}</td>
							<td>{{ formatAmount(txn.amount, txn.currency) }}</td>
							<td>{{ formatStripeStatus(txn.stripeStatus) }}</td>
							<td>{{ formatStatusLabel(txn.chainStatus || txn.status) }}</td>
							<td>
								<a
									v-if="txn.chainTxHash"
									:href="`https://etherscan.io/tx/${txn.chainTxHash}`"
									target="_blank"
									rel="noopener noreferrer"
								>
									{{ formatTxHash(txn.chainTxHash) }}
								</a>
								<span v-else>—</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div v-else class="empty-state">
				<p v-if="isLoading">Loading transactions…</p>
				<p v-else>No transactions match the selected filter.</p>
			</div>
		</section>
	</div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useToast } from 'vue-toastification'

const toast = useToast()
const transactions = ref([])
const isLoading = ref(false)
const statusFilter = ref('all')
const issuerBalanceEth = ref(null)
const issuerBalanceLoading = ref(false)
const OWNER_ADDRESS = '0x209EC910313D53CBBb6C62cc557dD9608386f980'
const TREASURY_ADDRESS = '0xfe1C048CC0A079b56C940F107cAe7938EB744ae0'
const QUICKNODE_ENDPOINT = 'https://morning-wispy-bird.quiknode.pro/af700ae1acfd7c6bd615fae21faabc68fa3bfcdc/'
const MIN_RECOMMENDED_BALANCE = 0.02
const ownerAddressShort = `${OWNER_ADDRESS.slice(0, 6)}…${OWNER_ADDRESS.slice(-4)}`
const treasuryAddressUrl = `https://etherscan.io/address/${TREASURY_ADDRESS}`
let balanceIntervalId = null

const statusRank = {
	pending: 0,
	paid: 1,
	failed: 2
}

const statusOptions = computed(() => {
	const total = transactions.value.length
	const pendingCount = transactions.value.filter((txn) => txn.status === 'pending').length
	const paidCount = transactions.value.filter((txn) => txn.status === 'paid').length
	const failedCount = total - pendingCount - paidCount
	return [
		{ value: 'all', label: 'All', count: total },
		{ value: 'pending', label: 'Pending', count: pendingCount },
		{ value: 'paid', label: 'Paid', count: paidCount },
		{ value: 'failed', label: 'Failed', count: failedCount }
	]
})

const filteredTransactions = computed(() => {
	const subset = transactions.value.filter((txn) => {
		if (statusFilter.value === 'all') {
			return true
		}
		return txn.status === statusFilter.value
	})

	return subset.slice().sort((a, b) => {
		const statusDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99)
		if (statusDiff !== 0) {
			return statusDiff
		}
		return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)
	})
})

const issuerBalanceDisplay = computed(() => {
	if (issuerBalanceEth.value == null) {
		return '—'
	}
	return `${issuerBalanceEth.value.toFixed(6)} ETH`
})

const fetchTransactions = async () => {
	isLoading.value = true
	try {
		const callable = httpsCallable(functions, 'listNftTransactions')
		const { data } = await callable({ limit: 400 })
		const raw = Array.isArray(data?.transactions) ? data.transactions : []
		transactions.value = raw.map((txn) => ({
			...txn,
			status: txn.status || (txn.chainTxHash ? 'paid' : 'pending'),
			createdAtMs: normalizeTimestamp(txn.createdAtMs ?? txn.createdAt)
		}))
	} catch (error) {
		console.error('Failed to load NFT transactions', error)
		toast.error(error?.message || 'Unable to load NFT transactions.')
		transactions.value = []
	} finally {
		isLoading.value = false
	}
}

const normalizeTimestamp = (value) => {
	if (!value) return null
	if (typeof value === 'number') {
		return value
	}
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date.getTime()
}

const setStatusFilter = (next) => {
	statusFilter.value = next
}

const loadIssuerBalance = async () => {
	issuerBalanceLoading.value = true
	try {
		const response = await fetch(QUICKNODE_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: Date.now(),
				method: 'eth_getBalance',
				params: [TREASURY_ADDRESS, 'latest']
			})
		})

		if (!response.ok) {
			throw new Error(`RPC status ${response.status}`)
		}

		const payload = await response.json()
		if (payload.error) {
			throw new Error(payload.error.message || 'RPC error')
		}
		if (!payload.result) {
			throw new Error('Empty balance result')
		}
		const weiString = payload.result.startsWith('0x') ? payload.result.slice(2) : payload.result
		const weiNumber = Number.parseInt(weiString, 16)
		if (Number.isNaN(weiNumber)) {
			throw new Error('Unable to parse balance result')
		}
		const eth = weiNumber / 1e18
		issuerBalanceEth.value = eth
	} catch (error) {
		console.error('Failed to load issuer balance', error)
		toast.error('Unable to fetch issuer wallet balance.')
		issuerBalanceEth.value = null
	} finally {
		issuerBalanceLoading.value = false
	}
}

const formatTimestamp = (value) => {
	if (!value) return '—'
	const date = typeof value === 'number' ? new Date(value) : new Date(value)
	if (Number.isNaN(date.getTime())) {
		return '—'
	}
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date)
}

const formatAddress = (address) => {
	if (!address) return '—'
	return address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

const formatCoins = (value) => {
	const amount = Number(value) || 0
	return amount.toLocaleString()
}

const formatAmount = (amount, currency = 'usd') => {
	const cents = Number(amount) || 0
	const dollars = cents / 100
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: currency.toUpperCase()
	}).format(dollars)
}

const formatTxHash = (hash) => {
	if (!hash) return '—'
	return hash.length > 14 ? `${hash.slice(0, 10)}…${hash.slice(-4)}` : hash
}

const formatStatusLabel = (status) => {
	if (status === 'paid') return 'Paid'
	if (status === 'pending') return 'Pending'
	if (status === 'failed') return 'Failed'
	return status || 'Unknown'
}

const formatStripeStatus = (status) => {
	if (!status) return '—'
	return status.replace(/_/g, ' ')
}

onMounted(() => {
	fetchTransactions()
	loadIssuerBalance()
	balanceIntervalId = setInterval(loadIssuerBalance, 60000)
})

onBeforeUnmount(() => {
	if (balanceIntervalId) {
		clearInterval(balanceIntervalId)
	}
})
</script>

<style scoped>
.nft-admin-wrapper {
	position: relative;
	min-height: 100vh;
	padding: 2rem 1rem 4rem;
	display: flex;
	justify-content: center;
	width: 100%;
	overflow-x: hidden;
}

.background-video {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	z-index: -2;
	opacity: 0.25;
}

.admin-card {
	width: min(1100px, 100%);
	margin: 0 auto;
	position: relative;
	z-index: 1;
	padding: 20px;
	box-sizing: border-box;
}

.header {
	display: flex;
	justify-content: space-between;
	gap: 1rem;
	flex-wrap: wrap;
	align-items: flex-start;
	position: relative;
}

.headline {
	flex: 1 1 520px;
	text-align: center;
}

.eyebrow {
	text-transform: uppercase;
	letter-spacing: 0.2em;
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.6);
	margin: 0 0 0.5rem;
}

.header h1 {
	margin: 0;
	font-size: 2.4rem;
}

.intro {
	margin: 0.35rem auto 0.85rem;
	color: rgba(255, 255, 255, 0.8);
	max-width: 640px;
}

.issuer-line {
	margin: 0.35rem 0 0;
	font-size: 0.95rem;
	color: rgba(255, 255, 255, 0.8);
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.4rem;
	align-items: center;
	text-align: center;
}

.treasury-inline {
	display: inline-flex;
	flex-direction: column;
	gap: 0.15rem;
	font-size: 0.8rem;
	color: rgba(255, 255, 255, 0.7);
	text-align: center;
}

.treasury-address {
	font-family: 'Roboto Mono', 'SFMono-Regular', Menlo, monospace;
	word-break: break-all;
	color: #4bd87a;
}

.issuer-value {
	margin-left: 0.35rem;
	font-weight: 700;
	font-size: 1rem;
}

.issuer-value.warning {
	color: #ffb347;
}

.ghost-button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.status-pills {
	display: flex;
	gap: 0.5rem;
	margin: 1.25rem 0 1rem;
	flex-wrap: wrap;
	justify-content: center;
}

.status-pill {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.4rem 0.9rem;
	border-radius: 999px;
	border: 1px solid rgba(255, 255, 255, 0.15);
	background: rgba(255, 255, 255, 0.05);
	color: #f6f7f9;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.status-pill.active {
	background: rgba(75, 216, 122, 0.15);
	border-color: rgba(75, 216, 122, 0.8);
	color: #4bd87a;
}

.status-pill .count {
	font-variant-numeric: tabular-nums;
}

.table-scroll {
	max-height: 70vh;
	overflow-y: auto;
	overflow-x: auto;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 16px;
	width: 100%;
	background: rgba(6, 10, 18, 0.6);
	-webkit-overflow-scrolling: touch;
}

.table-scroll::-webkit-scrollbar {
	height: 10px;
}

.table-scroll::-webkit-scrollbar-thumb {
	background: rgba(75, 216, 122, 0.6);
	border-radius: 999px;
}

.table-scroll::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.08);
	border-radius: 999px;
}

.nft-table {
	width: 100%;
	border-collapse: collapse;
	min-width: 960px;
}

.nft-table th,
.nft-table td {
	padding: 0.9rem 1rem;
	text-align: left;
}

.nft-table thead th {
	position: sticky;
	top: 0;
	background: rgba(5, 8, 12, 0.95);
	backdrop-filter: blur(6px);
	font-size: 0.85rem;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.nft-table tbody tr:not(:last-child) td {
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nft-table tbody tr {
	background: rgba(255, 255, 255, 0.01);
}

.nft-table tbody tr:nth-child(even) {
	background: rgba(255, 255, 255, 0.02);
}

.buyer-cell {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	font-size: 0.9rem;
	height: 125px;
}

.buyer-email {
	font-size: 0.8rem;
	color: rgba(255, 255, 255, 0.7);
}

.payment-id {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.6);
}

.address-cell {
	font-family: 'Roboto Mono', 'SFMono-Regular', Menlo, monospace;
}

.status-chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 80px;
	padding: 0.25rem 0.6rem;
	border-radius: 999px;
	text-transform: capitalize;
	font-weight: 600;
	font-size: 0.9rem;
}

.status-chip.pending {
	background: rgba(255, 193, 7, 0.15);
	color: #ffc107;
	border: 1px solid rgba(255, 193, 7, 0.4);
}

.status-chip.paid {
	background: rgba(75, 216, 122, 0.15);
	color: #4bd87a;
	border: 1px solid rgba(75, 216, 122, 0.4);
}

.status-chip.failed {
	background: rgba(255, 107, 107, 0.18);
	color: #ff6b6b;
	border: 1px solid rgba(255, 107, 107, 0.45);
}

.empty-state {
	text-align: center;
	padding: 2rem 1rem;
	color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 768px) {
	.nft-admin-wrapper {
		padding: 1.5rem 0.75rem 3rem;
	}

	.admin-card {
		padding: 16px 10px;
		width: 95vw !important;
	}

	.table-scroll {
		margin: 0 -0.5rem;
		border-radius: 12px;
	}

	.nft-table {
		min-width: 720px;
	}

	.header h1 {
		font-size: 1.9rem;
	}

	.status-pills {
		justify-content: flex-start;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}
}

@media (max-width: 768px) {
	.header {
		flex-direction: column;
	}

	.table-scroll {
		max-height: none;
	}

	.nft-table th,
	.nft-table td {
		padding: 0.75rem;
		font-size: 0.85rem;
	}
}
</style>
.ghost-button {
	border: 1px solid rgba(255, 255, 255, 0.35);
	background: transparent;
	color: #f6f7f9;
	border-radius: 999px;
	padding: 0.5rem 1.5rem;
	font-weight: 600;
	cursor: pointer;
}

.ghost-button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
.ghost-button {
	border: 1px solid rgba(255, 255, 255, 0.35);
	background: transparent;
	color: #f6f7f9;
	border-radius: 999px;
	padding: 0.5rem 1.5rem;
	font-weight: 600;
	cursor: pointer;
	position: absolute;
	right: 0;
	top: 0;
	margin: 15px;
}

.ghost-button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
