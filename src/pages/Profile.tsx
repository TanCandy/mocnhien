import { useEffect, useRef, useState } from "react";
import { User, Mail, Phone, MapPin, Shield, Bell, LogOut, ChevronRight, Loader2, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearSession, getToken } from "../lib/auth";
import { SuccessModal } from "../components/Toast";

interface ProfileData {
  _id: string;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string;
  primaryAddress?: string;
  createdAt: string;
}

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ email: "", phoneNumber: "", primaryAddress: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successData, setSuccessData] = useState<{ title: string; message: string } | null>(null);

  // Refs are stable across renders — they can NEVER cause useEffect to re-run.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Fetch user profile from backend
  useEffect(() => {
    const mounted = { current: true };

    const fetchProfile = async () => {
      const token = getToken();
      if (!token) {
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
        setFormData({
          email: data.user.email || "",
          phoneNumber: data.user.phoneNumber || "",
          primaryAddress: data.user.primaryAddress || "",
        });
        setError("");
      } catch (err: any) {
        if (!mounted.current) return;
        console.error("[Profile] fetch failed:", err);
        setError(err?.message || "Unauthorized");
        clearSession();
        navigateRef.current("/login", { replace: true });
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted.current = false;
    };
  }, []);

  function startEditing() {
    if (!profile) return;
    setFormData({
      email: profile.email || "",
      phoneNumber: profile.phoneNumber || "",
      primaryAddress: profile.primaryAddress || "",
    });
    setSaveError("");
    setIsEditing(true);
  }

  function cancelEditing() {
    if (!profile) return;
    setFormData({
      email: profile.email || "",
      phoneNumber: profile.phoneNumber || "",
      primaryAddress: profile.primaryAddress || "",
    });
    setSaveError("");
    setIsEditing(false);
  }

  async function handleSave() {
    if (!profile) return;

    // Basic client-side validation
    if (!formData.email.trim()) {
      setSaveError("Email address is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setSaveError("Please enter a valid email address.");
      return;
    }

    setSaveError("");
    setIsSaving(true);

    try {
      const updated = await api.put("/api/user/profile", {
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        primaryAddress: formData.primaryAddress.trim(),
      });

      setProfile(updated.user);
      setIsEditing(false);
      setSuccessData({
        title: "Profile Updated",
        message: "Your profile details have been saved successfully.",
      });
    } catch (err: any) {
      console.error("[Profile] save failed:", err);
      setSaveError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // clear local session regardless
    }
    clearSession();
    navigate("/login");
  }

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
      {successData && (
        <SuccessModal
          title={successData.title}
          message={successData.message}
          onClose={() => setSuccessData(null)}
        />
      )}

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

          {isEditing ? (
            /* ── Edit Mode ── */
            <div className="space-y-5">
              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-outline flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-surface-container-low rounded-2xl px-5 py-3 text-on-surface border border-outline/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-outline flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="Enter your phone number"
                  className="w-full bg-surface-container-low rounded-2xl px-5 py-3 text-on-surface border border-outline/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50"
                />
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-outline flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Primary Address
                </label>
                <input
                  type="text"
                  value={formData.primaryAddress}
                  onChange={(e) => setFormData({ ...formData, primaryAddress: e.target.value })}
                  placeholder="Enter your address"
                  className="w-full bg-surface-container-low rounded-2xl px-5 py-3 text-on-surface border border-outline/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50"
                />
              </div>

              {/* Error message */}
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  {saveError}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-primary text-on-primary py-3 rounded-full font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="px-5 py-3 rounded-full font-bold border border-outline/30 text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
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

              <button
                onClick={startEditing}
                className="text-primary font-bold text-sm hover:underline flex items-center gap-2 mt-2"
              >
                Edit Profile Details
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
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
