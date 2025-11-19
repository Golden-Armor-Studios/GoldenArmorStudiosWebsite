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
				<div class="mobile-nav-logo">
					<img src="/golden-armor.png" alt="Golden Armor Studio logo">
				</div>
				<div class="nav-items">
					<RouterLink class="nav-link home-link" to="/" @click="closeNav" @mouseenter="handleNavHover" @focus="handleNavHover">
						<img class="home-icon" src="/golden-armor.png" alt="Golden Armor Studio crest">
						<span>Home</span>
					</RouterLink>
					<RouterLink class="nav-link" to="/app/buy-gasc" @click="closeNav" @mouseenter="handleNavHover" @focus="handleNavHover">Buy GASC</RouterLink>
                    <RouterLink class="nav-link" to="/news" @click="closeNav" @mouseenter="handleNavHover" @focus="handleNavHover">News</RouterLink>
                    <RouterLink v-if="isAuthenticated" class="nav-link" to="/dashboard" @click="closeNav" @mouseenter="handleNavHover" @focus="handleNavHover">Dashboard</RouterLink>
                    <RouterLink v-if="!isAuthenticated" class="nav-link" to="/login" @click="closeNav" @mouseenter="handleNavHover" @focus="handleNavHover">Login</RouterLink>
					<div
						class="projects-dropdown"
						ref="projectsRef"
					>
						<button
							type="button"
							class="nav-link projects-toggle"
							:aria-expanded="isProjectsOpen"
							@click.stop="toggleProjects"
							@mouseenter="closeCommunity"
							@focus="closeCommunity"
							@keydown.enter.prevent="toggleProjects"
							@keydown.space.prevent="toggleProjects"
						>
							Projects
						</button>
						<div
							v-if="isProjectsOpen"
							class="dropdown-menu"
						>
							<RouterLink class="dropdown-link" to="/project-status" @click="closeNavAndProjects">BattleDawnPro Status</RouterLink>
							<RouterLink class="dropdown-link" to="/coloriq-status" @click="closeNavAndProjects">Color IQ Status</RouterLink>
						</div>
					</div>
					<div
						class="community-dropdown"
						ref="communityRef"
					>
						<button
							type="button"
							class="nav-link projects-toggle"
							:aria-expanded="isCommunityOpen"
							@click.stop="toggleCommunity"
							@mouseenter="closeProjects"
							@focus="closeProjects"
							@keydown.enter.prevent="toggleCommunity"
							@keydown.space.prevent="toggleCommunity"
						>
							Join Us
						</button>
						<div
							v-if="isCommunityOpen"
							class="dropdown-menu"
						>
							<RouterLink class="dropdown-link" to="/community" @click="closeNavAndCommunity">Join Discord</RouterLink>
							<RouterLink class="dropdown-link" to="/join-team" @click="closeNavAndCommunity">Join our Team</RouterLink>
						</div>
					</div>
		<div
			v-if="isDeveloper"
			class="developer-dropdown"
			ref="developerRef"
		>
						<button
							type="button"
							class="nav-link projects-toggle"
							:aria-expanded="isDeveloperOpen"
							@click.stop="toggleDeveloper"
							@mouseenter="handleNavHover"
							@focus="handleNavHover"
							@keydown.enter.prevent="toggleDeveloper"
							@keydown.space.prevent="toggleDeveloper"
						>
							Developer
						</button>
		<div
			v-if="isDeveloperOpen"
			class="dropdown-menu"
		>
		<RouterLink
			class="dropdown-link"
			to="/dev-tools"
			@click="closeNavAndDeveloper"
		>
			Dev Tools
		</RouterLink>
		</div>
		</div>
					<div
						v-if="isAdmin"
						class="admin-dropdown"
						ref="adminRef"
					>
						<button
							type="button"
							class="nav-link projects-toggle"
							:aria-expanded="isAdminOpen"
							@click.stop="toggleAdmin"
							@mouseenter="handleNavHover"
							@focus="handleNavHover"
							@keydown.enter.prevent="toggleAdmin"
							@keydown.space.prevent="toggleAdmin"
						>
							Admin
						</button>
		<div
			v-if="isAdminOpen"
			class="dropdown-menu"
		>
			<RouterLink class="dropdown-link" to="/devs" @click="closeNavAndAdmin">Team Admin</RouterLink>
			<RouterLink class="dropdown-link" to="/manage-news" @click="closeNavAndAdmin">Manage News</RouterLink>
			<RouterLink class="dropdown-link" to="/news-editor" @click="closeNavAndAdmin">News Editor</RouterLink>
		</div>
	</div>
				</div>

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
const isDeveloper = computed(() => groups.value.includes('developer'))
const displayName = computed(() => profile.value?.displayName || profile.value?.email || 'Member')
const avatarUrl = computed(() => profile.value?.photoURL || '')
const avatarInitial = computed(() => displayName.value.charAt(0).toUpperCase())

const isNavOpen = ref(false)
const isDropdownOpen = ref(false)
const isProjectsOpen = ref(false)
const isCommunityOpen = ref(false)
const isAdminOpen = ref(false)
const isDeveloperOpen = ref(false)
const menuRef = ref(null)
const projectsRef = ref(null)
const communityRef = ref(null)
const adminRef = ref(null)
const developerRef = ref(null)

const toggleNav = () => {
	isNavOpen.value = !isNavOpen.value
}

const closeNav = () => {
	isNavOpen.value = false
	isDropdownOpen.value = false
	isProjectsOpen.value = false
	isCommunityOpen.value = false
	isAdminOpen.value = false
	isDeveloperOpen.value = false
}

const toggleDropdown = () => {
	isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
	isDropdownOpen.value = false
}

const toggleProjects = () => {
	isProjectsOpen.value = !isProjectsOpen.value
	if (isProjectsOpen.value) {
		isCommunityOpen.value = false
		isAdminOpen.value = false
		isDeveloperOpen.value = false
	}
}

const closeProjects = () => {
	isProjectsOpen.value = false
}

const toggleCommunity = () => {
	isCommunityOpen.value = !isCommunityOpen.value
	if (isCommunityOpen.value) {
		isProjectsOpen.value = false
		isAdminOpen.value = false
		isDeveloperOpen.value = false
	}
}

const closeCommunity = () => {
	isCommunityOpen.value = false
}

const toggleAdmin = () => {
	isAdminOpen.value = !isAdminOpen.value
	if (isAdminOpen.value) {
		isProjectsOpen.value = false
		isCommunityOpen.value = false
		isDeveloperOpen.value = false
	}
}

const closeAdmin = () => {
	isAdminOpen.value = false
}

const toggleDeveloper = () => {
	isDeveloperOpen.value = !isDeveloperOpen.value
	if (isDeveloperOpen.value) {
		isProjectsOpen.value = false
		isCommunityOpen.value = false
		isAdminOpen.value = false
	}
}

const closeDeveloper = () => {
	isDeveloperOpen.value = false
}

const closeNavAndProjects = () => {
	closeNav()
	isProjectsOpen.value = false
}

const closeNavAndCommunity = () => {
	closeNav()
	isCommunityOpen.value = false
}

const closeNavAndDeveloper = () => {
	closeNav()
	isDeveloperOpen.value = false
}

const handleNavHover = () => {
	closeProjects()
	closeCommunity()
	closeAdmin()
	closeDeveloper()
}

const closeNavAndAdmin = () => {
	closeNav()
	isAdminOpen.value = false
}

const onDocumentClick = (event) => {
	if (!menuRef.value) {
		return
	}
	if (!menuRef.value.contains(event.target)) {
		closeDropdown()
	}
	if (!projectsRef.value?.contains(event.target)) {
		closeProjects()
	}
	if (!communityRef.value?.contains(event.target)) {
		closeCommunity()
	}
	if (!adminRef.value?.contains(event.target)) {
		closeAdmin()
	}
	if (!developerRef.value?.contains(event.target)) {
		closeDeveloper()
	}
}

const onEscapePress = (event) => {
	if (event.key === 'Escape') {
		closeDropdown()
		closeProjects()
		closeCommunity()
		closeAdmin()
		closeDeveloper()
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
		width: 100%;
		box-sizing: border-box;
		background: rgba(8, 12, 18, 0.85);
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
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
    color: #f6f7f9;
    min-height: 100vh;
    display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40px 16px;
		box-sizing: border-box;
	}

	.nav-bar {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		max-width: 960px;
		margin: 0 auto 2rem;
		position: relative;
		padding: 0 16px;
		box-sizing: border-box;
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
		justify-content: center;
		width: 100%;
		gap: 1.5rem;
	}

	.nav-items {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		flex: 1;
	}

	.projects-dropdown {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.projects-toggle {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		font: inherit;
		color: inherit;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.75rem);
		left: 0;
		background: rgba(15, 20, 25, 0.95);
		border-radius: 12px;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
		padding: 0.75rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 220px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		z-index: 70;
	}

	.community-dropdown,
	.projects-dropdown,
	.admin-dropdown,
	.developer-dropdown {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.mobile-nav-logo {
		display: none;
	}

	.dropdown-link {
		padding: 0.5rem 1rem;
		color: #f6f7f9;
		text-decoration: none;
		font-weight: 600;
		transition: background 0.2s ease;
	}

	.dropdown-link:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.nav-link {
		color: white;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.home-link .home-icon {
		height: 175px;
		width: auto;
		display: block;
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
		margin-left: auto;
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
		.nav-bar {
			justify-content: space-between;
		}

		.nav-toggle {
			display: inline-flex;
		}

		.nav-links {
			position: fixed;
			top: 0;
			right: 0;
			height: 100vh;
			width: min(260px, 68vw);
			background: rgba(8, 12, 18, 0.88);
			backdrop-filter: blur(12px);
			flex-direction: column;
			align-items: flex-start;
			justify-content: flex-start;
			padding: 32px 18px 24px;
			gap: 1rem;
			transform: translateX(100%);
			transition: transform 0.3s ease;
			z-index: 50;
			box-shadow: -6px 0 24px rgba(0, 0, 0, 0.45);
			border-left: 1px solid rgba(255, 255, 255, 0.08);
			overflow-y: auto;
		}

		.mobile-nav-logo {
			display: flex;
			width: 100%;
			justify-content: center;
			margin-bottom: 1rem;
		}

		.mobile-nav-logo img {
			height: 100px;
			width: auto;
		}

		.nav-items {
			width: 100%;
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
			flex: initial;
		}

		.nav-link {
			width: 100%;
			text-align: left;
			font-size: 1.1rem;
		}

		.home-link {
			gap: 0.25rem;
		}

		.home-link .home-icon {
			display: none;
		}

		.nav-links.open {
			transform: translateX(0);
		}

		.user-menu {
			width: 100%;
			justify-content: flex-start;
			margin-top: 1rem;
			margin-left: 0;
		}

		.login-status {
			text-align: left;
		}

		.projects-dropdown,
		.community-dropdown,
		.admin-dropdown,
		.developer-dropdown {
			width: 100%;
			flex-direction: column;
			align-items: flex-start;
		}

		.projects-toggle {
			width: 100%;
			text-align: left;
			padding: 0;
		}

		.dropdown-menu {
			position: static;
			top: auto;
			left: auto;
			width: 100%;
			margin-top: 0.5rem;
			background: rgba(255, 255, 255, 0.05);
			box-shadow: none;
			border: none;
			padding: 0.5rem 0.75rem;
			border-radius: 10px;
			gap: 0.5rem;
		}

		.dropdown-link {
			width: 100%;
			padding: 0.4rem 0;
		}
	}
</style>
