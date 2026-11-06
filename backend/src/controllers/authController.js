const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
// REGISTER USER
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check existing user
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: "ACCOUNT_HOLDER"
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });

        return res.status(201).json({
            message: "Registration successful",
            user
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};
const jwt = require("jsonwebtoken");

// LOGIN USER
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
                algorithm: "HS256"
            }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};