import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

const toastOptions = {
	position: 'top-right',
	timeout: 4000,
	closeOnClick: true,
	hideProgressBar: false,
	pauseOnFocusLoss: true,
	pauseOnHover: true,
	draggable: true
}

store.dispatch('user/initializeAuthListener').finally(() => {
	const app = createApp(App)

	app
		.use(router)
		.use(store)
		.use(Toast, toastOptions)
		.mount('#app')
})
