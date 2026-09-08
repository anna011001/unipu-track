const writeMethods = new Set(["POST", "PUT", "PATCH"]);

export function setAuditUser(req, res, next) {
  if (
    !writeMethods.has(req.method) ||
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return next();
  }

  const userId = req.authenticatedUser.id;

  if (req.method === "POST") {
    req.body.created_by = userId;
  } else {
    delete req.body.created_by;
  }

  req.body.updated_by = userId;
  return next();
}
