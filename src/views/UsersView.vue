<template>
	<div class="users-wrapper">
		<header class="header">
			<h1 class="homepage-title">User Directory</h1>
			<div class="header-actions">
				<button
					type="button"
					class="action-button"
					@click="fetchUsers"
					:disabled="isLoading"
				>
					Refresh
				</button>
			</div>
		</header>

		<p class="context-text homepage-p">
			View every account currently registered across the studio ecosystem. Admin rights are required to access this page.
		</p>

		<div v-if="errorMessage" class="error-message" role="alert">
			{{ errorMessage }}
		</div>

		<div v-if="successMessage" class="success-message" role="status">
			{{ successMessage }}
		</div>

		<div v-if="isLoading" class="status-card card-standard">
			<p class="homepage-p">Loading users…</p>
		</div>

		<div v-else-if="users.length === 0" class="status-card card-standard">
			<p class="homepage-p">
				No users found.
			</p>
		</div>

		<div v-else class="users-table-card card-standard">
			<div
				class="users-table-scroll"
				ref="tableScrollRef"
				@mousedown="startDrag"
				@mousemove="handleDrag"
				@mouseleave="stopDrag"
				@mouseup="stopDrag"
			>
				<table class="users-table">
					<thead>
						<tr>
							<th>Status</th>
							<th>
								<button type="button" class="sort-button" @click="setSortKey('displayName')">
									Name
									<span class="sort-indicator" v-if="sortKey === 'displayName'">
										{{ sortDirection === 'asc' ? '↑' : '↓' }}
									</span>
								</button>
							</th>
							<th>Email</th>
							<th>UID</th>
							<th>Groups</th>
							<th>
								<button type="button" class="sort-button" @click="setSortKey('tokensPurchased')">
									Tokens
									<span class="sort-indicator" v-if="sortKey === 'tokensPurchased'">
										{{ sortDirection === 'asc' ? '↑' : '↓' }}
									</span>
								</button>
							</th>
							<th>
								<button type="button" class="sort-button" @click="setSortKey('usdSpent')">
									USD Spent
									<span class="sort-indicator" v-if="sortKey === 'usdSpent'">
										{{ sortDirection === 'asc' ? '↑' : '↓' }}
									</span>
								</button>
							</th>
							<th>
								<button type="button" class="sort-button" @click="setSortKey('ethSpent')">
									ETH Spent
									<span class="sort-indicator" v-if="sortKey === 'ethSpent'">
										{{ sortDirection === 'asc' ? '↑' : '↓' }}
									</span>
								</button>
							</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="user in sortedUsers" :key="user.uid">
							<td>
								<span class="user-status" :class="user.isApplying ? 'applicant' : 'active'">
									{{ user.isApplying ? 'Applicant' : 'Active' }}
								</span>
							</td>
							<td class="users-name-cell">
								<strong>{{ user.displayName }}</strong>
							</td>
							<td>{{ user.email || '—' }}</td>
							<td class="mono">{{ user.uid }}</td>
							<td>
								<span v-if="user.groups.length">{{ user.groups.join(', ') }}</span>
								<em v-else>none</em>
							</td>
							<td>{{ formatTokenCount(user.tokensPurchased) }}</td>
							<td>{{ formatCurrency(user.usdSpent) }}</td>
							<td>{{ formatEth(user.ethSpent) }}</td>
							<td class="users-actions">
								<button type="button" class="small-button" @click="selectUser(user)">
									Manage
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<div v-if="selectedUser" class="modal-overlay" @click.self="closeEditor">
			<div class="modal-shell">
				<button type="button" class="close-button" @click="closeEditor" aria-label="Close dialog">×</button>
				<aside class="modal-sidebar">
					<div class="profile-avatar large">
						<img
							v-if="selectedUser.photoURL"
							:src="selectedUser.photoURL"
							:alt="`Avatar for ${selectedUser.displayName}`"
						>
						<span v-else>{{ selectedUser.displayName.charAt(0).toUpperCase() }}</span>
					</div>
					<h2>{{ selectedUser.displayName }}</h2>
					<p class="sidebar-meta">{{ selectedUser.email || '—' }}</p>
					<p class="sidebar-label">UID</p>
					<p class="mono">{{ selectedUser.uid }}</p>
					<p class="sidebar-label">Groups</p>
					<p class="sidebar-meta">
						<span v-if="selectedUser.groups?.length">{{ selectedUser.groups.join(', ') }}</span>
						<em v-else>none</em>
					</p>
					<p class="sidebar-label">Status</p>
					<span class="user-status" :class="selectedUser.isApplying ? 'applicant' : 'active'">
						{{ selectedUser.isApplying ? 'Applicant' : 'Active' }}
					</span>
					<p v-if="selectedUser.createdAt" class="sidebar-meta created">
						Created {{ selectedUser.createdAt }}
					</p>
					<div class="sidebar-stats">
						<p class="sidebar-label">Tokens Purchased</p>
						<p class="sidebar-meta">{{ formatTokenCount(selectedUser.tokensPurchased) }} GASC</p>
						<p class="sidebar-label">USD Spent</p>
						<p class="sidebar-meta">{{ formatCurrency(selectedUser.usdSpent) }}</p>
						<p class="sidebar-label">ETH Spent</p>
						<p class="sidebar-meta">{{ formatEth(selectedUser.ethSpent) }}</p>
					</div>
				</aside>
				<div class="modal-main" role="dialog" aria-modal="true">
					<div class="modal-main-header">
						<div>
							<p class="modal-kicker">Management</p>
							<h3>Edit Settings</h3>
						</div>
					</div>
					<div class="editor-content">
						<section class="field">
							<label>Groups & Roles</label>
							<p class="field-subtitle">Toggle the roles this user should retain. Members always keep baseline access.</p>
							<div class="group-options">
								<label
									v-for="group in availableGroups"
									:key="group"
									class="group-option"
								>
									<input
										type="checkbox"
										:value="group"
										v-model="editableGroups"
									>
									<span>{{ group }}</span>
								</label>
							</div>
						</section>

					<section class="field quick-stats">
						<div class="stat-card">
							<p class="stat-label">Role Count</p>
							<p class="stat-value">{{ editableGroups.length }}</p>
						</div>
						<div class="stat-card">
							<p class="stat-label">Developer Track</p>
							<p class="stat-value">{{ editableGroups.includes('developer') ? 'Yes' : 'No' }}</p>
						</div>
						<div class="stat-card">
							<p class="stat-label">Admin</p>
							<p class="stat-value">{{ editableGroups.includes('admin') ? 'Yes' : 'No' }}</p>
						</div>
					</section>

					<section class="transaction-history" v-if="selectedUser.transactions?.length">
						<h4>GASC Transactions</h4>
					<div class="users-table-scroll mini">
							<table class="users-table mini">
								<thead>
									<tr>
										<th>Date</th>
										<th>Tokens</th>
										<th>USD</th>
										<th>Status</th>
										<th>Tx Hash</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="txn in selectedUser.transactions" :key="txn.paymentIntentId || txn.chainTxHash || txn.createdAt">
										<td>{{ txn.createdAt || '—' }}</td>
										<td>{{ formatTokenCount(txn.nftAmount) }}</td>
										<td>{{ formatCurrency(txn.usdAmount) }}</td>
										<td>{{ txn.status }}</td>
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
					</section>

					<div class="editor-actions">
							<button
								type="button"
								class="submit-button"
								@click="submitGroups"
								:disabled="isPerformingAction"
							>
								Save Changes
							</button>
							<button
								type="button"
								class="ghost-button"
								@click="closeEditor"
								:disabled="isPerformingAction"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { useToast } from 'vue-toastification'
import { functions } from '@/firebase'
import { useStore } from 'vuex'

const toast = useToast()
const store = useStore()

const availableGroups = ['member', 'subscriber', 'donor', 'admin', 'developer']

const users = ref([])
const isLoading = ref(false)
const isPerformingAction = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const selectedUser = ref(null)
const editableGroups = ref([])
const sortKey = ref('displayName')
const sortDirection = ref('asc')
const currentProfile = computed(() => store.state.user.profile)

const resetMessages = () => {
	errorMessage.value = ''
	successMessage.value = ''
}

const handleError = (error, fallbackMessage) => {
	const message = error?.message ?? fallbackMessage
	errorMessage.value = message
	toast.error(message)
}

const mapUser = (doc) => ({
	uid: doc.uid,
	email: doc.email,
	displayName: doc.displayName || doc.email || doc.uid,
	groups: doc.groups || [],
	isApplying: Boolean(doc.isApplying),
	application: doc.application || null,
	createdAt: doc.createdAt ?? null,
	photoURL: doc.photoURL || null,
	tokensPurchased: Number(doc.tokensPurchased) || 0,
	usdSpent: Number(doc.usdSpent) || 0,
	ethSpent: Number(doc.ethSpent) || 0,
	transactions: Array.isArray(doc.transactions) ? doc.transactions : []
})

const fetchUsers = async () => {
	resetMessages()
	isLoading.value = true

	try {
		const callable = httpsCallable(functions, 'listUsers')
		const response = await callable({
			applicantsOnly: false
		})

		const mapped = Array.isArray(response.data)
			? response.data.map(mapUser)
			: []

		const current = currentProfile.value
		users.value = mapped.map((user) => {
			if (current && user.uid === current.uid) {
				return {
					...user,
					photoURL: current.photoURL || user.photoURL,
					displayName: current.displayName || user.displayName,
					email: current.email || user.email
				}
			}
			return user
		})

		successMessage.value = `Loaded ${users.value.length} users.`
	} catch (error) {
		handleError(error, 'Unable to load users.')
	} finally {
		isLoading.value = false
	}
}

const selectUser = (user) => {
	selectedUser.value = { ...user }
	editableGroups.value = [...(user.groups || [])]
}

const closeEditor = () => {
	selectedUser.value = null
	editableGroups.value = []
}

watch(currentProfile, (profile) => {
	if (!profile || !selectedUser.value) {
		return
	}
	if (selectedUser.value.uid === profile.uid) {
		selectedUser.value = {
			...selectedUser.value,
			photoURL: profile.photoURL || selectedUser.value.photoURL,
			displayName: profile.displayName || selectedUser.value.displayName,
			email: profile.email || selectedUser.value.email
		}
		const target = users.value.find((user) => user.uid === profile.uid)
		if (target) {
			target.photoURL = selectedUser.value.photoURL
			target.displayName = selectedUser.value.displayName
			target.email = selectedUser.value.email
		}
	}
})

const ensureDefaultGroup = (groups) => {
	if (!groups.includes('member')) {
		groups.push('member')
	}
	return Array.from(new Set(groups))
}

const submitGroups = async () => {
	if (!selectedUser.value) {
		return
	}

	isPerformingAction.value = true
	resetMessages()

	try {
		const payloadGroups = ensureDefaultGroup([...editableGroups.value])
			.filter((group) => availableGroups.includes(group))

		const callable = httpsCallable(functions, 'updateUserGroups')
		await callable({
			uid: selectedUser.value.uid,
			groups: payloadGroups
		})

		selectedUser.value.groups = payloadGroups
		const target = users.value.find((user) => user.uid === selectedUser.value.uid)
		if (target) {
			target.groups = payloadGroups
		}

		successMessage.value = 'Groups updated successfully.'
		toast.success(successMessage.value)
	} catch (error) {
		handleError(error, 'Unable to update groups.')
	} finally {
		isPerformingAction.value = false
	}
}

const sortableNumericKeys = new Set(['tokensPurchased', 'usdSpent', 'ethSpent'])

const getSortableValue = (user, key) => {
	if (sortableNumericKeys.has(key)) {
		return Number(user?.[key]) || 0
	}
	return (user?.[key] || '').toString().toLowerCase()
}

const setSortKey = (key) => {
	if (sortKey.value === key) {
		sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
	} else {
		sortKey.value = key
		sortDirection.value = 'asc'
	}
}

const formatTokenCount = (value) => {
	const numeric = Number(value) || 0
	return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const formatCurrency = (value) => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(Number(value) || 0)
}

const formatEth = (value) => {
	const numeric = Number(value) || 0
	return `${numeric.toFixed(4)} ETH`
}

const formatTxHash = (hash) => {
	if (!hash) return '—'
	return hash.length > 14 ? `${hash.slice(0, 10)}…${hash.slice(-4)}` : hash
}

const sortedUsers = computed(() => {
	const key = sortKey.value
	const direction = sortDirection.value === 'asc' ? 1 : -1

	return [...users.value].sort((a, b) => {
		const aValue = getSortableValue(a, key)
		const bValue = getSortableValue(b, key)

		if (aValue < bValue) return -1 * direction
		if (aValue > bValue) return 1 * direction
		return 0
	})
})

onMounted(fetchUsers)

const tableScrollRef = ref(null)
const isDragging = ref(false)
let dragStartX = 0
let scrollStart = 0

const startDrag = (event) => {
	const target = event.currentTarget
	if (!target) return
	isDragging.value = true
	dragStartX = event.clientX
	scrollStart = target.scrollLeft
	target.classList.add('dragging')
}

const handleDrag = (event) => {
	const target = event.currentTarget
	if (!isDragging.value || !target) return
	const dx = event.clientX - dragStartX
	target.scrollLeft = scrollStart - dx
}

const stopDrag = (event) => {
	const target = event.currentTarget
	if (!target) return
	isDragging.value = false
	target.classList.remove('dragging')
}
</script>

<style scoped>
.users-wrapper {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	width: min(1100px, 100%);
}

.header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
}

.header-actions {
	display: flex;
	gap: 0.75rem;
}

.action-button {
	background: rgba(75, 216, 122, 0.2);
	color: rgb(75, 216, 122);
	border: none;
	border-radius: 999px;
	padding: 0.6rem 1.2rem;
	font-weight: 600;
	cursor: pointer;
	transition: filter 0.2s ease;
}

.action-button:disabled {
	filter: grayscale(0.5);
	cursor: not-allowed;
}

.action-button:hover:not(:disabled) {
	filter: brightness(1.1);
}

.context-text {
	color: #b9bcc3;
	margin-bottom: 0.5rem;
}

.status-card {
	padding: 1.5rem;
	border-radius: 20px;
}

.users-table-card {
	width: 100%;
	padding: 0;
}

.users-table-scroll {
	width: 100%;
	border-radius: 18px;
	border: 1px solid rgba(255, 255, 255, 0.12);
	background: rgba(6, 10, 18, 0.7);
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
	cursor: grab;
}

.users-table-scroll.dragging {
	cursor: grabbing;
}

.users-table {
	width: 100%;
	min-width: 1200px;
	border-collapse: collapse;
}

.users-table.mini {
	min-width: 700px;
}

.users-table th,
.users-table td {
	padding: 0.85rem 1rem;
	text-align: left;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.users-table thead th {
	text-transform: uppercase;
	letter-spacing: 0.05em;
	font-size: 0.8rem;
	color: rgba(255, 255, 255, 0.75);
	background: rgba(5, 8, 12, 0.9);
	position: sticky;
	top: 0;
	z-index: 1;
}

.sort-button {
	background: transparent;
	border: none;
	color: inherit;
	font: inherit;
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	cursor: pointer;
	text-transform: inherit;
	letter-spacing: inherit;
}

.sort-indicator {
	font-size: 0.75rem;
}

.users-table tbody tr:nth-child(even) {
	background: rgba(255, 255, 255, 0.02);
}

.users-table-scroll::-webkit-scrollbar {
	height: 10px;
}

.users-table-scroll::-webkit-scrollbar-thumb {
	background: linear-gradient(90deg, #34c670, #7ef0a4);
	border-radius: 999px;
}

.users-table-scroll::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.08);
	border-radius: 999px;
}

.transaction-history {
	margin-top: 2rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.transaction-history h4 {
	margin: 0;
	color: #f6f7f9;
	font-size: 1.2rem;
}

.user-status {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 90px;
	padding: 0.25rem 0.6rem;
	border-radius: 999px;
	font-weight: 600;
	font-size: 0.8rem;
	text-transform: capitalize;
}

.user-status.active {
	background: rgba(75, 216, 122, 0.18);
	color: #4bd87a;
	border: 1px solid rgba(75, 216, 122, 0.5);
}

.user-status.applicant {
	background: rgba(255, 193, 7, 0.2);
	color: #ffc107;
	border: 1px solid rgba(255, 193, 7, 0.45);
}

.users-name-cell strong {
	color: #f6f7f9;
}

.mono {
	font-family: 'Roboto Mono', 'SFMono-Regular', Menlo, monospace;
	font-size: 0.85rem;
	color: #c1c3c9;
	word-break: break-all;
	min-width: 280px;
}

.users-detail {
	font-size: 0.82rem;
	color: rgba(255, 255, 255, 0.75);
}

.users-actions {
	text-align: right;
}

.small-button {
	background: rgb(75, 216, 122);
	color: #0f1419;
	border: none;
	border-radius: 8px;
	padding: 0.4rem 0.9rem;
	font-weight: 700;
	cursor: pointer;
	transition: filter 0.2s ease;
}

.small-button:hover {
	filter: brightness(1.1);
}

.modal-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.65);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1.5rem;
	z-index: 1000;
}

.modal-shell {
	display: grid;
	grid-template-columns: 320px minmax(0, 600px);
	background: #11161c;
	border-radius: 24px;
	box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
	width: min(1100px, 100%);
	max-height: 90vh;
	overflow: hidden;
}

.modal-sidebar {
	background: rgba(255, 255, 255, 0.02);
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	position: relative;
	overflow-y: auto;
}

.modal-sidebar h2 {
	margin: 0.75rem 0 0.2rem;
	font-size: 1.4rem;
}

.modal-main {
	padding: 2rem;
	background: #1c222b;
	width: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.modal-main-header {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	margin-bottom: 1.5rem;
}

.modal-kicker {
	text-transform: uppercase;
	letter-spacing: 0.2em;
	font-size: 0.7rem;
	color: rgba(255, 255, 255, 0.5);
	margin: 0 0 0.3rem;
}

.modal-main-header h3 {
	margin: 0;
	font-size: 1.8rem;
}

.close-button {
	position: absolute;
	top: 1rem;
	right: 1rem;
	background: transparent;
	border: none;
	color: #b9bcc3;
	font-size: 1.8rem;
	cursor: pointer;
	z-index: 2;
}
.editor-content {
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
	padding-bottom: 1rem;
	overflow-y: auto;
}

.profile-avatar {
	width: 64px;
	height: 64px;
	border-radius: 50%;
	background: rgba(75, 216, 122, 0.2);
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 1.5rem;
	color: #4bd87a;
	overflow: hidden;
}

.profile-avatar.large {
	width: 96px;
	height: 96px;
	font-size: 2.2rem;
}

.profile-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.sidebar-meta {
	margin: 0;
	color: rgba(255, 255, 255, 0.7);
	font-size: 0.9rem;
}

.sidebar-label {
	margin: 0.4rem 0 0.1rem;
	font-size: 0.75rem;
	text-transform: uppercase;
	color: rgba(255, 255, 255, 0.5);
	letter-spacing: 0.1em;
}

.sidebar-meta.created {
	margin-top: 1rem;
	font-size: 0.8rem;
	color: rgba(255, 255, 255, 0.55);
}

.sidebar-stats {
	margin-top: 0.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.profile-details p {
	margin: 0.15rem 0;
	color: #d9dce2;
	font-size: 0.9rem;
}

.profile-details .mono,
.sidebar-meta .mono,
.mono {
	font-family: 'Roboto Mono', 'SFMono-Regular', Menlo, monospace;
	font-size: 0.85rem;
}

.field {
	display: flex;
	flex-direction: column;
	gap: 0.65rem;
}

label {
	font-weight: 700;
	color: #f6f7f9;
}

.field-subtitle {
	margin: 0;
	color: rgba(255, 255, 255, 0.65);
	font-size: 0.85rem;
}

.quick-stats {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 0.75rem;
	padding: 0.2rem 0;
}

.stat-card {
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 12px;
	padding: 0.85rem;
	background: rgba(255, 255, 255, 0.02);
}

.stat-label {
	margin: 0;
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.55);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.stat-value {
	margin: 0.25rem 0 0;
	font-size: 1.2rem;
	font-weight: 700;
}

.editor-actions {
	display: flex;
	gap: 0.8rem;
	justify-content: flex-end;
	align-items: center;
}

.submit-button {
	background: linear-gradient(135deg, #4bd87a, #7df0a3);
	color: #0f1419;
	border: none;
	border-radius: 999px;
	padding: 0.6rem 1.5rem;
	font-weight: 700;
	cursor: pointer;
	transition: transform 0.15s ease, filter 0.2s ease;
}

.submit-button:hover:not(:disabled) {
	filter: brightness(1.08);
	transform: translateY(-1px);
}

.submit-button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.ghost-button {
	background: transparent;
	border: 1px solid rgba(75, 216, 122, 0.8);
	color: #4bd87a;
	border-radius: 999px;
	padding: 0.55rem 1.4rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s ease, color 0.2s ease;
}

.ghost-button:hover:not(:disabled) {
	background: rgba(75, 216, 122, 0.2);
}

.ghost-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

@media (max-width: 768px) {
	.users-table-card {
		width: 95vw !important;
	}

	.users-table-scroll {
		margin: 0 -0.5rem;
		border-radius: 12px;
	}

	.users-table {
		min-width: 720px;
	}
}
</style>
