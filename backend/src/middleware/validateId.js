export function validateId(req, res, next) {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            message: "ID mora biti pozitivan cijeli broj."
        });
    }

    req.resourceId = id;
    next();
}