import jwt from "jsonwebtoken";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET nije postavljen.");
  }

  return secret;
}

export function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Prijava je obavezna." });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({ message: "Prijava je obavezna." });
  }

  try {
    req.authenticatedUser = jwt.verify(token, jwtSecret());
    return next();
  } catch {
    return res.status(401).json({ message: "Prijava je istekla ili nije valjana." });
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
