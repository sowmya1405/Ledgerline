import { useAuth } from "../context/AuthContext";
import { Copy, UserCircle } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  const copyUserId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      alert("User ID copied successfully!");
    } catch {
      alert("Unable to copy User ID.");
    }
  };

  if (!user) {
    return <p>Please log in to view your profile.</p>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <UserCircle size={35} />
        <h1 className="text-3xl font-bold">My Profile</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
        <div className="mb-5">
          <p className="text-gray-500">Full Name</p>
          <h2 className="font-semibold text-lg">{user.name}</h2>
        </div>

        <div className="mb-5">
          <p className="text-gray-500">Email Address</p>
          <h2 className="font-semibold text-lg">{user.email}</h2>
        </div>

        <div className="mb-5">
          <p className="text-gray-500">Account Role</p>
          <h2 className="font-semibold text-lg">{user.role}</h2>
        </div>

        <div>
          <p className="text-gray-500 mb-2">Your User ID (UUID)</p>

          <div className="flex items-center gap-3 flex-wrap">
            <code className="bg-gray-100 p-3 rounded-lg break-all">
              {user.id}
            </code>

            <button
              onClick={copyUserId}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Copy size={16} />
              Copy ID
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}