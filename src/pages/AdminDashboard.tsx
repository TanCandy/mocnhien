import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useUser } from "../context/UserContext";

interface UserItem {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

export default function AdminDashboard() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadUsers() {
    try {
      const data = await api.get("/api/user");
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await api.post("/api/user", { name, email, password, role, phoneNumber, primaryAddress });
      setName("");
      setEmail("");
      setPassword("");
      setPhoneNumber("");
      setPrimaryAddress("");
      setRole("user");
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleRole(u: UserItem) {
    const id = u._id || u.id;
    if (!id) return;
    if (currentUser?.email === u.email && u.role === "admin") {
      setError("Bạn không thể tự hạ quyền quản trị viên của chính mình.");
      return;
    }
    setError("");
    try {
      await api.patch(`/api/user/${id}`, { role: u.role === "admin" ? "user" : "admin" });
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    }
  }

  async function deleteUser(u: UserItem) {
    const id = u._id || u.id;
    if (!id) return;
    if (currentUser?.email === u.email) {
      setError("Bạn không thể xóa tài khoản của chính mình.");
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${u.name || u.email}" không?`)) {
      return;
    }
    setError("");
    try {
      await api.delete(`/api/user/${id}`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-8 pb-20 space-y-10">
      <h1 className="text-4xl font-headline text-primary pt-10">Admin Dashboard</h1>
      <form onSubmit={createUser} className="bg-surface-container-low p-6 rounded-[20px] grid md:grid-cols-4 gap-3">
        <input className="bg-surface-container-lowest rounded-full px-4 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="bg-surface-container-lowest rounded-full px-4 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="bg-surface-container-lowest rounded-full px-4 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="bg-surface-container-lowest rounded-full px-4 py-2" placeholder="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        <input className="bg-surface-container-lowest rounded-full px-4 py-2 md:col-span-2" placeholder="Primary Address" value={primaryAddress} onChange={(e) => setPrimaryAddress(e.target.value)} />
        <select className="bg-surface-container-lowest rounded-full px-4 py-2" value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button disabled={isSubmitting} className="bg-primary text-on-primary rounded-full px-4 py-2 font-bold disabled:opacity-50">
          {isSubmitting ? "Creating…" : "Create"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-surface-container-low rounded-[20px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left bg-surface-container-high/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = currentUser?.email === u.email;
              return (
                <tr key={u._id || u.id} className="border-t border-outline-variant/20">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      disabled={isSelf}
                      className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container disabled:opacity-40"
                      onClick={() => toggleRole(u)}
                      title={isSelf ? "Không thể tự đổi quyền của chính mình" : ""}
                    >
                      Toggle Role
                    </button>
                    <button
                      disabled={isSelf}
                      className="px-3 py-1 rounded-full bg-red-100 text-red-700 disabled:opacity-40"
                      onClick={() => deleteUser(u)}
                      title={isSelf ? "Không thể tự xóa tài khoản của chính mình" : ""}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

