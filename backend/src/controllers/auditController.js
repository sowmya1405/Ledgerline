const prisma = require("../config/prisma");

// Get audit logs (ADMIN and AUDITOR)
const getAuditLogs = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(req.query.limit) || 10, 1),
            100
        );

        const skip = (page - 1) * limit;

        const [logs, total] = await prisma.$transaction([
            prisma.auditLog.findMany({
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            }),
            prisma.auditLog.count()
        ]);

        res.status(200).json({
            message: "Audit logs retrieved successfully",
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            logs: logs.map(log => ({
                ...log,
                createdAt: log.createdAt.toISOString()
            }))
        });
    } catch (error) {
        console.error("Get audit logs error:", error);
        res.status(500).json({
            message: "Failed to retrieve audit logs"
        });
    }
};

module.exports = { getAuditLogs };