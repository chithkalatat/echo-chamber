import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setProfile(res.data);
        setNewUsername(res.data.username);
      })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const token = localStorage.getItem("token");

    const trimmed = newUsername.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      setError("Username must be 3-30 characters");
      return;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
      setError("Only letters, numbers, dots, and underscores allowed");
      return;
    }

    try {
      const res = await axios.post(
        "/api/auth/update-username",
        { username: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.setItem("token", res.data.token);
      setProfile((prev) => ({ ...prev, username: res.data.username }));
      setSuccessMsg("Username updated successfully!");
      setEditMode(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update username");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-xl w-[440px]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {profile?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.username}</h2>
            <p className="text-gray-400 text-sm">
              {profile?.googleLinked ? "Google Account" : "Email Account"}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-500/20 border border-green-500 text-green-100 p-3 rounded mb-4 text-sm text-center">
            {successMsg}
          </div>
        )}

        {/* Details */}
        <div className="space-y-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <label className="text-xs text-gray-500 uppercase tracking-wider">
                Username
              </label>
              <button
                onClick={() => {
                  setEditMode(!editMode);
                  setError("");
                  setSuccessMsg("");
                  if (profile) setNewUsername(profile.username);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                {editMode ? "Cancel" : "Edit"}
              </button>
            </div>
            {editMode ? (
              <form onSubmit={handleUpdateUsername} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="flex-1 bg-gray-700 text-white text-sm px-3 py-1.5 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={30}
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition-colors"
                >
                  Save
                </button>
              </form>
            ) : (
              <p className="text-white mt-1 font-medium">{profile?.username}</p>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Email
            </label>
            <p className="text-white mt-1 font-medium">
              {profile?.email || (
                <span className="text-gray-500 italic">Not set</span>
              )}
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Account Type
            </label>
            <p className="text-white mt-1 font-medium flex items-center gap-2">
              {profile?.googleLinked ? (
                <>
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-4 h-4"
                  />
                  Linked with Google
                </>
              ) : (
                "Password-based"
              )}
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Member Since
            </label>
            <p className="text-white mt-1 font-medium">
              {formatDate(profile?.createdAt)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/chat")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded font-semibold transition-colors"
          >
            ← Back to Chats
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login");
            }}
            className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-600 text-red-400 p-3 rounded font-semibold transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
