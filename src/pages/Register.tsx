import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setSessionUser, setToken } from "../lib/auth";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneRegex = /^[\d\s\-+()]{8,15}$/;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!phoneRegex.test(phoneNumber.trim())) {
      setError("Please enter a valid phone number (e.g., +84 123 456 789).");
      return;
    }
    if (!primaryAddress.trim()) {
      setError("Primary address is required.");
      return;
    }

    setLoading(true);
    console.log("[Register] Submitting registration for:", email);
    try {
      const data = await api.post("/api/auth/register", { name, email, password, phoneNumber, primaryAddress, role: "user" });
      console.log("[Register] Success:", data.user);
      setToken(data.token);
      setSessionUser(data.user);
      navigate("/profile");
    } catch (err: any) {
      console.error("[Register] Error:", err.message);
      setError(err.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-16">
      <h1 className="text-4xl font-headline text-primary mb-8">Create Account</h1>
      <form onSubmit={onSubmit} className="bg-surface-container-low p-8 rounded-[20px] space-y-4">
        <input className="w-full bg-surface-container-lowest rounded-full px-6 py-3" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full bg-surface-container-lowest rounded-full px-6 py-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full bg-surface-container-lowest rounded-full px-6 py-3" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="w-full bg-surface-container-lowest rounded-full px-6 py-3" placeholder="Phone Number (e.g., +84 123 456 789)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        <input className="w-full bg-surface-container-lowest rounded-full px-6 py-3" placeholder="Primary Address" value={primaryAddress} onChange={(e) => setPrimaryAddress(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full bg-primary text-on-primary rounded-full py-3 font-bold">{loading ? "Creating..." : "Register"}</button>
      </form>
      <p className="mt-4 text-sm text-on-surface-variant">
        Already have an account? <Link to="/login" className="text-primary font-bold">Login</Link>
      </p>
    </div>
  );
}
