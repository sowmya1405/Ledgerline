import { useParams } from "react-router-dom";
import { Copy, UserCircle } from "lucide-react";

export default function PublicUser() {
  const { id } = useParams();

  const copyUserId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      alert("User ID copied successfully!");
    } catch {
      alert("Unable to copy User ID.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f6fb",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "35px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "420px",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <UserCircle size={55} color="#2563eb" />

        <h1 style={{ margin: "15px 0 8px" }}>Ledgerline User</h1>

        <p style={{ color: "#666" }}>
          Public User ID
        </p>

        <code
          style={{
            display: "block",
            background: "#f1f5f9",
            padding: "15px",
            borderRadius: "8px",
            overflowWrap: "anywhere",
            margin: "20px 0",
          }}
        >
          {id}
        </code>

        <button
          onClick={copyUserId}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <Copy size={15} style={{ verticalAlign: "middle" }} /> Copy User ID
        </button>

        <p style={{ color: "#888", fontSize: "12px", marginTop: "20px" }}>
          Shared through Ledgerline QR Code.
        </p>
      </div>
    </div>
  );
}