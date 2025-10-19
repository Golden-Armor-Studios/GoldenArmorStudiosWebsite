<template>
	<div class="repo-wrapper">
		<video ref="videoRef" class="background-video" autoplay muted loop playsinline>
			<source src="/website background - repos.mp4" type="video/mp4" />
		</video>
		<h1 class="homepage-title">ColorIQ Project Status</h1>
		<p class="homepage-p description">
			Fresh data from GitHub highlighting progress, outstanding work, and milestones for ColorIQ.
		</p>

		<section v-if="isLoading" class="status-block card-standard">
			<p class="homepage-p">Loading GitHub data...</p>
		</section>

		<section v-else-if="errorMessage" class="status-block error card-standard">
			<p class="homepage-p">Unable to load repository data.</p>
			<p class="homepage-p error-detail">{{ errorMessage }}</p>
		</section>

		<section v-else class="status-grid">
			<div class="status-row">
				<div class="status-card card-standard">
					<h2 class="section-title">Repository Overview</h2>
					<p class="repo-description">{{ repo?.description || 'No description supplied.' }}</p>
					<div class="stats-row">
						<div class="stat">
							<span class="stat-label">Stars</span>
							<span class="stat-value">{{ repo?.stargazers_count ?? 0 }}</span>
						</div>
						<div class="stat">
							<span class="stat-label">Forks</span>
							<span class="stat-value">{{ repo?.forks_count ?? 0 }}</span>
						</div>
						<div class="stat">
							<span class="stat-label">Watchers</span>
							<span class="stat-value">{{ repo?.subscribers_count ?? 0 }}</span>
						</div>
						<div class="stat">
							<span class="stat-label">Open Issues</span>
							<span class="stat-value">{{ repo?.open_issues_count ?? 0 }}</span>
						</div>
					</div>
					<a
						class="homepage-link repo-link"
						href="https://github.com/Golden-Armor-Studios/ColorIQ"
						target="_blank"
						rel="noopener noreferrer"
					>
						View on GitHub
					</a>
				</div>

				<div class="status-card card-standard">
					<h2 class="section-title">Open Issues</h2>
					<ul v-if="issues.length" class="list">
						<li v-for="issue in issues" :key="issue.id" class="list-item">
							<a :href="issue.html_url" class="homepage-link issue-link" target="_blank" rel="noopener noreferrer">
								{{ issue.title }}
							</a>
							<p class="item-meta">#{{ issue.number }} opened by {{ issue.user?.login ?? 'unknown' }}</p>
							<p v-if="issue.labels.length" class="item-labels">
								<span v-for="label in issue.labels" :key="label.id" class="label-pill" :style="{ backgroundColor: '#' + label.color }">
									{{ label.name }}
								</span>
							</p>
						</li>
					</ul>
					<p v-else class="homepage-p muted">No open issues found.</p>
				</div>
			</div>

			<div class="status-row">
				<div class="status-card card-standard">
					<h2 class="section-title">Milestones</h2>
					<ul v-if="milestones.length" class="list">
						<li v-for="milestone in milestones" :key="milestone.id" class="list-item">
							<div class="milestone-header">
								<a :href="milestone.html_url" class="homepage-link" target="_blank" rel="noopener noreferrer">
									{{ milestone.title }}
								</a>
								<span class="milestone-state">{{ milestone.state }}</span>
							</div>
							<p class="item-meta">
								{{ milestone.open_issues }} open / {{ milestone.closed_issues }} closed
								<span v-if="milestone.due_on" class="milestone-due">
									| Due {{ formatDate(milestone.due_on) }}
								</span>
							</p>
							<p v-if="milestone.description" class="item-description">
								{{ milestone.description }}
							</p>
						</li>
					</ul>
					<p v-else class="homepage-p muted">No milestones available.</p>
				</div>

				<div class="status-card card-standard placeholder-card" aria-hidden="true"></div>
			</div>
		</section>
	</div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
		const videoRef = ref(null)

	const repo = ref(null)
	const issues = ref([])
	const milestones = ref([])
	const isLoading = ref(true)
	const errorMessage = ref('')

	onBeforeUnmount(() => {
	const video = videoRef.value
	if (video) {
		video.pause()
	}
})

const formatDate = (value) => {
		if (!value) {
			return ''
		}

		const date = new Date(value)
		if (Number.isNaN(date.getTime())) {
			return value
		}

		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	const sanitizeIssues = (rawIssues) =>
		rawIssues.filter((item) => !item.pull_request)

	const fetchRepoData = async () => {
		isLoading.value = true
		errorMessage.value = ''

		try {
			const [repoResponse, issuesResponse, milestonesResponse] = await Promise.all([
				fetch('https://api.github.com/repos/Golden-Armor-Studios/ColorIQ'),
				fetch('https://api.github.com/repos/Golden-Armor-Studios/ColorIQ/issues?state=open'),
				fetch('https://api.github.com/repos/Golden-Armor-Studios/ColorIQ/milestones?state=all&sort=due_on')
			])

			if (!repoResponse.ok || !issuesResponse.ok || !milestonesResponse.ok) {
				throw new Error('GitHub returned an error response.')
			}

			const [repoJson, issuesJson, milestonesJson] = await Promise.all([
				repoResponse.json(),
				issuesResponse.json(),
				milestonesResponse.json()
			])

			repo.value = repoJson
			issues.value = sanitizeIssues(issuesJson)
			milestones.value = milestonesJson
		} catch (error) {
			errorMessage.value = error?.message ?? 'Unknown error'
		} finally {
			isLoading.value = false
		}
	}

	onMounted(() => {
	const video = videoRef.value
	if (video) {
		video.playbackRate = 0.25
	}
	fetchRepoData()
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
	.repo-wrapper {
		position: relative;
	}
.repo-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: min(960px, 100%);
	}

	.description {
		max-width: 640px;
		margin: 0 auto;
		color: #b9bcc3;
	}

	.status-block {
		width: 100%;
		background: #1f2329;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}

	.status-block.error {
		border: 1px solid rgba(255, 107, 107, 0.4)
	}

	.status-grid {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
	}

	.status-row {
		display: flex;
		flex-direction: row;
		gap: 1.5rem;
		justify-content: space-between;
		flex-wrap: wrap;
		width: 100%;
}

	.status-row > .status-card {
		flex: 1 1 340px;
	}

	.status-card {
		background: #1f2329;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 220px;
	}

	.section-title {
		margin: 0;
		color: #f6f7f9;
		font-size: 1.4rem;
	}

	.repo-description {
		color: #d0d4dc;
		margin: 0;
	}

	.stats-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.stat {
		background: #12161b;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		min-width: 120px;
	}

	.stat-label {
		display: block;
		color: #8b909a;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: rgb(75, 216, 122);
	}

	.repo-link {
		align-self: flex-start;
		font-weight: 700;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.list-item {
		background: #12161b;
		border-radius: 8px;
		padding: 1rem;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
	}

	.issue-link {
		font-weight: 700;
	}

	.item-meta {
		color: #8b909a;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
	}

	.item-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.75rem 0 0;
	}

	.label-pill {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		background: #2f333a;
		color: #0d1117;
		font-size: 0.75rem;
		font-weight: 600;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
	}

	.muted {
		color: #8b909a;
	}

	.milestone-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.milestone-state {
		background: #2f333a;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		text-transform: capitalize;
		color: #d0d4dc;
		font-size: 0.75rem;
	}

	.milestone-due {
		margin-left: 0.35rem;
	}

	.item-description {
		color: #d0d4dc;
		margin: 0.75rem 0 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.error-detail {
		color: #ff6b6b;
	}

	@media (max-width: 800px) {
		.status-row {
			flex-direction: row;
			width: 100%;
			gap: 1.25rem;
		}

		.status-row > .status-card {
			flex: 1 1 100%;
			width: 100%;
		}

	}

	@media (max-width: 600px) {
		.stats-row {
			flex-direction: column;
		}
	}
</style>