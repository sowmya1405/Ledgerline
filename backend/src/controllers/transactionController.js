const prisma = require("../config/prisma");
const crypto = require("crypto");

exports.deposit = async (req, res) => {
    try {
        const { accountId, amountPaise, description } = req.body;
        const idempotencyKey = req.headers["idempotency-key"];

        // Validate request
        if (!accountId || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
            return res.status(400).json({
                message: "Valid accountId and positive amountPaise are required"
            });
        }

        if (!idempotencyKey || idempotencyKey.length > 128) {
            return res.status(400).json({
                message: "A valid Idempotency-Key header is required"
            });
        }

        // Generate request fingerprint
        const requestHash = crypto
            .createHash("sha256")
            .update(JSON.stringify({
                accountId,
                amountPaise,
                description: description || "Account deposit"
            }))
            .digest("hex");

        const result = await prisma.$transaction(async (tx) => {

            // Register idempotency key
            await tx.idempotencyRecord.create({
                data: {
                    key: idempotencyKey,
                    requestHash,
                    userId: req.user.userId
                }
            });

            // Find customer account
            const account = await tx.account.findFirst({
                where: {
                    id: accountId,
                    ownerId: req.user.userId,
                    status: "ACTIVE",
                    type: "CUSTOMER"
                }
            });

            if (!account) {
                throw new Error("ACCOUNT_NOT_FOUND");
            }

            // Get or create system cash account
            const systemAccount = await tx.account.upsert({
                where: {
                    accountNumber: "LL-SYSTEM-CASH"
                },
                update: {},
                create: {
                    accountNumber: "LL-SYSTEM-CASH",
                    type: "SYSTEM",
                    balance: 0n,
                    status: "ACTIVE"
                }
            });

            // Create transaction
            const transaction = await tx.transaction.create({
                data: {
                    reference: `DEP-${crypto.randomUUID()}`,
                    type: "DEPOSIT",
                    amount: BigInt(amountPaise),
                    status: "COMPLETED",
                    description: description || "Account deposit",
                    sourceAccountId: systemAccount.id,
                    destinationAccountId: account.id,
                    initiatedById: req.user.userId
                }
            });

            // Update balance
            // Update balance only if the account is still active
const balanceUpdate = await tx.account.updateMany({
    where: {
        id: account.id,
        ownerId: req.user.userId,
        status: "ACTIVE",
        type: "CUSTOMER"
    },
    data: {
        balance: {
            increment: BigInt(amountPaise)
        }
    }
});

if (balanceUpdate.count === 0) {
    throw new Error("ACCOUNT_NOT_FOUND");
}

            // Create double-entry ledger
            await tx.ledgerEntry.createMany({
                data: [
                    {
                        transactionId: transaction.id,
                        accountId: systemAccount.id,
                        entryType: "DEBIT",
                        amount: BigInt(amountPaise)
                    },
                    {
                        transactionId: transaction.id,
                        accountId: account.id,
                        entryType: "CREDIT",
                        amount: BigInt(amountPaise)
                    }
                ]
            });

            // Create audit record
            await tx.auditLog.create({
                data: {
                    action: "DEPOSIT",
                    entity: "TRANSACTION",
                    entityId: transaction.id,
                    userId: req.user.userId,
                    details: {
                        accountId: account.id,
                        amountPaise
                    }
                }
            });

            // Link idempotency record to transaction
            await tx.idempotencyRecord.update({
                where: {
                    userId_key: {
                        userId: req.user.userId,
                        key: idempotencyKey
                    }
                },
                data: {
                    transactionId: transaction.id
                }
            });

            return transaction;
        });

        return res.status(201).json({
            message: "Deposit successful",
            duplicate: false,
            transaction: {
                id: result.id,
                reference: result.reference,
                amountPaise: result.amount.toString(),
                status: result.status
            }
        });

    } catch (error) {

        // Handle duplicate idempotency key
        // Handle duplicate idempotency key
if (error.code === "P2002") {
    try {
        const existing = await prisma.idempotencyRecord.findUnique({
            where: {
                userId_key: {
                    userId: req.user.userId,
                    key: req.headers["idempotency-key"]
                }
            }
        });

        if (existing) {
            const currentHash = crypto
                .createHash("sha256")
                .update(JSON.stringify({
                    accountId: req.body.accountId,
                    amountPaise: req.body.amountPaise,
                    description: req.body.description || "Account deposit"
                }))
                .digest("hex");

            if (existing.requestHash !== currentHash) {
                return res.status(409).json({
                    message: "Idempotency key already used with different request"
                });
            }

            if (!existing.transactionId) {
                return res.status(409).json({
                    message: "Original request is still being processed"
                });
            }

            const originalTransaction = await prisma.transaction.findUnique({
                where: {
                    id: existing.transactionId
                }
            });

            if (!originalTransaction) {
                return res.status(500).json({
                    message: "Original transaction not found"
                });
            }

            return res.status(200).json({
                message: "Duplicate request. Original transaction returned.",
                duplicate: true,
                transaction: {
                    id: originalTransaction.id,
                    reference: originalTransaction.reference,
                    amountPaise: originalTransaction.amount.toString(),
                    status: originalTransaction.status
                }
            });
        }
    } catch (lookupError) {
        console.error("Idempotency lookup error:", lookupError);
    }
        }

        if (error.message === "ACCOUNT_NOT_FOUND") {
            return res.status(404).json({
                message: "Active account not found"
            });
        }

        console.error("Deposit error:", error);

        return res.status(500).json({
            message: "Deposit failed"
        });
    }
};
exports.withdraw = async (req, res) => {
    try {
        const { accountId, amountPaise, description } = req.body;
        const idempotencyKey = req.headers["idempotency-key"];

        // Validate input
        if (
            !accountId ||
            !Number.isSafeInteger(amountPaise) ||
            amountPaise <= 0
        ) {
            return res.status(400).json({
                message: "Valid accountId and positive amountPaise are required"
            });
        }

        if (!idempotencyKey || idempotencyKey.length > 128) {
            return res.status(400).json({
                message: "A valid Idempotency-Key header is required"
            });
        }

        const requestHash = crypto
            .createHash("sha256")
            .update(JSON.stringify({
                accountId,
                amountPaise,
                description: description || "Account withdrawal"
            }))
            .digest("hex");

        const result = await prisma.$transaction(async (tx) => {

            // Register idempotency key
            await tx.idempotencyRecord.create({
                data: {
                    key: idempotencyKey,
                    requestHash,
                    userId: req.user.userId
                }
            });

            // Verify account ownership and status
            const account = await tx.account.findFirst({
                where: {
                    id: accountId,
                    ownerId: req.user.userId,
                    status: "ACTIVE",
                    type: "CUSTOMER"
                }
            });

            if (!account) {
                throw new Error("ACCOUNT_NOT_FOUND");
            }

            // Prevent overdrafts using an atomic conditional update
            const balanceUpdate = await tx.account.updateMany({
                where: {
                    id: account.id,
                    ownerId: req.user.userId,
                    status: "ACTIVE",
                    balance: {
                        gte: BigInt(amountPaise)
                    }
                },
                data: {
                    balance: {
                        decrement: BigInt(amountPaise)
                    }
                }
            });

            if (balanceUpdate.count === 0) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            // Get or create system cash account
            const systemAccount = await tx.account.upsert({
                where: {
                    accountNumber: "LL-SYSTEM-CASH"
                },
                update: {},
                create: {
                    accountNumber: "LL-SYSTEM-CASH",
                    type: "SYSTEM",
                    balance: 0n,
                    status: "ACTIVE"
                }
            });

            // Create transaction
            const transaction = await tx.transaction.create({
                data: {
                    reference: `WDR-${crypto.randomUUID()}`,
                    type: "WITHDRAWAL",
                    amount: BigInt(amountPaise),
                    status: "COMPLETED",
                    description: description || "Account withdrawal",
                    sourceAccountId: account.id,
                    destinationAccountId: systemAccount.id,
                    initiatedById: req.user.userId
                }
            });

            // Double-entry ledger
            await tx.ledgerEntry.createMany({
                data: [
                    {
                        transactionId: transaction.id,
                        accountId: account.id,
                        entryType: "DEBIT",
                        amount: BigInt(amountPaise)
                    },
                    {
                        transactionId: transaction.id,
                        accountId: systemAccount.id,
                        entryType: "CREDIT",
                        amount: BigInt(amountPaise)
                    }
                ]
            });

            // Audit log
            await tx.auditLog.create({
                data: {
                    action: "WITHDRAWAL",
                    entity: "TRANSACTION",
                    entityId: transaction.id,
                    userId: req.user.userId,
                    details: {
                        accountId: account.id,
                        amountPaise
                    }
                }
            });

            // Link idempotency record
            await tx.idempotencyRecord.update({
                where: {
                    userId_key: {
                        userId: req.user.userId,
                        key: idempotencyKey
                    }
                },
                data: {
                    transactionId: transaction.id
                }
            });

            return transaction;
        });

        return res.status(201).json({
            message: "Withdrawal successful",
            duplicate: false,
            transaction: {
                id: result.id,
                reference: result.reference,
                amountPaise: result.amount.toString(),
                status: result.status
            }
        });

    } catch (error) {

        // Handle duplicate idempotency key
        if (error.code === "P2002") {
            try {
                const existing = await prisma.idempotencyRecord.findUnique({
                    where: {
                        userId_key: {
                            userId: req.user.userId,
                            key: req.headers["idempotency-key"]
                        }
                    }
                });

                if (existing) {
                    const currentHash = crypto
                        .createHash("sha256")
                        .update(JSON.stringify({
                            accountId: req.body.accountId,
                            amountPaise: req.body.amountPaise,
                            description: req.body.description || "Account withdrawal"
                        }))
                        .digest("hex");

                    if (existing.requestHash !== currentHash) {
                        return res.status(409).json({
                            message: "Idempotency key already used with different request"
                        });
                    }

                    if (!existing.transactionId) {
                        return res.status(409).json({
                            message: "Original request is still being processed"
                        });
                    }

                    const original = await prisma.transaction.findUnique({
                        where: { id: existing.transactionId }
                    });

                    if (original) {
                        return res.status(200).json({
                            message: "Duplicate request. Original transaction returned.",
                            duplicate: true,
                            transaction: {
                                id: original.id,
                                reference: original.reference,
                                amountPaise: original.amount.toString(),
                                status: original.status
                            }
                        });
                    }
                }
            } catch (lookupError) {
                console.error("Idempotency lookup error:", lookupError);
            }
        }

        if (error.message === "ACCOUNT_NOT_FOUND") {
            return res.status(404).json({
                message: "Active account not found"
            });
        }

        if (error.message === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({
                message: "Insufficient account balance"
            });
        }

        console.error("Withdrawal error:", error);

        return res.status(500).json({
            message: "Withdrawal failed"
        });
    }
};
exports.transfer = async (req, res) => {
    try {
        const {
            sourceAccountId,
            destinationAccountId,
            amountPaise,
            description
        } = req.body;

        const idempotencyKey = req.headers["idempotency-key"];

        // Validate input
        if (
            !sourceAccountId ||
            !destinationAccountId ||
            sourceAccountId === destinationAccountId ||
            !Number.isSafeInteger(amountPaise) ||
            amountPaise <= 0
        ) {
            return res.status(400).json({
                message: "Valid source account, destination account and positive amount are required"
            });
        }

        if (!idempotencyKey || idempotencyKey.length > 128) {
            return res.status(400).json({
                message: "A valid Idempotency-Key header is required"
            });
        }

        // Generate request fingerprint
        const requestHash = crypto
            .createHash("sha256")
            .update(JSON.stringify({
                sourceAccountId,
                destinationAccountId,
                amountPaise,
                description: description || "Account transfer"
            }))
            .digest("hex");

        const result = await prisma.$transaction(async (tx) => {

            // Register idempotency key
            await tx.idempotencyRecord.create({
                data: {
                    key: idempotencyKey,
                    requestHash,
                    userId: req.user.userId
                }
            });

            // Verify sender account
            const sourceAccount = await tx.account.findFirst({
                where: {
                    id: sourceAccountId,
                    ownerId: req.user.userId,
                    status: "ACTIVE",
                    type: "CUSTOMER"
                }
            });

            if (!sourceAccount) {
                throw new Error("SOURCE_ACCOUNT_NOT_FOUND");
            }

            // Verify receiver account
            const destinationAccount = await tx.account.findFirst({
                where: {
                    id: destinationAccountId,
                    status: "ACTIVE",
                    type: "CUSTOMER"
                }
            });

            if (!destinationAccount) {
                throw new Error("DESTINATION_ACCOUNT_NOT_FOUND");
            }

            // Atomically debit sender account
            const debitResult = await tx.account.updateMany({
                where: {
                    id: sourceAccountId,
                    ownerId: req.user.userId,
                    status: "ACTIVE",
                    balance: {
                        gte: BigInt(amountPaise)
                    }
                },
                data: {
                    balance: {
                        decrement: BigInt(amountPaise)
                    }
                }
            });

            if (debitResult.count === 0) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            // Credit receiver account only if still active
            const creditResult = await tx.account.updateMany({
                where: {
                    id: destinationAccountId,
                    status: "ACTIVE",
                    type: "CUSTOMER"
                },
                data: {
                    balance: {
                        increment: BigInt(amountPaise)
                    }
                }
            });

            if (creditResult.count === 0) {
                throw new Error("DESTINATION_ACCOUNT_NOT_FOUND");
            }

            // Create transfer transaction
            const transaction = await tx.transaction.create({
                data: {
                    reference: `TRF-${crypto.randomUUID()}`,
                    type: "TRANSFER",
                    amount: BigInt(amountPaise),
                    status: "COMPLETED",
                    description: description || "Account transfer",
                    sourceAccountId: sourceAccountId,
                    destinationAccountId: destinationAccountId,
                    initiatedById: req.user.userId
                }
            });

            // Create double-entry ledger
            await tx.ledgerEntry.createMany({
                data: [
                    {
                        transactionId: transaction.id,
                        accountId: sourceAccountId,
                        entryType: "DEBIT",
                        amount: BigInt(amountPaise)
                    },
                    {
                        transactionId: transaction.id,
                        accountId: destinationAccountId,
                        entryType: "CREDIT",
                        amount: BigInt(amountPaise)
                    }
                ]
            });

            // Create audit record
            await tx.auditLog.create({
                data: {
                    action: "TRANSFER",
                    entity: "TRANSACTION",
                    entityId: transaction.id,
                    userId: req.user.userId,
                    details: {
                        sourceAccountId,
                        destinationAccountId,
                        amountPaise
                    }
                }
            });

            // Link idempotency record
            await tx.idempotencyRecord.update({
                where: {
                    userId_key: {
                        userId: req.user.userId,
                        key: idempotencyKey
                    }
                },
                data: {
                    transactionId: transaction.id
                }
            });

            return transaction;
        });

        return res.status(201).json({
            message: "Transfer successful",
            duplicate: false,
            transaction: {
                id: result.id,
                reference: result.reference,
                amountPaise: result.amount.toString(),
                status: result.status
            }
        });

    } catch (error) {

        // Handle duplicate idempotency key
        if (error.code === "P2002") {
            try {
                const existing = await prisma.idempotencyRecord.findUnique({
                    where: {
                        userId_key: {
                            userId: req.user.userId,
                            key: req.headers["idempotency-key"]
                        }
                    }
                });

                if (existing) {
                    const currentHash = crypto
                        .createHash("sha256")
                        .update(JSON.stringify({
                            sourceAccountId: req.body.sourceAccountId,
                            destinationAccountId: req.body.destinationAccountId,
                            amountPaise: req.body.amountPaise,
                            description: req.body.description || "Account transfer"
                        }))
                        .digest("hex");

                    if (existing.requestHash !== currentHash) {
                        return res.status(409).json({
                            message: "Idempotency key already used with different request"
                        });
                    }

                    if (!existing.transactionId) {
                        return res.status(409).json({
                            message: "Original request is still being processed"
                        });
                    }

                    const original = await prisma.transaction.findUnique({
                        where: {
                            id: existing.transactionId
                        }
                    });

                    if (original) {
                        return res.status(200).json({
                            message: "Duplicate request. Original transaction returned.",
                            duplicate: true,
                            transaction: {
                                id: original.id,
                                reference: original.reference,
                                amountPaise: original.amount.toString(),
                                status: original.status
                            }
                        });
                    }
                }
            } catch (lookupError) {
                console.error("Transfer idempotency error:", lookupError);
            }
        }

        if (error.message === "SOURCE_ACCOUNT_NOT_FOUND") {
            return res.status(404).json({
                message: "Source account not found"
            });
        }

        if (error.message === "DESTINATION_ACCOUNT_NOT_FOUND") {
            return res.status(404).json({
                message: "Destination account not found or inactive"
            });
        }

        if (error.message === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({
                message: "Insufficient account balance"
            });
        }

        console.error("Transfer error:", error);

        return res.status(500).json({
            message: "Transfer failed"
        });
    }
};// GET TRANSACTION HISTORY FOR LOGGED-IN USER
exports.getMyTransactions = async (req, res) => {
    try {
        const userId = req.user.userId;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit) || 10, 1),
            100
        );

        const skip = (page - 1) * limit;

        const where = {
            OR: [
                { initiatedById: userId },
                {
                    sourceAccount: {
                        is: { ownerId: userId }
                    }
                },
                {
                    destinationAccount: {
                        is: { ownerId: userId }
                    }
                }
            ]
        };

        const [transactions, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where,
                include: {
                    sourceAccount: {
                        select: {
                            id: true,
                            accountNumber: true
                        }
                    },
                    destinationAccount: {
                        select: {
                            id: true,
                            accountNumber: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                },
                skip,
                take: limit
            }),

            prisma.transaction.count({ where })
        ]);

        return res.status(200).json({
            message: "Transaction history fetched successfully",
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            transactions: transactions.map(transaction => ({
                id: transaction.id,
                reference: transaction.reference,
                type: transaction.type,
                amountPaise: transaction.amount.toString(),
                status: transaction.status,
                description: transaction.description,
                sourceAccount: transaction.sourceAccount,
                destinationAccount: transaction.destinationAccount,
                createdAt: transaction.createdAt
            }))
        });

    } catch (error) {
        console.error("Transaction history error:", error);

        return res.status(500).json({
            message: "Unable to fetch transaction history"
        });
    }
};