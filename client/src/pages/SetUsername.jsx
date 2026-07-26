import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

export default function SetUsername() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const setupToken = params.get("setup_token");

  useEffect(() => {
    if (!setupToken) {
      navigate("/login", { replace: true });
    }
  }, [setupToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      setError("Username must be 3-30 characters");
      return;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
      setError("Only letters, numbers, dots, and underscores allowed");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/set-username", {
        setupToken,
        username: trimmed,
      });
      localStorage.setItem("token", res.data.token);
      navigate("/chat", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-2xl shadow-xl w-96"
      >
        <h2 className="text-2xl mb-2 text-center font-bold">
          Choose your username
        </h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          This is how other users will find and message you.
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="e.g. john.doe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-6 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          autoFocus
          maxLength={30}
        />

        <button
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 p-3 rounded font-semibold transition-colors"
        >
          {loading ? "Creating account…" : "Continue"}
        </button>

        <p className="text-center mt-4 text-gray-500 text-xs">
          Letters, numbers, dots, and underscores only. 3-30 characters.
        </p>
      </form>
    </div>
  );
}
