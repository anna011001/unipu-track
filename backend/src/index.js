import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import pool from "./db/pool.js";
import organizationalUnitsRouter from "./routes/core/organizationalUnits.js";
import reportingPeriodsRouter from "./routes/core/reportingPeriods.js";
import organizationsRouter from "./routes/core/organizations.js";
import countriesRouter from "./routes/core/countries.js";
import staffMembersRouter from "./routes/core/staffMembers.js";
import usersRouter from "./routes/core/users.js";
import membershipsRouter from "./routes/science/memberships.js";
import professionalDevelopmentsRouter from "./routes/science/professionalDevelopments.js";
import eventParticipationsRouter from "./routes/science/eventParticipations.js";
import workshopsRouter from "./routes/science/workshops.js";
import coauthorshipsRouter from "./routes/science/coauthorships.js";
import visitingResearchersRouter from "./routes/science/visitingResearchers.js";
import stakeholdersRouter from "./routes/stakeholders.js";
import internationalConferencesRouter from "./routes/international/internationalConferences.js";
import internationalCooperationsRouter from "./routes/international/internationalCooperations.js";
import scheduleOptimizationsRouter from "./routes/teaching/scheduleOptimizations.js";
import scheduleAdjustmentsRouter from "./routes/teaching/scheduleAdjustments.js";
import sabbaticalsRouter from "./routes/teaching/sabbaticals.js";
import jointEventsRouter from "./routes/international/jointEvents.js";
import projectApplicationsRouter from "./routes/science/projectApplications.js";
import surveyActionPlansRouter from "./routes/teaching/surveyActionPlans.js";
import facultyReportsRouter from "./routes/faculty/facultyReports.js";
import recordFilesRouter from "./routes/system/recordFiles.js";
import dashboardRouter from "./routes/system/dashboard.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

// https://www.postman.com/anna011001-5136958/workspace/unipu-track

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  express.static(fileURLToPath(new URL("../uploads/", import.meta.url))),
);

app.use("/api/organizational-units", organizationalUnitsRouter);
app.use("/api/reporting-periods", reportingPeriodsRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/countries", countriesRouter);
app.use("/api/staff-members", staffMembersRouter);
app.use("/api/users", usersRouter);
app.use("/api/memberships", membershipsRouter);
app.use("/api/professional-developments", professionalDevelopmentsRouter);
app.use("/api/event-participations", eventParticipationsRouter);
app.use("/api/workshops", workshopsRouter);
app.use("/api/coauthorships", coauthorshipsRouter);
app.use("/api/visiting-researchers", visitingResearchersRouter);
app.use("/api/stakeholders", stakeholdersRouter);
app.use("/api/international-conferences", internationalConferencesRouter);
app.use("/api/international-cooperations", internationalCooperationsRouter);
app.use("/api/schedule-optimizations", scheduleOptimizationsRouter);
app.use("/api/schedule-adjustments", scheduleAdjustmentsRouter);
app.use("/api/sabbaticals", sabbaticalsRouter);
app.use("/api/joint-events", jointEventsRouter);
app.use("/api/project-applications", projectApplicationsRouter);
app.use("/api/survey-action-plans", surveyActionPlansRouter);
app.use("/api/faculty", facultyReportsRouter);
app.use("/api/record-files", recordFilesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use(notFound);
app.use(errorHandler);

app.get("/", (req, res) => {
  res.json({
    message: "UNIPU Track API is running.",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT
            NOW() AS database_time,
            current_database() AS database_name
        `);

    res.json({
      status: "ok",
      database: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      message: "Not possible to connect to db.",
    });
  }
});

app.listen(port, () => {
  console.log(`UNIPU Track API is listening on port ${port}.`);
});
