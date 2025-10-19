import { auth } from '@/firebase'
import { GithubAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'

const state = () => ({
	profile: null,
	status: 'guest',
	session: null,
	initialized: false,
	groups: []
})

const githubProvider = new GithubAuthProvider()

githubProvider.setCustomParameters({
	allow_signup: 'true'
})

const getters = {
	isAuthenticated: (state) => Boolean(state.profile),
	userStatus: (state) => state.status,
	sessionUser: (state) => state.session,
	userGroups: (state) => state.groups
}

const mutations = {
	setProfile(state, profile) {
		state.profile = profile
		state.status = profile ? 'member' : 'guest'
	},
	setSession(state, session) {
		state.session = session
	},
	setInitialized(state, initialized) {
		state.initialized = initialized
	},
	setGroups(state, groups) {
		state.groups = Array.isArray(groups) ? groups : []
	}
}

const buildProfile = (user) => {
	if (!user) {
		return null
	}

	return {
		uid: user.uid,
		email: user.email,
		displayName: user.displayName,
		photoURL: user.photoURL
	}
}

const actions = {
async login({ commit }, { email, password }) {
	const credential = await signInWithEmailAndPassword(auth, email, password)
	const { user } = credential
	const profile = buildProfile(user)

	commit('setSession', user)
	commit('setProfile', profile)
	commit('setGroups', user.getIdTokenResult ? (await user.getIdTokenResult(true)).claims.groups || [] : [])

	return user
},
async logout({ commit }) {
	await signOut(auth)
	commit('setSession', null)
	commit('setProfile', null)
},
async loginWithGithub({ commit }) {
	const credential = await signInWithPopup(auth, githubProvider)
	const { user } = credential
	const profile = buildProfile(user)

	commit('setSession', user)
	commit('setProfile', profile)
	commit('setGroups', user.getIdTokenResult ? (await user.getIdTokenResult(true)).claims.groups || [] : [])

	return user
},
initializeAuthListener({ commit, state }) {
	if (state.initialized) {
		return Promise.resolve()
	}

	return new Promise((resolve) => {
		let resolved = false
		onAuthStateChanged(auth, async (user) => {
			const profile = buildProfile(user)
			commit('setSession', user)
			commit('setProfile', profile)

			if (user) {
				const tokenResult = await user.getIdTokenResult()
				commit('setGroups', tokenResult.claims.groups || [])
			} else {
				commit('setGroups', [])
			}

			if (!resolved) {
				resolved = true
				commit('setInitialized', true)
				resolve()
			}
		})
	})
}
}

export default {
	namespaced: true,
	state,
	getters,
	mutations,
	actions
}
