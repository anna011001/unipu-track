import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import { currentUser, isAuthenticated } from '../services/auth.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/prijava',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/istrazivanje-i-razvoj',
      name: 'research-development',
      component: () => import('../views/ResearchDevelopmentView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/clanstva',
      name: 'memberships',
      component: () => import('../views/MembershipsView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/clanstva/novo',
      name: 'new-membership',
      component: () => import('../views/NewMembershipView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/strucna-usavrsavanja',
      name: 'professional-developments',
      component: () => import('../views/ProfessionalDevelopmentsView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/strucna-usavrsavanja/novo',
      name: 'new-professional-development',
      component: () => import('../views/NewProfessionalDevelopmentView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/sudjelovanja',
      name: 'event-participations',
      component: () => import('../views/EventParticipationsView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/sudjelovanja/novo',
      name: 'new-event-participation',
      component: () => import('../views/NewEventParticipationView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/radionice',
      name: 'workshops',
      component: () => import('../views/WorkshopsView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/radionice/novo',
      name: 'new-workshop',
      component: () => import('../views/NewWorkshopView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/koautorstva',
      name: 'coauthorships',
      component: () => import('../views/CoauthorshipsView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/koautorstva/novo',
      name: 'new-coauthored-paper',
      component: () => import('../views/NewCoauthoredPaperView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/projektne-prijave',
      name: 'project-applications',
      component: () => import('../views/ProjectApplicationsView.vue'),
    },
    {
      path: '/istrazivanje-i-razvoj/projektne-prijave/nova',
      name: 'new-project-application',
      component: () => import('../views/NewProjectApplicationView.vue'),
    },
    {
      path: '/medunarodna-suradnja',
      name: 'international-cooperation',
      component: () => import('../views/InternationalCooperationView.vue'),
    },
    {
      path: '/medunarodna-suradnja/gostujuci-istrazivaci',
      name: 'visiting-researchers',
      component: () => import('../views/VisitingResearchersView.vue'),
    },
    {
      path: '/medunarodna-suradnja/gostujuci-istrazivaci/novo',
      name: 'new-visiting-researcher',
      component: () => import('../views/NewVisitingResearcherView.vue'),
    },
    {
      path: '/medunarodna-suradnja/medunarodne-konferencije',
      name: 'international-conferences',
      component: () => import('../views/InternationalConferencesView.vue'),
    },
    {
      path: '/medunarodna-suradnja/medunarodne-konferencije/nova',
      name: 'new-international-conference',
      component: () => import('../views/NewInternationalConferenceView.vue'),
    },
    {
      path: '/medunarodna-suradnja/mobilnost-osoblja',
      name: 'staff-mobilities',
      component: () => import('../views/StaffMobilitiesView.vue'),
    },
    {
      path: '/medunarodna-suradnja/mobilnost-osoblja/nova',
      name: 'new-staff-mobility',
      component: () => import('../views/NewStaffMobilityView.vue'),
    },
    {
      path: '/medunarodna-suradnja/partnerstva',
      name: 'international-partnerships',
      component: () => import('../views/InternationalPartnershipsView.vue'),
    },
    {
      path: '/medunarodna-suradnja/partnerstva/novo',
      name: 'new-international-partnership',
      component: () => import('../views/NewInternationalPartnershipView.vue'),
    },
    {
      path: '/nastava-i-kvaliteta',
      name: 'teaching-quality',
      component: () => import('../views/TeachingQualityView.vue'),
    },
    {
      path: '/nastava-i-kvaliteta/optimizacija-rasporeda',
      name: 'schedule-optimizations',
      component: () => import('../views/ScheduleOptimizationsView.vue'),
    },
    {
      path: '/nastava-i-kvaliteta/prilagodbe-rasporeda',
      name: 'schedule-adjustments',
      component: () => import('../views/ScheduleAdjustmentsView.vue'),
    },
    {
      path: '/nastava-i-kvaliteta/mjere-prema-studentskim-anketama',
      name: 'survey-action-plans',
      component: () => import('../views/SurveyActionPlansView.vue'),
    },
    {
      path: '/nastava-i-kvaliteta/znanstvena-produktivnost',
      name: 'sabbaticals',
      component: () => import('../views/SabbaticalsView.vue'),
    },
    {
      path: '/suradnja-i-dogadanja',
      name: 'cooperation-events',
      component: () => import('../views/CooperationEventsView.vue'),
    },
    {
      path: '/suradnja-i-dogadanja/dionici',
      name: 'stakeholders',
      component: () => import('../views/StakeholdersView.vue'),
    },
    {
      path: '/suradnja-i-dogadanja/zajednicka-dogadanja',
      name: 'joint-events',
      component: () => import('../views/JointEventsView.vue'),
    },
    {
      path: '/glavni-obrazac',
      name: 'faculty-report',
      component: () => import('../views/FacultyReportView.vue'),
    },
    {
      path: '/administracija/korisnici',
      name: 'authorized-emails',
      component: () => import('../views/AuthorizedEmailsView.vue'),
      meta: { admin: true },
    },
    {
      path: '/profil',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public && isAuthenticated.value && !to.meta.allowAuthenticated)
    return { name: 'home' }

  if (!to.meta.public && !isAuthenticated.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.admin && currentUser.value?.role !== 'ADMIN') return { name: 'home' }

  return true
})

export default router
