# Ledgerline – Money Movement & Ledger Management System

A secure, full-stack money movement and ledger management application designed to handle financial transactions with authentication, role-based access control, double-entry bookkeeping, transaction tracking and audit logging.

## Overview

Ledgerline is a banking-style financial management system that enables users to create accounts, deposit money, withdraw funds and transfer money between accounts.

The application uses a double-entry accounting approach to maintain transaction records and provides an administrative dashboard for managing customer accounts.

It is built using React, Node.js, Express.js, PostgreSQL and Prisma ORM, with Docker support for containerized deployment.

## Key Features
## Application Screenshots

### Login Page
![Login Page](screenshots/login.png)

### Customer Dashboard
![Customer Dashboard](screenshots/dashboard.png)

### Transaction History
![Transaction History](screenshots/transactions.png)

### Admin Dashboard
![Admin Dashboard](screenshots/admin-dashboard.png)

### Authentication & Authorization
- User registration and login.
- JWT-based authentication.
- Password hashing using bcrypt.
- Role-based access control.
- Roles: ADMIN, ACCOUNT_HOLDER and AUDITOR.

### Account Management
- Create and manage customer accounts.
- View account details and balances.
- Admin account management.
- Freeze and activate customer accounts.

### Money Movement
- Deposit funds.
- Withdraw funds.
- Transfer funds between accounts.
- Insufficient balance validation.
- Atomic balance updates.

### Double-Entry Ledger
- Debit and credit entries for financial transactions.
- Transaction-linked ledger records.
- Consistent transaction processing using database transactions.

### Transaction Management
- Transaction history.
- Transaction status tracking.
- Idempotency protection against duplicate requests.
- Unique transaction references.

### Audit Logging
- Record important financial activities.
- Track transaction-related actions.
- Admin and auditor access to audit records.

### Admin Dashboard
- View customer accounts.
- Search and filter accounts.
- Freeze and activate accounts.
- Monitor account information.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Authentication | JWT, bcrypt |
| API Testing | Postman, Supertest |
| Testing | Jest |
| Containerization | Docker, Docker Compose |
| Web Server | Nginx |
| Version Control | Git, GitHub |

## System Architecture

```text
             USER
              |
              v
      React Frontend
        (Vite + CSS)
              |
              v
        Nginx Server
              |
              v
       Express Backend
              |
      -------------------
      |        |        |
      v        v        v
 Authentication Account Transactions
      |        |        |
      -------------------
              |
              v
         Prisma ORM
              |
              v
       PostgreSQL DB
              |
      -------------------
      |        |        |
      v        v        v
    Users   Accounts  Ledger Entries
                       |
                       v
                 Audit Logs
```

## Project Structure

```text
Ledgerline/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── styles/
│   │
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install the following:

- Node.js 22 or later.
- Docker Desktop.
- Git.

### 1. Clone the Repository

```bash
git clone https://github.com/sowmya1405/Ledgerline.git
cd Ledgerline
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
DB_PASSWORD=your_database_password
JWT_SECRET=your_strong_jwt_secret
```

For local backend development, create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ledgerline?schema=public
PORT=5000
JWT_SECRET=your_strong_jwt_secret
```

Use the same JWT secret for the backend and Docker configuration.

Never commit environment files or expose credentials publicly.

### 3. Run Using Docker

Build and start all services:

```bash
docker compose up --build -d
```

Check container status:

```bash
docker compose ps
```

View backend logs:

```bash
docker compose logs backend
```

Docker Compose automatically starts PostgreSQL, runs Prisma migrations and starts the backend and frontend services.

### 4. Access the Application

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |
| Prisma Studio | http://localhost:5555 |

To start Prisma Studio:

```bash
docker compose exec backend npx prisma studio --hostname 0.0.0.0 --port 5555
```

### 5. Run Backend Tests

```bash
docker compose exec backend npm test
```

The backend test suite includes authentication, account management, transactions and application tests.

## API Modules

The backend provides the following API modules:

| Module | Base Route | Purpose |
|---|---|---|
| Authentication | `/api/auth` | Registration and login |
| Accounts | `/api/accounts` | Account creation and management |
| Transactions | `/api/transactions` | Deposits, withdrawals, transfers and history |
| Audit Logs | `/api/audit-logs` | Financial activity tracking |

All protected endpoints require appropriate authentication and authorization.

## Testing

The project uses Jest and Supertest for backend testing.

Current backend test results:

- 4 test suites passed.
- 66 tests passed.
- 0 failing tests.

Frontend production builds are generated using Vite and served through Nginx.

## Security Considerations

- JWT-based authentication.
- Password hashing using bcrypt.
- Role-based authorization.
- Account ownership validation.
- Atomic balance updates.
- Idempotency protection.
- Transactional database operations.
- Audit logging.

**Note:** This project is an educational software implementation and is not certified or intended for production banking or real-money processing.

## Future Improvements

- Advanced transaction monitoring.
- Enhanced reporting and analytics.
- Automated deployment using CI/CD.
- More comprehensive integration and security testing.
- Cloud deployment and monitoring.

## Author

**Jujjuri Lakshmi Sowmya**

GitHub: https://github.com/sowmya1405

---

If you find this project interesting, feel free to explore the repository and share your feedback!

⭐ Star the repository if you like the project.