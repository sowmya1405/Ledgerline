require("dotenv").config();

const app = require("./app");
const prisma = require("./config/prisma");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
    console.log(`Ledgerline server running on http://${HOST}:${PORT}`);
});

async function shutdown() {
    console.log("Shutting down Ledgerline server...");

    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);