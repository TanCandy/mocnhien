import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { setToken, setSessionUser } from "../lib/auth";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Reset token is missing. Please request a new password reset link.");
      return;
    }

    const trimmed = password.trim();
    if (!trimmed) {
      setError("Please enter a new password.");
      return;
    }
    if (trimmed.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (trimmed !== confirm.trim()) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/api/reset-password", { token, newPassword: trimmed });

      // Backend auto-logs the user in — persist token + user so the app is
      // immediately authenticated after redirect
      if (data.token) setToken(data.token);
      if (data.user) setSessionUser(data.user);

      navigate("/login", { replace: true });
    } catch (err: any) {
      console.error("[ResetPassword] Error:", err?.message);
      setError(
        err?.message ||
          "Failed to reset password. The link may have expired — please request a new one."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-headline text-primary mb-4">Invalid link</h1>
        <p className="text-on-surface-variant mb-8">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="inline-block bg-primary text-on-primary rounded-full px-8 py-3 font-bold"
        >
          Request new reset link
        </Link>
        <p className="mt-4 text-sm text-on-surface-variant">
          <Link to="/login" className="text-primary font-bold">
            Back to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-headline text-primary mb-2">Set new password</h1>
      <p className="text-on-surface-variant mb-8">
        Choose a strong password you haven't used before.
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-surface-container-low p-8 rounded-[20px] space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
            New password
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
            Confirm password
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary rounded-full py-3 font-bold disabled:opacity-60"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <p className="mt-4 text-sm text-on-surface-variant">
        Remembered your password?{" "}
        <Link to="/login" className="text-primary font-bold">
          Back to login
        </Link>
      </p>
    </div>
  );
}
