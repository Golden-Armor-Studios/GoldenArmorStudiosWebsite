<template>
	<div id="app">
		<nav class="nav-bar">
			<button
				class="nav-toggle"
				type="button"
				@click="toggleNav"
				:aria-expanded="isNavOpen"
				aria-controls="primary-navigation"
				title="Toggle navigation"
			>
				<span class="sr-only">Toggle navigation</span>
				<span class="nav-toggle-bar"></span>
				<span class="nav-toggle-bar"></span>
				<span class="nav-toggle-bar"></span>
			</button>

			<div
				id="primary-navigation"
				class="nav-links"
				:class="{ open: isNavOpen }"
			>
				<RouterLink class="nav-link" to="/" @click="closeNav">Home</RouterLink>
				<RouterLink v-if="isAuthenticated" class="nav-link" to="/dashboard" @click="closeNav">Dashboard</RouterLink>
				<RouterLink v-if="!isAuthenticated" class="nav-link" to="/login" @click="closeNav">Login</RouterLink>
				<RouterLink class="nav-link" to="/project-status" @click="closeNav">Project Status</RouterLink>
				<RouterLink class="nav-link" to="/coloriq-status" @click="closeNav">Color IQ Status</RouterLink>
				<RouterLink class="nav-link" to="/community" @click="closeNav">Join Us on Discord</RouterLink>
				<RouterLink v-if="isAuthenticated" class="nav-link" to="/join-team" @click="closeNav">Join the Team</RouterLink>
				<RouterLink v-if="isAdmin" class="nav-link" to="/devs" @click="closeNav">Team Admin</RouterLink>

				<div v-if="isAuthenticated" ref="menuRef" class="user-menu">
					<span class="login-status">Logged in as {{ displayName }}</span>
					<button
						class="avatar-button"
						type="button"
						@click.stop="toggleDropdown"
						@keydown="handleAvatarKeydown"
						:aria-expanded="isDropdownOpen"
						aria-haspopup="true"
						title="Account menu"
					>
						<div class="avatar">
							<img
								v-if="avatarUrl"
								:src="avatarUrl"
								alt="User avatar"
								class="avatar-image"
							>
							<span v-else class="avatar-initial">{{ avatarInitial }}</span>
						</div>
					</button>
					<div v-if="isDropdownOpen" class="user-dropdown">
						<p class="dropdown-header">
							Signed in as <strong>{{ displayName }}</strong>
						</p>
						<button class="dropdown-button" type="button" @click="handleSignOut">
							Sign Out
						</button>
					</div>
				</div>
			</div>
		</nav>
		<div v-if="isNavOpen" class="nav-overlay" @click="closeNav"></div>
		<main class="view-wrapper">
			<RouterView />
		</main>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { useToast } from 'vue-toastification'

const store = useStore()
const toast = useToast()
const route = useRoute()

const isAuthenticated = computed(() => store.getters['user/isAuthenticated'])
const profile = computed(() => store.state.user.profile)
const groups = computed(() => store.getters['user/userGroups'] || [])
const isAdmin = computed(() => groups.value.includes('admin'))
const displayName = computed(() => profile.value?.displayName || profile.value?.email || 'Member')
const avatarUrl = computed(() => profile.value?.photoURL || '')
const avatarInitial = computed(() => displayName.value.charAt(0).toUpperCase())

const isNavOpen = ref(false)
const isDropdownOpen = ref(false)
const menuRef = ref(null)

const toggleNav = () => {
	isNavOpen.value = !isNavOpen.value
}

const closeNav = () => {
	isNavOpen.value = false
	isDropdownOpen.value = false
}

const toggleDropdown = () => {
	isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
	isDropdownOpen.value = false
}

const onDocumentClick = (event) => {
	if (!menuRef.value) {
		return
	}
	if (!menuRef.value.contains(event.target)) {
		closeDropdown()
	}
}

const onEscapePress = (event) => {
	if (event.key === 'Escape') {
		closeDropdown()
	}
}

onMounted(() => {
	document.addEventListener('click', onDocumentClick)
	document.addEventListener('keyup', onEscapePress)
})

onBeforeUnmount(() => {
	document.removeEventListener('click', onDocumentClick)
	document.removeEventListener('keyup', onEscapePress)
})

watch(isAuthenticated, (value) => {
	if (!value) {
		closeNav()
	}
})

watch(
	() => route.fullPath,
	() => {
		closeNav()
	}
)

const handleSignOut = async () => {
	await store.dispatch('user/logout')
	closeNav()
	toast.success('Signed out successfully.')
}

const handleAvatarKeydown = (event) => {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault()
		toggleDropdown()
	}
}
</script>

<style>
	.homepage-link {
		color: rgb(75, 216, 122) !important;
	}
	.card-standard {
		width: 100% !important;
		max-width: 360px;
		min-height: 320px !important;
		box-sizing: border-box;
		margin: 0 auto;
	}

	@media (max-width: 800px) {
		.card-standard {
			max-width: 100%;
		}
	}
	.color-iq-video {
		width: 200px;
	}
	.silkscreen-regular {
		font-family: "Silkscreen", sans-serif;
		font-weight: 400;
		font-style: normal;
	}

	.silkscreen-bold {
		font-family: "Silkscreen", sans-serif;
		font-weight: 700;
		font-style: normal;
	}
	.winky-sans-400 {
		font-family: "Winky Sans", sans-serif;
		font-optical-sizing: auto;
		font-weight: 400;
		font-style: normal;
	}
	body {
		background-color: #21252a;
		margin: 0;
	}
	.logo {
		width: 200px;
	}
	.homepage-p {
		font-size: 1.5em;
		color: white;
	}
	.homepage-title {
		font-size: 3.5em;
		color: white;
	}

	#app {
		font-family: Avenir, Helvetica, Arial, sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-align: center;
		color: #2c3e50;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40px 16px;
		box-sizing: border-box;
	}

	.nav-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		max-width: 960px;
		margin-bottom: 2rem;
		position: relative;
	}

	.nav-toggle {
		display: none;
		flex-direction: column;
		gap: 6px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0.4rem;
	}

	.nav-toggle-bar {
		width: 26px;
		height: 3px;
		background: #f5f8fa;
		border-radius: 999px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.nav-link {
		color: white;
		font-weight: 700;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.nav-link:hover {
		color: rgb(75, 216, 122);
	}

	.nav-link.router-link-active {
		color: rgb(75, 216, 122);
	}

	.nav-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 40;
	}

	.view-wrapper {
		flex: 1;
		width: min(900px, 100%);
		display: flex;
		justify-content: center;
	}

	.user-menu {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		position: relative;
	}

	.login-status {
		color: #d0d4dc;
		font-size: 0.95rem;
	}

	.avatar-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 999px;
		transition: transform 0.1s ease, filter 0.2s ease;
	}

	.avatar-button:focus-visible {
		outline: 2px solid rgb(75, 216, 122);
		outline-offset: 3px;
	}

	.avatar-button:hover {
		filter: brightness(1.05);
	}

	.avatar-button:active {
		transform: scale(0.98);
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
		background: #2f333a;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
	}

	.avatar-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initial {
		color: rgb(75, 216, 122);
		font-weight: 700;
		font-size: 1.1rem;
	}

	.user-dropdown {
		position: absolute;
		top: calc(100% + 0.75rem);
		right: 0;
		background: #12161b;
		border-radius: 10px;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
		min-width: 220px;
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		z-index: 60;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.dropdown-header {
		color: #d0d4dc;
		font-size: 0.85rem;
		margin: 0;
		line-height: 1.4;
		text-align: left;
	}

	.dropdown-header strong {
		color: white;
	}

	.dropdown-button {
		background: rgb(75, 216, 122);
		color: #0f1419;
		font-weight: 700;
		border: none;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		transition: filter 0.2s ease;
	}

	.dropdown-button:hover {
		filter: brightness(1.1);
	}

	@media (max-width: 820px) {
		.nav-toggle {
			display: inline-flex;
		}

		.nav-links {
			position: fixed;
			top: 0;
			right: 0;
			height: 100vh;
			width: min(320px, 80vw);
			background: #1f2329;
			flex-direction: column;
			align-items: flex-start;
			padding: 80px 24px 24px;
			gap: 1rem;
			transform: translateX(100%);
			transition: transform 0.3s ease;
			z-index: 50;
			box-shadow: -4px 0 16px rgba(0, 0, 0, 0.35);
		}

		.nav-links.open {
			transform: translateX(0);
		}

		.nav-link {
			font-size: 1.1rem;
		}

		.user-menu {
			width: 100%;
			justify-content: flex-start;
			margin-top: 1rem;
		}

		.login-status {
			text-align: left;
		}
	}
</style>
