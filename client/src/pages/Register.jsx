import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const navigate = useNavigate();

  const handleSubmit = async (e) => {       
    e.preventDefault();         

    try {
      await axios.post("/api/register", form);

      alert("Registered successfully");
      navigate("/login");             
    } catch (err) {                 
      console.log(err);
      alert("Error registering");           

    }           
  };        

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-8 rounded-2xl w-96"
      >
        <h2 className="text-2xl mb-6 text-center">Register</h2>

        <input
          type="text"
          placeholder="Username"
          className="w-full mb-4 p-3 bg-gray-800"
          onChange={(e) =>
            setForm({ ...form, username: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-3 bg-gray-800"
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <button className="w-full bg-indigo-600 p-3 rounded">
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