export function errorHandler(error, req, res, next) {
    console.error(error);

    return res.status(500).json({
        message: "Došlo je do greške na poslužitelju.",
    });
}