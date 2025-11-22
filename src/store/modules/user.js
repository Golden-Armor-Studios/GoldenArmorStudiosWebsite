import { auth, functions } from '@/firebase'
import { trackSignUpConversion } from '@/utils/analyticsTracking'
import {
	GithubAuthProvider,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'

const GITHUB_TOKEN_STORAGE_KEY = 'unityGithubAccessToken'

const getStoredGithubToken = () => {
	if (typeof window === 'undefined') {
		return null
	}

	try {
		return window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)
	} catch (error) {
		console.warn('Unable to read Unity GitHub token from storage', error)
		return null
	}
}

const persistGithubToken = (token) => {
	if (typeof window === 'undefined') {
		return
	}

	try {
		if (token) {
			window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, token)
		} else {
			window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
		}
	} catch (error) {
		console.warn('Unable to persist Unity GitHub token to storage', error)
	}
}

const state = () => ({
	profile: null,
	status: 'guest',
	session: null,
	initialized: false,
	groups: [],
	githubAccessToken: getStoredGithubToken(),
	firebaseIdToken: null,
	firebaseCustomToken: null
})

const githubProvider = new GithubAuthProvider()

githubProvider.setCustomParameters({
	allow_signup: 'true'
})

const getters = {
	isAuthenticated: (state) => Boolean(state.profile),
	userStatus: (state) => state.status,
	sessionUser: (state) => state.session,
	userGroups: (state) => state.groups,
	githubAccessToken: (state) => state.githubAccessToken,
	firebaseIdToken: (state) => state.firebaseIdToken,
	firebaseCustomToken: (state) => state.firebaseCustomToken
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
	},
	setGithubAccessToken(state, token) {
		state.githubAccessToken = token || null
	},
	setFirebaseIdToken(state, token) {
		state.firebaseIdToken = token || null
	},
	setFirebaseCustomToken(state, token) {
		state.firebaseCustomToken = token || null
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
		const tokenResult = user?.getIdTokenResult ? await user.getIdTokenResult(true) : null
		const groups = tokenResult?.claims?.groups || []

		commit('setSession', user)
		commit('setProfile', profile)
		commit('setGroups', groups)
		commit('setFirebaseIdToken', tokenResult?.token || null)
		commit('setGithubAccessToken', null)
		commit('setFirebaseCustomToken', null)
		persistGithubToken(null)

		return user
	},
	async logout({ commit }) {
		await signOut(auth)
		commit('setSession', null)
		commit('setProfile', null)
		commit('setGroups', [])
		commit('setFirebaseIdToken', null)
		commit('setGithubAccessToken', null)
		commit('setFirebaseCustomToken', null)
		persistGithubToken(null)
	},
	async loginWithGithub({ commit }) {
		const result = await signInWithPopup(auth, githubProvider)
		const { user, additionalUserInfo } = result
		const credential = GithubAuthProvider.credentialFromResult(result)
		const accessToken = credential?.accessToken || null
		const profile = buildProfile(user)
		const tokenResult = user?.getIdTokenResult ? await user.getIdTokenResult(true) : null
		const groups = tokenResult?.claims?.groups || []

		if (additionalUserInfo?.isNewUser) {
			const method = additionalUserInfo?.providerId || 'github'
			trackSignUpConversion(method)
		}

		commit('setSession', user)
		commit('setProfile', profile)
		commit('setGroups', groups)
		commit('setFirebaseIdToken', tokenResult?.token || null)
		commit('setGithubAccessToken', accessToken)
		commit('setFirebaseCustomToken', null)
		persistGithubToken(accessToken)

		return user
	},
	async refreshFirebaseIdToken({ commit }) {
		const currentUser = auth.currentUser
		if (!currentUser) {
			commit('setFirebaseIdToken', null)
			commit('setFirebaseCustomToken', null)
			return null
		}

		const tokenResult = await currentUser.getIdTokenResult(true)
		commit('setGroups', tokenResult.claims?.groups || [])
		commit('setFirebaseIdToken', tokenResult.token)
		return tokenResult.token
	},
	async generateFirebaseCustomToken({ commit }) {
		const currentUser = auth.currentUser
		if (!currentUser) {
			commit('setFirebaseCustomToken', null)
			throw new Error('User must be signed in to mint a custom token.')
		}

		const callable = httpsCallable(functions, 'generateCustomAuthToken')
		const response = await callable()
		const token = typeof response?.data?.token === 'string' ? response.data.token : null

		commit('setFirebaseCustomToken', token)
		return token
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
					const groups = tokenResult.claims?.groups || []
					const usesGithub = user.providerData?.some(
						(provider) => provider?.providerId === 'github.com'
					)
					const storedGithubToken = usesGithub ? getStoredGithubToken() : null

					if (!usesGithub) {
						persistGithubToken(null)
					}

					commit('setGroups', groups)
					commit('setFirebaseIdToken', tokenResult.token)
					commit('setGithubAccessToken', storedGithubToken)
					commit('setFirebaseCustomToken', null)
				} else {
					commit('setGroups', [])
					commit('setFirebaseIdToken', null)
					commit('setGithubAccessToken', null)
					commit('setFirebaseCustomToken', null)
					persistGithubToken(null)
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
