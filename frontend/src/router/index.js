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
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
