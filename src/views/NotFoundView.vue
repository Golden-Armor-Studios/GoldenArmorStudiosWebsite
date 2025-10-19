<template>
	<div class="not-found-wrapper">
		<h1 class="status-code">404</h1>
		<p class="message">Looks like you took a wrong turn.</p>
		<p class="details">
			The page you’re looking for doesn’t exist or might have moved. Head back to the homepage to keep exploring Golden Armor Studios.
		</p>
		<RouterLink class="home-link" to="/">Return Home</RouterLink>
	</div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
	.not-found-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-height: 70vh;
		gap: 1rem;
		color: #f6f7f9;
		padding: 2rem;
	}

	.status-code {
		margin: 0;
		font-size: clamp(3rem, 8vw, 6rem);
		font-weight: 800;
		color: rgb(75, 216, 122);
	}

	.message {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.details {
		max-width: 540px;
		color: #c6cad3;
		line-height: 1.6;
	}

	.home-link {
		margin-top: 1rem;
		padding: 0.75rem 1.75rem;
		border-radius: 999px;
		background: rgb(75, 216, 122);
		color: #0e1014;
		font-weight: 700;
		text-decoration: none;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.home-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 18px 40px rgba(75, 216, 122, 0.3);
	}
</style>
