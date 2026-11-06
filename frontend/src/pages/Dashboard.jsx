import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  History,
  User,
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  CreditCard,
  X,
  IndianRupee,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../styles/Dashboard.css";

function Dashboard() {
  const { user, logout } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Create account
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [creating, setCreating] = useState(false);

  // Deposit
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Withdrawal
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAccountId, setWithdrawAccountId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  // Transfer
  const [showTransfer, setShowTransfer] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Fetch accounts and transaction history when the dashboard loads.
  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  // FETCH ACCOUNTS
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/accounts");

      const data = response.data;

      const accountList = Array.isArray(data)
        ? data
        : data.accounts || [];

      setAccounts(accountList);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your accounts."
      );
    } finally {
      setLoading(false);
    }
  };

  // FETCH TRANSACTION HISTORY
  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true);
      setTransactionsError("");

      const response = await api.get("/transactions/history");
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setTransactionsError(
        err.response?.data?.message ||
          "Unable to load transaction history."
      );
    } finally {
      setTransactionsLoading(false);
    }
  };

  // CREATE ACCOUNT
  const handleCreateAccount = async () => {
    try {
      setCreating(true);
      setError("");
      setSuccessMessage("");

      const response = await api.post("/accounts");

      setSuccessMessage(
        response.data.message || "Account created successfully!"
      );

      setShowCreateAccount(false);

      await fetchAccounts();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create account."
      );
    } finally {
      setCreating(false);
    }
  };

  // DEPOSIT MONEY
  const handleDeposit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!depositAccountId) {
      setError("Please select an account.");
      return;
    }

    const amountInRupees = Number(depositAmount);

    if (
      !Number.isFinite(amountInRupees) ||
      amountInRupees <= 0
    ) {
      setError("Please enter a valid deposit amount.");
      return;
    }

    const amountPaise = Math.round(amountInRupees * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    try {
      setDepositing(true);

      const response = await api.post(
        "/transactions/deposit",
        {
          accountId: depositAccountId,
          amountPaise,
          description: "Account deposit",
        },
        {
          headers: {
            "Idempotency-Key": crypto.randomUUID(),
          },
        }
      );

      setSuccessMessage(
        response.data.message || "Deposit successful!"
      );

      setShowDeposit(false);
      setDepositAmount("");
      setDepositAccountId("");

      await fetchAccounts();
      await fetchTransactions();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Deposit failed. Please try again."
      );
    } finally {
      setDepositing(false);
    }
  };

  // WITHDRAW MONEY
  const handleWithdraw = async (e) => {
    e.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!withdrawAccountId) {
      setError("Please select an account.");
      return;
    }

    const amountInRupees = Number(withdrawAmount);

    if (
      !Number.isFinite(amountInRupees) ||
      amountInRupees <= 0
    ) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }

    const amountPaise = Math.round(amountInRupees * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    const selectedAccount = accounts.find(
      (account) => account.id === withdrawAccountId
    );

    if (
      !selectedAccount ||
      BigInt(selectedAccount.balance) < BigInt(amountPaise)
    ) {
      setError("Insufficient account balance.");
      return;
    }

    try {
      setWithdrawing(true);

      const response = await api.post(
        "/transactions/withdraw",
        {
          accountId: withdrawAccountId,
          amountPaise,
          description: "Account withdrawal",
        },
        {
          headers: {
            "Idempotency-Key": crypto.randomUUID(),
          },
        }
      );

      setSuccessMessage(
        response.data.message || "Withdrawal successful!"
      );

      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawAccountId("");

      await fetchAccounts();
      await fetchTransactions();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Withdrawal failed. Please try again."
      );
    } finally {
      setWithdrawing(false);
    }
  };
  // TRANSFER MONEY
const handleTransfer = async (e) => {
  e.preventDefault();

  setError("");
  setSuccessMessage("");

  if (!sourceAccountId || !destinationAccountId) {
    setError("Please select both source and destination accounts.");
    return;
  }

  if (sourceAccountId === destinationAccountId) {
    setError("Source and destination accounts must be different.");
    return;
  }

  const amountInRupees = Number(transferAmount);

  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    setError("Please enter a valid transfer amount.");
    return;
  }

  const amountPaise = Math.round(amountInRupees * 100);

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    setError("Please enter a valid amount.");
    return;
  }

  const sourceAccount = accounts.find(
    (account) => account.id === sourceAccountId
  );

  if (
    !sourceAccount ||
    BigInt(sourceAccount.balance) < BigInt(amountPaise)
  ) {
    setError("Insufficient account balance.");
    return;
  }

  try {
    setTransferring(true);

    const response = await api.post(
      "/transactions/transfer",
      {
        sourceAccountId,
        destinationAccountId,
        amountPaise,
        description: "Account transfer",
      },
      {
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
      }
    );

    setSuccessMessage(
      response.data.message || "Transfer successful!"
    );

    setShowTransfer(false);
    setSourceAccountId("");
    setDestinationAccountId("");
    setTransferAmount("");

    await fetchAccounts();
    await fetchTransactions();
  } catch (err) {
    setError(
      err.response?.data?.message ||
        "Transfer failed. Please try again."
    );
  } finally {
    setTransferring(false);
  }
};

  // TOTAL BALANCE
  // Account balances are stored in paise.
  const totalBalance = accounts.reduce(
    (total, account) =>
      total + Number(account.balance || 0),
    0
  );

  // FORMAT CURRENCY
  const formatCurrency = (amountInPaise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInPaise / 100);

  // ACTIVE ACCOUNTS
  const activeAccounts = accounts.filter(
    (account) => account.status === "ACTIVE"
  );

  return (
    <div className="dashboard-layout">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Wallet size={25} />
          </div>
          <h2>Ledgerline</h2>
        </div>

        <p className="sidebar-label">MENU</p>

        <nav className="sidebar-nav">
          <a
            href="#dashboard"
            className={`nav-item ${activeSection === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveSection("dashboard")}
          >
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a
            href="#accounts"
            className={`nav-item ${activeSection === "accounts" ? "active" : ""}`}
            onClick={() => setActiveSection("accounts")}
          >
            <CreditCard size={19} />
            My Accounts
          </a>

          <a
            href="#transactions"
            className={`nav-item ${activeSection === "transactions" ? "active" : ""}`}
            onClick={() => setActiveSection("transactions")}
          >
            <ArrowLeftRight size={19} />
            Transactions
          </a>

          <Link to="/transactions/history" className="nav-item">
            <History size={19} />
            History
          </Link>
        </nav>

        <div className="sidebar-bottom">

          <div className="sidebar-user">
            <div className="user-avatar">
              <User size={20} />
            </div>

            <div className="user-details">
              <h4>{user?.name}</h4>
              <span>Account Holder</span>
            </div>
          </div>

          <button className="logout-button" onClick={logout}>
            <LogOut size={18} />
            Logout
          </button>

        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="dashboard-main" id="dashboard">

        {/* HEADER */}
        <header className="dashboard-header">

          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, {user?.name}!</p>
          </div>

          <div className="header-profile">
            <div className="profile-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>

        </header>

        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* BALANCE */}
        <section className="balance-card">

          <div>
            <p>Total Account Balance</p>

            <h2>
              {loading
                ? "Loading..."
                : formatCurrency(totalBalance)}
            </h2>

            <span>Across all your accounts</span>
          </div>

          <div className="balance-icon">
            <Wallet size={35} />
          </div>

        </section>

        {/* QUICK ACTIONS */}
        <section className="dashboard-section" id="transactions">

          <div className="section-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Manage your money easily</p>
            </div>
          </div>

          <div className="quick-actions">

            {/* DEPOSIT BUTTON */}
            <button
              className="action-card"
              onClick={() => {
                setError("");
                setSuccessMessage("");

                setDepositAccountId(
                  activeAccounts[0]?.id || ""
                );

                setShowDeposit(true);
              }}
            >
              <div className="action-icon deposit-icon">
                <ArrowDownLeft size={22} />
              </div>
              <span>Deposit</span>
            </button>

            {/* WITHDRAW BUTTON */}
            <button
              className="action-card"
              onClick={() => {
                setError("");
                setSuccessMessage("");

                setWithdrawAccountId(
                  activeAccounts[0]?.id || ""
                );

                setShowWithdraw(true);
              }}
            >
              <div className="action-icon withdraw-icon">
                <ArrowUpRight size={22} />
              </div>
              <span>Withdraw</span>
            </button>

            {/* TRANSFER BUTTON */}
           <button
  className="action-card"
  onClick={() => {
    setError("");
    setSuccessMessage("");

    setSourceAccountId(activeAccounts[0]?.id || "");
    setDestinationAccountId("");
    setTransferAmount("");

    setShowTransfer(true);
  }}
>
  <div className="action-icon transfer-icon">
    <ArrowLeftRight size={22} />
  </div>
  <span>Transfer</span>
</button>

            {/* REFRESH BUTTON */}
            <button
              className="action-card"
              onClick={() => {
                fetchAccounts();
                fetchTransactions();
              }}
              disabled={loading || transactionsLoading}
            >
              <div className="action-icon refresh-icon">
                <RefreshCw size={22} />
              </div>
              <span>Refresh</span>
            </button>

          </div>
        </section>

        {/* ACCOUNTS */}
        <section className="dashboard-section" id="accounts">

          <div className="section-heading">

            <div>
              <h2>My Accounts</h2>
              <p>Overview of your bank accounts</p>
            </div>

            <button
              className="add-account-button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setShowCreateAccount(true);
              }}
            >
              <Plus size={17} />
              New Account
            </button>

          </div>

          {loading ? (
            <p className="status-message">
              Loading your accounts...
            </p>
          ) : accounts.length === 0 ? (
            <div className="empty-state">
              <Wallet size={35} />
              <h3>No accounts yet</h3>
              <p>
                Create an account to start managing your money.
              </p>
            </div>
          ) : (
            <div className="accounts-grid">

              {accounts.map((account) => (
                <div className="account-card" key={account.id}>

                  <div className="account-card-top">

                    <div className="account-icon">
                      <CreditCard size={22} />
                    </div>

                    <span
                      className={`account-status ${account.status?.toLowerCase()}`}
                    >
                      {account.status}
                    </span>

                  </div>

                  <p className="account-number">
                    Account Number: {account.accountNumber}
                  </p>

                  <h3>
                    {formatCurrency(Number(account.balance || 0))}
                  </h3>

                  <span className="account-type">
                    {account.type} ACCOUNT
                  </span>

                </div>
              ))}

            </div>
          )}

        </section>

        {/* RECENT TRANSACTIONS */}
        <section
          className="dashboard-section"
          id="history"
        >

          <div className="section-heading">
            <div>
              <h2>Recent Transactions</h2>
              <p>Keep track of your money movement</p>
            </div>

            <button
              className="add-account-button"
              onClick={fetchTransactions}
              disabled={transactionsLoading}
            >
              <RefreshCw size={16} />
              {transactionsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {transactionsLoading ? (
            <p className="status-message">Loading transactions...</p>
          ) : transactionsError ? (
            <div className="error-message">{transactionsError}</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">
              <History size={35} />
              <h3>No transactions yet</h3>
              <p>Your recent transactions will appear here.</p>
            </div>
          ) : (
            <div className="transaction-list">
              {transactions.map((transaction) => {
                const isOutgoing =
                  transaction.type === "WITHDRAWAL" ||
                  (transaction.type === "TRANSFER" &&
                    accounts.some(
                      (account) => account.id === transaction.sourceAccount?.id
                    ));

                const amountClass = isOutgoing ? "negative" : "positive";
                const amountSign = isOutgoing ? "-" : "+";

                return (
                  <div className="transaction-item" key={transaction.id}>
                    <div className={`transaction-icon ${transaction.type?.toLowerCase()}`}>
                      {transaction.type === "DEPOSIT" ? (
                        <ArrowDownLeft size={21} />
                      ) : transaction.type === "WITHDRAWAL" ? (
                        <ArrowUpRight size={21} />
                      ) : (
                        <ArrowLeftRight size={21} />
                      )}
                    </div>

                    <div className="transaction-details">
                      <h4>{transaction.type}</h4>
                      <p>{transaction.description || "Money movement"}</p>
                      <span>
                        {new Date(transaction.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      {transaction.reference && (
                        <small>Ref: {transaction.reference}</small>
                      )}
                    </div>

                    <div className="transaction-amount">
                      <h4 className={amountClass}>
                        {amountSign}{formatCurrency(Number(transaction.amountPaise || 0))}
                      </h4>
                      <span className={`transaction-status ${transaction.status?.toLowerCase()}`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </section>

      </main>

      {/* CREATE ACCOUNT MODAL */}
      {showCreateAccount && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!creating) setShowCreateAccount(false);
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-header">
              <div>
                <h2>Create New Account</h2>
                <p>Open a new Ledgerline customer account.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowCreateAccount(false)}
                disabled={creating}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-account-info">
              <div className="account-icon">
                <Wallet size={24} />
              </div>

              <div>
                <h3>Customer Account</h3>
                <p>Initial balance: ₹0.00</p>
              </div>
            </div>

            <div className="modal-actions">

              <button
                className="cancel-button"
                onClick={() => setShowCreateAccount(false)}
                disabled={creating}
              >
                Cancel
              </button>

              <button
                className="confirm-button"
                onClick={handleCreateAccount}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create Account"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {showDeposit && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!depositing) setShowDeposit(false);
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-header">
              <div>
                <h2>Deposit Money</h2>
                <p>Add money to your active account.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowDeposit(false)}
                disabled={depositing}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDeposit}>

              <div className="form-group">
                <label>Select Account</label>

                <select
                  value={depositAccountId}
                  onChange={(e) =>
                    setDepositAccountId(e.target.value)
                  }
                  required
                >
                  <option value="">Choose an account</option>

                  {activeAccounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Deposit Amount (₹)</label>

                <div className="amount-input-wrapper">
                  <IndianRupee size={18} />

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={depositAmount}
                    onChange={(e) =>
                      setDepositAmount(e.target.value)
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowDeposit(false)}
                  disabled={depositing}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="confirm-button"
                  disabled={depositing || activeAccounts.length === 0}
                >
                  {depositing ? "Processing..." : "Confirm Deposit"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWithdraw && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!withdrawing) setShowWithdraw(false);
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="modal-header">
              <div>
                <h2>Withdraw Money</h2>
                <p>Withdraw money from your active account.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowWithdraw(false)}
                disabled={withdrawing}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleWithdraw}>

              <div className="form-group">
                <label>Select Account</label>

                <select
                  value={withdrawAccountId}
                  onChange={(e) =>
                    setWithdrawAccountId(e.target.value)
                  }
                  required
                >
                  <option value="">Choose an account</option>

                  {activeAccounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.accountNumber} — Balance:{" "}
                      {formatCurrency(Number(account.balance || 0))}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Withdrawal Amount (₹)</label>

                <div className="amount-input-wrapper">
                  <IndianRupee size={18} />

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) =>
                      setWithdrawAmount(e.target.value)
                    }
                    required
                  />
                </div>
              </div>

              {withdrawAccountId && (
                <p className="withdraw-balance">
                  Available balance:{" "}
                  {formatCurrency(
                    Number(
                      accounts.find(
                        (account) => account.id === withdrawAccountId
                      )?.balance || 0
                    )
                  )}
                </p>
              )}

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowWithdraw(false)}
                  disabled={withdrawing}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="confirm-button"
                  disabled={withdrawing || activeAccounts.length === 0}
                >
                  {withdrawing
                    ? "Processing..."
                    : "Confirm Withdrawal"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}
      {/* TRANSFER MODAL */}
{showTransfer && (
  <div
    className="modal-overlay"
    onClick={() => {
      if (!transferring) setShowTransfer(false);
    }}
  >
    <div
      className="modal-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <div>
          <h2>Transfer Money</h2>
          <p>Transfer money to another active account.</p>
        </div>

        <button
          className="modal-close"
          onClick={() => setShowTransfer(false)}
          disabled={transferring}
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleTransfer}>
        <div className="form-group">
          <label>Source Account</label>

          <select
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
            required
          >
            <option value="">Select source account</option>

            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountNumber} — Balance:{" "}
                {formatCurrency(Number(account.balance || 0))}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Destination Account ID (UUID)</label>

          <input
            type="text"
            placeholder="Enter receiver's account UUID"
            value={destinationAccountId}
            onChange={(e) =>
              setDestinationAccountId(e.target.value.trim())
            }
            required
          />
        </div>

        <div className="form-group">
          <label>Transfer Amount (₹)</label>

          <div className="amount-input-wrapper">
            <IndianRupee size={18} />

            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Enter amount"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              required
            />
          </div>
        </div>

        {sourceAccountId && (
          <p className="withdraw-balance">
            Available balance:{" "}
            {formatCurrency(
              Number(
                accounts.find(
                  (account) => account.id === sourceAccountId
                )?.balance || 0
              )
            )}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={() => setShowTransfer(false)}
            disabled={transferring}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="confirm-button"
            disabled={transferring || activeAccounts.length === 0}
          >
            {transferring ? "Processing..." : "Confirm Transfer"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>
  );
}

export default Dashboard;