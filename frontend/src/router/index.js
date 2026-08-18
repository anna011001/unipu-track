import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MembershipsView from '../views/MembershipsView.vue'
import NewMembershipView from '../views/NewMembershipView.vue'
import ResearchDevelopmentView from '../views/ResearchDevelopmentView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/istrazivanje-i-razvoj',
      name: 'research-development',
      component: ResearchDevelopmentView,
    },
    {
      path: '/istrazivanje-i-razvoj/clanstva',
      name: 'memberships',
      component: MembershipsView,
    },
    {
      path: '/istrazivanje-i-razvoj/clanstva/novo',
      name: 'new-membership',
      component: NewMembershipView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
