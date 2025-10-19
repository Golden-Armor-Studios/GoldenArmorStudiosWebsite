<template>
	<div class="dashboard-wrapper">
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

		<section class="card-grid">
			<div class="card card-standard donation-summary">
				<div class="summary-header">
					<h2 class="card-title">Total Donations</h2>
					<button class="print-button" type="button" @click="printTransactions" :disabled="isFetchingTransactions || transactions.length === 0">
						Print transactions to date
					</button>
				</div>
				<p class="card-body" v-if="isFetchingTransactions">Loading your donation history…</p>
		<div v-else>
			<p class="total-amount">{{ formattedTotal }}</p>
			<p class="card-body muted" v-if="!transactions.length">No donations recorded yet. Thank you for your support!</p>
		</div>
			</div>
		</section>
	</div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
const isDonor = computed(() => groups.value.includes('donor'))
const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])

const transactions = ref([])
const totalAmount = ref(0)
const baseCurrency = ref('usd')
const isFetchingTransactions = ref(false)

const formattedTotal = computed(() => {
	const dollars = totalAmount.value / 100
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: baseCurrency.value.toUpperCase() }).format(dollars || 0)
})

const loadTransactions = async () => {
	if (!isAuthenticated.value) {
		transactions.value = []
		totalAmount.value = 0
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
	loadTransactions()
})

watch(isAuthenticated, (value) => {
	if (value) {
		loadTransactions()
	} else {
		transactions.value = []
		totalAmount.value = 0
	}
})
</script>

<style scoped>
	.dashboard-wrapper {
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

	.card-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.5rem;
		width: 100%;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.75rem;
		border-radius: 16px;
		background: #1f2329;
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
		text-decoration: none;
		color: inherit;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		border: 1px solid rgba(255, 255, 255, 0.05);
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
	}

	.card-link {
		color: rgb(75, 216, 122);
		font-weight: 700;
	}

	.admin-card {
		background: linear-gradient(145deg, rgba(31, 35, 41, 0.95), rgba(39, 43, 49, 0.95));
		border-color: rgba(75, 216, 122, 0.35);
	}

	.donation-summary {
		flex: 1 1 340px;
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
	}

	@media (max-width: 768px) {
		.dashboard-wrapper {
			gap: 1.5rem;
		}

		.card {
			padding: 1.5rem;
		}
	}
</style>
