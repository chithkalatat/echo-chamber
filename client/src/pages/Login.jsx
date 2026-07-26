import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("token", token);
      navigate("/chat", { replace: true });
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("/api/login", form);
      localStorage.setItem("token", res.data.token);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred during login");
    }
  };

  const API_URL = import.meta.env.VITE_BACKEND_URL || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-2xl shadow-xl w-96"
      >
        <h2 className="text-2xl mb-6 text-center font-bold">
          Login
        </h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Username or email"
          className="w-full mb-4 p-3 rounded bg-gray-800"
          onChange={(e) =>
            setForm({ ...form, username: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 rounded bg-gray-800"
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <button className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded mb-2 font-semibold transition-colors">
          Login
        </button>

        <p className="text-right mb-4">
          <Link to="/forgot-password" className="text-indigo-400 hover:underline text-sm">
            Forgot password?
          </Link>
        </p>

        <div className="relative flex items-center justify-center mb-4">
          <div className="border-t border-gray-700 w-full absolute"></div>
          <span className="bg-gray-900 px-2 text-xs text-gray-500 relative z-10 uppercase tracking-widest">or</span>
        </div>

        <a 
          href={`${API_URL}/api/auth/google`}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 p-3 rounded flex items-center justify-center gap-2 font-semibold transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
          Continue with Google
        </a>

        <p className="text-center mt-6 text-gray-400">
          Don't have an account?{" "}
          <Link to="/register" className="text-indigo-400 hover:underline">
            Go to Register
          </Link>
        </p>
      </form>
    </div>
  );
}