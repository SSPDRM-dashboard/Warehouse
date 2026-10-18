import React, { useState } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Package,
  Layers,
  Truck,
  Wrench,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { UserAccount, Role, RolePermissions, DEFAULT_ROLE_PERMISSIONS, AVAILABLE_PANELS } from "./types";

interface LoginViewProps {
  users: UserAccount[];
  rolePermissions: RolePermissions;
  onLogin: (user: UserAccount) => void;
}

export function LoginView({ users, rolePermissions, onLogin }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Find matching user
    const found = users.find(
      (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );

    if (!found) {
      setTimeout(() => {
        setIsSubmitting(false);
        setErrorMsg("Invalid username or password. Please try again or click a demo account below.");
      }, 250);
      return;
    }

    setTimeout(() => {
      setIsSubmitting(false);
      onLogin(found);
    }, 200);
  };

  const handleQuickLogin = (demoUser: UserAccount) => {
    setUsername(demoUser.username);
    setPassword(demoUser.password);
    setErrorMsg(null);
    onLogin(demoUser);
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case "Admin":
        return <ShieldCheck size={16} className="text-purple-600" />;
      case "Receiving":
        return <Package size={16} className="text-blue-600" />;
      case "Storage":
        return <Layers size={16} className="text-emerald-600" />;
      case "Forklift":
        return <Truck size={16} className="text-amber-600" />;
      case "Kitting":
        return <Wrench size={16} className="text-indigo-600" />;
      default:
        return <KeyRound size={16} className="text-slate-600" />;
    }
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case "Admin":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Receiving":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Storage":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Forklift":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Kitting":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1d30] text-[#18324d] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background industrial graphic grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none"></div>

      {/* Top Bar Branding */}
      <header className="relative z-10 max-w-5xl mx-auto w-full flex items-center justify-between py-2 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-[#2463a6] text-white rounded-xl p-2.5 font-bold font-mono text-xl shadow-md border border-[#3b82f6]/30">
            ▦
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide flex items-center gap-2">
              <span>WAREHOUSE OS</span>
              <span className="text-[10px] bg-[#1e3a5f] text-cyan-300 font-semibold px-2 py-0.5 rounded-full border border-cyan-500/30">
                v2.6 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400">Inbound, Storage, Forklift & Material Control</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-[#162a45]/80 px-3 py-1.5 rounded-lg border border-[#2b4c77]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Access Controlled Terminal</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 max-w-5xl mx-auto w-full my-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Login Form Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#2463a6] bg-[#f0f5fc] px-2.5 py-1 rounded-md mb-2">
                  Authentication Portal
                </span>
                <h1 className="text-2xl font-bold text-[#10243b]">Sign In to Your Station</h1>
                <p className="text-xs text-[#5c6f83] mt-1">
                  Enter your assigned username and password to open your role-authorized workspace.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#304a65] mb-1.5">
                    Username / Operator ID
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3 text-[#7b8f9e]" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin or receiving"
                      required
                      autoFocus
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-[#cfd9e4] rounded-xl font-mono text-[#18324d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463a6] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#304a65]">Password</label>
                    <span className="text-[11px] text-[#7b8f9e]">Default: password123</span>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3 text-[#7b8f9e]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#cfd9e4] rounded-xl font-mono text-[#18324d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463a6] focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#7b8f9e] hover:text-[#18324d]"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 bg-[#2463a6] hover:bg-[#1d528b] active:bg-[#163f6d] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <span>Enter Workspace</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-[11px] text-[#65768a] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" /> Role-based Panel Access
              </span>
              <span>Warehouse OS 2.6</span>
            </div>
          </div>

          {/* Right: Quick Role Selector & Panel Preview */}
          <div className="lg:col-span-6 bg-[#162a45]/90 border border-[#2b4c77] rounded-2xl p-6 sm:p-8 text-white flex flex-col justify-between backdrop-blur-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Quick Role Login</span>
                    <span className="text-[10px] bg-[#2463a6] px-2 py-0.5 rounded font-mono font-normal">
                      DEMO READY
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Select any role below to test specific panel access configured by Admin:
                  </p>
                </div>
              </div>

              {/* Role Cards List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {users.map((u) => {
                  const rolePerms = rolePermissions[u.role] || DEFAULT_ROLE_PERMISSIONS[u.role] || [];
                  const accessiblePanels = AVAILABLE_PANELS.filter((p) => rolePerms.includes(p.id));

                  return (
                    <div
                      key={u.id}
                      onClick={() => handleQuickLogin(u)}
                      className="group cursor-pointer bg-[#0f2137] hover:bg-[#1a3455] border border-[#244266] hover:border-[#386b9e] rounded-xl p-3 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#1a3455] group-hover:bg-[#244570] flex items-center justify-center shrink-0 border border-[#2b4c77]">
                          {getRoleIcon(u.role)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                              {u.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${getRoleBadgeClass(
                                u.role
                              )}`}
                            >
                              {u.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-cyan-200">@{u.username}</span>
                            <span>•</span>
                            <span className="text-[10px] text-slate-300 truncate">
                              {accessiblePanels.length} panels allowed (
                              {accessiblePanels.slice(0, 3).map((p) => p.label.split(" ")[0]).join(", ")}
                              {accessiblePanels.length > 3 ? "..." : ""})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 text-xs text-cyan-300 font-semibold group-hover:translate-x-0.5 transition">
                        <span>Sign In</span>
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note on Admin configurability */}
            <div className="mt-5 pt-4 border-t border-[#244266] text-xs text-slate-300">
              <p className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin Configuration:</strong> The Admin can edit user accounts, assign roles (Receiving, Storage, Forklift, Kitting), and choose exactly which panels each role can view and access in <em>User Settings</em>.
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full text-center text-xs text-slate-400 py-2">
        <p>© Warehouse Operations & Material Control • All sessions logged & audited</p>
      </footer>
    </div>
  );
}
