import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MembershipsView from '../views/MembershipsView.vue'
import NewMembershipView from '../views/NewMembershipView.vue'
import NewProfessionalDevelopmentView from '../views/NewProfessionalDevelopmentView.vue'
import ProfessionalDevelopmentsView from '../views/ProfessionalDevelopmentsView.vue'
import ResearchDevelopmentView from '../views/ResearchDevelopmentView.vue'
import EventParticipationsView from '../views/EventParticipationsView.vue'
import NewEventParticipationView from '../views/NewEventParticipationView.vue'

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
      path: '/istrazivanje-i-razvoj/strucna-usavrsavanja',
      name: 'professional-developments',
      component: ProfessionalDevelopmentsView,
    },
    {
      path: '/istrazivanje-i-razvoj/strucna-usavrsavanja/novo',
      name: 'new-professional-development',
      component: NewProfessionalDevelopmentView,
    },
    {
      path: '/istrazivanje-i-razvoj/sudjelovanja',
      name: 'event-participations',
      component: EventParticipationsView,
    },
    {
      path: '/istrazivanje-i-razvoj/sudjelovanja/novo',
      name: 'new-event-participation',
      component: NewEventParticipationView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
