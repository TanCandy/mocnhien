import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { getToken, getRoleFromToken, setSessionUser, setToken } from "../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const role = getRoleFromToken(token);
    navigate(role === "admin" ? "/admin/dashboard" : "/profile", { replace: true });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    console.log("[Login] Submitting login for:", email);
    try {
      const data = await api.post("/api/auth/login", { email, password });
      console.log("[Login] Success:", data.user);
      setToken(data.token);
      setSessionUser(data.user);
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/profile");
    } catch (err: any) {
      console.error("[Login] Error:", err.message);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-headline text-primary mb-8">Login</h1>
      <form onSubmit={onSubmit} className="bg-surface-container-low p-8 rounded-[20px] space-y-4">
        <input
          className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="space-y-1">
          <input
            className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Forgot password link — directly under the password input */}
          <div className="flex justify-end px-2 pt-1">
            <Link
              to="/forgot-password"
              className="text-sm text-primary font-medium hover:underline focus:outline-none focus:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div className="space-y-1">
            <p className="text-sm text-red-600">{error}</p>
            {/* On failed login, also surface the Forgot password link right under the error */}
            <p className="text-sm text-on-surface-variant">
              <Link
                to="/forgot-password"
                className="text-primary font-bold hover:underline focus:outline-none focus:underline"
              >
                Forgot password?
              </Link>
            </p>
          </div>
        )}

        <button
          disabled={loading}
          className="w-full bg-primary text-on-primary rounded-full py-3 font-bold disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="mt-4 text-sm text-on-surface-variant">
        No account?{" "}
        <Link to="/register" className="text-primary font-bold">
          Register
        </Link>
      </p>
    </div>
  );
}
