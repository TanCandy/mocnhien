function roleMiddleware(expectedRole) {
  return function roleGuard(req, res, next) {
    if (!req.user) return res.status(401).json({ message: "Unauthorized." });
    if (req.user.role !== expectedRole) {
      return res.status(403).json({ message: "Forbidden." });
    }
    return next();
  };
}

module.exports = { roleMiddleware };

