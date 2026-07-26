import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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
      .then((res) => setProfile(res.data))
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

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

        {/* Details */}
        <div className="space-y-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Username
            </label>
            <p className="text-white mt-1 font-medium">{profile?.username}</p>
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
