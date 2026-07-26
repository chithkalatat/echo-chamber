import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1=email, 2=code, 3=new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/forgot-password", { email });
      // In dev mode, the API returns the code for testing
      if (res.data.code) {
        setSentCode(res.data.code);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/verify-reset-code", { email, code });
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/reset-password", {
        resetToken,
        newPassword,
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-xl w-96">
        <h2 className="text-2xl mb-2 text-center font-bold">Reset Password</h2>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-1 rounded-full transition-colors ${
                s <= step ? "bg-indigo-500" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-100 p-3 rounded mb-4 text-sm text-center">
            {success}
          </div>
        )}

        {/* Step 1: Enter email */}
        {step === 1 && (
          <form onSubmit={handleSendCode}>
            <p className="text-gray-400 text-sm text-center mb-4">
              Enter the email associated with your account.
            </p>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-4 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              autoFocus
              required
            />
            <button
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 p-3 rounded font-semibold transition-colors"
            >
              {loading ? "Sending…" : "Send Reset Code"}
            </button>
          </form>
        )}

        {/* Step 2: Enter verification code */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            <p className="text-gray-400 text-sm text-center mb-4">
              Enter the 6-digit code sent to <strong className="text-white">{email}</strong>
            </p>
            {sentCode && (
              <div className="bg-yellow-500/10 border border-yellow-600 text-yellow-200 p-3 rounded mb-4 text-sm text-center">
                <span className="text-xs text-yellow-400 block mb-1">Dev Mode — Your code:</span>
                <span className="text-2xl font-mono font-bold tracking-widest">{sentCode}</span>
              </div>
            )}
            <input
              type="text"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full mb-4 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center text-lg tracking-widest font-mono"
              maxLength={6}
              autoFocus
              required
            />
            <button
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 p-3 rounded font-semibold transition-colors"
            >
              {loading ? "Verifying…" : "Verify Code"}
            </button>
          </form>
        )}

        {/* Step 3: Set new password */}
        {step === 3 && !success && (
          <form onSubmit={handleResetPassword}>
            <p className="text-gray-400 text-sm text-center mb-4">
              Choose a new password for your account.
            </p>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full mb-4 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              autoFocus
              required
              minLength={6}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full mb-4 p-3 rounded bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              required
              minLength={6}
            />
            <button
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 p-3 rounded font-semibold transition-colors"
            >
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-gray-400 text-sm">
          <Link to="/login" className="text-indigo-400 hover:underline">
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
