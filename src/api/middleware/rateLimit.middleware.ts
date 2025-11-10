import rateLimit from "express-rate-limit";

const publishRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export default publishRateLimiter;
