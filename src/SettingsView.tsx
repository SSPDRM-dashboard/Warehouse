import React, { useState } from "react";
import {
  ShieldCheck,
  Plus,
  X,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Lock,
  User,
  Check,
  Package,
  Layers,
  Truck,
  Wrench,
  KeyRound,
  LayoutDashboard,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  History,
  FileSpreadsheet,
  Sparkles,
  RotateCcw,
  Sliders,
  Users as UsersIcon,
  CheckSquare,
  Square,
  AlertCircle
} from "lucide-react";
import {
  UserAccount,
  Role,
  Page,
  RolePermissions,
  AVAILABLE_PANELS,
  DEFAULT_ROLE_PERMISSIONS
} from "./types";

interface SettingsViewProps {
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  canManage: boolean;
  rolePermissions: RolePermissions;
  setRolePermissions: React.Dispatch<React.SetStateAction<RolePermissions>>;
  currentUser?: UserAccount | null;
}

export function SettingsView({
  users,
  setUsers,
  canManage,
  rolePermissions,
  setRolePermissions,
  currentUser,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"roles" | "users">("roles");
  const [selectedRole, setSelectedRole] = useState<Role>("Receiving");

  // User edit / add state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("Receiving");

  const [isAdding, setIsAdding] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("Receiving");

  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Roles available for permission assignment
  const configurableRoles: { role: Role; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    {
      role: "Receiving",
      label: "1. Receiving",
      desc: "Container intake, temporary staged receiving, part key-in & inbound reports",
      icon: <Package size={18} className="text-blue-600" />,
      color: "blue",
    },
    {
      role: "Storage",
      label: "2. Storage",
      desc: "Inventory balance, bin & racking allocation, item lookup & stock returns",
      icon: <Layers size={18} className="text-emerald-600" />,
      color: "emerald",
    },
    {
      role: "Forklift",
      label: "3. Forklift",
      desc: "In-transit dock transfer, unpacking station staging & material transport",
      icon: <Truck size={18} className="text-amber-600" />,
      color: "amber",
    },
    {
      role: "Kitting",
      label: "4. Kitting",
      desc: "Production line parts issuance, kit staging, excess returns & BOM tracking",
      icon: <Wrench size={18} className="text-indigo-600" />,
      color: "indigo",
    },
    {
      role: "Manager",
      label: "Warehouse Manager",
      desc: "Operational monitoring, daily incoming reports & inventory auditing",
      icon: <ShieldCheck size={18} className="text-cyan-600" />,
      color: "cyan",
    },
    {
      role: "User",
      label: "Floor Operator",
      desc: "Basic operator terminal for item lookup and stock checks",
      icon: <KeyRound size={18} className="text-slate-600" />,
      color: "slate",
    },
  ];

  // Helper to toggle a single panel for a role
  const handleTogglePanel = (role: Role, pageId: Page) => {
    if (role === "Admin") return; // Admin always has full access

    const currentAllowed = rolePermissions[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    const isAllowed = currentAllowed.includes(pageId);

    const updated = isAllowed
      ? currentAllowed.filter((p) => p !== pageId)
      : [...currentAllowed, pageId];

    const newPerms = {
      ...rolePermissions,
      [role]: updated,
    };

    setRolePermissions(newPerms);
    setNotice({
      msg: `Updated panel access for role "${role}". Changes apply immediately to navigation.`,
      type: "success",
    });
  };

  const handleGrantAll = (role: Role) => {
    if (role === "Admin") return;
    const allPageIds = AVAILABLE_PANELS.map((p) => p.id);
    setRolePermissions({
      ...rolePermissions,
      [role]: allPageIds,
    });
    setNotice({ msg: `Granted access to all panels for role "${role}".`, type: "success" });
  };

  const handleClearAll = (role: Role) => {
    if (role === "Admin") return;
    setRolePermissions({
      ...rolePermissions,
      [role]: ["dashboard"], // Keep at least dashboard
    });
    setNotice({ msg: `Cleared panel access for role "${role}" (retained Dashboard).`, type: "success" });
  };

  const handleResetDefaults = (role: Role) => {
    setRolePermissions({
      ...rolePermissions,
      [role]: DEFAULT_ROLE_PERMISSIONS[role] || ["dashboard"],
    });
    setNotice({ msg: `Reset panel access for role "${role}" to standard defaults.`, type: "success" });
  };

  // User management
  const startEdit = (user: UserAccount) => {
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditPassword(user.password);
    setEditName(user.name);
    setEditRole(user.role);
    setNotice(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUsername.trim() || !editPassword.trim()) {
      setNotice({ msg: "Username and password cannot be blank.", type: "error" });
      return;
    }
    const duplicate = users.some(
      (u) => u.id !== editingUserId && u.username.toLowerCase() === editUsername.trim().toLowerCase()
    );
    if (duplicate) {
      setNotice({ msg: `Username "${editUsername.trim()}" is already in use by another account.`, type: "error" });
      return;
    }

    setUsers(
      users.map((u) =>
        u.id === editingUserId
          ? {
              ...u,
              username: editUsername.trim(),
              password: editPassword.trim(),
              name: editName.trim() || editUsername.trim(),
              role: editRole,
            }
          : u
      )
    );
    setEditingUserId(null);
    setNotice({ msg: `Account "${editUsername.trim()}" updated successfully with role "${editRole}".`, type: "success" });
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setNotice({ msg: "Please specify both username and password.", type: "error" });
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      setNotice({ msg: `Username "${newUsername.trim()}" already exists.`, type: "error" });
      return;
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      username: newUsername.trim(),
      password: newPassword.trim(),
      name: newName.trim() || newUsername.trim(),
      role: newRole,
    };
    setUsers([...users, newUser]);
    setIsAdding(false);
    setNewUsername("");
    setNewPassword("");
    setNewName("");
    setNewRole("Receiving");
    setNotice({ msg: `New user account "${newUser.username}" created with role "${newUser.role}".`, type: "success" });
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (users.length <= 1) {
      setNotice({ msg: "Cannot remove the only remaining user account.", type: "error" });
      return;
    }
    setUsers(users.filter((u) => u.id !== id));
    setNotice({ msg: `User "${username}" has been removed.`, type: "success" });
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "Admin":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">Admin</span>;
      case "Receiving":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">1. Receiving</span>;
      case "Storage":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">2. Storage</span>;
      case "Forklift":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">3. Forklift</span>;
      case "Kitting":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">4. Kitting</span>;
      case "Manager":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">Manager</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-800 border border-slate-200">User</span>;
    }
  };

  const getPanelIcon = (id: Page) => {
    switch (id) {
      case "dashboard": return <LayoutDashboard size={16} />;
      case "items": return <Boxes size={16} />;
      case "receiving": return <ArrowDownLeft size={16} />;
      case "unpack": return <Truck size={16} />;
      case "issue": return <ArrowUpRight size={16} />;
      case "return": return <RotateCcw size={16} />;
      case "inventory": return <Database size={16} />;
      case "history": return <History size={16} />;
      case "reports": return <FileSpreadsheet size={16} />;
      case "ai_forecast": return <Sparkles size={16} />;
      case "settings": return <KeyRound size={16} />;
      default: return <Package size={16} />;
    }
  };

  const currentRolePanels = rolePermissions[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole] || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#2463a6]/10 text-[#2463a6] rounded-lg">
              <Sliders size={18} />
            </span>
            <h2 className="text-xl font-bold text-[#18324d]">User Setting & Access Control</h2>
          </div>
          <p className="text-xs text-[#65768a]">
            Configure roles (<strong>1. Receiving, 2. Storage, 3. Forklift, 4. Kitting</strong>) and customize exactly which panels each role can access.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center p-1 bg-[#f0f4f9] border border-[#cfd9e4] rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("roles")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === "roles"
                ? "bg-white text-[#18324d] shadow-xs font-bold"
                : "text-[#5c6f83] hover:text-[#18324d]"
            }`}
          >
            <Sliders size={14} />
            <span>Role Panel Permissions</span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === "users"
                ? "bg-white text-[#18324d] shadow-xs font-bold"
                : "text-[#5c6f83] hover:text-[#18324d]"
            }`}
          >
            <UsersIcon size={14} />
            <span>User Accounts & Logins ({users.length})</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Check size={16} className="shrink-0 text-emerald-600" />
            <span>{notice.msg}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: ROLE PANEL ACCESS PERMISSION CONTROL                          */}
      {/* ==================================================================== */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          {/* Admin Announcement Callout */}
          <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 border border-blue-200 rounded-2xl flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs mt-0.5">
                <ShieldCheck size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#10243b]">
                  Role-Based Panel Access Configuration
                </h3>
                <p className="text-xs text-[#355171] leading-relaxed">
                  As Administrator, select a role below (<strong>1. Receiving, 2. Storage, 3. Forklift, 4. Kitting</strong>) and toggle checkboxes to choose which navigation panels they can access. Changes apply immediately upon login.
                </p>
              </div>
            </div>

            <div className="shrink-0 hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-[#18324d] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Enforcement</span>
            </div>
          </div>

          {/* Role Selection Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {configurableRoles.map((r) => {
              const isSelected = selectedRole === r.role;
              const allowedCount = (rolePermissions[r.role] || DEFAULT_ROLE_PERMISSIONS[r.role] || []).length;

              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setSelectedRole(r.role)}
                  className={`p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between gap-2 ${
                    isSelected
                      ? "bg-white border-[#2463a6] ring-2 ring-[#2463a6]/20 shadow-sm"
                      : "bg-white hover:bg-[#f9fafc] border-[#dfe6ee]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      {r.icon}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#475569]">
                      {allowedCount} panels
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#18324d]">{r.label}</h4>
                    <p className="text-[10px] text-[#64748b] line-clamp-1 mt-0.5">{r.desc}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#2463a6]"></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panel Selection for the Active Role */}
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#dfe6ee]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#18324d]">
                    Configuring Access for:
                  </span>
                  {getRoleBadge(selectedRole)}
                  <span className="text-xs font-mono text-[#65768a]">
                    ({currentRolePanels.length} of {AVAILABLE_PANELS.length} panels enabled)
                  </span>
                </div>
                <p className="text-xs text-[#65768a] mt-1">
                  Check or uncheck panels below to control what users with this role can see in the sidebar:
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleGrantAll(selectedRole)}
                  className="px-3 py-1.5 bg-[#f0f5fc] hover:bg-[#e1edfc] text-[#2463a6] border border-[#cfd9e4] rounded-lg text-xs font-semibold transition"
                >
                  Enable All
                </button>
                <button
                  type="button"
                  onClick={() => handleClearAll(selectedRole)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-[#cfd9e4] rounded-lg text-xs font-semibold transition"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => handleResetDefaults(selectedRole)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#cfd9e4] rounded-lg text-xs font-semibold transition"
                  title="Reset to recommended standard permissions"
                >
                  <RotateCcw size={12} />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>

            {/* Panel Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {AVAILABLE_PANELS.map((panel) => {
                const isChecked = currentRolePanels.includes(panel.id);

                return (
                  <div
                    key={panel.id}
                    onClick={() => handleTogglePanel(selectedRole, panel.id)}
                    className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-start gap-3.5 ${
                      isChecked
                        ? "bg-[#f7fbff] border-[#b9d5f3] hover:border-[#2463a6]"
                        : "bg-white border-[#e2e8f0] opacity-70 hover:opacity-100 hover:border-slate-300"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <div className="w-5 h-5 rounded bg-[#2463a6] text-white flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border border-slate-300 bg-white"></div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#18324d]">
                          <span className={isChecked ? "text-[#2463a6]" : "text-slate-400"}>
                            {getPanelIcon(panel.id)}
                          </span>
                          <span className="truncate">{panel.label}</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                            isChecked
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {isChecked ? "Allowed" : "Restricted"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748b] leading-relaxed line-clamp-2">
                        {panel.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Access Control Matrix Table */}
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-[#2463a6]" />
                <h3 className="text-sm font-bold text-[#18324d]">
                  Full Role Access Control Matrix
                </h3>
              </div>
              <span className="text-xs text-[#65768a]">
                Direct click on any checkbox to instantly grant or revoke panel access
              </span>
            </div>

            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                    <th className="p-3 sticky left-0 bg-[#f7f9fc] z-10 w-44">Role / Title</th>
                    {AVAILABLE_PANELS.map((p) => (
                      <th key={p.id} className="p-2.5 text-center font-mono text-[11px] font-semibold whitespace-nowrap">
                        <span title={p.description}>{p.label.split(" ")[0]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9eef3] text-xs">
                  {/* Administrator row (fixed full access) */}
                  <tr className="bg-purple-50/30">
                    <td className="p-3 font-semibold text-[#18324d] sticky left-0 bg-purple-50/50 z-10 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                      <span>Administrator</span>
                    </td>
                    {AVAILABLE_PANELS.map((p) => (
                      <td key={p.id} className="p-2.5 text-center text-purple-600">
                        <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[10px]">
                          ALL
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Configurable roles */}
                  {configurableRoles.map((r) => {
                    const allowed = rolePermissions[r.role] || DEFAULT_ROLE_PERMISSIONS[r.role] || [];
                    return (
                      <tr key={r.role} className="hover:bg-[#fcfdfd]">
                        <td className="p-3 font-semibold text-[#18324d] sticky left-0 bg-white hover:bg-[#fcfdfd] z-10">
                          <div className="flex items-center gap-2">
                            {r.icon}
                            <span>{r.label}</span>
                          </div>
                        </td>
                        {AVAILABLE_PANELS.map((p) => {
                          const isAllowed = allowed.includes(p.id);
                          return (
                            <td key={p.id} className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePanel(r.role, p.id)}
                                className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition ${
                                  isAllowed
                                    ? "bg-[#2463a6] text-white hover:bg-[#1a4b7f]"
                                    : "border border-slate-300 text-transparent hover:border-slate-400 bg-white"
                                }`}
                                title={`${isAllowed ? "Revoke" : "Grant"} ${p.label} for ${r.role}`}
                              >
                                <Check size={13} strokeWidth={isAllowed ? 3 : 1} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: USER ACCOUNTS & LOGINS                                        */}
      {/* ==================================================================== */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-[#18324d]">User Logins & Role Assignments</h3>
              <p className="text-xs text-[#65768a] mt-0.5">
                Manage login accounts, set passwords, and assign roles (<strong>Receiving, Storage, Forklift, Kitting</strong>) for all operators.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setIsAdding(true);
                  setNotice(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#2463a6] hover:bg-[#1c4e82] text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <Plus size={14} /> Add User Account
              </button>
            )}
          </div>

          {/* User Accounts Table */}
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                    <th className="p-3">Operator Name</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Password</th>
                    <th className="p-3">Assigned Role</th>
                    <th className="p-3">Permitted Panels</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9eef3] text-xs">
                  {users.map((u) => {
                    const isShow = Boolean(showPasswordMap[u.id]);
                    const userRolePanels = rolePermissions[u.role] || DEFAULT_ROLE_PERMISSIONS[u.role] || [];
                    const isCurrent = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} className={`hover:bg-[#fcfdfd] ${isCurrent ? "bg-blue-50/30" : ""}`}>
                        <td className="p-3 font-semibold text-[#18324d]">
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-[#2463a6]">
                          @{u.username}
                        </td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#f4f7fb] px-2 py-1 rounded-lg border border-[#dfe6ee] font-mono text-[11px]">
                              {isShow ? u.password : "••••••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(u.id)}
                              className="text-[#65768a] hover:text-[#18324d] p-1"
                              title={isShow ? "Hide Password" : "Show Password"}
                            >
                              {isShow ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          {getRoleBadge(u.role)}
                        </td>
                        <td className="p-3">
                          <div className="text-[11px] text-[#475569] flex items-center gap-1.5">
                            <span className="font-semibold">{userRolePanels.length} panels:</span>
                            <span className="text-[#64748b] truncate max-w-[200px]">
                              {userRolePanels.slice(0, 3).map((p) => p).join(", ")}
                              {userRolePanels.length > 3 ? ` +${userRolePanels.length - 3} more` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(u)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#cfd9e4] text-[#18324d] rounded-lg text-[11px] font-semibold hover:bg-[#f7f9fc]"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold hover:bg-red-100"
                              title="Delete user"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#18324d]">Create New User Account</h3>
              <button onClick={() => setIsAdding(false)} className="text-[#65768a] hover:text-[#18324d]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Display Name / Operator Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Farhan (Storage Team Lead)"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. storage_lead"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Password *</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. password123"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Assigned Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-medium"
                >
                  <option value="Receiving">1. Receiving (Dock & Inbound)</option>
                  <option value="Storage">2. Storage (Putaway & Inventory Control)</option>
                  <option value="Forklift">3. Forklift (Decant & Bay Driver)</option>
                  <option value="Kitting">4. Kitting (Assembly Line Marshall)</option>
                  <option value="Admin">Administrator (Full Access)</option>
                  <option value="Manager">Warehouse Manager</option>
                  <option value="User">Standard Floor Operator</option>
                </select>
                <p className="text-[11px] text-[#65768a] mt-1">
                  The panel access for this role can be modified in the <em>Role Panel Permissions</em> tab.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#dfe6ee]">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528b] text-white rounded-xl text-xs font-semibold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUserId && (
        <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#18324d]">Edit User Account & Role</h3>
              <button onClick={() => setEditingUserId(null)} className="text-[#65768a] hover:text-[#18324d]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Username *</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Password *</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Assigned Role *</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-medium"
                >
                  <option value="Receiving">1. Receiving (Dock & Inbound)</option>
                  <option value="Storage">2. Storage (Putaway & Inventory Control)</option>
                  <option value="Forklift">3. Forklift (Decant & Bay Driver)</option>
                  <option value="Kitting">4. Kitting (Assembly Line Marshall)</option>
                  <option value="Admin">Administrator (Full Access)</option>
                  <option value="Manager">Warehouse Manager</option>
                  <option value="User">Standard Floor Operator</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#dfe6ee]">
                <button
                  type="button"
                  onClick={() => setEditingUserId(null)}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528b] text-white rounded-xl text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
