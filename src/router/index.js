import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RepoOverviewView from '../views/RepoOverviewView.vue'
import ColorIqOverviewView from '../views/ColorIqOverviewView.vue'
import DiscordInviteView from '../views/DiscordInviteView.vue'
import JoinTeamView from '../views/JoinTeamView.vue'
import DevsView from '../views/DevsView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import DashboardView from '../views/DashboardView.vue'
import store from '../store'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: {
      guestOnly: true
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/project-status',
    name: 'ProjectStatus',
    component: RepoOverviewView
  },
  {
    path: '/coloriq-status',
    name: 'ColorIqStatus',
    component: ColorIqOverviewView
  },
  {
    path: '/community',
    name: 'Community',
    component: DiscordInviteView
  },
  {
    path: '/join-team',
    name: 'JoinTeam',
    component: JoinTeamView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/devs',
    name: 'Devs',
    component: DevsView,
    meta: {
      requiresAuth: true,
      requiresGroup: 'admin'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFoundView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = store.getters['user/isAuthenticated']

  if (to.meta?.guestOnly && isAuthenticated) {
    next({ path: '/dashboard' })
    return
  }

  if (to.meta?.requiresAuth && !isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta?.requiresGroup) {
    const groups = store.getters['user/userGroups'] || []
    if (!isAuthenticated || !groups.includes(to.meta.requiresGroup)) {
    next({ path: '/dashboard' })
      return
    }
  }

  next()
})

export default router
