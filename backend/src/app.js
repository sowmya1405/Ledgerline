require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const auditRoutes = require("./routes/auditRoutes");
const app = express();

app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to Ledgerline API",
        status: "Running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/audit-logs", auditRoutes);
module.exports = app;