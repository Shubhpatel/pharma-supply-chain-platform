"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

const ALL_PERMISSIONS = [
  { id: "po", label: "Purchase Order (PO)" },
  { id: "grn", label: "GRN" },
  { id: "pr", label: "Purchase Return (Debit Note)" },
  { id: "invoice", label: "Sales Invoice" },
  { id: "sr", label: "Sales Return (Credit Note)" },
  { id: "inventory", label: "Inventory" },
  { id: "masters", label: "Masters (SKUs / Vendors / Customers)" },
  { id: "reports", label: "Reports" },
  { id: "users", label: "User Management (Admin)" },
];

const DEFAULT_ROLE_PERMISSIONS = {
  PURCHASE: ["po"],
  GRN: ["grn", "pr"],
  SALES: ["invoice", "sr"],
  ADMIN: ALL_PERMISSIONS.map((p) => p.id),
  CUSTOM: [],
};

export default function UsersPage() {
  const router = useRouter();
  const { user, token, showToast } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
    permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN" || user?.permissions?.includes("users");

  useEffect(() => {
    if (!token) return;
    if (!isAdmin) {
      showToast("Access denied: Admin permission required", "error");
      router.push("/");
      return;
    }
    loadUsers();
  }, [token, isAdmin]);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.listUsers(token);
      setUsers(data.users || []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleRoleChange(role) {
    let perms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    if (role === "CUSTOM") {
      perms = form.permissions || [];
    }
    setForm((f) => ({ ...f, role, permissions: perms }));
  }

  function handlePermissionToggle(permId) {
    setForm((f) => {
      const current = f.permissions || [];
      const exists = current.includes(permId);
      const updated = exists ? current.filter((p) => p !== permId) : [...current, permId];
      return {
        ...f,
        role: "CUSTOM",
        permissions: updated,
      };
    });
  }

  function openCreateModal() {
    setEditingUser(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role: "ADMIN",
      permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN,
    });
    setError("");
    setShowModal(true);
  }

  function openEditModal(u) {
    setEditingUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role || "ADMIN",
      permissions: u.permissions || [],
    });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (editingUser) {
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role,
          permissions: form.permissions,
        };
        if (form.password) payload.password = form.password;
        await api.updateUser(editingUser._id, payload, token);
        showToast("User updated successfully");
      } else {
        await api.createUser(form, token);
        showToast("User created successfully");
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Are you sure you want to delete user ${u.name}?`)) return;
    try {
      await api.deleteUser(u._id, token);
      showToast("User deleted successfully");
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Add users and edit their role-based or custom permissions.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Add User
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading users...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                      {u.role || "ADMIN"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {u.role === "ADMIN" ? (
                      <span className="font-medium text-gray-800">All Permissions</span>
                    ) : (
                      (u.permissions || []).join(", ") || "None"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="text-teal-700 hover:text-teal-900 font-medium"
                    >
                      Edit
                    </button>
                    {user?.id !== u._id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingUser ? "Edit User Permissions" : "Add New User"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser && "(leave blank to keep unchanged)"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-700 bg-white"
                >
                  <option value="ADMIN">ADMIN (All Access)</option>
                  <option value="PURCHASE">PURCHASE (PO Access)</option>
                  <option value="GRN">GRN (GRN & PR Access)</option>
                  <option value="SALES">SALES (Invoice & SR Access)</option>
                  <option value="CUSTOM">CUSTOM (Granular Permissions)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2 border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form.permissions || []).includes(perm.id)}
                        disabled={form.role === "ADMIN"}
                        onChange={() => handlePermissionToggle(perm.id)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingUser ? "Update User" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
