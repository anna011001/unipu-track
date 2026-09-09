import jwt from "jsonwebtoken";
import pool from "../db/pool.js";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET nije postavljen.");
  }

  return secret;
}

export async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Prijava je obavezna." });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({ message: "Prijava je obavezna." });
  }

  let claims;
  try {
    claims = jwt.verify(token, jwtSecret());
  } catch {
    return res.status(401).json({ message: "Prijava je istekla ili nije valjana." });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1",
      [claims.id],
    );
    const user = result.rows[0];

    if (!user?.is_active) {
      return res.status(401).json({ message: "Korisnički račun nije aktivan." });
    }

    req.authenticatedUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.authenticatedUser?.role !== "ADMIN") {
    return res.status(403).json({ message: "Ova radnja dostupna je samo administratoru." });
  }

  return next();
}

export function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    },
    jwtSecret(),
    { subject: String(user.id), expiresIn: "24h" },
  );
}
