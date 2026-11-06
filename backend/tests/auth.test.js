const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

describe("Ledgerline Authentication API Tests", () => {
    const testUser = {
        name: "Test User",
        email: `test${Date.now()}@example.com`,
        password: "TestPass123"
    };

    afterAll(async () => {
        await prisma.user.deleteMany({
            where: {
                email: testUser.email
            }
        });

        await prisma.$disconnect();
    });

    // TEST 1: Successful Registration
    test("POST /api/auth/register - should register a new user", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send(testUser);

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe("Registration successful");
        expect(response.body.user.email).toBe(testUser.email);
        expect(response.body.user.role).toBe("ACCOUNT_HOLDER");
        expect(response.body.user.password).toBeUndefined();
    });

    // TEST 2: Duplicate Email
    test("POST /api/auth/register - should reject duplicate email", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send(testUser);

        expect(response.statusCode).toBe(409);
        expect(response.body.message).toBe("Email already registered");
    });

    // TEST 3: Missing Registration Fields
    test("POST /api/auth/register - should reject missing fields", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Test User"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe("All fields are required");
    });

    // TEST 4: Short Password
    test("POST /api/auth/register - should reject short passwords", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Test User",
                email: `short${Date.now()}@example.com`,
                password: "123"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(
            "Password must be at least 8 characters"
        );
    });

    // TEST 5: Successful Login
    test("POST /api/auth/login - should login with correct credentials", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email,
                password: testUser.password
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("Login successful");
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe(testUser.email);
    });

    // TEST 6: Incorrect Password
    test("POST /api/auth/login - should reject incorrect password", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email,
                password: "WrongPassword123"
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
    });

    // TEST 7: Missing Login Fields
    test("POST /api/auth/login - should reject missing credentials", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: testUser.email
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(
            "Email and password are required"
        );
    });
});