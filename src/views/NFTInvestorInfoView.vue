<template>
	<div class="nft-info-wrapper">
		<section class="card-standard intro">
			<h1>NFT Investor Impact</h1>
			<p>
				This tool mirrors the Uniswap v2-style pool described in the financial model. It shows how the studio's
				monthly buybacks influence the on-chain price of GASC based on pool depth and ETH/USD assumptions.
			</p>
			<ul>
				<li>Initial ratio: <strong>1 ETH = 1,000 GASC</strong> (0.001 ETH per GASC).</li>
				<li>Pool Size Goal: <strong>500,000 GASC</strong> against 500 ETH (constant product k = 250,000,000).</li>
				<li>Company buybacks inject fresh ETH, shrink the GASC side of the pool, and raise the price.</li>
			</ul>
		</section>

		<section class="card-standard live-quote" v-if="lastFetchedQuote">
			<div class="quote-header">
				<h2>Live Market Reference</h2>
				<span class="auto-refresh-note">Auto-refresh every 60 seconds</span>
			</div>
			<p class="note">
				Current `getGascPrice` quote:
				<span :class="['price-indicator', priceTrendClass]">
					${{ (lastFetchedQuote.finalPrice ?? 0).toFixed(4) }}
				</span>
				per GASC (ETH ${{ lastFetchedQuote.ethUsd?.toFixed ? lastFetchedQuote.ethUsd.toFixed(2) : '—' }}).
				Use the calculator below to model deeper liquidity or larger buybacks.
			</p>
		</section>

		<section class="card-standard calculator">
			<h2>Liquidity Inputs</h2>
			<div class="input-grid">
				<label>
					<span>ETH price (USD)</span>
					<div class="live-price" :class="['price-indicator', priceTrendClass]">
						${{ ethPriceUsd.toFixed(2) }}
					</div>
				</label>
				<label>
					<span>ETH in GASC pool</span>
					<input type="number" min="1" step="1" v-model.number="targetEthReserve">
					<small class="usd-cost">≈ ${{ poolEthUsdCost.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</small>
				</label>
				<label>
					<span>Monthly buyback (USD)</span>
					<input type="number" min="1000" step="1000" v-model.number="buybackUsd">
				</label>
			</div>
			<p class="note">Change the ETH reserve to simulate deeper or thinner liquidity. The model preserves the constant product to estimate price impact.</p>
		</section>

		<section class="card-standard results">
			<h2>Pool Snapshot</h2>
			<div class="results-grid">
				<div class="result-card">
					<h3>Current Pool</h3>
					<p><strong>{{ formatNumber(poolGascReserve) }}</strong> GASC in reserve</p>
					<p><strong>{{ formatNumber(targetEthReserveDisplay) }}</strong> ETH backing</p>
					<p>GASC share remaining: {{ (poolShareRemaining * 100).toFixed(2) }}%</p>
					<p>Pool Size Goal: {{ formatNumber(BASE_GASC) }} GASC</p>
					<p>Pool price: <strong>${{ currentPriceUsd.toFixed(4) }}</strong></p>
				</div>
				<div class="result-card">
					<h3>Monthly Buyback</h3>
					<p>Company spends <strong>${{ buybackUsd.toLocaleString() }}</strong> → {{ buyEth.toFixed(2) }} ETH</p>
					<p>Tokens purchased: <strong>{{ formatNumber(tokensPurchased) }}</strong> GASC</p>
					<p>Price after buyback: <strong>${{ postPriceUsd.toFixed(4) }}</strong></p>
					<p>Price change: <span :class="{ up: priceChangePct > 0, down: priceChangePct < 0 }">{{ (priceChangePct * 100).toFixed(2) }}%</span></p>
				</div>
				<div class="result-card">
					<h3>Post-Buyback Pool</h3>
					<p>ETH reserve: <strong>{{ postEthReserve.toFixed(2) }}</strong></p>
					<p>GASC reserve: <strong>{{ formatNumber(postGascReserve) }}</strong></p>
					<p>Pool shrinkage: {{ ((1 - postGascReserve / BASE_GASC) * 100).toFixed(2) }}% from launch</p>
					<p class="note">Higher buybacks or thinner liquidity amplify the price impact.</p>
				</div>
			</div>
		</section>

		<section class="card-standard methodology">
			<h2>Calculation Details</h2>
			<ol>
				<li>Constant product k equals (ETH reserve × GASC reserve). Defaults to 500,000 × 500 = 250,000,000 but updates with your inputs.</li>
				<li>Pool inputs adjust the reserves while preserving that k value.</li>
				<li>Buyback adds ETH (buyback USD ÷ ETH price) then recomputes the matching GASC reserve (k ÷ new ETH).</li>
				<li>Tokens removed and price change derive from the new reserve ratio.</li>
				<li>Keeping the pool close to 500,000 GASC lowers price volatility; a deeper reserve absorbs larger buybacks without dramatic spikes.</li>
			</ol>
		</section>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

const BASE_GASC = 500_000
const TOKENS_PER_ETH = 1000
const BASE_ETH = BASE_GASC / TOKENS_PER_ETH

const ethPriceUsd = ref(3000)
const targetEthReserve = ref(BASE_ETH)
const buybackUsd = ref(45_000)
const lastFetchedQuote = ref(null)
const priceTrend = ref('trend-up')
const isFetchingQuote = ref(false)
let quoteIntervalId = null

const sanitizedEthReserve = computed(() => {
	const value = Number(targetEthReserve.value)
	return Number.isFinite(value) && value > 0 ? value : BASE_ETH
})

const targetEthReserveDisplay = computed(() => sanitizedEthReserve.value)

const poolGascReserve = computed(() => sanitizedEthReserve.value * TOKENS_PER_ETH)
const poolShare = computed(() => poolGascReserve.value / BASE_GASC)
const poolShareRemaining = computed(() => Math.max(0, 1 - poolShare.value))
const dynamicProduct = computed(() => poolGascReserve.value * sanitizedEthReserve.value)

const buyEth = computed(() => {
	const price = Number(ethPriceUsd.value)
	const spend = Number(buybackUsd.value)
	if (!Number.isFinite(price) || price <= 0) {
		return 0
	}
	return Math.max(spend / price, 0)
})

const postEthReserve = computed(() => sanitizedEthReserve.value + buyEth.value)
const postGascReserve = computed(() => dynamicProduct.value / Math.max(postEthReserve.value, 1e-9))
const tokensPurchased = computed(() => Math.max(poolGascReserve.value - postGascReserve.value, 0))

const currentPriceEth = computed(() => sanitizedEthReserve.value / poolGascReserve.value)
const postPriceEth = computed(() => postEthReserve.value / postGascReserve.value)
const currentPriceUsd = computed(() => currentPriceEth.value * Number(ethPriceUsd.value || 0))
const postPriceUsd = computed(() => postPriceEth.value * Number(ethPriceUsd.value || 0))
const priceChangePct = computed(() => {
	if (!currentPriceEth.value) {
		return 0
	}
	return (postPriceEth.value / currentPriceEth.value) - 1
})

const formatNumber = (value) => {
	if (!Number.isFinite(value)) {
		return '—'
	}
	return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

const poolEthUsdCost = computed(() => {
	const price = Number(ethPriceUsd.value)
	if (!Number.isFinite(price) || price <= 0) {
		return 0
	}
	return sanitizedEthReserve.value * price
})

const priceTrendClass = computed(() => {
	if (priceTrend.value === 'up') {
		return 'trend-up'
	}
	if (priceTrend.value === 'down') {
		return 'trend-down'
	}
	return 'trend-neutral'
})

const fetchQuote = async () => {
	if (isFetchingQuote.value) {
		return
	}
	isFetchingQuote.value = true
	try {
		const callable = httpsCallable(functions, 'getGascPrice')
		const { data } = await callable({ tokenAmount: 1 })
		if (data?.success) {
			const parsed = {
				finalPrice: Number(data.finalPrice) || 0,
				ethUsd: Number(data.ethUsd) || null
			}
			const previous = lastFetchedQuote.value?.ethUsd
			if (Number.isFinite(parsed.ethUsd) && Number.isFinite(previous)) {
				if (parsed.ethUsd > previous) {
					priceTrend.value = 'up'
				} else if (parsed.ethUsd < previous) {
					priceTrend.value = 'trend-down'
				} else {
					priceTrend.value = 'trend-neutral'
				}
			} else {
				priceTrend.value = 'trend-neutral'
			}
			lastFetchedQuote.value = parsed
			if (Number.isFinite(parsed.ethUsd)) {
				ethPriceUsd.value = parsed.ethUsd
			}
		}
	} catch (error) {
		console.error('Failed to fetch live quote', error)
	} finally {
		isFetchingQuote.value = false
	}
}

onMounted(() => {
	fetchQuote()
	quoteIntervalId = setInterval(fetchQuote, 60000)
})

onBeforeUnmount(() => {
	if (quoteIntervalId) {
		clearInterval(quoteIntervalId)
	}
})
</script>

<style scoped>
.nft-info-wrapper {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	width: min(1100px, 100%);
	margin: 0 auto;
}

.card-standard {
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 20px;
	padding: 1.75rem;
	color: #d5d7de;
	background: rgba(4, 8, 12, 0.85);
	backdrop-filter: blur(6px);
}

.live-quote .quote-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 1rem;
}

.auto-refresh-note {
	font-size: 0.9rem;
	color: #9aa5b6;
}

.intro ul {
	margin: 0.75rem 0 0;
	padding-left: 1.25rem;
}

.calculator .input-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 1rem;
}

.calculator label {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-weight: 600;
	color: #f6f7f9;
}

.calculator input {
	background: #12161b;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 10px;
	padding: 0.65rem 0.75rem;
	color: #f6f7f9;
}

.usd-cost {
	font-size: 0.85rem;
	color: #9aa5b6;
}

.note {
	color: #9aa5b6;
	font-size: 0.9rem;
}

.results-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: 1rem;
}

.result-card {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 16px;
	padding: 1.25rem;
}

.result-card h3 {
	margin: 0 0 0.5rem;
	color: #f6f7f9;
}

.result-card p {
	margin: 0.35rem 0;
}

.up {
	color: #4bd87a;
}

.down {
	color: #ff6b6b;
}

.price-indicator {
	font-weight: 700;
}

.price-indicator.trend-up {
	color: #4bd87a;
}

.price-indicator.trend-down {
	color: #ff6b6b;
}

.price-indicator.trend-neutral {
	color: #4bd87a;
}

.methodology ol {
	margin: 0.5rem 0 0;
	padding-left: 1.25rem;
	line-height: 1.7;
}

@media (max-width: 640px) {
	.nft-info-wrapper {
		padding: 0 1rem 2rem;
	}
}
</style>
