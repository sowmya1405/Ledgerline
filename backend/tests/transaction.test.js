const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/prisma");
const jwt = require("jsonwebtoken");

describe("Ledgerline Transaction API Tests", () => {
    let token;
    let accountId;
    let destinationAccountId;

    const testUser = {
        name: "Transaction Test User",
        email: `transaction${Date.now()}@example.com`,
        password: "TestPass123"
    };

    const secondUser = {
        name: "Receiver User",
        email: `receiver${Date.now()}@example.com`,
        password: "TestPass123"
    };

    let secondUserId;

    beforeAll(async () => {
        // Register sender
        await request(app)
            .post("/api/auth/register")
            .send(testUser);

        // Login sender
        const login = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email,
                password: testUser.password
            });

        token = login.body.token;

        // Create sender account
        const senderAccount = await request(app)
            .post("/api/accounts")
            .set("Authorization", `Bearer ${token}`);

        accountId = senderAccount.body.account.id;

        // Register receiver
        const receiver = await request(app)
            .post("/api/auth/register")
            .send(secondUser);

        secondUserId = receiver.body.user.id;

        // Create receiver account
        const destination = await prisma.account.create({
            data: {
                accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
                ownerId: secondUserId,
                balance: 0n,
                type: "CUSTOMER"
            }
        });

        destinationAccountId = destination.id;
    });

    // CLEANUP TEST DATA
    afterAll(async () => {
        const userEmails = [testUser.email, secondUser.email];

        const users = await prisma.user.findMany({
            where: {
                email: {
                    in: userEmails
                }
            },
            select: {
                id: true
            }
        });

        const userIds = users.map(user => user.id);

        if (userIds.length > 0) {
            const transactions = await prisma.transaction.findMany({
                where: {
                    initiatedById: {
                        in: userIds
                    }
                },
                select: {
                    id: true
                }
            });

            const transactionIds = transactions.map(tx => tx.id);

            if (transactionIds.length > 0) {
                await prisma.ledgerEntry.deleteMany({
                    where: {
                        transactionId: {
                            in: transactionIds
                        }
                    }
                });

                await prisma.transaction.deleteMany({
                    where: {
                        id: {
                            in: transactionIds
                        }
                    }
                });
            }

            await prisma.idempotencyRecord.deleteMany({
                where: {
                    userId: {
                        in: userIds
                    }
                }
            });

            await prisma.auditLog.deleteMany({
                where: {
                    userId: {
                        in: userIds
                    }
                }
            });

            await prisma.account.deleteMany({
                where: {
                    ownerId: {
                        in: userIds
                    }
                }
            });

            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: userIds
                    }
                }
            });
        }

        await prisma.$disconnect();
    });

    // TEST 1: Successful Deposit
    test("should deposit money successfully", async () => {
        const response = await request(app)
            .post("/api/transactions/deposit")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", `deposit-${Date.now()}`)
            .send({
                accountId,
                amountPaise: 50000
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("Deposit successful");
        expect(response.body.transaction.amountPaise).toBe("50000");
    });

    // TEST 2: Verify Deposit Balance
    test("should update account balance after deposit", async () => {
        const account = await prisma.account.findUnique({
            where: { id: accountId }
        });

        expect(account.balance).toBe(50000n);
    });

    // TEST 3: Verify Double-Entry Ledger
    test("should create two ledger entries for deposit", async () => {
        const transaction = await prisma.transaction.findFirst({
            where: {
                destinationAccountId: accountId,
                type: "DEPOSIT"
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        const entries = await prisma.ledgerEntry.findMany({
            where: {
                transactionId: transaction.id
            }
        });

        expect(entries).toHaveLength(2);

        expect(
            entries.map(entry => entry.entryType).sort()
        ).toEqual(["CREDIT", "DEBIT"]);
    });

    // TEST 4: Duplicate Deposit
    test("should prevent duplicate deposits using idempotency key", async () => {
        const key = `duplicate-deposit-${Date.now()}`;

        const payload = {
            accountId,
            amountPaise: 10000
        };

        const first = await request(app)
            .post("/api/transactions/deposit")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", key)
            .send(payload);

        const second = await request(app)
            .post("/api/transactions/deposit")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", key)
            .send(payload);

        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(200);
        expect(second.body.duplicate).toBe(true);
        expect(second.body.transaction.id).toBe(first.body.transaction.id);
    });

    // TEST 5: Withdrawal
    test("should withdraw money successfully", async () => {
        const response = await request(app)
            .post("/api/transactions/withdraw")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", `withdraw-${Date.now()}`)
            .send({
                accountId,
                amountPaise: 10000
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("Withdrawal successful");
    });

    // TEST 6: Insufficient Balance
    test("should reject withdrawal with insufficient balance", async () => {
        const response = await request(app)
            .post("/api/transactions/withdraw")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", `insufficient-${Date.now()}`)
            .send({
                accountId,
                amountPaise: 999999999
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe("Insufficient account balance");
    });

    // TEST 7: Successful Transfer
    test("should transfer money between accounts", async () => {
        const response = await request(app)
            .post("/api/transactions/transfer")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", `transfer-${Date.now()}`)
            .send({
                sourceAccountId: accountId,
                destinationAccountId,
                amountPaise: 5000
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("Transfer successful");
        expect(response.body.transaction.amountPaise).toBe("5000");
    });

    // TEST 8: Verify Transfer Balances
    test("should update both account balances after transfer", async () => {
        const sender = await prisma.account.findUnique({
            where: { id: accountId }
        });

        const receiver = await prisma.account.findUnique({
            where: { id: destinationAccountId }
        });

        expect(sender.balance).toBe(45000n);
        expect(receiver.balance).toBe(5000n);
    });

    // TEST 9: Duplicate Transfer
    test("should prevent duplicate transfers", async () => {
        const key = `duplicate-transfer-${Date.now()}`;

        const payload = {
            sourceAccountId: accountId,
            destinationAccountId,
            amountPaise: 2000
        };

        const first = await request(app)
            .post("/api/transactions/transfer")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", key)
            .send(payload);

        const second = await request(app)
            .post("/api/transactions/transfer")
            .set("Authorization", `Bearer ${token}`)
            .set("Idempotency-Key", key)
            .send(payload);

        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(200);
        expect(second.body.duplicate).toBe(true);
    });

    // TEST 10: Reject Missing Idempotency Key
    test("should reject transactions without an idempotency key", async () => {
        const response = await request(app)
            .post("/api/transactions/deposit")
            .set("Authorization", `Bearer ${token}`)
            .send({
                accountId,
                amountPaise: 1000
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(
            "A valid Idempotency-Key header is required"
        );
    });

    // TEST 11: Concurrent Withdrawals
    test("should prevent overdrawing during simultaneous withdrawals", async () => {
        const testUserRecord = await prisma.user.findUnique({
            where: {
                email: testUser.email
            }
        });

        const concurrentAccount = await prisma.account.create({
            data: {
                accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
                ownerId: testUserRecord.id,
                balance: 50000n,
                type: "CUSTOMER"
            }
        });

        const results = await Promise.all([
            request(app)
                .post("/api/transactions/withdraw")
                .set("Authorization", `Bearer ${token}`)
                .set("Idempotency-Key", `concurrent-1-${Date.now()}`)
                .send({
                    accountId: concurrentAccount.id,
                    amountPaise: 30000
                }),

            request(app)
                .post("/api/transactions/withdraw")
                .set("Authorization", `Bearer ${token}`)
                .set("Idempotency-Key", `concurrent-2-${Date.now()}`)
                .send({
                    accountId: concurrentAccount.id,
                    amountPaise: 30000
                })
        ]);

        const successful = results.filter(
            response => response.statusCode === 201
        );

        const rejected = results.filter(
            response => response.statusCode === 400
        );

        expect(successful).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        expect(rejected[0].body.message).toBe(
            "Insufficient account balance"
        );

        const updatedAccount = await prisma.account.findUnique({
            where: {
                id: concurrentAccount.id
            }
        });

        expect(updatedAccount.balance).toBe(20000n);
    });

    // TEST 12: Verify Audit Logs
    test("should create audit logs for every successful transaction", async () => {
        const user = await prisma.user.findUnique({
            where: {
                email: testUser.email
            }
        });

        const transactions = await prisma.transaction.findMany({
            where: {
                initiatedById: user.id
            }
        });

        expect(transactions.length).toBeGreaterThan(0);

        const transactionIds = transactions.map(tx => tx.id);

        const auditLogs = await prisma.auditLog.findMany({
            where: {
                userId: user.id,
                entity: "TRANSACTION",
                entityId: {
                    in: transactionIds
                }
            }
        });

        expect(auditLogs).toHaveLength(transactions.length);

        for (const transaction of transactions) {
            const matchingLog = auditLogs.find(
                log => log.entityId === transaction.id
            );

            expect(matchingLog).toBeDefined();
            expect(matchingLog.action).toBe(transaction.type);
        }
    });

    // TEST 13: Verify Double-Entry Ledger Consistency
    test("should maintain balanced debit and credit entries", async () => {
        const user = await prisma.user.findUnique({
            where: {
                email: testUser.email
            }
        });

        const transactions = await prisma.transaction.findMany({
            where: {
                initiatedById: user.id
            }
        });

        expect(transactions.length).toBeGreaterThan(0);

        for (const transaction of transactions) {
            const entries = await prisma.ledgerEntry.findMany({
                where: {
                    transactionId: transaction.id
                }
            });

            expect(entries).toHaveLength(2);

            const debitTotal = entries
                .filter(entry => entry.entryType === "DEBIT")
                .reduce((sum, entry) => sum + entry.amount, 0n);

            const creditTotal = entries
                .filter(entry => entry.entryType === "CREDIT")
                .reduce((sum, entry) => sum + entry.amount, 0n);

            expect(debitTotal).toBe(creditTotal);
            expect(debitTotal).toBe(transaction.amount);
        }
    });
        // TEST 14: Reject ADMIN from financial transactions
    test("should reject ADMIN from deposit, withdrawal, and transfer", async () => {
        const user = await prisma.user.findUnique({
            where: { email: testUser.email }
        });

        const adminToken = jwt.sign(
            {
                userId: user.id,
                role: "ADMIN"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        const endpoints = [
            "/api/transactions/deposit",
            "/api/transactions/withdraw",
            "/api/transactions/transfer"
        ];

        for (const endpoint of endpoints) {
            const response = await request(app)
                .post(endpoint)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.statusCode).toBe(403);
            expect(response.body.message).toBe("Access denied");
        }
    });

    // TEST 15: Reject AUDITOR from financial transactions
    test("should reject AUDITOR from deposit, withdrawal, and transfer", async () => {
        const user = await prisma.user.findUnique({
            where: { email: testUser.email }
        });

        const auditorToken = jwt.sign(
            {
                userId: user.id,
                role: "AUDITOR"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        const endpoints = [
            "/api/transactions/deposit",
            "/api/transactions/withdraw",
            "/api/transactions/transfer"
        ];

        for (const endpoint of endpoints) {
            const response = await request(app)
                .post(endpoint)
                .set("Authorization", `Bearer ${auditorToken}`);

            expect(response.statusCode).toBe(403);
            expect(response.body.message).toBe("Access denied");
        }
    });
    // TEST 16: Reject Deposit into Frozen Account
test("should reject deposits into frozen accounts", async () => {
    const frozenAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: secondUserId,
            balance: 0n,
            type: "CUSTOMER",
            status: "FROZEN"
        }
    });

    const response = await request(app)
        .post("/api/transactions/deposit")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `frozen-deposit-${Date.now()}`)
        .send({
            accountId: frozenAccount.id,
            amountPaise: 5000
        });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Active account not found");
   });
   // TEST 17: Reject Withdrawal from Frozen Account
test("should reject withdrawals from frozen accounts", async () => {
    const frozenAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: secondUserId,
            balance: 50000n,
            type: "CUSTOMER",
            status: "FROZEN"
        }
    });

    const response = await request(app)
        .post("/api/transactions/withdraw")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `frozen-withdraw-${Date.now()}`)
        .send({
            accountId: frozenAccount.id,
            amountPaise: 5000
        });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Active account not found");

    const updatedAccount = await prisma.account.findUnique({
        where: { id: frozenAccount.id }
    });

    expect(updatedAccount.balance).toBe(50000n);
});
// TEST 18: Reject Transfer to Frozen Account
test("should reject transfers to frozen destination accounts", async () => {
    const frozenAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: secondUserId,
            balance: 0n,
            type: "CUSTOMER",
            status: "FROZEN"
        }
    });

    const senderBefore = await prisma.account.findUnique({
        where: { id: accountId }
    });

    const response = await request(app)
        .post("/api/transactions/transfer")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `frozen-transfer-${Date.now()}`)
        .send({
            sourceAccountId: accountId,
            destinationAccountId: frozenAccount.id,
            amountPaise: 1000
        });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe(
        "Destination account not found or inactive"
    );

    const senderAfter = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(senderAfter.balance).toBe(senderBefore.balance);
});
// TEST 19: Reject Deposit into Closed Account
test("should reject deposits into closed accounts", async () => {
    const closedAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: secondUserId,
            balance: 0n,
            type: "CUSTOMER",
            status: "CLOSED"
        }
    });

    const response = await request(app)
        .post("/api/transactions/deposit")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `closed-deposit-${Date.now()}`)
        .send({
            accountId: closedAccount.id,
            amountPaise: 5000
        });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Active account not found");

    const updatedAccount = await prisma.account.findUnique({
        where: { id: closedAccount.id }
    });

    expect(updatedAccount.balance).toBe(0n);
});
// TEST 20: Reject Withdrawal from Closed Account
test("should reject withdrawals from closed accounts", async () => {
    const closedAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: secondUserId,
            balance: 50000n,
            type: "CUSTOMER",
            status: "CLOSED"
        }
    });

    const response = await request(app)
        .post("/api/transactions/withdraw")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `closed-withdraw-${Date.now()}`)
        .send({
            accountId: closedAccount.id,
            amountPaise: 5000
        });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Active account not found");

    const updatedAccount = await prisma.account.findUnique({
        where: { id: closedAccount.id }
    });

    expect(updatedAccount.balance).toBe(50000n);
});
// TEST 21: Reject Transfers to Closed Destination Accounts
test("should reject transfers to closed destination accounts", async () => {
    const closedAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: secondUserId,
            balance: 0n,
            type: "CUSTOMER",
            status: "CLOSED"
        }
    });

    const senderBefore = await prisma.account.findUnique({
        where: { id: accountId }
    });

    const response = await request(app)
        .post("/api/transactions/transfer")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `closed-destination-${Date.now()}`)
        .send({
            sourceAccountId: accountId,
            destinationAccountId: closedAccount.id,
            amountPaise: 5000
        });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Destination account not found or inactive");

    const senderAfter = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(senderAfter.balance).toBe(senderBefore.balance);
});
// TEST 22: Reject Transfers from Closed Source Accounts
test("should reject transfers from closed source accounts", async () => {
    const destinationBefore = await prisma.account.findUnique({
        where: { id: accountId }
    });

    const closedSource = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: destinationBefore.ownerId,
            balance: 50000n,
            type: "CUSTOMER",
            status: "CLOSED"
        }
    });

    const response = await request(app)
        .post("/api/transactions/transfer")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", `closed-source-${Date.now()}`)
        .send({
            sourceAccountId: closedSource.id,
            destinationAccountId: accountId,
            amountPaise: 5000
        });

    expect(response.statusCode).toBe(404);

    const destinationAfter = await prisma.account.findUnique({
        where: { id: accountId }
    });

    const sourceAfter = await prisma.account.findUnique({
        where: { id: closedSource.id }
    });

    expect(sourceAfter.balance).toBe(50000n);
    expect(destinationAfter.balance).toBe(destinationBefore.balance);
});
});