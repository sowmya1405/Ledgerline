const prisma = require("../config/prisma");
const crypto = require("crypto");

// Generate unique account number
function generateAccountNumber() {
    return "LL" + crypto.randomInt(1000000000, 9999999999);
}

// CREATE ACCOUNT
exports.createAccount = async (req, res) => {
    try {
        const accountNumber = generateAccountNumber();

        const account = await prisma.account.create({
            data: {
                accountNumber,
                ownerId: req.user.userId,
                balance: 0n,
                type: "CUSTOMER"
            }
        });

        return res.status(201).json({
            message: "Account created successfully",
            account: {
                id: account.id,
                accountNumber: account.accountNumber,
                balance: "0",
                status: account.status
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Unable to create account"
        });
    }
};


// GET MY ACCOUNTS
exports.getMyAccounts = async (req, res) => {
    try {
        const accounts = await prisma.account.findMany({
            where: {
                ownerId: req.user.userId
            }
        });

        return res.json({
            accounts: accounts.map(account => ({
                ...account,
                balance: account.balance.toString()
            }))
        });

    } catch (error) {
        return res.status(500).json({
            message: "Unable to fetch accounts"
        });
    }
};


// GET ACCOUNT DETAILS
exports.getAccount = async (req, res) => {
    try {
        const account = await prisma.account.findFirst({
            where: {
                id: req.params.id,
                ownerId: req.user.userId
            }
        });

        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        return res.json({
            account: {
                ...account,
                balance: account.balance.toString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: "Unable to fetch account"
        });
    }
};
// ADMIN: GET ALL CUSTOMER ACCOUNTS
exports.getAllAccounts = async (req, res) => {
    try {
        const accounts = await prisma.account.findMany({
            where: {
                type: "CUSTOMER"
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return res.json({
            count: accounts.length,
            accounts: accounts.map(account => ({
                ...account,
                balance: account.balance.toString()
            }))
        });

    } catch (error) {
        console.error("Admin account fetch error:", error);

        return res.status(500).json({
            message: "Unable to fetch customer accounts"
        });
    }
};
// ADMIN: FREEZE CUSTOMER ACCOUNT
exports.freezeAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await prisma.$transaction(async (tx) => {
            const account = await tx.account.findFirst({
                where: {
                    id,
                    type: "CUSTOMER"
                }
            });

            if (!account) {
                return { error: "ACCOUNT_NOT_FOUND" };
            }

            if (account.status === "FROZEN") {
                return { error: "ALREADY_FROZEN" };
            }

            if (account.status === "CLOSED") {
                return { error: "ACCOUNT_CLOSED" };
            }

            const updatedAccount = await tx.account.update({
                where: { id },
                data: { status: "FROZEN" }
            });

            await tx.auditLog.create({
                data: {
                    action: "ACCOUNT_FROZEN",
                    entity: "ACCOUNT",
                    entityId: account.id,
                    details: {
                        previousStatus: account.status,
                        newStatus: "FROZEN"
                    },
                    userId: req.user.userId
                }
            });

            return { account: updatedAccount };
        });

        if (result.error === "ACCOUNT_NOT_FOUND") {
            return res.status(404).json({
                message: "Customer account not found"
            });
        }

        if (result.error === "ALREADY_FROZEN") {
            return res.status(409).json({
                message: "Account is already frozen"
            });
        }

        if (result.error === "ACCOUNT_CLOSED") {
            return res.status(400).json({
                message: "Closed accounts cannot be frozen"
            });
        }

        return res.json({
            message: "Account frozen successfully",
            account: {
                ...result.account,
                balance: result.account.balance.toString()
            }
        });

    } catch (error) {
        console.error("Freeze account error:", error);

        return res.status(500).json({
            message: "Unable to freeze account"
        });
    }
};


// ADMIN: REACTIVATE FROZEN CUSTOMER ACCOUNT
exports.activateAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await prisma.$transaction(async (tx) => {
            const account = await tx.account.findFirst({
                where: {
                    id,
                    type: "CUSTOMER"
                }
            });

            if (!account) {
                return { error: "ACCOUNT_NOT_FOUND" };
            }

            if (account.status === "ACTIVE") {
                return { error: "ALREADY_ACTIVE" };
            }

            if (account.status === "CLOSED") {
                return { error: "ACCOUNT_CLOSED" };
            }

            const updatedAccount = await tx.account.update({
                where: { id },
                data: { status: "ACTIVE" }
            });

            await tx.auditLog.create({
                data: {
                    action: "ACCOUNT_ACTIVATED",
                    entity: "ACCOUNT",
                    entityId: account.id,
                    details: {
                        previousStatus: account.status,
                        newStatus: "ACTIVE"
                    },
                    userId: req.user.userId
                }
            });

            return { account: updatedAccount };
        });

        if (result.error === "ACCOUNT_NOT_FOUND") {
            return res.status(404).json({
                message: "Customer account not found"
            });
        }

        if (result.error === "ALREADY_ACTIVE") {
            return res.status(409).json({
                message: "Account is already active"
            });
        }

        if (result.error === "ACCOUNT_CLOSED") {
            return res.status(400).json({
                message: "Closed accounts cannot be activated"
            });
        }

        return res.json({
            message: "Account activated successfully",
            account: {
                ...result.account,
                balance: result.account.balance.toString()
            }
        });

    } catch (error) {
        console.error("Activate account error:", error);

        return res.status(500).json({
            message: "Unable to activate account"
        });
    }
};