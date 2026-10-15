const Sentry = require("@sentry/node");

function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  // Mongoose raises these for malformed ids / invalid documents: caller input, not a server fault.
  const isClientInput = err && (err.name === "CastError" || err.name === "ValidationError");
  const statusCode = isClientInput
    ? 400
    : res.statusCode && res.statusCode !== 200 ? res.statusCode : err.statusCode || 500;
  const isServerError = statusCode >= 500;
  // 5xx messages can contain internals (driver errors, file paths) — only
  // client errors (4xx) pass their message through in production.
  const message = isServerError && process.env.NODE_ENV === "production"
    ? "Internal Server Error"
    : err.message || "Internal Server Error";

  if (process.env.SENTRY_DSN && isServerError) {
    Sentry.captureException(err);
  }

  // Avoid leaking internal details in production.
  const response = {
    message,
  };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { errorHandler };

