function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : err.statusCode || 500;
  const message = err.message || "Internal Server Error";

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

