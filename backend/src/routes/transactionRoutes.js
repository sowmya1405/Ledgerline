const express = require("express");
const router = express.Router();

const {
    deposit,
    withdraw,
    transfer,
    getMyTransactions
} = require("../controllers/transactionController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");

router.use(authenticate);

router.get(
    "/history",
    authorize("ACCOUNT_HOLDER"),
    getMyTransactions
);

router.post(
    "/deposit",
    authorize("ACCOUNT_HOLDER"),
    deposit
);

router.post(
    "/withdraw",
    authorize("ACCOUNT_HOLDER"),
    withdraw
);

router.post(
    "/transfer",
    authorize("ACCOUNT_HOLDER"),
    transfer
);

module.exports = router;