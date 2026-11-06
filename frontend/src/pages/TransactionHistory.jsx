import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, LayoutDashboard, CreditCard, ArrowLeftRight, History,
  User, LogOut, Search, RefreshCw, ArrowDownLeft, ArrowUpRight, CalendarDays
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "../styles/Dashboard.css";

const PAGE_SIZE = 10;

function TransactionHistory() {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/transactions/history", {
        params: { page: 1, limit: 100 }
      });
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load transaction history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const searchFields = [
        tx.reference, tx.description, tx.type,
        tx.sourceAccount?.accountNumber, tx.destinationAccount?.accountNumber
      ].filter(Boolean);
      const matchesSearch = !query || searchFields.some((value) =>
        String(value).toLowerCase().includes(query)
      );
      const matchesType = type === "ALL" || tx.type === type;
      const date = new Date(tx.createdAt);
      const matchesFrom = !fromDate || date >= new Date(`${fromDate}T00:00:00`);
      const matchesTo = !toDate || date < new Date(`${toDate}T23:59:59.999`);
      return matchesSearch && matchesType && matchesFrom && matchesTo;
    });
  }, [transactions, search, type, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const formatCurrency = (paise) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(paise || 0) / 100);

  const clearFilters = () => {
    setSearch(""); setType("ALL"); setFromDate(""); setToDate(""); setPage(1);
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo"><Wallet size={25} /></div>
          <h2>Ledgerline</h2>
        </div>
        <p className="sidebar-label">MENU</p>
        <nav className="sidebar-nav">
          <Link to="/dashboard" className="nav-item"><LayoutDashboard size={19} /> Dashboard</Link>
          <Link to="/dashboard#accounts" className="nav-item"><CreditCard size={19} /> My Accounts</Link>
          <Link to="/dashboard#transactions" className="nav-item"><ArrowLeftRight size={19} /> Transactions</Link>
          <Link to="/transactions/history" className="nav-item active"><History size={19} /> History</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar"><User size={20} /></div>
            <div className="user-details"><h4>{user?.name}</h4><span>Account Holder</span></div>
          </div>
          <button className="logout-button" onClick={logout}><LogOut size={18} /> Logout</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Transaction History</h1>
            <p>Search, filter and review your money movements.</p>
          </div>
          <button className="add-account-button" onClick={fetchTransactions} disabled={loading}>
            <RefreshCw size={16} /> {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        <section className="history-summary">
          <div><span>Total matching transactions</span><strong>{filtered.length}</strong></div>
          <div><span>Current page</span><strong>{currentPage} / {totalPages}</strong></div>
        </section>

        <section className="history-filters">
          <label className="history-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search reference, description or account..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </label>
          <label>
            <span>Transaction type</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="ALL">All types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </label>
          <label>
            <span>From date</span>
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" min={fromDate || undefined} value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </label>
          <button type="button" className="history-clear-button" onClick={clearFilters}>Clear filters</button>
        </section>

        {error && <div className="error-message">{error}</div>}
        {loading ? (
          <p className="status-message">Loading transaction history...</p>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <History size={35} /><h3>No matching transactions</h3>
            <p>Try changing your search or filters.</p>
          </div>
        ) : (
          <section className="transaction-list history-list">
            {visible.map((tx) => (
              <article className="transaction-item" key={tx.id}>
                <div className={`transaction-icon ${tx.type?.toLowerCase()}`}>
                  {tx.type === "DEPOSIT" ? <ArrowDownLeft size={21} /> :
                    tx.type === "WITHDRAWAL" ? <ArrowUpRight size={21} /> :
                    <ArrowLeftRight size={21} />}
                </div>
                <div className="transaction-details">
                  <h4>{tx.type}</h4>
                  <p>{tx.description || "Money movement"}</p>
                  <span><CalendarDays size={13} /> {new Date(tx.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium", timeStyle: "short"
                  })}</span>
                  {tx.reference && <small>Reference: {tx.reference}</small>}
                  {(tx.sourceAccount || tx.destinationAccount) && (
                    <small>
                      {tx.sourceAccount?.accountNumber || "External"} → {tx.destinationAccount?.accountNumber || "External"}
                    </small>
                  )}
                </div>
                <div className="transaction-amount">
                  <h4>{formatCurrency(tx.amountPaise)}</h4>
                  <span className={`transaction-status ${tx.status?.toLowerCase()}`}>{tx.status}</span>
                </div>
              </article>
            ))}
          </section>
        )}

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="history-pagination">
            <button className="cancel-button" disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}>Previous</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button className="confirm-button" disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>Next</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default TransactionHistory;
