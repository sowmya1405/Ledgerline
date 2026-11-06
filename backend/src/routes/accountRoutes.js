const express = require("express");

const router = express.Router();

const {
    createAccount,
    getMyAccounts,
    getAccount,
    freezeAccount,
    activateAccount,
    getAllAccounts
} = require("../controllers/accountController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");

router.use(authenticate);

// ACCOUNT HOLDER: CREATE ACCOUNT
router.post(
    "/",
    authorize("ACCOUNT_HOLDER"),
    createAccount
);

// ADMIN: VIEW ALL CUSTOMER ACCOUNTS
router.get(
    "/admin/all",
    authorize("ADMIN"),
    getAllAccounts
);

// ACCOUNT HOLDER: VIEW OWN ACCOUNTS
router.get(
    "/",
    authorize("ACCOUNT_HOLDER"),
    getMyAccounts
);
// ADMIN: FREEZE ACCOUNT
router.patch(
    "/:id/freeze",
    authorize("ADMIN"),
    freezeAccount
);

// ADMIN: ACTIVATE ACCOUNT
router.patch(
    "/:id/activate",
    authorize("ADMIN"),
    activateAccount
);

// ACCOUNT HOLDER: VIEW ACCOUNT DETAILS
router.get(
    "/:id",
    authorize("ACCOUNT_HOLDER"),
    getAccount
);


module.exports = router;