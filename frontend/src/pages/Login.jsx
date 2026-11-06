import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Wallet, ArrowRight } from "lucide-react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const result = await login(email, password);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon">
            <Wallet size={28} />
          </div>
          <h1>Ledgerline</h1>
          <p>Smart money movement. Complete transparency.</p>
        </div>

        <div className="auth-heading">
          <h2>Welcome back</h2>
          <p>Sign in to access your account.</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;