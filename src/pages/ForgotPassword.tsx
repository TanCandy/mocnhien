import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/api/auth/forgot-password", { email: trimmed });
      setSuccess(
        data?.message ||
          "If an account with that email exists, a password reset link has been sent."
      );
      setEmail(""); // clear the field after success
    } catch (err: any) {
      console.error("[ForgotPassword] Error:", err?.message);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-headline text-primary mb-2">Forgot password</h1>
      <p className="text-on-surface-variant mb-8">
        Enter the email address tied to your account and we'll send you a link to reset your password.
      </p>

      <form
        onSubmit={onSubmit}
        className="bg-surface-container-low p-8 rounded-[20px] space-y-4"
      >
        <input
          type="email"
          required
          autoComplete="email"
          className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary rounded-full py-3 font-bold disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send reset link"}
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
