import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db/pool.js";
import organizationalUnitsRouter from "./routes/organizationalUnits.js";
import reportingPeriodsRouter from "./routes/reportingPeriods.js";
import organizationsRouter from "./routes/organizations.js";
import countriesRouter from "./routes/countries.js";
import staffMembersRouter from "./routes/staffMembers.js";
import usersRouter from "./routes/users.js";
import membershipsRouter from "./routes/memberships.js";
import professionalDevelopmentsRouter from "./routes/professionalDevelopments.js";
import eventParticipationsRouter from "./routes/eventParticipations.js";
import workshopsRouter from "./routes/workshops.js";
import coauthorshipsRouter from "./routes/coauthorships.js";
import visitingResearchersRouter from "./routes/visitingResearchers.js";
import stakeholdersRouter from "./routes/stakeholders.js";
import internationalConferencesRouter from "./routes/internationalConferences.js";
import internationalCooperationsRouter from "./routes/internationalCooperations.js";
import scheduleOptimizationsRouter from "./routes/scheduleOptimizations.js";
import scheduleAdjustmentsRouter from "./routes/scheduleAdjustments.js";
import sabbaticalsRouter from "./routes/sabbaticals.js";
import jointEventsRouter from "./routes/jointEvents.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

// https://www.postman.com/anna011001-5136958/workspace/unipu-track

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
