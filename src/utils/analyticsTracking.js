import { logEvent } from 'firebase/analytics'
import { analytics } from '@/firebase'

const canTrack = () => typeof window !== 'undefined' && analytics

const formatNumber = (value, decimals = 2) => {
	const numeric = Number(value)
	if (!Number.isFinite(numeric)) {
		return undefined
	}
	return Number(numeric.toFixed(decimals))
}

export const trackPurchaseConversion = ({ transactionId, valueUsd = 0, tokens = 0 }) => {
	if (!canTrack()) {
		return
	}

	const roundedValue = formatNumber(valueUsd, 2)
	if (!roundedValue) {
		return
	}

	const quantity = Number(tokens) || 0
	const itemPrice = quantity > 0 ? formatNumber(roundedValue / quantity, 4) : undefined

	const payload = {
		currency: 'USD',
		value: roundedValue,
		transaction_id: transactionId || undefined,
		items: [
			{
				item_id: 'GASC',
				item_name: 'Golden Armor Studio Coin',
				quantity,
				price: itemPrice
			}
		]
	}

	try {
		logEvent(analytics, 'purchase', payload)
		logEvent(analytics, 'conversion', {
			event_category: 'purchase',
			value: roundedValue
		})
	} catch (error) {
		// Analytics is non-critical; swallow errors silently.
		console.warn('trackPurchaseConversion failed', error)
	}
}

export const trackSignUpConversion = (method = 'unknown') => {
	if (!canTrack()) {
		return
	}

	try {
		logEvent(analytics, 'sign_up', { method })
		logEvent(analytics, 'conversion', {
			event_category: 'sign_up',
			method
		})
	} catch (error) {
		console.warn('trackSignUpConversion failed', error)
	}
}
