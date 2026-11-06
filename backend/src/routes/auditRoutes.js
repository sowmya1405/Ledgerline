const express = require("express");
const router = express.Router();

const { getAuditLogs } = require("../controllers/auditController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

// All audit routes require authentication
router.use(authenticate);

// Only ADMIN and AUDITOR can view audit logs
router.get("/", authorize("ADMIN", "AUDITOR"), getAuditLogs);

module.exports = router;