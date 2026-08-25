import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MembershipsView from '../views/MembershipsView.vue'
import NewMembershipView from '../views/NewMembershipView.vue'
import NewProfessionalDevelopmentView from '../views/NewProfessionalDevelopmentView.vue'
import ProfessionalDevelopmentsView from '../views/ProfessionalDevelopmentsView.vue'
import ResearchDevelopmentView from '../views/ResearchDevelopmentView.vue'
import EventParticipationsView from '../views/EventParticipationsView.vue'
import NewEventParticipationView from '../views/NewEventParticipationView.vue'
import WorkshopsView from '../views/WorkshopsView.vue'
import NewWorkshopView from '../views/NewWorkshopView.vue'
import CoauthorshipsView from '../views/CoauthorshipsView.vue'
import NewCoauthoredPaperView from '../views/NewCoauthoredPaperView.vue'
import ProjectApplicationsView from '../views/ProjectApplicationsView.vue'
import NewProjectApplicationView from '../views/NewProjectApplicationView.vue'
import InternationalCooperationView from '../views/InternationalCooperationView.vue'
import VisitingResearchersView from '../views/VisitingResearchersView.vue'
import NewVisitingResearcherView from '../views/NewVisitingResearcherView.vue'
import InternationalConferencesView from '../views/InternationalConferencesView.vue'
import NewInternationalConferenceView from '../views/NewInternationalConferenceView.vue'
import StaffMobilitiesView from '../views/StaffMobilitiesView.vue'
import NewStaffMobilityView from '../views/NewStaffMobilityView.vue'
import InternationalPartnershipsView from '../views/InternationalPartnershipsView.vue'
import NewInternationalPartnershipView from '../views/NewInternationalPartnershipView.vue'
import TeachingQualityView from '../views/TeachingQualityView.vue'
import ScheduleOptimizationsView from '../views/ScheduleOptimizationsView.vue'
import ScheduleAdjustmentsView from '../views/ScheduleAdjustmentsView.vue'
import SurveyActionPlansView from '../views/SurveyActionPlansView.vue'
import SabbaticalsView from '../views/SabbaticalsView.vue'
import CooperationEventsView from '../views/CooperationEventsView.vue'
import StakeholdersView from '../views/StakeholdersView.vue'
import JointEventsView from '../views/JointEventsView.vue'
import FacultyReportView from '../views/FacultyReportView.vue'
import LoginView from '../views/LoginView.vue'
import AuthorizedEmailsView from '../views/AuthorizedEmailsView.vue'
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
      path: '/istrazivanje-i-razvoj/radionice',
      name: 'workshops',
      component: WorkshopsView,
    },
    {
      path: '/istrazivanje-i-razvoj/radionice/novo',
      name: 'new-workshop',
      component: NewWorkshopView,
    },
    {
      path: '/istrazivanje-i-razvoj/koautorstva',
      name: 'coauthorships',
      component: CoauthorshipsView,
    },
    {
      path: '/istrazivanje-i-razvoj/koautorstva/novo',
      name: 'new-coauthored-paper',
      component: NewCoauthoredPaperView,
    },
    {
      path: '/istrazivanje-i-razvoj/projektne-prijave',
      name: 'project-applications',
      component: ProjectApplicationsView,
    },
    {
      path: '/istrazivanje-i-razvoj/projektne-prijave/nova',
      name: 'new-project-application',
      component: NewProjectApplicationView,
    },
    {
      path: '/medunarodna-suradnja',
      name: 'international-cooperation',
      component: InternationalCooperationView,
    },
    {
      path: '/medunarodna-suradnja/gostujuci-istrazivaci',
      name: 'visiting-researchers',
      component: VisitingResearchersView,
    },
    {
      path: '/medunarodna-suradnja/gostujuci-istrazivaci/novo',
      name: 'new-visiting-researcher',
      component: NewVisitingResearcherView,
    },
    {
      path: '/medunarodna-suradnja/medunarodne-konferencije',
      name: 'international-conferences',
      component: InternationalConferencesView,
    },
    {
      path: '/medunarodna-suradnja/medunarodne-konferencije/nova',
      name: 'new-international-conference',
      component: NewInternationalConferenceView,
    },
    {
      path: '/medunarodna-suradnja/mobilnost-osoblja',
      name: 'staff-mobilities',
      component: StaffMobilitiesView,
    },
    {
      path: '/medunarodna-suradnja/mobilnost-osoblja/nova',
      name: 'new-staff-mobility',
      component: NewStaffMobilityView,
    },
    {
      path: '/medunarodna-suradnja/partnerstva',
      name: 'international-partnerships',
      component: InternationalPartnershipsView,
    },
    {
      path: '/medunarodna-suradnja/partnerstva/novo',
      name: 'new-international-partnership',
      component: NewInternationalPartnershipView,
    },
    {
      path: '/nastava-i-kvaliteta',
      name: 'teaching-quality',
      component: TeachingQualityView,
    },
    {
      path: '/nastava-i-kvaliteta/optimizacija-rasporeda',
      name: 'schedule-optimizations',
      component: ScheduleOptimizationsView,
    },
    {
      path: '/nastava-i-kvaliteta/prilagodbe-rasporeda',
      name: 'schedule-adjustments',
      component: ScheduleAdjustmentsView,
    },
    {
      path: '/nastava-i-kvaliteta/mjere-prema-studentskim-anketama',
      name: 'survey-action-plans',
      component: SurveyActionPlansView,
    },
    {
      path: '/nastava-i-kvaliteta/znanstvena-produktivnost',
      name: 'sabbaticals',
      component: SabbaticalsView,
    },
    {
      path: '/suradnja-i-dogadanja',
      name: 'cooperation-events',
      component: CooperationEventsView,
    },
    {
      path: '/suradnja-i-dogadanja/dionici',
      name: 'stakeholders',
      component: StakeholdersView,
    },
    {
      path: '/suradnja-i-dogadanja/zajednicka-dogadanja',
      name: 'joint-events',
      component: JointEventsView,
    },
    {
      path: '/glavni-obrazac',
      name: 'faculty-report',
      component: FacultyReportView,
    },
    {
      path: '/administracija/korisnici',
      name: 'authorized-emails',
      component: AuthorizedEmailsView,
      meta: { admin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public && isAuthenticated.value && !to.meta.allowAuthenticated) return { name: 'home' }

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
