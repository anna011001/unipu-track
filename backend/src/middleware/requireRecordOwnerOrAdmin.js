import pool from "../db/pool.js";

const protectedMethods = new Set(["PUT", "PATCH", "DELETE"]);

const tablesByPath = {
  "/memberships/new": "new_memberships",
  "/memberships/active": "active_memberships",
  "/memberships/summaries": "membership_category_summaries",
  "/professional-developments/confirmations": "professional_development_confirmations",
  "/professional-developments/media": "professional_development_media",
  "/professional-developments": "professional_developments",
  "/event-participations/confirmations": "event_organizer_confirmations",
  "/event-participations/media": "event_media",
  "/event-participations": "event_participations",
  "/workshops/details": "workshop_details",
  "/workshops/media": "workshop_media",
  "/workshops": "workshops",
  "/coauthorships/year-totals": "coauthorship_year_totals",
  "/coauthorships/papers": "coauthored_papers",
  "/coauthorships/category-summaries": "coauthorship_category_summaries",
  "/visiting-researchers/realized": "realized_visiting_researchers",
  "/visiting-researchers/planned": "planned_visiting_researchers",
  "/visiting-researchers/unit-analyses": "visiting_researcher_unit_analyses",
  "/stakeholders/analyses": "stakeholder_analyses",
  "/stakeholders/science": "science_stakeholders",
  "/stakeholders/artistic": "artistic_stakeholders",
  "/stakeholders/professional": "professional_stakeholders",
  "/stakeholders/summaries": "stakeholder_analysis_summaries",
  "/international-conferences/details": "international_conference_details",
  "/international-conferences/countries": "conference_country_statistics",
  "/international-conferences": "international_conferences",
  "/staff-mobilities": "staff_mobilities",
  "/international-cooperations/new": "new_international_cooperations",
  "/international-cooperations/agreements": "active_international_agreements",
  "/international-cooperations/region-analyses": "international_cooperation_region_analyses",
  "/schedule-optimizations/reports": "schedule_optimization_reports",
  "/schedule-optimizations/overload-cases": "schedule_overload_cases",
  "/schedule-optimizations/promotion-cases": "academic_promotion_cases",
  "/schedule-optimizations/summaries": "schedule_optimization_summaries",
  "/schedule-adjustments/reports": "schedule_adjustment_reports",
  "/schedule-adjustments/measures": "schedule_adjustment_measures",
  "/schedule-adjustments/beneficiaries": "schedule_adjustment_beneficiaries",
  "/schedule-adjustments/planned": "planned_schedule_adjustments",
  "/schedule-adjustments/effect-analyses": "schedule_adjustment_effect_analyses",
  "/sabbaticals/reports": "sabbatical_reports",
  "/sabbaticals/users": "sabbatical_users",
  "/sabbaticals/papers": "sabbatical_q1_q2_papers",
  "/sabbaticals/monographs": "sabbatical_monographs",
  "/joint-events/held": "held_joint_events",
  "/joint-events/planned": "planned_joint_events",
  "/joint-events/type-analyses": "joint_event_type_analyses",
  "/project-applications": "project_applications",
  "/survey-action-plans": "survey_action_plans",
  "/faculty/reports": "faculty_reports",
  "/faculty/staff-elections": "staff_elections",
  "/faculty/newly-employed-teachers": "newly_employed_teachers",
  "/faculty/retired-teachers": "retired_teachers",
  "/faculty/doctoral-assistants": "doctoral_assistants",
  "/faculty/committees": "faculty_committees",
  "/faculty/council-statistics": "faculty_council_statistics",
  "/faculty/council-meeting-records": "faculty_council_meeting_records",
  "/faculty/alumni-organizations": "alumni_organizations",
  "/faculty/business-partners": "business_partners",
  "/faculty/funded-projects": "funded_projects",
  "/faculty/doctoral-generation-statistics": "doctoral_generation_statistics",
  "/faculty/defended-doctoral-dissertations": "defended_doctoral_dissertations",
  "/faculty/doctoral-co-mentors": "doctoral_co_mentors",
  "/faculty/external-doctoral-mentorships": "external_doctoral_mentorships",
  "/faculty/specialist-generation-statistics": "specialist_generation_statistics",
  "/faculty/defended-specialist-works": "defended_specialist_works",
  "/faculty/digital-tool-usage": "digital_tool_usage",
  "/faculty/innovative-teaching-methods": "innovative_teaching_methods",
  "/faculty/full-time-study-enrollments": "full_time_study_enrollments",
  "/faculty/part-time-study-enrollments": "part_time_study_enrollments",
  "/faculty/english-course-statistics": "english_course_statistics",
  "/faculty/foreign-student-statistics": "foreign_student_statistics",
  "/faculty/commission-exams": "commission_exams",
  "/faculty/external-teachers": "external_teachers",
  "/faculty/lifelong-learning-programs": "lifelong_learning_programs",
  "/faculty/student-mobility-statistics": "student_mobility_statistics",
  "/faculty/field-teaching-activities": "field_teaching_activities",
  "/faculty/student-competitions": "student_competitions",
  "/faculty/student-awards": "student_awards",
  "/faculty/extracurricular-activities": "extracurricular_activities",
};

export async function requireRecordOwnerOrAdmin(req, res, next) {
  if (!protectedMethods.has(req.method) || req.authenticatedUser.role === "ADMIN") {
    return next();
  }

  const pathParts = req.path.toLowerCase().split("/").filter(Boolean);
  let recordId;
  try {
    // Express matches routes without case sensitivity and decodes route parameters.
    recordId = Number(decodeURIComponent(pathParts.at(-1)));
  } catch {
    return res.status(400).json({ message: "ID mora biti pozitivan cijeli broj." });
  }

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return next();
  }

  const resourcePath = `/${pathParts.slice(0, -1).join("/")}`;
  const table = tablesByPath[resourcePath];

  if (!table) {
    return next();
  }

  try {
    const result = await pool.query(
      `SELECT created_by FROM ${table} WHERE id = $1`,
      [recordId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Zapis nije pronađen." });
    }

    if (Number(result.rows[0].created_by) !== Number(req.authenticatedUser.id)) {
      return res.status(403).json({
        message: "Možete uređivati i brisati samo vlastite zapise.",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
