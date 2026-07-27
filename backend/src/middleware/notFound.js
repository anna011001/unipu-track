export function notFound(req, res) {
    return res.status(404).json({
        message: "Ruta nije pronađena."
    });
}