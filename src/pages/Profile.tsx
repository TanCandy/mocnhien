import { useEffect, useRef, useState } from "react";
import { User, Mail, Phone, MapPin, Shield, Bell, LogOut, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearSession, getToken } from "../lib/auth";

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<{ name: string; email: string; role: string; phoneNumber?: string; primaryAddress?: string; createdAt: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Refs are stable across renders — they can NEVER cause useEffect to re-run.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // ✅ Runs exactly once on mount. No re-runs, no loop, no lag.
  useEffect(() => {
    const mounted = { current: true };

    const fetchProfile = async () => {
      const token = getToken();
      if (!token) {
        // No token → don't waste a request, just go to login.
        clearSession();
        if (mounted.current) {
          setError("Not authenticated.");
          setLoading(false);
        }
        navigateRef.current("/login", { replace: true });
        return;
      }

      try {
        const data = await api.get("/api/user/profile");
        if (!mounted.current) return;
        setProfile(data.user);
        setError("");
      } catch (err: any) {
        if (!mounted.current) return;
        console.error("[Profile] fetch failed:", err);
        setError(err?.message || "Unauthorized");
        // Token is invalid/expired — wipe it and bounce to login.
        clearSession();
        navigateRef.current("/login", { replace: true });
      } finally {
        // ✅ ALWAYS stop the spinner, success OR failure.
        if (mounted.current) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted.current = false;
    };
  }, []); // ⚠️ IMPORTANT — empty array, run once on mount

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // clear local session regardless
    }
    clearSession();
    navigate("/login");
  }

  // ✅ Show loading only once. If errored, show error + auto-redirect.
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 pb-24 pt-12 text-on-surface-variant">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-8 pb-24 pt-12 text-on-surface-variant">
        {error || "No profile data."}
      </div>
    );
  }

  const memberYear = new Date(profile.createdAt).getFullYear();

  return (
    <div className="max-w-4xl mx-auto px-8 pb-24">
      <section className="flex flex-col md:flex-row items-center gap-8 py-12 border-b border-outline-variant/20">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-primary-container/20 flex items-center justify-center border-4 border-white shadow-xl">
            <User className="w-16 h-16 text-primary" />
          </div>
          <button className="absolute bottom-0 right-0 bg-primary text-on-primary p-2 rounded-full shadow-lg">
            <Shield className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-4xl font-headline text-primary">{profile.name}</h1>
          <p className="text-on-surface-variant font-medium">Heritage Collector • Member since {memberYear}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
            <span className="bg-secondary-container text-on-secondary-container px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Gold Tier</span>
            <span className="bg-primary-container/20 text-on-primary-container px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Verified Identity</span>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-12 py-12">
        <section className="space-y-8">
          <h2 className="text-2xl font-headline text-primary">Personal Information</h2>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Mail className="text-primary w-5 h-5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline">Email Address</p>
                <p className="font-medium">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Phone className="text-primary w-5 h-5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline">Phone Number</p>
                <p className="font-medium">{profile.phoneNumber || "Not provided"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <MapPin className="text-primary w-5 h-5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline">Primary Address</p>
                <p className="font-medium">{profile.primaryAddress || "Not provided"}</p>
              </div>
            </div>
          </div>
          <button className="text-primary font-bold text-sm hover:underline flex items-center gap-2">
            Edit Profile Details
            <ChevronRight className="w-4 h-4" />
          </button>
        </section>

        <section className="space-y-8">
          <h2 className="text-2xl font-headline text-primary">Account Settings</h2>
          <div className="bg-surface-container-low rounded-[32px] overflow-hidden divide-y divide-outline-variant/10">
            <button className="w-full flex justify-between items-center p-6 hover:bg-surface-container-high transition-colors text-left">
              <div className="flex items-center gap-4">
                <Bell className="text-primary w-5 h-5" />
                <span className="font-medium">Notification Preferences</span>
              </div>
              <ChevronRight className="w-5 h-5 text-outline" />
            </button>
            <button className="w-full flex justify-between items-center p-6 hover:bg-surface-container-high transition-colors text-left">
              <div className="flex items-center gap-4">
                <Shield className="text-primary w-5 h-5" />
                <span className="font-medium">Security & Password</span>
              </div>
              <ChevronRight className="w-5 h-5 text-outline" />
            </button>
            <button onClick={handleLogout} className="w-full flex justify-between items-center p-6 hover:bg-surface-container-high transition-colors text-left text-red-600">
              <div className="flex items-center gap-4">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </div>
            </button>
          </div>
        </section>
      </div>

      <section className="bg-surface-container-low rounded-[40px] p-12 text-center space-y-6">
        <h2 className="text-3xl font-headline text-primary">Heritage Rewards</h2>
        <p className="text-on-surface-variant max-w-md mx-auto">
          You have <span className="text-primary font-bold">2,450 points</span> available. Redeem them for shipping discounts or premium packaging upgrades.
        </p>
        <button className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
          Explore Rewards Shop
        </button>
      </section>
    </div>
  );
}
