import { useAuth } from "../context/AuthContext";

function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <main
      style={{
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div>
          <h1>Ledgerline Admin</h1>
          <p>Welcome, {user?.name || "Administrator"}</p>
        </div>

        <button type="button" onClick={logout}>
          Logout
        </button>
      </header>

      <section style={{ marginTop: "32px" }}>
        <h2>Admin Dashboard</h2>

        <p>
          Your administrator access is working successfully.
        </p>

        <p>
          Customer account management and audit log features
          will be added next.
        </p>
      </section>
    </main>
  );
}

export default AdminDashboard;