<template>
	<div class="devs-wrapper">
		<header class="header">
			<h1 class="homepage-title">Team Management</h1>
			<div class="header-actions">
				<button
					type="button"
					class="action-button"
					@click="toggleApplicants"
					:disabled="isLoading"
				>
					<span v-if="isApplicantsMode">Show Active Members</span>
					<span v-else>Show Applicants</span>
				</button>
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
			Manage team member access and review applicants. Only administrators can view and edit this page.
		</p>

		<div v-if="errorMessage" class="error-message" role="alert">
			{{ errorMessage }}
		</div>

		<div v-if="successMessage" class="success-message" role="status">
			{{ successMessage }}
		</div>

		<div v-if="isLoading" class="status-card card-standard">
			<p class="homepage-p">Loading {{ isApplicantsMode ? 'applicants' : 'team members' }}…</p>
		</div>

		<div v-else-if="users.length === 0" class="status-card card-standard">
			<p class="homepage-p">
				No {{ isApplicantsMode ? 'applicants' : 'team members' }} found.
			</p>
		</div>

		<div v-else class="devs-table-card card-standard">
			<div
				class="devs-table-scroll"
				ref="tableScrollRef"
				@mousedown="startDrag"
				@mousemove="handleDrag"
				@mouseleave="stopDrag"
				@mouseup="stopDrag"
			>
				<table class="devs-table">
					<colgroup>
						<col class="col-status">
						<col class="col-name">
						<col class="col-email">
						<col class="col-uid">
						<col class="col-groups">
						<col class="col-details">
						<col class="col-actions">
					</colgroup>
					<thead>
						<tr>
							<th>Status</th>
							<th>Name</th>
							<th>Email</th>
							<th>UID</th>
							<th>Groups</th>
							<th>Details</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="user in users" :key="user.uid">
							<td>
								<span class="dev-status" :class="user.isApplying ? 'applicant' : 'active'">
									{{ user.isApplying ? 'Applicant' : 'Active' }}
								</span>
							</td>
							<td class="devs-name-cell">
								<strong>{{ user.displayName }}</strong>
							</td>
							<td class="devs-email" :title="user.email || '—'">{{ user.email || '—' }}</td>
							<td class="mono">{{ user.uid }}</td>
							<td>
								<span v-if="user.groups.length">{{ user.groups.join(', ') }}</span>
								<em v-else>none</em>
							</td>
							<td>
								<div class="devs-detail" v-if="user.application?.developerType">
									Role: {{ user.application.developerType }}
								</div>
								<div class="devs-detail" v-if="user.application?.experience !== undefined">
									Exp: {{ user.application.experience }} yrs
								</div>
								<div class="devs-detail" v-if="user.application?.about">
									{{ user.application.about }}
								</div>
							</td>
							<td class="devs-actions">
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
			<div class="modal-container" role="dialog" aria-modal="true">
				<div class="editor-header">
					<h2 class="homepage-title">
						Manage
						<br>
						<span class="sub-heading">{{ selectedUser.displayName }}</span>
					</h2>
					<button type="button" class="close-button" @click="closeEditor" aria-label="Close dialog">×</button>
				</div>

				<div class="editor-content">
					<div class="field">
						<label>Groups</label>
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
									:disabled="isApplyingGroupRestriction(group)"
								>
								<span>{{ group }}</span>
							</label>
						</div>
					</div>

					<div class="field" v-if="selectedUser.application">
						<label>Application</label>
						<ul class="application-details">
							<li v-if="selectedUser.application.developerType">
								<strong>Role:</strong> {{ selectedUser.application.developerType }}
							</li>
							<li v-if="selectedUser.application.experience !== undefined">
								<strong>Experience:</strong> {{ selectedUser.application.experience }} yrs
							</li>
							<li v-if="selectedUser.application.languages?.length">
								<strong>Languages:</strong> {{ selectedUser.application.languages.join(', ') }}
							</li>
							<li v-if="selectedUser.application.portfolio">
								<strong>Portfolio:</strong>
								<a :href="selectedUser.application.portfolio" target="_blank" rel="noopener">
									{{ selectedUser.application.portfolio }}
								</a>
							</li>
							<li v-if="selectedUser.application.otherLinks">
								<strong>Other links:</strong> {{ selectedUser.application.otherLinks }}
							</li>
							<li v-if="selectedUser.application.address">
								<strong>Address:</strong> {{ selectedUser.application.address }}
							</li>
							<li v-if="selectedUser.application.phone">
								<strong>Phone:</strong> {{ selectedUser.application.phone }}
							</li>
							<li v-if="selectedUser.application.about">
								<strong>About:</strong> {{ selectedUser.application.about }}
							</li>
						</ul>
					</div>

					<div class="editor-actions">
						<button
							type="button"
							class="submit-button"
							@click="submitGroups"
							:disabled="isPerformingAction"
						>
							Save Groups
						</button>
						<button
							v-if="canDeleteSelected"
							type="button"
							class="danger-button"
							@click="deleteSelectedUser"
							:disabled="isPerformingAction"
						>
							Delete User
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed, onMounted, ref } from 'vue'
	import { useStore } from 'vuex'
	import { httpsCallable } from 'firebase/functions'
	import { useToast } from 'vue-toastification'
	import { functions } from '@/firebase'

	const store = useStore()
	const toast = useToast()

	const availableGroups = ['member', 'subscriber', 'donor', 'admin', 'developer']

	const users = ref([])
	const isLoading = ref(false)
	const isPerformingAction = ref(false)
	const isApplicantsMode = ref(false)
	const errorMessage = ref('')
	const successMessage = ref('')
	const tableScrollRef = ref(null)
	const isDragging = ref(false)
	let dragStartX = 0
	let scrollStart = 0

	const selectedUser = ref(null)
	const editableGroups = ref([])

	const currentUserUid = computed(() => store.state.user.profile?.uid)

	const canDeleteSelected = computed(() => {
		if (!selectedUser.value) {
			return false
		}
		// Prevent removing yourself or deleting other admins unless viewer is also admin
		if (selectedUser.value.uid === currentUserUid.value) {
			return false
		}
		return true
	})

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
		createdAt: doc.createdAt ?? null
	})

	const fetchUsers = async () => {
		resetMessages()
		isLoading.value = true

		try {
			const callable = httpsCallable(functions, 'listUsers')
			const response = await callable({
				applicantsOnly: isApplicantsMode.value
			})

			users.value = Array.isArray(response.data)
				? response.data.map(mapUser)
				: []

			successMessage.value = `Loaded ${users.value.length} ${isApplicantsMode.value ? 'applicants' : 'team members'}.`
		} catch (error) {
			handleError(error, 'Unable to load users.')
		} finally {
			isLoading.value = false
		}
	}

	const toggleApplicants = async () => {
		isApplicantsMode.value = !isApplicantsMode.value
		selectedUser.value = null
		await fetchUsers()
	}

	const selectUser = (user) => {
		selectedUser.value = { ...user }
		editableGroups.value = [...(user.groups || [])]
	}

	const closeEditor = () => {
		selectedUser.value = null
		editableGroups.value = []
	}

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

	const deleteSelectedUser = async () => {
		if (!selectedUser.value) {
			return
		}

		const confirmation = window.confirm('Are you sure you want to delete this user? This action cannot be undone.')
		if (!confirmation) {
			return
		}

		isPerformingAction.value = true
		resetMessages()

		try {
			const callable = httpsCallable(functions, 'deleteUserAccount')
			await callable({
				uid: selectedUser.value.uid
			})

			users.value = users.value.filter((user) => user.uid !== selectedUser.value.uid)
			toast.success('User deleted.')
			closeEditor()
		} catch (error) {
			handleError(error, 'Unable to delete user.')
		} finally {
			isPerformingAction.value = false
		}
	}

	const isApplyingGroupRestriction = (group) => {
		// Applicants must remain at least "member" until processed.
		return selectedUser.value?.isApplying && group === 'member' && editableGroups.value.length === 1
	}

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
		const target = event?.currentTarget || tableScrollRef.value
		if (!target) return
		isDragging.value = false
		target.classList.remove('dragging')
	}

	onMounted(fetchUsers)
</script>

<style scoped>
	.devs-wrapper {
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

	.devs-table-card {
		width: 100%;
		padding: 0;
	}

	.devs-table-scroll {
		width: 100%;
		border-radius: 18px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(6, 10, 18, 0.7);
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		cursor: grab;
	}

	.devs-table-scroll.dragging {
		cursor: grabbing;
	}

	.devs-table-scroll::-webkit-scrollbar {
		height: 10px;
	}

	.devs-table-scroll::-webkit-scrollbar-thumb {
		background: linear-gradient(90deg, #34c670, #7ef0a4);
		border-radius: 999px;
	}

	.devs-table-scroll::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 999px;
	}

.devs-table {
	width: 100%;
	min-width: 1100px;
	border-collapse: collapse;
}

.devs-table th:nth-child(1),
.devs-table td:nth-child(1) {
	width: 110px;
}

.devs-table th:nth-child(2),
.devs-table td:nth-child(2) {
	width: 200px;
}

.devs-table th:nth-child(3),
.devs-table td:nth-child(3) {
	width: 220px;
}

.devs-table th:nth-child(4),
.devs-table td:nth-child(4) {
	width: 260px;
}

.devs-table th:nth-child(5),
.devs-table td:nth-child(5) {
	width: 200px;
}

.devs-table th:nth-child(6),
.devs-table td:nth-child(6) {
	width: 280px;
}

.devs-table th:nth-child(7),
.devs-table td:nth-child(7) {
	width: 140px;
}

.devs-table th,
.devs-table td {
	padding: 0.85rem 1rem;
	text-align: left;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.devs-table thead th {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.75);
		background: rgba(5, 8, 12, 0.9);
		position: sticky;
		top: 0;
		z-index: 1;
	}

.devs-table tbody tr:nth-child(even) {
	background: rgba(255, 255, 255, 0.02);
}

.col-status {
	width: 110px;
}

.col-name {
	width: 200px;
}

.col-email {
	width: 260px;
}

.col-uid {
	width: 320px;
}

.col-groups {
	width: 220px;
}

.col-details {
	width: 320px;
}

.col-actions {
	width: 140px;
}

	.dev-status {
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

	.dev-status.active {
		background: rgba(75, 216, 122, 0.18);
		color: #4bd87a;
		border: 1px solid rgba(75, 216, 122, 0.5);
	}

	.dev-status.applicant {
		background: rgba(255, 193, 7, 0.2);
		color: #ffc107;
		border: 1px solid rgba(255, 193, 7, 0.45);
	}

	.devs-name-cell strong {
		color: #f6f7f9;
	}

.devs-email {
	font-family: 'Roboto Mono', 'SFMono-Regular', Menlo, monospace;
	font-size: 0.85rem;
	color: #f6f7f9;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.devs-uid,
.mono {
	font-family: 'Roboto Mono', 'SFMono-Regular', Menlo, monospace;
	font-size: 0.85rem;
	color: #c1c3c9;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

	.devs-detail {
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.75);
	}

	.devs-actions {
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

	.modal-container {
		background: #1f2329;
		border-radius: 18px;
		box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
		padding: 1.75rem;
		width: min(720px, 100%);
		max-height: 90vh;
		overflow-y: auto;
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.close-button {
		background: transparent;
		border: none;
		color: #b9bcc3;
		font-size: 1.8rem;
		line-height: 1;
		cursor: pointer;
	}

	.editor-content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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

	.group-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}

	.group-option {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #12161b;
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}

	.application-details {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		color: #d0d4dc;
		font-size: 0.95rem;
	}

	.application-details strong {
		color: #f6f7f9;
	}

	.editor-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.submit-button {
		background: rgb(75, 216, 122);
		color: #0f1419;
		border: none;
		border-radius: 10px;
		padding: 0.75rem 1.6rem;
		font-weight: 700;
		cursor: pointer;
		transition: filter 0.2s ease;
	}

	.submit-button:disabled {
		cursor: not-allowed;
		filter: grayscale(0.5);
	}

	.submit-button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.danger-button {
		background: rgba(255, 107, 107, 0.2);
		color: #ff6b6b;
		border: none;
		border-radius: 10px;
		padding: 0.75rem 1.4rem;
		font-weight: 700;
		cursor: pointer;
		transition: filter 0.2s ease;
	}

	.danger-button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.error-message {
		color: #ff6b6b;
		background: rgba(255, 107, 107, 0.12);
		padding: 0.85rem 1.1rem;
		border-radius: 10px;
	}

	.success-message {
		color: rgb(75, 216, 122);
		background: rgba(75, 216, 122, 0.12);
		padding: 0.85rem 1.1rem;
		border-radius: 10px;
	}

	@media (max-width: 720px) {
		.devs-table-card {
			width: 95vw !important;
		}

		.devs-table-scroll {
			margin: 0 -0.5rem;
			border-radius: 12px;
		}

		.devs-table {
			min-width: 720px;
		}

		.editor-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
