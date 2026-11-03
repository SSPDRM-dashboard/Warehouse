import React, { useState } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { UserAccount, RolePermissions } from "./types";

interface LoginViewProps {
  users: UserAccount[];
  rolePermissions?: RolePermissions;
  onLogin: (user: UserAccount) => void;
}

export function LoginView({ users, onLogin }: LoginViewProps) {
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
        setErrorMsg("Invalid username or password. Please try again.");
      }, 250);
      return;
    }

    setTimeout(() => {
      setIsSubmitting(false);
      onLogin(found);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-[#0d1d30] text-[#18324d] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
      {/* Background industrial graphic grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none"></div>

      {/* Top Bar Branding */}
      <header className="relative z-10 max-w-md mx-auto w-full flex items-center justify-between py-2 text-white">
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
          <span>Access Controlled</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between">
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
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-md mx-auto w-full text-center text-xs text-slate-400 py-2">
        <p>© Warehouse Operations & Material Control • All sessions logged & audited</p>
      </footer>
    </div>
  );
}
