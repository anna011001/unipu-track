import express from "express";
import bcrypt from "bcrypt";
import pool from "../../db/pool.js";
import { authenticate, createToken, requireAdmin } from "../../middleware/authenticate.js";

const router = express.Router();
const saltRounds = 12;
const academicTitles = [
  "prof. dr. sc.",
  "izv. prof. dr. sc.",
  "doc. dr. sc.",
  "v. pred.",
  "pred.",
  "asist.",
  "viši asist.",
  "prof. art.",
  "izv. prof. art.",
  "doc. art.",
];

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validUniversityEmail(email) {
  return /^[^\s@]+@unipu\.hr$/i.test(email);
}

router.get("/registration-options", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, short_name
       FROM organizational_units
       ORDER BY short_name, name`,
    );

    return res.status(200).json({
      academic_titles: academicTitles,
      organizational_units: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const firstName = normalizedText(req.body?.first_name);
  const lastName = normalizedText(req.body?.last_name);
  const email = normalizedText(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const passwordConfirmation = typeof req.body?.password_confirmation === "string"
    ? req.body.password_confirmation
    : "";
  const academicTitle = normalizedText(req.body?.academic_title);
  const organizationalUnitId = Number(req.body?.organizational_unit_id);
  const errors = [];

  if (!firstName || firstName.length > 50) errors.push("Ime je obavezno i smije imati najviše 50 znakova.");
  if (!lastName || lastName.length > 80) errors.push("Prezime je obavezno i smije imati najviše 80 znakova.");
  if (!validUniversityEmail(email)) errors.push("Registracija je moguća samo službenom @unipu.hr adresom.");
  if (password.length < 8) errors.push("Lozinka mora imati najmanje 8 znakova.");
  if (password !== passwordConfirmation) errors.push("Lozinke se ne podudaraju.");
  if (!academicTitles.includes(academicTitle)) errors.push("Odaberite zvanje s ponuđenog popisa.");
  if (!Number.isInteger(organizationalUnitId) || organizationalUnitId <= 0) errors.push("Odaberite sastavnicu.");

  if (errors.length) {
    return res.status(400).json({ message: "Podaci nisu ispravni.", errors });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const allowedResult = await client.query(
      "SELECT id FROM authorized_user_emails WHERE LOWER(email) = $1",
      [email],
    );

    if (!allowedResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Ova e-mail adresa nije na popisu korisnika kojima je dopuštena registracija.",
      });
    }

    const unitResult = await client.query(
      "SELECT id FROM organizational_units WHERE id = $1",
      [organizationalUnitId],
    );

    if (!unitResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Odabrana sastavnica ne postoji." });
    }

    const existingResult = await client.query(
      "SELECT id, is_active FROM users WHERE LOWER(email) = $1",
      [email],
    );

    if (existingResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: existingResult.rows[0].is_active
          ? "Korisnički račun s tom e-mail adresom već postoji."
          : "Korisnički račun je deaktiviran. Obratite se administratoru.",
      });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userResult = await client.query(
      `
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, 'PROFESSOR', TRUE)
        RETURNING id, email, first_name, last_name, role, is_active
      `,
      [email, passwordHash, firstName, lastName],
    );
    const user = userResult.rows[0];

    const staffResult = await client.query(
      "SELECT id FROM staff_members WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1 FOR UPDATE",
      [user.email],
    );

    let staffMemberId;

    if (staffResult.rows.length) {
      const updatedStaffResult = await client.query(
        `UPDATE staff_members
         SET user_id = $1, first_name = $2, last_name = $3,
             academic_title = $4, organizational_unit_id = $5,
             is_active = TRUE, updated_at = NOW()
         WHERE id = $6
         RETURNING id`,
        [user.id, firstName, lastName, academicTitle, organizationalUnitId, staffResult.rows[0].id],
      );
      staffMemberId = updatedStaffResult.rows[0].id;
    } else {
      const createdStaffResult = await client.query(
        `INSERT INTO staff_members (
           user_id, organizational_unit_id, first_name, last_name,
           academic_title, email, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id`,
        [user.id, organizationalUnitId, firstName, lastName, academicTitle, user.email],
      );
      staffMemberId = createdStaffResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO staff_member_organizational_units (
         staff_member_id, organizational_unit_id, is_primary
       ) VALUES ($1, $2, TRUE)
       ON CONFLICT (staff_member_id, organizational_unit_id)
       DO UPDATE SET is_primary = TRUE`,
      [staffMemberId, organizationalUnitId],
    );
    await client.query("COMMIT");

    return res.status(201).json({
      message: "Registracija je uspješna. Sada se možete prijaviti.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res, next) => {
  const email = normalizedText(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "E-mail i lozinka su obavezni." });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM users WHERE LOWER(email) = $1`,
      [email],
    );
    const user = result.rows[0];
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (user && !user.is_active && passwordMatches) {
      return res.status(403).json({ message: "Korisnički račun je deaktiviran. Obratite se administratoru." });
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

    return res.status(200).json({ jwt_token: createToken(authenticatedUser), user: authenticatedUser });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, is_active, last_login_at
       FROM users WHERE id = $1`,
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

router.post("/change-password", authenticate, async (req, res, next) => {
  const currentPassword = typeof req.body?.current_password === "string" ? req.body.current_password : "";
  const newPassword = typeof req.body?.new_password === "string" ? req.body.new_password : "";
  const passwordConfirmation = typeof req.body?.password_confirmation === "string"
    ? req.body.password_confirmation
    : "";

  if (!currentPassword) {
    return res.status(400).json({ message: "Trenutačna lozinka je obavezna." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Nova lozinka mora imati najmanje 8 znakova." });
  }
  if (newPassword !== passwordConfirmation) {
    return res.status(400).json({ message: "Nove lozinke se ne podudaraju." });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: "Nova lozinka mora se razlikovati od trenutačne." });
  }

  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE",
      [req.authenticatedUser.id],
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ message: "Trenutačna lozinka nije ispravna." });
    }

    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, req.authenticatedUser.id],
    );

    return res.status(200).json({ message: "Lozinka je uspješno promijenjena." });
  } catch (error) {
    return next(error);
  }
});

router.get("/authorized-emails", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT aue.id, aue.email, aue.created_at, u.id AS user_id,
             u.first_name, u.last_name, u.role,
             COALESCE(u.is_active, FALSE) AS is_registered,
             sm.id AS staff_member_id,
             sm.academic_title,
             sm.organizational_unit_id AS primary_organizational_unit_id,
             primary_unit.name AS primary_organizational_unit_name,
             primary_unit.short_name AS primary_organizational_unit_short_name,
             COALESCE((
               SELECT json_agg(
                 json_build_object(
                   'id', unit.id,
                   'name', unit.name,
                   'short_name', unit.short_name,
                   'is_primary', relation.is_primary
                 )
                 ORDER BY relation.is_primary DESC, unit.short_name, unit.name
               )
               FROM staff_member_organizational_units relation
               JOIN organizational_units unit
                 ON unit.id = relation.organizational_unit_id
               WHERE relation.staff_member_id = sm.id
             ), '[]'::json) AS organizational_units
      FROM authorized_user_emails aue
      LEFT JOIN users u ON LOWER(u.email) = LOWER(aue.email)
      LEFT JOIN staff_members sm ON sm.user_id = u.id
      LEFT JOIN organizational_units primary_unit
        ON primary_unit.id = sm.organizational_unit_id
      ORDER BY aue.email
    `);
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.put("/authorized-emails/:id/organizational-units", authenticate, requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const suppliedIds = req.body?.organizational_unit_ids;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "ID zapisa nije ispravan." });
  }
  if (!Array.isArray(suppliedIds)) {
    return res.status(400).json({ message: "Sastavnice moraju biti poslane kao popis ID-eva." });
  }

  const organizationalUnitIds = [...new Set(suppliedIds.map(Number))];
  if (organizationalUnitIds.some((unitId) => !Number.isInteger(unitId) || unitId <= 0)) {
    return res.status(400).json({ message: "Popis sastavnica sadrži neispravan ID." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const staffResult = await client.query(
      `SELECT sm.id, sm.organizational_unit_id
       FROM authorized_user_emails aue
       JOIN users u ON LOWER(u.email) = LOWER(aue.email)
       JOIN staff_members sm ON sm.user_id = u.id
       WHERE aue.id = $1
       FOR UPDATE OF sm`,
      [id],
    );
    const staffMember = staffResult.rows[0];

    if (!staffMember) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Registrirani nastavnik nije pronađen." });
    }

    if (organizationalUnitIds.length) {
      const unitResult = await client.query(
        "SELECT id FROM organizational_units WHERE id = ANY($1::int[])",
        [organizationalUnitIds],
      );
      if (unitResult.rows.length !== organizationalUnitIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Jedna ili više odabranih sastavnica ne postoje." });
      }
    }

    const primaryUnitId = Number(staffMember.organizational_unit_id);
    const additionalUnitIds = organizationalUnitIds.filter((unitId) => unitId !== primaryUnitId);

    await client.query(
      `DELETE FROM staff_member_organizational_units
       WHERE staff_member_id = $1 AND is_primary = FALSE`,
      [staffMember.id],
    );

    if (primaryUnitId) {
      await client.query(
        `INSERT INTO staff_member_organizational_units (
           staff_member_id, organizational_unit_id, is_primary
         ) VALUES ($1, $2, TRUE)
         ON CONFLICT (staff_member_id, organizational_unit_id)
         DO UPDATE SET is_primary = TRUE`,
        [staffMember.id, primaryUnitId],
      );
    }

    for (const unitId of additionalUnitIds) {
      await client.query(
        `INSERT INTO staff_member_organizational_units (
           staff_member_id, organizational_unit_id, is_primary
         ) VALUES ($1, $2, FALSE)
         ON CONFLICT (staff_member_id, organizational_unit_id)
         DO UPDATE SET is_primary = FALSE`,
        [staffMember.id, unitId],
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Sastavnice nastavnika uspješno su spremljene." });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.post("/authorized-emails", authenticate, requireAdmin, async (req, res, next) => {
  const email = normalizedText(req.body?.email).toLowerCase();

  if (!validUniversityEmail(email)) {
    return res.status(400).json({ message: "Unesite ispravnu službenu @unipu.hr adresu." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO authorized_user_emails (email, added_by_user_id)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, created_at`,
      [email, req.authenticatedUser.id],
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "E-mail adresa već se nalazi na popisu." });
    }

    await client.query(
      "UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE LOWER(email) = $1",
      [email],
    );
    await client.query("COMMIT");
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.delete("/authorized-emails/:id", authenticate, requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "ID zapisa nije ispravan." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const selectedResult = await client.query(
      "SELECT email FROM authorized_user_emails WHERE id = $1 FOR UPDATE",
      [id],
    );
    const selected = selectedResult.rows[0];

    if (!selected) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "E-mail adresa nije pronađena." });
    }
    if (selected.email.toLowerCase() === req.authenticatedUser.email.toLowerCase()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Ne možete ukloniti vlastitu administratorsku adresu." });
    }

    await client.query("DELETE FROM authorized_user_emails WHERE id = $1", [id]);
    await client.query(
      "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE LOWER(email) = LOWER($1)",
      [selected.email],
    );
    await client.query("COMMIT");
    return res.status(200).json({ message: "E-mail je uklonjen, a povezani račun deaktiviran." });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

export default router;
