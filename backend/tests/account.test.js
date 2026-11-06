const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

describe("Ledgerline Account API Tests", () => {
    let token;
    let accountId;
    let secondUserAccountId;
    let testUserId;
    let secondUserId;

    const testUser = {
        name: "Account Test User",
        email: `account${Date.now()}@example.com`,
        password: "TestPass123"
    };

    const secondUser = {
        name: "Second Test User",
        email: `second${Date.now()}@example.com`,
        password: "TestPass123"
    };

    beforeAll(async () => {
        // Register first user
        await request(app)
            .post("/api/auth/register")
            .send(testUser);

        // Retrieve first user's database ID
        const firstUserRecord = await prisma.user.findUnique({
            where: { email: testUser.email }
        });

        testUserId = firstUserRecord.id;

        // Login first user
        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email,
                password: testUser.password
            });

        token = loginResponse.body.token;

        // Register second user
        const secondRegisterResponse = await request(app)
            .post("/api/auth/register")
            .send(secondUser);

        secondUserId = secondRegisterResponse.body.user.id;

        // Create an account directly for second user
        const secondAccount = await prisma.account.create({
            data: {
                accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
                ownerId: secondUserId,
                balance: 0n,
                type: "CUSTOMER"
            }
        });

        secondUserAccountId = secondAccount.id;
    });

    afterAll(async () => {
        // Clean up dependent records before deleting users
        const userIds = [testUserId, secondUserId].filter(Boolean);

        await prisma.ledgerEntry.deleteMany({
            where: {
                account: {
                    ownerId: { in: userIds }
                }
            }
        });

        await prisma.transaction.deleteMany({
            where: {
                initiatedById: { in: userIds }
            }
        });

        await prisma.idempotencyRecord.deleteMany({
            where: { userId: { in: userIds } }
        });

        await prisma.auditLog.deleteMany({
            where: { userId: { in: userIds } }
        });

        await prisma.account.deleteMany({
            where: { ownerId: { in: userIds } }
        });

        await prisma.user.deleteMany({
            where: { id: { in: userIds } }
        });

        await prisma.$disconnect();
    });

    // TEST 1: Create Account
    test("POST /api/accounts - should create a new account", async () => {
        const response = await request(app)
            .post("/api/accounts")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("Account created successfully");
        expect(response.body.account).toBeDefined();
        expect(response.body.account.balance).toBe("0");

        accountId = response.body.account.id;
    });

    // TEST 2: Get My Accounts
    test("GET /api/accounts - should retrieve logged-in user's accounts", async () => {
        const response = await request(app)
            .get("/api/accounts")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.accounts).toBeInstanceOf(Array);
        expect(response.body.accounts.length).toBeGreaterThan(0);

        expect(
            response.body.accounts.every(
                account => account.ownerId !== secondUserId
            )
        ).toBe(true);
    });

    // TEST 3: Get Account Details
    test("GET /api/accounts/:id - should retrieve account details", async () => {
        const response = await request(app)
            .get(`/api/accounts/${accountId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.account.id).toBe(accountId);
        expect(response.body.account.balance).toBe("0");
    });

    // TEST 4: Reject Unauthorized Request
    test("GET /api/accounts - should reject requests without a token", async () => {
        const response = await request(app)
            .get("/api/accounts");

        expect(response.statusCode).toBe(401);
    });

    // TEST 5: Prevent Access to Another User's Account
    test("GET /api/accounts/:id - should prevent access to another user's account", async () => {
        const response = await request(app)
            .get(`/api/accounts/${secondUserAccountId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(404);
        expect(response.body.message).toBe("Account not found");
    });

    // TEST 6: Reject AUDITOR from creating an account
    test("POST /api/accounts - should reject an AUDITOR", async () => {
        const auditorToken = jwt.sign(
            {
                userId: testUserId,
                role: "AUDITOR"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        const response = await request(app)
            .post("/api/accounts")
            .set("Authorization", `Bearer ${auditorToken}`);

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe("Access denied");
    });

    // TEST 7: Reject ADMIN from account-holder route
    test("POST /api/accounts - should reject an ADMIN", async () => {
        const adminToken = jwt.sign(
            {
                userId: testUserId,
                role: "ADMIN"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        const response = await request(app)
            .post("/api/accounts")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(response.statusCode).toBe(403);
        expect(response.body.message).toBe("Access denied");
    });
    // TEST 8: ADMIN can view all customer accounts
test("GET /api/accounts/admin/all - should allow ADMIN to view all customer accounts", async () => {
    const adminToken = jwt.sign(
        {
            userId: testUserId,
            role: "ADMIN"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .get("/api/accounts/admin/all")
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.accounts).toBeInstanceOf(Array);
    expect(response.body.count).toBeGreaterThan(0);

    expect(
        response.body.accounts.some(
            account => account.id === accountId
        )
    ).toBe(true);

    expect(response.body.accounts[0].owner).toBeDefined();
});

// TEST 9: ACCOUNT_HOLDER cannot view all customer accounts
test("GET /api/accounts/admin/all - should reject ACCOUNT_HOLDER", async () => {
    const response = await request(app)
        .get("/api/accounts/admin/all")
        .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");
});

// TEST 10: AUDITOR cannot view all customer accounts
test("GET /api/accounts/admin/all - should reject AUDITOR", async () => {
    const auditorToken = jwt.sign(
        {
            userId: testUserId,
            role: "AUDITOR"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .get("/api/accounts/admin/all")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");
});
// TEST 11: ADMIN can freeze an account
test("PATCH /api/accounts/:id/freeze - should freeze an active account", async () => {
    const adminToken = jwt.sign(
        {
            userId: testUserId,
            role: "ADMIN"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .patch(`/api/accounts/${accountId}/freeze`)
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Account frozen successfully");
    expect(response.body.account.status).toBe("FROZEN");
});
// TEST 12: ADMIN can reactivate a frozen account
test("PATCH /api/accounts/:id/activate - should reactivate a frozen account", async () => {
    const adminToken = jwt.sign(
        {
            userId: testUserId,
            role: "ADMIN"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .patch(`/api/accounts/${accountId}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Account activated successfully");
    expect(response.body.account.status).toBe("ACTIVE");
});
// TEST 13: Verify account status changes are recorded in audit logs
test("should create audit logs when an account is frozen and activated", async () => {
    const freezeLog = await prisma.auditLog.findFirst({
        where: {
            action: "ACCOUNT_FROZEN",
            entity: "ACCOUNT",
            entityId: accountId,
            userId: testUserId
        }
    });

    const activateLog = await prisma.auditLog.findFirst({
        where: {
            action: "ACCOUNT_ACTIVATED",
            entity: "ACCOUNT",
            entityId: accountId,
            userId: testUserId
        }
    });

    expect(freezeLog).not.toBeNull();
    expect(activateLog).not.toBeNull();

    expect(freezeLog.details.newStatus).toBe("FROZEN");
    expect(activateLog.details.newStatus).toBe("ACTIVE");
});
// TEST 14: ACCOUNT_HOLDER cannot freeze an account
test("should reject ACCOUNT_HOLDER from freezing an account", async () => {
    const response = await request(app)
        .patch(`/api/accounts/${accountId}/freeze`)
        .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");

    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(account.status).toBe("ACTIVE");
});
// TEST 15: AUDITOR cannot freeze an account
test("should reject AUDITOR from freezing an account", async () => {
    const auditorToken = jwt.sign(
        {
            userId: testUserId,
            role: "AUDITOR"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .patch(`/api/accounts/${accountId}/freeze`)
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");

    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(account.status).toBe("ACTIVE");
});
// TEST 16: AUDITOR cannot reactivate an account
test("should reject AUDITOR from activating an account", async () => {
    const auditorToken = jwt.sign(
        {
            userId: testUserId,
            role: "AUDITOR"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .patch(`/api/accounts/${accountId}/activate`)
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");

    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(account.status).toBe("ACTIVE");
});
// TEST 16: AUDITOR cannot reactivate an account
test("should reject AUDITOR from activating an account", async () => {
    const auditorToken = jwt.sign(
        {
            userId: testUserId,
            role: "AUDITOR"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .patch(`/api/accounts/${accountId}/activate`)
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");

    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(account.status).toBe("ACTIVE");
});
// TEST 18: Reject activating an already active account
test("should reject activating an already active account", async () => {
    const adminToken = jwt.sign(
        {
            userId: testUserId,
            role: "ADMIN"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
            algorithm: "HS256"
        }
    );

    const response = await request(app)
        .patch(`/api/accounts/${accountId}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe("Account is already active");

    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(account.status).toBe("ACTIVE");
});
// TEST 19: Reject freezing a closed account
test("should reject freezing a closed account", async () => {
    const adminToken = jwt.sign(
        { userId: testUserId, role: "ADMIN" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const closedAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: testUserId,
            balance: 0n,
            type: "CUSTOMER",
            status: "CLOSED"
        }
    });

    const response = await request(app)
        .patch(`/api/accounts/${closedAccount.id}/freeze`)
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Closed accounts cannot be frozen");

    const updatedAccount = await prisma.account.findUnique({
        where: { id: closedAccount.id }
    });

    expect(updatedAccount.status).toBe("CLOSED");
});
// TEST 20: Reject activating a closed account
test("should reject activating a closed account", async () => {
    const adminToken = jwt.sign(
        { userId: testUserId, role: "ADMIN" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const closedAccount = await prisma.account.create({
        data: {
            accountNumber: `LL${Date.now()}${Math.floor(Math.random() * 1000)}`,
            ownerId: testUserId,
            balance: 0n,
            type: "CUSTOMER",
            status: "CLOSED"
        }
    });

    const response = await request(app)
        .patch(`/api/accounts/${closedAccount.id}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Closed accounts cannot be activated");

    const updatedAccount = await prisma.account.findUnique({
        where: { id: closedAccount.id }
    });

    expect(updatedAccount.status).toBe("CLOSED");
});
// TEST 21: Reject account holder from activating an account
test("should reject account holder from activating an account", async () => {
    const response = await request(app)
        .patch(`/api/accounts/${accountId}/activate`)
        .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");

    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    expect(account.status).toBe("ACTIVE");
});
// TEST 22: Reject account activation without authentication
test("should reject activating an account without a token", async () => {
    const response = await request(app)
        .patch(`/api/accounts/${accountId}/activate`);

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Authentication required");
});
// TEST 23: Reject AUDITOR from creating an account
test("should reject AUDITOR from creating an account", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .post("/api/accounts")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");
});
// TEST 23: Allow AUDITOR to view audit logs
test("should allow AUDITOR to view audit logs", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
        "Audit logs retrieved successfully"
    );
    expect(response.body).toHaveProperty("logs");
    expect(response.body).toHaveProperty("pagination");
});
// TEST 24: Allow ADMIN to view audit logs
test("should allow ADMIN to view audit logs", async () => {
    const adminToken = jwt.sign(
        { userId: testUserId, role: "ADMIN" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
        "Audit logs retrieved successfully"
    );
    expect(response.body).toHaveProperty("logs");
});
// TEST 25: Reject ACCOUNT_HOLDER from viewing audit logs
test("should reject ACCOUNT_HOLDER from viewing audit logs", async () => {
    const response = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("Access denied");
});
// TEST 26: Verify audit logs pagination
test("should support pagination when retrieving audit logs", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs?page=1&limit=5")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(5);

    expect(response.body.logs.length).toBeLessThanOrEqual(5);
    expect(response.body.pagination).toHaveProperty("total");
    expect(response.body.pagination).toHaveProperty("totalPages");
});
// TEST 27: Verify audit logs are sorted by newest first
test("should return audit logs in descending chronological order", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs?limit=20")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);

    const logs = response.body.logs;

    for (let i = 0; i < logs.length - 1; i++) {
        expect(
            new Date(logs[i].createdAt).getTime()
        ).toBeGreaterThanOrEqual(
            new Date(logs[i + 1].createdAt).getTime()
        );
    }
});
// TEST 28: Verify audit logs include user details
test("should include user details in audit logs", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);

    if (response.body.logs.length > 0) {
        expect(response.body.logs[0].user).toBeDefined();
        expect(response.body.logs[0].user).toHaveProperty("id");
        expect(response.body.logs[0].user).toHaveProperty("name");
        expect(response.body.logs[0].user).toHaveProperty("email");
        expect(response.body.logs[0].user).toHaveProperty("role");
    }
});
// TEST 29: Ensure audit logs do not expose user passwords
test("should not expose passwords in audit logs", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);

    response.body.logs.forEach(log => {
        expect(log.user).not.toHaveProperty("password");
    });
});
// TEST 30: Handle invalid pagination parameters
test("should handle invalid pagination parameters safely", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs?page=-1&limit=abc")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(10);
});
// TEST 31: Enforce maximum pagination limit
test("should restrict audit log pagination limit to 100", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs?page=1&limit=500")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.pagination.limit).toBe(100);
    expect(response.body.logs.length).toBeLessThanOrEqual(100);
});
// TEST 32: Reject audit log access without authentication
test("should reject access to audit logs without a token", async () => {
    const response = await request(app)
        .get("/api/audit-logs");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Authentication required");
});
// TEST 33: Retrieve the second page of audit logs
test("should retrieve the second page of audit logs", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs?page=2&limit=5")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.pagination.page).toBe(2);
    expect(response.body.pagination.limit).toBe(5);
    expect(response.body.logs.length).toBeLessThanOrEqual(5);
});
// TEST 34: Verify audit logs response structure
test("should return an array for audit logs", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.logs)).toBe(true);
    expect(typeof response.body.pagination.total).toBe("number");
});
// TEST 35: Handle requests for pages beyond available audit logs
test("should return an empty array for an unavailable audit log page", async () => {
    const auditorToken = jwt.sign(
        { userId: testUserId, role: "AUDITOR" },
        process.env.JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    const response = await request(app)
        .get("/api/audit-logs?page=999999&limit=10")
        .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.pagination.page).toBe(999999);
    expect(response.body.logs).toEqual([]);
});
});