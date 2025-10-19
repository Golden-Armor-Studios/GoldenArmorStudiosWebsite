<template>
	<div class="discord-wrapper">
	<video ref="videoRef" class="background-video" autoplay muted loop playsinline>
		<source src="/website background - discord.mp4" type="video/mp4" />
	</video>
		<h1 class="homepage-title">Join Our Discord Community</h1>
		<p class="homepage-p description">
			Come hang out with the Golden Armor Studios team, share feedback, and collaborate on new ideas.
		</p>
		<div class="iframe-wrapper">
			<iframe
				title="Golden Armor Studios Discord"
				src="https://discord.com/widget?id=1428964055413952657&theme=dark"
				width="350"
				height="500"
				allowtransparency="true"
				frameborder="0"
				sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
			></iframe>
		</div>
	</div>
</template>


<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const videoRef = ref(null)

onMounted(() => {
	const video = videoRef.value
	if (video) {
		video.playbackRate = 1
	}
})


onBeforeUnmount(() => {
	const video = videoRef.value
	if (video) {
		video.pause()
	}
})
</script>
<style scoped>
	.background-video {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -2;
	}
	.discord-wrapper {
		position: relative;
	}
	.discord-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: min(960px, 100%);
	}

	.description {
		max-width: 520px;
		margin: 0 auto;
		color: #b9bcc3;
	}

	.iframe-wrapper {
		padding: 1rem;
		background: #1f2329;
		border-radius: 16px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
		display: inline-flex;
		width: 100%;
		box-sizing: border-box;
	}

	iframe {
		border-radius: 12px;
		width: 100%;
		height: 500px;
	}

	@media (max-width: 420px) {
		iframe {
			width: 100%;
			height: 400px;
		}
	}
</style>
