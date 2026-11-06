import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  LogOut,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Activity,
  History,
  CheckCircle,
  XCircle,
  Menu,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../styles/AdminDashboard.css";

function AdminDashboard() {
  const { user, logout } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        api.get("/accounts/admin/all"),
        api.get("/transactions/history"),
        api.get("/audit-logs"),
      ]);

      if (results[0].status === "fulfilled") {
        const data = results[0].value.data;
        setAccounts(
          Array.isArray(data)
            ? data
            : data.accounts || data.data || []
        );
      } else {
        throw new Error("Unable to load customer accounts.");
      }

      if (results[1].status === "fulfilled") {
        const data = results[1].value.data;
        setTransactions(
          Array.isArray(data)
            ? data
            : data.transactions || data.data || []
        );
      }

      if (results[2].status === "fulfilled") {
        const data = results[2].value.data;
        setAuditLogs(
          Array.isArray(data)
            ? data
            : data.logs || data.auditLogs || data.data || []
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const freezeAccount = async (accountId) => {
    if (!window.confirm("Are you sure you want to freeze this account?")) {
      return;
    }

    try {
      setActionLoading(accountId);

      await api.patch(`/accounts/${accountId}/freeze`);

      await loadDashboard();
    } catch (err) {
      alert(
        err.response?.data?.message || "Unable to freeze account."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const activateAccount = async (accountId) => {
    if (!window.confirm("Do you want to activate this account?")) {
      return;
    }

    try {
      setActionLoading(accountId);

      await api.patch(`/accounts/${accountId}/activate`);

      await loadDashboard();
    } catch (err) {
      alert(
        err.response?.data?.message || "Unable to activate account."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const customerName =
      account.user?.name ||
      account.customer?.name ||
      "";

    const accountNumber = account.accountNumber || "";

    const matchesSearch =
      customerName.toLowerCase().includes(search.toLowerCase()) ||
      accountNumber.toLowerCase().includes(search.toLowerCase());

    const status = String(account.status || "").toUpperCase();

    const matchesStatus =
      statusFilter === "ALL" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalAccounts = accounts.length;

  const activeAccounts = accounts.filter(
    (account) => String(account.status).toUpperCase() === "ACTIVE"
  ).length;

  const frozenAccounts = accounts.filter(
    (account) => String(account.status).toUpperCase() === "FROZEN"
  ).length;

  const customers = new Set(
    accounts.map((account) => account.userId || account.user?.id)
      .filter(Boolean)
  ).size;

  const formatCurrency = (amount) => {
    const value = Number(amount || 0);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getCustomerName = (account) =>
    account.user?.name ||
    account.customer?.name ||
    "Customer";

  const getTransactionIcon = (type) => {
    const value = String(type || "").toUpperCase();

    if (value.includes("DEPOSIT")) return <ArrowDownLeft />;
    if (value.includes("WITHDRAW")) return <ArrowUpRight />;

    return <ArrowLeftRight />;
  };

  return (
    <div className="admin-layout">

      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenu ? "open" : ""}`}>

        <div className="admin-brand">
          <div className="admin-brand-icon">
            <Wallet size={25} />
          </div>
          <span>Ledgerline</span>
        </div>

        <div className="admin-menu-label">ADMIN MENU</div>

        <nav className="admin-navigation">

          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => {
              setActiveTab("overview");
              setMobileMenu(false);
            }}
          >
            <LayoutDashboard size={19} />
            Overview
          </button>

          <button
            className={activeTab === "accounts" ? "active" : ""}
            onClick={() => {
              setActiveTab("accounts");
              setMobileMenu(false);
            }}
          >
            <Users size={19} />
            Customer Accounts
          </button>

          <button
            className={activeTab === "transactions" ? "active" : ""}
            onClick={() => {
              setActiveTab("transactions");
              setMobileMenu(false);
            }}
          >
            <Activity size={19} />
            Transactions
          </button>

          <button
            className={activeTab === "audit" ? "active" : ""}
            onClick={() => {
              setActiveTab("audit");
              setMobileMenu(false);
            }}
          >
            <History size={19} />
            Audit Logs
          </button>

        </nav>

        <div className="admin-sidebar-bottom">

          <div className="admin-user">
            <div className="admin-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>

            <div>
              <strong>{user?.name || "Administrator"}</strong>
              <span>Administrator</span>
            </div>
          </div>

          <button className="admin-logout" onClick={logout}>
            <LogOut size={18} />
            Logout
          </button>

        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">

        <header className="admin-topbar">

          <button
            className="admin-mobile-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>

          <div>
            <h1>
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "accounts" && "Customer Accounts"}
              {activeTab === "transactions" && "Transactions"}
              {activeTab === "audit" && "Audit Logs"}
            </h1>

            <p>Welcome back, {user?.name || "Administrator"}!</p>
          </div>

          <button
            className="admin-refresh"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw size={17} />
            Refresh
          </button>

        </header>

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="admin-loading">
            <RefreshCw className="admin-spinner" size={30} />
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>

            {/* Overview */}
            {activeTab === "overview" && (
              <>

                <section className="admin-welcome">
                  <div>
                    <span>ADMINISTRATOR PANEL</span>
                    <h2>Manage your banking operations</h2>
                    <p>
                      Monitor customer accounts and financial activities
                      from one place.
                    </p>
                  </div>

                  <ShieldCheck size={55} />
                </section>

                <section className="admin-stats">

                  <div className="admin-stat-card">
                    <div className="stat-icon blue">
                      <Users />
                    </div>
                    <span>Total Customers</span>
                    <h2>{customers}</h2>
                  </div>

                  <div className="admin-stat-card">
                    <div className="stat-icon purple">
                      <Wallet />
                    </div>
                    <span>Total Accounts</span>
                    <h2>{totalAccounts}</h2>
                  </div>

                  <div className="admin-stat-card">
                    <div className="stat-icon green">
                      <ShieldCheck />
                    </div>
                    <span>Active Accounts</span>
                    <h2>{activeAccounts}</h2>
                  </div>

                  <div className="admin-stat-card">
                    <div className="stat-icon orange">
                      <ShieldAlert />
                    </div>
                    <span>Frozen Accounts</span>
                    <h2>{frozenAccounts}</h2>
                  </div>

                </section>

                <section className="admin-section">

                  <div className="admin-section-heading">
                    <div>
                      <h2>Customer Accounts</h2>
                      <p>Manage customer banking accounts</p>
                    </div>

                    <button
                      className="admin-view-all"
                      onClick={() => setActiveTab("accounts")}
                    >
                      View All
                    </button>
                  </div>

                  <AccountTable
                    accounts={accounts.slice(0, 5)}
                    freezeAccount={freezeAccount}
                    activateAccount={activateAccount}
                    actionLoading={actionLoading}
                    getCustomerName={getCustomerName}
                    formatCurrency={formatCurrency}
                  />

                </section>

                <section className="admin-section">

                  <div className="admin-section-heading">
                    <div>
                      <h2>Recent Transactions</h2>
                      <p>Latest financial activities</p>
                    </div>

                    <button
                      className="admin-view-all"
                      onClick={() => setActiveTab("transactions")}
                    >
                      View All
                    </button>
                  </div>

                  <TransactionTable
                    transactions={transactions.slice(0, 5)}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getTransactionIcon={getTransactionIcon}
                  />

                </section>

              </>
            )}

            {/* Accounts */}
            {activeTab === "accounts" && (
              <section className="admin-section">

                <div className="admin-section-heading">
                  <div>
                    <h2>Customer Account Management</h2>
                    <p>Search, monitor and manage customer accounts</p>
                  </div>
                </div>

                <div className="admin-filters">

                  <div className="admin-search">
                    <Search size={18} />

                    <input
                      type="text"
                      placeholder="Search customer or account number..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Accounts</option>
                    <option value="ACTIVE">Active</option>
                    <option value="FROZEN">Frozen</option>
                  </select>

                </div>

                <AccountTable
                  accounts={filteredAccounts}
                  freezeAccount={freezeAccount}
                  activateAccount={activateAccount}
                  actionLoading={actionLoading}
                  getCustomerName={getCustomerName}
                  formatCurrency={formatCurrency}
                />

              </section>
            )}

            {/* Transactions */}
            {activeTab === "transactions" && (
              <section className="admin-section">

                <div className="admin-section-heading">
                  <div>
                    <h2>Transaction Monitoring</h2>
                    <p>Review financial transaction records</p>
                  </div>
                </div>

                <TransactionTable
                  transactions={transactions}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  getTransactionIcon={getTransactionIcon}
                />

              </section>
            )}

            {/* Audit Logs */}
            {activeTab === "audit" && (
              <section className="admin-section">

                <div className="admin-section-heading">
                  <div>
                    <h2>System Audit Logs</h2>
                    <p>Monitor important system activities</p>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="admin-empty">
                    No audit log records available.
                  </div>
                ) : (
                  <div className="admin-table-wrapper">
                    <table className="admin-table">

                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>User</th>
                          <th>Details</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <span className="admin-action-badge">
                                {log.action || "Activity"}
                              </span>
                            </td>

                            <td>
                              {log.user?.name || log.userId || "System"}
                            </td>

                            <td>
                              {log.details || log.description || "—"}
                            </td>

                            <td>{formatDate(log.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>

                    </table>
                  </div>
                )}

              </section>
            )}

          </>
        )}

      </main>
    </div>
  );
}

function AccountTable({
  accounts,
  freezeAccount,
  activateAccount,
  actionLoading,
  getCustomerName,
  formatCurrency,
}) {
  if (!accounts.length) {
    return (
      <div className="admin-empty">
        No customer accounts found.
      </div>
    );
  }

  return (
    <div className="admin-table-wrapper">

      <table className="admin-table">

        <thead>
          <tr>
            <th>Customer</th>
            <th>Account Number</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>

          {accounts.map((account) => {
            const frozen =
              String(account.status).toUpperCase() === "FROZEN";

            return (
              <tr key={account.id}>

                <td>
                  <strong>{getCustomerName(account)}</strong>
                </td>

                <td>{account.accountNumber || "—"}</td>

                <td>
                  <strong>
                    {formatCurrency(account.balance)}
                  </strong>
                </td>

                <td>
                  <span
                    className={`admin-status ${
                      frozen ? "frozen" : "active"
                    }`}
                  >
                    {account.status || "UNKNOWN"}
                  </span>
                </td>

                <td>
                  <button
                    className={`admin-action-button ${
                      frozen ? "activate" : "freeze"
                    }`}
                    disabled={actionLoading === account.id}
                    onClick={() =>
                      frozen
                        ? activateAccount(account.id)
                        : freezeAccount(account.id)
                    }
                  >
                    {actionLoading === account.id
                      ? "Please wait..."
                      : frozen
                      ? "Activate"
                      : "Freeze"}
                  </button>
                </td>

              </tr>
            );
          })}

        </tbody>

      </table>

    </div>
  );
}

function TransactionTable({
  transactions,
  formatCurrency,
  formatDate,
  getTransactionIcon,
}) {
  if (!transactions.length) {
    return (
      <div className="admin-empty">
        No transaction records available.
      </div>
    );
  }

  return (
    <div className="admin-table-wrapper">

      <table className="admin-table">

        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>

          {transactions.map((transaction) => (
            <tr key={transaction.id}>

              <td>
                {transaction.reference || transaction.id}
              </td>

              <td>
                <span className="admin-transaction-type">
                  {getTransactionIcon(transaction.type)}
                  {transaction.type || "TRANSACTION"}
                </span>
              </td>

              <td>
                <strong>
                  {formatCurrency(
                    transaction.amountPaise != null
                      ? transaction.amountPaise / 100
                      : transaction.amount
                  )}
                </strong>
              </td>

              <td>
                <span className="admin-status active">
                  {transaction.status || "COMPLETED"}
                </span>
              </td>

              <td>
                {formatDate(transaction.createdAt)}
              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>
  );
}

export default AdminDashboard;