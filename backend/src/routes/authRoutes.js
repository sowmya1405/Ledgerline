const express = require("express");
const router = express.Router();

const {
    register,
    login
} = require("../controllers/authController");

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

module.exports = router;