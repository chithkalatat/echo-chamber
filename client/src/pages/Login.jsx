import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
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
          placeholder="Username"
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

        <button className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded">
          Login
        </button>

        <p className="text-center mt-4 text-gray-400">
          Don't have an account?{" "}
          <Link to="/register" className="text-indigo-400 hover:underline">
            Go to Register
          </Link>
        </p>
      </form>
    </div>
  );
}