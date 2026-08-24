import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import pool from "../../db/pool.js";
import { authenticate, createToken } from "../../middleware/authenticate.js";
import { notifyRegistrationAdmin } from "../../services/registrationNotifications.js";

const router = express.Router();
const saltRounds = 12;
const approvalValidityHours = 48;

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post("/register", async (req, res, next) => {
  const firstName = normalizedText(req.body?.first_name);
  const lastName = normalizedText(req.body?.last_name);
  const email = normalizedText(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const passwordConfirmation = typeof req.body?.password_confirmation === "string"
    ? req.body.password_confirmation
    : "";
  const errors = [];

  if (!firstName || firstName.length > 50) errors.push("Ime je obavezno i smije imati najviše 50 znakova.");
  if (!lastName || lastName.length > 80) errors.push("Prezime je obavezno i smije imati najviše 80 znakova.");
  if (!/^[^\s@]+@unipu\.hr$/i.test(email)) errors.push("Registracija je moguća samo službenom @unipu.hr adresom.");
  if (password.length < 8) errors.push("Lozinka mora imati najmanje 8 znakova.");
  if (password !== passwordConfirmation) errors.push("Lozinke se ne podudaraju.");

  if (errors.length) {
    return res.status(400).json({ message: "Podaci nisu ispravni.", errors });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      "SELECT id, is_active FROM users WHERE LOWER(email) = $1",
      [email],
    );

    if (existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: existingResult.rows[0].is_active
          ? "Korisnički račun s tom e-mail adresom već postoji."
          : "Zahtjev za tu e-mail adresu već čeka odobrenje.",
      });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userResult = await client.query(
      `
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, 'PROFESSOR', FALSE)
        RETURNING id, email, first_name, last_name
      `,
      [email, passwordHash, firstName, lastName],
    );
    const user = userResult.rows[0];
    const approvalToken = crypto.randomBytes(32).toString("hex");

    await client.query(
      `
        INSERT INTO user_registration_approvals (user_id, token_hash, expires_at)
        VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 hour'))
      `,
      [user.id, tokenHash(approvalToken), approvalValidityHours],
    );

    await client.query("COMMIT");

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    try {
      await notifyRegistrationAdmin({
        user,
        approvalUrl: `${frontendUrl}/odobrenje-registracije?token=${approvalToken}`,
      });
    } catch (notificationError) {
      console.error("Nije moguće poslati obavijest o registraciji:", notificationError.message);
      console.log(`Poveznica za ručno odobrenje: ${frontendUrl}/odobrenje-registracije?token=${approvalToken}`);
    }

    return res.status(201).json({
      message: "Registracija je zaprimljena. Prijava će biti moguća nakon odobrenja administratora.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.post("/approve-registration", async (req, res, next) => {
  const token = normalizedText(req.body?.token);

  if (!token) return res.status(400).json({ message: "Poveznica za odobrenje nije ispravna." });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const approvalResult = await client.query(
      `
        SELECT ura.id, ura.user_id, ura.expires_at, ura.approved_at,
               u.email, u.first_name, u.last_name, u.is_active
        FROM user_registration_approvals ura
        JOIN users u ON u.id = ura.user_id
        WHERE ura.token_hash = $1
        FOR UPDATE
      `,
      [tokenHash(token)],
    );
    const approval = approvalResult.rows[0];

    if (!approval) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Poveznica za odobrenje nije ispravna." });
    }
    if (approval.approved_at || approval.is_active) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Korisnički račun već je odobren." });
    }
    if (new Date(approval.expires_at) <= new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ message: "Poveznica za odobrenje je istekla." });
    }

    await client.query("UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1", [approval.user_id]);
    await client.query("UPDATE user_registration_approvals SET approved_at = NOW() WHERE id = $1", [approval.id]);
    await client.query(
      `
        UPDATE staff_members
        SET user_id = $1, updated_at = NOW()
        WHERE user_id IS NULL AND LOWER(email) = LOWER($2)
      `,
      [approval.user_id, approval.email],
    );
    await client.query("COMMIT");

    return res.status(200).json({
      message: `Račun korisnika ${approval.first_name} ${approval.last_name} uspješno je odobren.`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res, next) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "E-mail i lozinka su obavezni." });
  }

  try {
    const result = await pool.query(
      `
        SELECT id, email, password_hash, first_name, last_name, role, is_active
        FROM users
        WHERE LOWER(email) = $1
      `,
      [email],
    );

    const user = result.rows[0];
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (user && !user.is_active && passwordMatches) {
      const pendingResult = await pool.query(
        "SELECT 1 FROM user_registration_approvals WHERE user_id = $1 AND approved_at IS NULL",
        [user.id],
      );
      if (pendingResult.rows.length) {
        return res.status(403).json({ message: "Korisnički račun još čeka odobrenje administratora." });
      }
    }

    if (!user || !user.is_active || !passwordMatches) {
      return res.status(401).json({ message: "E-mail ili lozinka nisu ispravni." });
    }

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const authenticatedUser = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    };

    return res.status(200).json({
      jwt_token: createToken(authenticatedUser),
      user: authenticatedUser,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, email, first_name, last_name, role, is_active, last_login_at
        FROM users
        WHERE id = $1
      `,
      [req.authenticatedUser.id],
    );

    const user = result.rows[0];

    if (!user?.is_active) {
      return res.status(401).json({ message: "Korisnički račun nije aktivan." });
    }

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
});

export default router;
