import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
	apiKey: 'AIzaSyAFTqz2BdQPiYkjl8qHh5OXJeL324Ldjkc',
	authDomain: 'goldenarmorstudios.firebaseapp.com',
	projectId: 'goldenarmorstudios',
	storageBucket: 'goldenarmorstudios.firebasestorage.app',
	messagingSenderId: '732128551566',
	appId: '1:732128551566:web:322f043589f889784a9fdf',
	measurementId: 'G-L83Z89FCVX'
}

const firebaseApp = initializeApp(firebaseConfig)

let analytics

if (typeof window !== 'undefined') {
	isAnalyticsSupported()
		.then((supported) => {
			if (supported) {
				analytics = getAnalytics(firebaseApp)
			}
		})
		.catch(() => {
			// analytics is optional; ignore failures in unsupported environments
		})
}

const auth = getAuth(firebaseApp)

if (typeof window !== 'undefined') {
	setPersistence(auth, browserLocalPersistence).catch(() => {
		// ignore persistence errors; SDK will fallback to in-memory
	})
}
// Route callable functions through the custom API domain instead of the default Google endpoint.
const functions = getFunctions(firebaseApp, 'https://api.goldenarmorstudio.art')

export { firebaseApp, analytics, auth, functions }
