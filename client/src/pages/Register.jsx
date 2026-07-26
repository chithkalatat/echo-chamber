import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.email.includes("@")) {
      setError("A valid email is required");
      return;
    }

    try {
      await axios.post("/api/register", form);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Error registering");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-2xl shadow-xl w-96"
      >
        <h2 className="text-2xl mb-6 text-center font-bold">Register</h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          className="w-full mb-4 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          onChange={(e) =>
            setForm({ ...form, username: e.target.value })
          }
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <button className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded font-semibold transition-colors">
          Register
        </button>

        <p className="text-center mt-4 text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-400 hover:underline">
            Go to Login
          </Link>
        </p>
      </form>
    </div>
  );
}