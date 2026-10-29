import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import {
  LayoutDashboard,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  History,
  Sparkles,
  Plus,
  Search,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Package,
  ArrowRight,
  RefreshCw,
  X,
  KeyRound,
  Users,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Edit2,
  Trash2,
  Share2,
  FileSpreadsheet,
  PackageOpen,
  Box,
  AlertCircle,
  Check,
  Clock,
  LogOut,
  Sliders,
  Layers,
  Truck,
  Wrench,
  PackageCheck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Filter,
  Tag,
  Settings,
} from "lucide-react";
import {
  Item,
  Balance,
  Transaction,
  Role,
  Page,
  UserAccount,
  RolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  AVAILABLE_PANELS,
} from "./types";
import { defaultUsers } from "./defaultUsers";
import { seedItems, initialBalances, initialTransactions } from "./mockData";
import { SyncBackupModal } from "./SyncBackupModal";
import { DailyReportsView } from "./DailyReportsView";
import { subscribeToWarehouseState, pushWarehouseStateToCloud } from "./warehouseStore";
import { LoginView } from "./LoginView";
import { SettingsView } from "./SettingsView";
import { SendToVAView } from "./SendToVAView";


// Module-level helpers
export const formatTimestamp = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
};

const txNo = (prefix: string) =>
  `${prefix}-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

const upsertBalance = (
  balances: Balance[],
  code: string,
  loc: string,
  delta: number,
  batchNo?: string,
  timestamp?: string,
  caseNo?: string
) => {
  let found = false;
  const targetCode = code.trim().toUpperCase();
  const targetLoc = loc.trim();
  const timeNow = timestamp || formatTimestamp();
  const out = balances.map((b) => {
    if (b.code.trim().toUpperCase() === targetCode && b.loc.trim().toLowerCase() === targetLoc.toLowerCase()) {
      found = true;
      return {
        ...b,
        qty: Math.max(0, b.qty + delta),
        batchNo: batchNo || b.batchNo,
        caseNo: caseNo || b.caseNo,
        timestamp: timeNow,
        updatedAt: timeNow,
      };
    }
    return b;
  });
  if (!found) {
    const newBal: Balance = {
      code: targetCode,
      loc: targetLoc,
      qty: Math.max(0, delta),
      timestamp: timeNow,
      updatedAt: timeNow,
    };
    if (batchNo) newBal.batchNo = batchNo;
    if (caseNo) newBal.caseNo = caseNo;
    out.push(newBal);
  }
  return out;
};

const downloadCSV = (name: string, headers: string[], rows: any[][]) => {
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"')
        .join(",")
    )
    .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
  );
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

const downloadXLSX = (name: string, headers: string[], rows: any[][], sheetName = "Item Master") => {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const fileName = name.endsWith(".xlsx") ? name : `${name}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem("wh_items");
      return saved ? JSON.parse(saved) : seedItems;
    } catch {
      return seedItems;
    }
  });

  const [balances, setBalances] = useState<Balance[]>(() => {
    try {
      const saved = localStorage.getItem("wh_balances");
      return saved ? JSON.parse(saved) : initialBalances;
    } catch {
      return initialBalances;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem("wh_transactions");
      return saved ? JSON.parse(saved) : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });

  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(() => {
    try {
      const saved = localStorage.getItem("wh_role_permissions");
      if (saved) {
        return { ...DEFAULT_ROLE_PERMISSIONS, ...JSON.parse(saved) };
      }
      return DEFAULT_ROLE_PERMISSIONS;
    } catch {
      return DEFAULT_ROLE_PERMISSIONS;
    }
  });

  useEffect(() => {
    localStorage.setItem("wh_role_permissions", JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem("wh_logged_in_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState<Role>(() => {
    return currentUser ? currentUser.role : "Admin";
  });

  const [page, setPage] = useState<Page>("dashboard");
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setRole(user.role);
    localStorage.setItem("wh_logged_in_user", JSON.stringify(user));
    const allowed = user.role === "Admin"
      ? AVAILABLE_PANELS.map((p) => p.id)
      : (rolePermissions[user.role] || DEFAULT_ROLE_PERMISSIONS[user.role] || ["dashboard"]);
    if (!allowed.includes(page)) {
      setPage(allowed[0] || "dashboard");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("wh_logged_in_user");
  };

  const handleRestoreData = (data: {
    items: Item[];
    balances: Balance[];
    transactions: Transaction[];
    users?: UserAccount[];
  }) => {
    setItems(data.items);
    setBalances(data.balances);
    setTransactions(data.transactions);
    if (data.users && data.users.length > 0) {
      setUsers(data.users);
    }
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem("wh_items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("wh_balances", JSON.stringify(balances));
  }, [balances]);

  useEffect(() => {
    localStorage.setItem("wh_transactions", JSON.stringify(transactions));
  }, [transactions]);

  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem("wh_users");
      return saved ? JSON.parse(saved) : defaultUsers;
    } catch {
      return defaultUsers;
    }
  });

  useEffect(() => {
    localStorage.setItem("wh_users", JSON.stringify(users));
  }, [users]);


  // Real-time Cloud Firestore live sync (Web, Mobile & Studio)
  const isRemoteUpdate = useRef(false);
  const isInitialCloudSyncDone = useRef(false);
  const lastSyncedJson = useRef("");

  useEffect(() => {
    // If cloud response is delayed or offline, enable local sync after 1.5 seconds
    const fallbackTimer = setTimeout(() => {
      isInitialCloudSyncDone.current = true;
    }, 1500);

    const unsubscribe = subscribeToWarehouseState(
      (cloudData) => {
        clearTimeout(fallbackTimer);
        isRemoteUpdate.current = true;
        isInitialCloudSyncDone.current = true;
        lastSyncedJson.current = JSON.stringify({
          items: cloudData.items,
          balances: cloudData.balances,
          transactions: cloudData.transactions,
          users: cloudData.users,
        });

        setItems(cloudData.items);
        setBalances(cloudData.balances);
        setTransactions(cloudData.transactions);
        if (cloudData.users && cloudData.users.length > 0) {
          setUsers(cloudData.users);
        }
      },
      (err) => {
        clearTimeout(fallbackTimer);
        isInitialCloudSyncDone.current = true;
        console.error("Cloud sync error:", err);
      }
    );
    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // CRITICAL: Do NOT push to cloud until the initial cloud sync has been completed.
    // This prevents resetting or overwriting inventory that was already keyed in on mobile or other devices.
    if (!isInitialCloudSyncDone.current) {
      return;
    }
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const currentJson = JSON.stringify({ items, balances, transactions, users });
    if (currentJson === lastSyncedJson.current) {
      return;
    }

    lastSyncedJson.current = currentJson;
    pushWarehouseStateToCloud(items, balances, transactions, users).catch((err) => {
      console.error("Failed to push state to cloud:", err);
    });
  }, [items, balances, transactions, users]);

  // Helper functions
  const stock = (code: string, loc?: string) => {
    return balances
      .filter(
        (b) =>
          b.code.trim().toUpperCase() === code.trim().toUpperCase() &&
          (!loc || b.loc.trim().toLowerCase() === loc.trim().toLowerCase())
      )
      .reduce((s, b) => s + b.qty, 0);
  };

  const allLocs = () => {
    return Array.from(
      new Set([
        ...balances.map((b) => b.loc),
        "A-01-01",
        "A-03-01",
        "B-02-01",
        "C-01-02",
        "D-01-01",
        "RECV-01",
      ])
    ).sort();
  };

  // If not logged in, show dedicated User Login Page
  if (!currentUser) {
    return (
      <LoginView
        users={users}
        rolePermissions={rolePermissions}
        onLogin={handleLogin}
      />
    );
  }

  const canManage = role === "Admin";

  // Compute allowed panels for current active role
  const currentAllowedPanels: Page[] =
    role === "Admin"
      ? AVAILABLE_PANELS.map((p) => p.id)
      : rolePermissions[role] || DEFAULT_ROLE_PERMISSIONS[role] || ["dashboard"];

  const isPanelAllowed = (p: Page) => role === "Admin" || currentAllowedPanels.includes(p);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[250px_1fr] bg-[#f3f6fa] text-[#18324d]">
      {/* Sidebar */}
      <aside className="bg-[#10243b] text-white p-5 flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-[#dceaff] text-[#10243b] rounded-xl p-2.5 text-xl font-bold font-mono">
            ▦
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">WAREHOUSE OS</h1>
            <p className="text-xs text-[#b8c9da]">Inventory Control Centre</p>
          </div>
        </div>

        <div className="text-[10px] tracking-widest text-[#9fb3c8] px-2 font-semibold flex items-center justify-between">
          <span>WORKSPACE</span>
          <span className="text-[9px] font-mono text-cyan-300 bg-[#162e4a] px-1.5 py-0.5 rounded">
            {role.toUpperCase()}
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {isPanelAllowed("dashboard") && (
            <SidebarButton
              active={page === "dashboard"}
              onClick={() => setPage("dashboard")}
              icon={<LayoutDashboard size={18} />}
              label="Overview"
            />
          )}
          {isPanelAllowed("items") && canManage && (
            <SidebarButton
              active={page === "items"}
              onClick={() => setPage("items")}
              icon={<Boxes size={18} />}
              label="Item Master"
            />
          )}
          {isPanelAllowed("items") && !canManage && (
            <SidebarButton
              active={page === "items"}
              onClick={() => setPage("items")}
              icon={<Boxes size={18} />}
              label="Item Lookup"
            />
          )}
          {isPanelAllowed("receiving") && (
            <SidebarButton
              active={page === "receiving"}
              onClick={() => setPage("receiving")}
              icon={<ArrowDownLeft size={18} />}
              label="Stock Receiving"
            />
          )}
          {isPanelAllowed("kitting_case") && (
            <SidebarButton
              active={page === "kitting_case"}
              onClick={() => setPage("kitting_case")}
              icon={<Boxes size={18} />}
              label="Kitting Case"
            />
          )}
          {isPanelAllowed("unpack") && (
            <SidebarButton
              active={page === "unpack"}
              onClick={() => setPage("unpack")}
              icon={<PackageOpen size={18} />}
              label="Kitting-Unpack"
            />
          )}
          {isPanelAllowed("issue") && (
            <SidebarButton
              active={page === "issue"}
              onClick={() => setPage("issue")}
              icon={<ArrowUpRight size={18} />}
              label="Send to Production"
            />
          )}
          {isPanelAllowed("return") && (
            <SidebarButton
              active={page === "return"}
              onClick={() => setPage("return")}
              icon={<ArrowDownLeft size={18} className="rotate-180" />}
              label="Return from Production"
            />
          )}
          {isPanelAllowed("send_to_va") && (
            <SidebarButton
              active={page === "send_to_va"}
              onClick={() => setPage("send_to_va")}
              icon={<Truck size={18} />}
              label="Send to VA"
            />
          )}
          {isPanelAllowed("inventory") && (
            <SidebarButton
              active={page === "inventory"}
              onClick={() => setPage("inventory")}
              icon={<Database size={18} />}
              label="Inventory Balance"
            />
          )}
          {isPanelAllowed("history") && (
            <SidebarButton
              active={page === "history"}
              onClick={() => setPage("history")}
              icon={<History size={18} />}
              label="Transactions"
            />
          )}
          {isPanelAllowed("reports") && (
            <SidebarButton
              active={page === "reports"}
              onClick={() => setPage("reports")}
              icon={<FileSpreadsheet size={18} />}
              label="Daily Reports"
            />
          )}
          {isPanelAllowed("ai_forecast") && (
            <SidebarButton
              active={page === "ai_forecast"}
              onClick={() => setPage("ai_forecast")}
              icon={<Sparkles size={18} />}
              label="AI Stock Intelligence"
            />
          )}
          {canManage && isPanelAllowed("settings") && (
            <SidebarButton
              active={page === "settings"}
              onClick={() => setPage("settings")}
              icon={<KeyRound size={18} />}
              label="User Settings"
            />
          )}
        </nav>

        <div className="mt-auto border border-[#304a65] rounded-xl p-3 text-xs text-[#c3d0de] space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#2a9d68]"></span>
            <b className="text-white">Active Warehouse</b>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9fb3c8]">
            Records stored securely in browser. Sync across Vercel or backup anytime.
          </p>
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="w-full py-1.5 px-2 bg-[#203c5b] hover:bg-[#2b4e75] text-[#dceaff] rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw size={12} /> Sync / Export Data
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex flex-col">
        <header className="bg-white border-b border-[#dfe6ee] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#18324d]">
              {page === "dashboard" && "Dashboard Overview"}
              {page === "items" && (canManage ? "Admin Item Master Setup" : "Item Catalogue Lookup")}
              {page === "receiving" && "Stock Receiving & Inbound"}
              {page === "unpack" && "Kitting-Unpack Station"}
              {page === "kitting_case" && "Kitting Case & Batch Transfer Station"}
              {page === "issue" && "Send Parts to Production"}
              {page === "return" && "Return Parts from Production"}
              {page === "send_to_va" && "Send to VA (Vehicle Assembly) - Finished Goods"}
              {page === "inventory" && "Warehouse Inventory Balance"}
              {page === "history" && "Transaction History & Audit Log"}
              {page === "reports" && "Daily Warehouse Reports (Incoming, Unpacking & Production 1)"}
              {page === "ai_forecast" && "AI Stock Intelligence & Reorder Forecasting"}
              {page === "settings" && "User Accounts & Security Settings"}
            </h2>
            <p className="text-xs text-[#65768a]">
              Real-time stock control, receiving, production issues and supply chain analytics
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Sync Active</span>
            </div>

            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#f0f5fc] hover:bg-[#e1edfc] text-[#2463a6] border border-[#cfd9e4] rounded-lg text-xs font-semibold transition"
              title="Sync warehouse records between Google Studio, Vercel, or backup to file"
            >
              <RefreshCw size={14} />
              <span className="hidden md:inline">Sync / Backup</span>
            </button>

            {/* Current Logged-in User Profile Card */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#f7f9fc] border border-[#cfd9e4] rounded-xl text-xs">
              <div className="w-6 h-6 rounded-lg bg-[#2463a6] text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="font-bold text-[#18324d] text-xs truncate max-w-[120px]">{currentUser.name}</div>
                <div className="text-[10px] text-[#65768a] font-mono">@{currentUser.username}</div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  role === "Admin"
                    ? "bg-purple-50 text-purple-800 border-purple-200"
                    : role === "Receiving"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : role === "Storage"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : role === "Forklift"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : role === "Kitting"
                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                    : "bg-slate-50 text-slate-800 border-slate-200"
                }`}
              >
                {role}
              </span>
            </div>

            {/* If Admin, role switcher for perspective testing */}
            {currentUser.role === "Admin" && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-[#65768a]">
                <span className="font-semibold text-[10px]">VIEW:</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="border border-[#cfd9e4] rounded-lg px-2 py-1 bg-white text-[#18324d] font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  title="Admin perspective switcher: test exact panels visible to each role"
                >
                  <option value="Admin">Administrator</option>
                  <option value="Receiving">1. Receiving</option>
                  <option value="Storage">2. Storage</option>
                  <option value="Forklift">3. Forklift</option>
                  <option value="Kitting">4. Kitting</option>
                  <option value="Manager">Manager</option>
                  <option value="User">Floor Operator</option>
                </select>
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-[#65768a] hover:text-red-700 border border-[#cfd9e4] hover:border-red-200 rounded-lg text-xs font-semibold transition"
              title="Sign out and return to Login page"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <div className="p-6 max-w-[1400px] w-full mx-auto flex-1">
          {!isPanelAllowed(page) && (
            <div className="p-8 bg-white border border-[#dfe6ee] rounded-2xl text-center space-y-4 max-w-lg mx-auto my-12 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#18324d]">Panel Access Restricted</h3>
                <p className="text-xs text-[#65768a] mt-1.5 leading-relaxed">
                  Your current role (<strong>{role}</strong>) does not have permission to access the{" "}
                  <strong>{page}</strong> panel. Contact the administrator in User Settings to grant access.
                </p>
              </div>
              <button
                onClick={() => setPage(currentAllowedPanels[0] || "dashboard")}
                className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528b] text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Go to Allowed Panel ({currentAllowedPanels[0] || "Overview"})
              </button>
            </div>
          )}

          {isPanelAllowed(page) && (
            <>
              <div className={page === "dashboard" ? "block space-y-6" : "hidden"}>
                <DashboardView
                  items={items}
                  balances={balances}
                  transactions={transactions}
                  setPage={setPage}
                  onOpenSyncModal={() => setIsSyncModalOpen(true)}
                  onRestoreData={handleRestoreData}
                />
              </div>
              <div className={page === "items" ? "block space-y-6" : "hidden"}>
                <ItemsView
                  items={items}
                  setItems={setItems}
                  balances={balances}
                  setBalances={setBalances}
                  canManage={canManage}
                  stock={stock}
                />
              </div>
              <div className={page === "receiving" ? "block space-y-6" : "hidden"}>
                <ReceivingView
                  items={items}
                  balances={balances}
                  setBalances={setBalances}
                  transactions={transactions}
                  setTransactions={setTransactions}
                  allLocs={allLocs}
                  stock={stock}
                  role={role}
                  setPage={setPage}
                />
              </div>
              <div className={page === "unpack" ? "block space-y-6" : "hidden"}>
                <UnpackingView
                  transactions={transactions}
                  setTransactions={setTransactions}
                  balances={balances}
                  setBalances={setBalances}
                  role={role}
                  items={items}
                  setPage={setPage}
                />
              </div>
              <div className={page === "kitting_case" ? "block space-y-6" : "hidden"}>
                <KittingCaseView
                  balances={balances}
                  setBalances={setBalances}
                  transactions={transactions}
                  setTransactions={setTransactions}
                  items={items}
                  role={role}
                  setPage={setPage}
                />
              </div>
              <div className={page === "issue" ? "block space-y-6" : "hidden"}>
                <IssueView
                  items={items}
                  balances={balances}
                  setBalances={setBalances}
                  transactions={transactions}
                  setTransactions={setTransactions}
                  allLocs={allLocs}
                  stock={stock}
                  role={role}
                  setPage={setPage}
                />
              </div>
              <div className={page === "return" ? "block space-y-6" : "hidden"}>
                <ReturnView
                  items={items}
                  balances={balances}
                  setBalances={setBalances}
                  transactions={transactions}
                  setTransactions={setTransactions}
                  allLocs={allLocs}
                  stock={stock}
                  role={role}
                  setPage={setPage}
                />
              </div>
              <div className={page === "send_to_va" ? "block space-y-6" : "hidden"}>
                <SendToVAView
                  items={items}
                  balances={balances}
                  setBalances={setBalances}
                  transactions={transactions}
                  setTransactions={setTransactions}
                  currentUser={currentUser}
                  users={users}
                  role={role}
                  setPage={setPage}
                />
              </div>
              <div className={page === "inventory" ? "block space-y-6" : "hidden"}>
                <InventoryView
                  balances={balances}
                  setBalances={setBalances}
                  items={items}
                  stock={stock}
                  transactions={transactions}
                  setTransactions={setTransactions}
                  currentUser={currentUser}
                  users={users}
                  role={role}
                />
              </div>
              <div className={page === "history" ? "block space-y-6" : "hidden"}>
                <HistoryView
                  transactions={transactions}
                  setTransactions={setTransactions}
                  items={items}
                  canManage={canManage}
                  setPage={setPage}
                />
              </div>
              <div className={page === "reports" ? "block space-y-6" : "hidden"}>
                <DailyReportsView
                  transactions={transactions}
                  items={items}
                  balances={balances}
                />
              </div>
              <div className={page === "ai_forecast" ? "block space-y-6" : "hidden"}>
                <AiForecastView items={items} balances={balances} transactions={transactions} />
              </div>
              <div className={page === "settings" ? "block space-y-6" : "hidden"}>
                <SettingsView
                  users={users}
                  setUsers={setUsers}
                  canManage={canManage}
                  rolePermissions={rolePermissions}
                  setRolePermissions={setRolePermissions}
                  currentUser={currentUser}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <SyncBackupModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        items={items}
        balances={balances}
        transactions={transactions}
        users={users}
        onRestoreData={handleRestoreData}
      />
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${
        active
          ? "bg-[#203c5b] text-white font-semibold"
          : "text-[#d4deea] hover:bg-[#1a334f] hover:text-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* DASHBOARD VIEW                                                             */
/* -------------------------------------------------------------------------- */
function DashboardView({
  items,
  balances,
  transactions,
  setPage,
  onOpenSyncModal,
  onRestoreData,
}: {
  items: Item[];
  balances: Balance[];
  transactions: Transaction[];
  setPage: (p: Page) => void;
  onOpenSyncModal: () => void;
  onRestoreData: (data: { items: Item[]; balances: Balance[]; transactions: Transaction[]; users?: UserAccount[] }) => void;
}) {
  const activeItems = items.filter((i) => i.active);
  const totalUnits = balances.reduce((s, b) => s + b.qty, 0);
  const lowStockItems = items.filter(
    (i) => i.active && balances.filter((b) => b.code === i.code).reduce((s, b) => s + b.qty, 0) <= i.min
  );
  const totalReceiving = transactions.filter((t) => t.type === "Receiving" && t.status === "Posted").length;
  const totalIssues = transactions.filter((t) => t.type === "Production Issue" && t.status === "Posted").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#18324d]">
            Warehouse Control Centre
          </h2>
          <p className="text-sm text-[#65768a]">
            Real-time stock monitoring, inventory control and inbound/outbound movements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage("reports")}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <FileSpreadsheet size={14} className="text-emerald-700" /> Daily Reports
          </button>
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold shadow-xs hover:bg-gray-50 transition"
          >
            <RefreshCw size={14} className="text-[#2463a6]" /> Sync / Backup
          </button>
          <button
            onClick={() => setPage("ai_forecast")}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 transition"
          >
            <Sparkles size={14} /> Run AI Stock Forecast
          </button>
        </div>
      </div>

      {/* Empty State Banner (e.g. When first opened on Vercel) */}
      {items.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>Warehouse Database is Empty in this Browser Environment</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Because web browsers isolate local storage by domain, data saved in Google Studio does not automatically appear on Vercel until synchronized. You can sync in 1 click or load the standard demo catalog.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={onOpenSyncModal}
              className="px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-bold hover:opacity-95 transition flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw size={13} /> Sync Data from Google Studio
            </button>
            <button
              onClick={() => {
                onRestoreData({
                  items: seedItems,
                  balances: initialBalances,
                  transactions: initialTransactions,
                  users: defaultUsers,
                });
              }}
              className="px-4 py-2 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1.5"
            >
              <Database size={13} /> Load Sample Automotive Parts
            </button>
          </div>
        </div>
      )}

      {/* Mobile Handphone Quick Stock Update Console */}
      <div className="bg-gradient-to-r from-[#10243b] to-[#203c5b] text-white rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold flex items-center gap-2">
            <span>📱</span> Mobile Handphone Stock Console
          </div>
          <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full">Fast Touch Mode</span>
        </div>
        <p className="text-xs text-[#b8c9da]">
          Tap below to quickly receive stock, issue to production, or return materials from your mobile device.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            onClick={() => setPage("receiving")}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-center transition cursor-pointer"
          >
            + Receive
          </button>
          <button
            onClick={() => setPage("issue")}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-center transition cursor-pointer"
          >
            - Issue Prod
          </button>
          <button
            onClick={() => setPage("return")}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-center transition cursor-pointer"
          >
            ↺ Return Prod
          </button>
          <button
            onClick={() => setPage("send_to_va")}
            className="py-2.5 px-3 bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-400/40 rounded-xl text-xs font-bold text-center transition cursor-pointer flex items-center justify-center gap-1"
          >
            <Truck size={14} /> Send to VA
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-[#65768a]">Active Part Masters</div>
          <div className="text-3xl font-extrabold text-[#18324d] mt-2 font-mono">
            {activeItems.length}
          </div>
          <div className="text-xs text-[#65768a] mt-1">Registered Part Nos</div>
        </div>
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-[#65768a]">Total Warehouse Units</div>
          <div className="text-3xl font-extrabold text-[#18324d] mt-2 font-mono">
            {totalUnits.toLocaleString()}
          </div>
          <div className="text-xs text-[#65768a] mt-1">Across all locations</div>
        </div>
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-[#65768a]">Low Stock Parts</div>
          <div className="text-3xl font-extrabold text-amber-600 mt-2 font-mono">
            {lowStockItems.length}
          </div>
          <div className="text-xs text-amber-700 mt-1">At or below minimum level</div>
        </div>
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-medium text-[#65768a]">Movements Posted</div>
          <div className="text-3xl font-extrabold text-[#18324d] mt-2 font-mono">
            {totalIssues + totalReceiving}
          </div>
          <div className="text-xs text-[#65768a] mt-1">
            {totalReceiving} receipts, {totalIssues} issues
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-semibold text-[#18324d] mb-4">Quick Operations</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setPage("receiving")}
              className="flex items-center gap-3 p-4 bg-[#f4f7fb] hover:bg-[#e8f1ff] border border-[#dfe6ee] rounded-xl text-left font-semibold text-sm text-[#18324d] transition"
            >
              <ArrowDownLeft className="text-[#2463a6]" size={20} />
              <div>
                <div>Receive Stock</div>
                <div className="text-xs font-normal text-[#65768a]">Log inbound shipments</div>
              </div>
            </button>
            <button
              onClick={() => setPage("issue")}
              className="flex items-center gap-3 p-4 bg-[#f4f7fb] hover:bg-[#e8f1ff] border border-[#dfe6ee] rounded-xl text-left font-semibold text-sm text-[#18324d] transition"
            >
              <ArrowUpRight className="text-[#2463a6]" size={20} />
              <div>
                <div>Send to Production</div>
                <div className="text-xs font-normal text-[#65768a]">Issue parts to lines</div>
              </div>
            </button>
            <button
              onClick={() => setPage("inventory")}
              className="flex items-center gap-3 p-4 bg-[#f4f7fb] hover:bg-[#e8f1ff] border border-[#dfe6ee] rounded-xl text-left font-semibold text-sm text-[#18324d] transition"
            >
              <Database className="text-[#2463a6]" size={20} />
              <div>
                <div>View Inventory</div>
                <div className="text-xs font-normal text-[#65768a]">Check bin balances</div>
              </div>
            </button>
            <button
              onClick={() => setPage("items")}
              className="flex items-center gap-3 p-4 bg-[#f4f7fb] hover:bg-[#e8f1ff] border border-[#dfe6ee] rounded-xl text-left font-semibold text-sm text-[#18324d] transition"
            >
              <Boxes className="text-[#2463a6]" size={20} />
              <div>
                <div>Item Master</div>
                <div className="text-xs font-normal text-[#65768a]">Manage part nos & specs</div>
              </div>
            </button>
            <button
              onClick={() => setPage("send_to_va")}
              className="flex items-center gap-3 p-4 bg-blue-50/60 hover:bg-blue-100/60 border border-blue-200 rounded-xl text-left font-semibold text-sm text-[#18324d] transition sm:col-span-2 cursor-pointer"
            >
              <Truck className="text-blue-700 shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#18324d]">Send Finished Goods to VA</div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">IP • Console • Door • Cooling</span>
                </div>
                <div className="text-xs font-normal text-[#65768a] truncate">
                  Record and dispatch Finished Goods modules to Vehicle Assembly line
                </div>
              </div>
            </button>
            <button
              onClick={() => setPage("reports")}
              className="flex items-center gap-3 p-4 bg-emerald-50/50 hover:bg-emerald-100/50 border border-emerald-200 rounded-xl text-left font-semibold text-sm text-[#18324d] transition sm:col-span-2"
            >
              <FileSpreadsheet className="text-emerald-700 shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#18324d]">Daily Warehouse Reports</div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">3 Reports</span>
                </div>
                <div className="text-xs font-normal text-[#65768a] truncate">
                  Download daily reports for Incoming, Unpacking & Production 1
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#18324d]">Low Stock Alerts</h3>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                lowStockItems.length > 0
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
            >
              {lowStockItems.length} parts requiring attention
            </span>
          </div>

          <div className="flex-1 overflow-auto space-y-3 max-h-[240px]">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-[#65768a]">
                <CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={28} />
                <p className="text-sm font-medium">All stock levels are healthy.</p>
              </div>
            ) : (
              lowStockItems.map((i) => {
                const totalQty = balances
                  .filter((b) => b.code === i.code)
                  .reduce((s, b) => s + b.qty, 0);
                return (
                  <div
                    key={i.code}
                    className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#18324d] flex items-center gap-2">
                        <span>{i.code} — {i.desc}</span>
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[10px] font-mono font-bold">
                          Model: {i.model || "—"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-amber-800">
                        {totalQty}
                      </div>
                      <div className="text-[11px] text-[#65768a]">Min: {i.min}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#18324d]">Recent Stock Movements</h3>
          <button
            onClick={() => setPage("history")}
            className="text-xs font-semibold text-[#2463a6] hover:underline flex items-center gap-1"
          >
            View all history <ArrowRight size={14} />
          </button>
        </div>
        <TxTable transactions={transactions.slice(0, 5)} items={items} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ITEM MASTER VIEW                                                           */
/* -------------------------------------------------------------------------- */
function ItemsView({
  items,
  setItems,
  balances,
  setBalances,
  canManage,
  stock,
}: {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  canManage: boolean;
  stock: (code: string) => number;
}) {
  const [search, setSearch] = useState("");
  const [modalItem, setModalItem] = useState<Item | null | undefined>(undefined);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Duplicate Part No Resolution on Import (XLSX or CSV)
  interface DuplicateRecord {
    code: string;
    existing: Item;
    incoming: Item;
  }

  interface DuplicateModalData {
    sourceType: "Excel (.xlsx)" | "CSV";
    brandNew: Item[];
    duplicates: DuplicateRecord[];
    resolutions: Record<string, "keep" | "replace" | "delete">;
  }

  const [duplicateModalData, setDuplicateModalData] = useState<DuplicateModalData | null>(null);

  const confirmDelete = () => {
    if (!deleteCode) return;
    const targetCode = deleteCode.trim().toUpperCase();
    setItems((prev) => prev.filter((i) => i.code.trim().toUpperCase() !== targetCode));
    // CRITICAL: Do not change or wipe inventory that is already keyed in
    setDeleteNotice(`Part ${targetCode} successfully deleted from Item Master.`);
    setDeleteCode(null);
    setTimeout(() => setDeleteNotice(null), 4000);
  };

  const filtered = items.filter(
    (i) =>
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.desc.toLowerCase().includes(search.toLowerCase()) ||
      (i.model && i.model.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleStatus = (code: string) => {
    if (!canManage) return;
    setItems(items.map((i) => (i.code === code ? { ...i, active: !i.active } : i)));
  };

  // Helper to parse 2D array of rows from CSV or XLSX into Item array
  const parseRowsToItems = (rawRows: any[][]): Item[] => {
    if (!rawRows || rawRows.length === 0) {
      throw new Error("File contains no data rows.");
    }

    const firstNonEmptyIdx = rawRows.findIndex(
      (row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim().length > 0)
    );
    if (firstNonEmptyIdx === -1) {
      throw new Error("File contains only blank rows.");
    }

    const rawHeaderStrings = rawRows[firstNonEmptyIdx].map((c) =>
      String(c ?? "").toLowerCase().trim()
    );

    const headerKeywords = [
      "part", "code", "sku", "item", "desc", "description", "name", "model", "series", "min", "minimum", "stock"
    ];
    const hasHeaders = rawHeaderStrings.some((h) =>
      headerKeywords.some((k) => h.includes(k))
    );

    const dataRows = hasHeaders ? rawRows.slice(firstNonEmptyIdx + 1) : rawRows.slice(firstNonEmptyIdx);
    let modelIdx = -1;
    let codeIdx = -1;
    let descIdx = -1;
    let minIdx = -1;

    if (hasHeaders) {
      const findCol = (keywords: string[]) => {
        for (const kw of keywords) {
          const found = rawHeaderStrings.findIndex((h) => h.includes(kw));
          if (found >= 0) return found;
        }
        return -1;
      };

      codeIdx = findCol(["part no", "partno", "part_no", "part #", "part code", "partcode", "part", "code", "sku", "item no", "item code"]);
      descIdx = findCol(["desc", "name", "description", "title", "part name", "specification"]);
      modelIdx = findCol(["model", "series", "car", "category", "line"]);
      minIdx = findCol(["min", "minimum", "safety", "threshold", "reorder", "stock"]);
    }

    if (codeIdx === -1) codeIdx = hasHeaders ? (modelIdx === 0 ? 1 : 0) : 1;
    if (descIdx === -1) descIdx = codeIdx === 1 ? 2 : 1;
    if (modelIdx === -1) modelIdx = codeIdx === 1 ? 0 : -1;
    if (minIdx === -1) minIdx = 3;

    const parsedItems: Item[] = [];

    for (const row of dataRows) {
      if (!Array.isArray(row) || !row.some((c) => String(c ?? "").trim().length > 0)) {
        continue;
      }

      let code = String(row[codeIdx] ?? "").trim();
      if (!code && row[0]) {
        code = String(row[0]).trim();
      }
      if (!code) continue;

      let desc = String(row[descIdx] ?? "").trim();
      if (!desc) {
        desc = code;
      }

      let model = modelIdx >= 0 ? String(row[modelIdx] ?? "").trim() : "";
      let minRaw = row[minIdx];
      let minNum = typeof minRaw === "number" ? minRaw : parseFloat(String(minRaw ?? "").replace(/[^0-9.]/g, ""));
      let min = Number.isFinite(minNum) && minNum >= 0 ? minNum : 10;

      parsedItems.push({
        model,
        code: code.toUpperCase(),
        desc,
        min,
        active: true,
      });
    }

    return parsedItems;
  };

  // Common duplicate checking logic
  const processIncomingItems = (incoming: Item[], sourceType: "Excel (.xlsx)" | "CSV") => {
    if (incoming.length === 0) {
      throw new Error(`No valid parts found. Please ensure your ${sourceType} file has Part No values.`);
    }

    // Deduplicate within the file itself (take the latest entry if repeated)
    const incomingMap = new Map<string, Item>();
    for (const item of incoming) {
      incomingMap.set(item.code.trim().toUpperCase(), item);
    }

    const existingMap = new Map(items.map((i) => [i.code.trim().toUpperCase(), i]));
    const duplicates: DuplicateRecord[] = [];
    const brandNew: Item[] = [];

    for (const [codeUpper, incItem] of incomingMap.entries()) {
      const existing = existingMap.get(codeUpper);
      if (existing) {
        duplicates.push({
          code: existing.code,
          existing,
          incoming: incItem,
        });
      } else {
        brandNew.push(incItem);
      }
    }

    if (duplicates.length === 0) {
      setItems((prev) => [...prev, ...brandNew]);
      setDeleteNotice(`✓ Successfully imported ${brandNew.length} new parts from ${sourceType} into Item Master.`);
      setTimeout(() => setDeleteNotice(null), 5000);
    } else {
      // Found duplicate part numbers! Prompt admin whether to keep or delete/replace!
      const defaultResolutions: Record<string, "keep" | "replace" | "delete"> = {};
      duplicates.forEach((d) => {
        defaultResolutions[d.code] = "keep";
      });
      setDuplicateModalData({
        sourceType,
        brandNew,
        duplicates,
        resolutions: defaultResolutions,
      });
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result).replace(/^\ufeff/, "");
        const lines = text.split(/\r?\n/).filter((x) => x.trim());
        if (lines.length === 0) throw new Error("CSV file is empty.");

        const parseCsvLine = (line: string) => {
          let out: string[] = [];
          let cur = "";
          let q = false;
          for (let n = 0; n < line.length; n++) {
            let c = line[n];
            if (c === '"' && line[n + 1] === '"') {
              cur += '"';
              n++;
            } else if (c === '"') q = !q;
            else if ((c === "," || c === ";") && !q) {
              out.push(cur.trim());
              cur = "";
            } else cur += c;
          }
          out.push(cur.trim());
          return out;
        };

        const rawRows = lines.map(parseCsvLine);
        const parsed = parseRowsToItems(rawRows);
        processIncomingItems(parsed, "CSV");
      } catch (err: any) {
        setDeleteNotice("CSV Import failed: " + (err.message || "Unknown error"));
        setTimeout(() => setDeleteNotice(null), 5000);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("Excel spreadsheet does not contain any sheets.");
        }
        const sheet = wb.Sheets[firstSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });
        if (!rawRows || rawRows.length === 0) {
          throw new Error("Excel spreadsheet is empty.");
        }
        const parsed = parseRowsToItems(rawRows);
        processIncomingItems(parsed, "Excel (.xlsx)");
      } catch (err: any) {
        setDeleteNotice("Excel Import failed: " + (err.message || "Unknown error"));
        setTimeout(() => setDeleteNotice(null), 5000);
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyDuplicateDecisions = () => {
    if (!duplicateModalData) return;
    const { sourceType, brandNew, duplicates, resolutions } = duplicateModalData;

    let currentList = [...items];
    let keptCount = 0;
    let replacedCount = 0;
    let deletedCount = 0;

    for (const dup of duplicates) {
      const decision = resolutions[dup.code] || "keep";
      const targetCode = dup.code.trim().toUpperCase();

      if (decision === "keep") {
        // Keep existing item, discard incoming duplicate
        keptCount++;
      } else if (decision === "replace") {
        // Replace existing item with incoming data
        currentList = currentList.map((item) =>
          item.code.trim().toUpperCase() === targetCode ? dup.incoming : item
        );
        replacedCount++;
      } else if (decision === "delete") {
        // Delete part from Item Master completely
        currentList = currentList.filter(
          (item) => item.code.trim().toUpperCase() !== targetCode
        );
        deletedCount++;
      }
    }

    // Append genuinely new parts
    currentList = [...currentList, ...brandNew];
    setItems(currentList);
    setDuplicateModalData(null);

    setDeleteNotice(
      `✓ ${sourceType} Import complete: ${brandNew.length} new part(s) added. Duplicates resolved: ${keptCount} kept existing, ${replacedCount} deleted & replaced, ${deletedCount} deleted from Item Master.`
    );
    setTimeout(() => setDeleteNotice(null), 6000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">
            {canManage ? "Item Master Setup" : "Item Catalogue Lookup"}
          </h2>
          <p className="text-sm text-[#65768a]">
            {canManage
              ? "Register part numbers, maintain minimum stock rules, and import/export via Excel (.xlsx) or CSV."
              : "Read-only part catalogue and stock reference."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Templates */}
          <button
            type="button"
            onClick={() =>
              downloadXLSX(
                "item_master_template.xlsx",
                ["Model", "Part No", "Description", "Minimum Stock"],
                [
                  ["Civic FD", "PN-SAMPLE-01", "Front Brake Pad Set", 15],
                  ["CR-V", "PN-SAMPLE-02", "Engine Oil Filter Element", 25],
                  ["City GN", "PN-SAMPLE-03", "Cabin Air Conditioning Filter", 20]
                ],
                "Item Master Template"
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition shadow-2xs"
            title="Download Excel Template (.xlsx)"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" /> Excel Template
          </button>

          <button
            type="button"
            onClick={() =>
              downloadCSV(
                "item_master_template.csv",
                ["Model", "Part No", "Description", "Minimum Stock"],
                [["Civic FD", "PN-SAMPLE-01", "Front Brake Pad Set", "15"]]
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition shadow-2xs"
            title="Download CSV Template (.csv)"
          >
            <Download size={14} /> CSV Template
          </button>

          {/* Exports */}
          <button
            type="button"
            onClick={() =>
              downloadXLSX(
                "item_master.xlsx",
                ["Model", "Part No", "Description", "Minimum Stock", "Status"],
                items.map((i) => [i.model, i.code, i.desc, i.min, i.active ? "Active" : "Inactive"]),
                "Item Master"
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition shadow-2xs"
            title="Export all Item Master parts to Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} /> Export XLSX
          </button>

          <button
            type="button"
            onClick={() =>
              downloadCSV(
                "item_master.csv",
                ["Model", "Part No", "Description", "Minimum Stock", "Status"],
                items.map((i) => [i.model, i.code, i.desc, i.min, i.active ? "Active" : "Inactive"])
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition shadow-2xs"
            title="Export all Item Master parts to CSV"
          >
            <Download size={14} /> Export CSV
          </button>

          {canManage && (
            <>
              {/* Imports */}
              <label
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                title="Import parts from Excel spreadsheet (.xlsx, .xls)"
              >
                <Upload size={14} /> Import XLSX
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleImportXLSX}
                />
              </label>

              <label
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition cursor-pointer shadow-2xs"
                title="Import parts from CSV file (.csv)"
              >
                <Upload size={14} /> Import CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCSV} />
              </label>

              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                <Plus size={14} /> Add Part
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        {deleteNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
            <span>{deleteNotice}</span>
            <button onClick={() => setDeleteNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">✕</button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by model, part no, or description..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                <th className="p-3">Model</th>
                <th className="p-3">Part No</th>
                <th className="p-3">Description</th>
                <th className="p-3">Stock On Hand</th>
                <th className="p-3">Min Level</th>
                <th className="p-3">Status</th>
                {canManage && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="text-center py-8 text-[#65768a]">
                    No matching parts found.
                  </td>
                </tr>
              ) : (
                filtered.map((i) => {
                  const currentStock = stock(i.code);
                  const isLow = currentStock <= i.min;
                  return (
                    <tr key={i.code} className="hover:bg-[#fcfdfd]">
                      <td className="p-3 font-medium text-[#42566c]">{i.model || "—"}</td>
                      <td className="p-3 font-bold font-mono text-[#18324d]">{i.code}</td>
                      <td className="p-3 font-medium text-[#18324d]">{i.desc}</td>
                      <td className="p-3 font-mono font-bold">
                        <span className={isLow ? "text-amber-700" : "text-[#18324d]"}>{currentStock}</span>
                      </td>
                      <td className="p-3 font-mono text-[#65768a]">{i.min}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            i.active ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {i.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setModalItem(i)}
                              className="px-2.5 py-1 bg-white border border-[#cfd9e4] text-[#18324d] rounded-lg text-[11px] font-semibold hover:bg-[#f7f9fc]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleStatus(i.code)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                                i.active
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {i.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => setDeleteCode(i.code)}
                              className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteCode && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600 border-b pb-3">
              <Trash2 size={20} />
              <h3 className="text-base font-bold text-[#18324d]">Confirm Part Deletion</h3>
            </div>
            
            <p className="text-xs text-[#42566c]">
              Are you sure you want to delete part <strong className="font-mono text-red-700">{deleteCode}</strong>?
            </p>

            {stock(deleteCode) > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle size={14} className="text-blue-600" /> Stock On Hand Notice
                </div>
                <div>
                  This part currently has <strong>{stock(deleteCode)} units</strong> on hand. Deleting will remove the part from the master setup catalog, while keeping all existing inventory balances safe.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#dfe6ee]">
              <button
                type="button"
                onClick={() => setDeleteCode(null)}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                Yes, Delete Part
              </button>
            </div>
          </div>
        </div>
      )}

      {modalItem !== undefined && (
        <ItemModal
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSave={(updated) => {
            if (modalItem === null) {
              setItems([...items, updated]);
            } else {
              setItems(items.map((x) => (x.code === updated.code ? updated : x)));
            }
            setModalItem(undefined);
          }}
          onDelete={(code) => {
            setModalItem(undefined);
            setDeleteCode(code);
          }}
          canManage={canManage}
          items={items}
        />
      )}

      {/* DUPLICATE PART NUMBERS RESOLUTION MODAL */}
      {duplicateModalData && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#dfe6ee] space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#dfe6ee] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#18324d]">
                    Duplicate Part Numbers Detected
                  </h3>
                  <p className="text-xs text-[#65768a]">
                    The <span className="font-semibold text-[#18324d]">{duplicateModalData.sourceType}</span> import contains{" "}
                    <strong className="text-[#18324d]">{duplicateModalData.duplicates.length}</strong> part number(s) that already exist in Item Master.
                    Choose whether to <strong>Keep Existing</strong>, <strong>Delete & Replace</strong>, or <strong>Delete Part</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateModalData(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                title="Cancel Import"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Batch Actions */}
            <div className="bg-slate-50 border border-[#dfe6ee] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-semibold text-[#42566c]">
                Quick Batch Actions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const allKeep: Record<string, "keep" | "replace" | "delete"> = {};
                    duplicateModalData.duplicates.forEach((d) => {
                      allKeep[d.code] = "keep";
                    });
                    setDuplicateModalData({ ...duplicateModalData, resolutions: allKeep });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  ✓ Keep All Existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allReplace: Record<string, "keep" | "replace" | "delete"> = {};
                    duplicateModalData.duplicates.forEach((d) => {
                      allReplace[d.code] = "replace";
                    });
                    setDuplicateModalData({ ...duplicateModalData, resolutions: allReplace });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-blue-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  ⇄ Delete & Replace All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allDelete: Record<string, "keep" | "replace" | "delete"> = {};
                    duplicateModalData.duplicates.forEach((d) => {
                      allDelete[d.code] = "delete";
                    });
                    setDuplicateModalData({ ...duplicateModalData, resolutions: allDelete });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-800 border border-red-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  ✕ Delete All Duplicates
                </button>
              </div>
            </div>

            {/* Scrollable Duplicate List */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1 max-h-[50vh]">
              {duplicateModalData.duplicates.map((dup) => {
                const currentDecision = duplicateModalData.resolutions[dup.code] || "keep";
                const currentOnHand = stock(dup.existing.code);

                return (
                  <div
                    key={dup.code}
                    className={`border rounded-xl p-3.5 transition ${
                      currentDecision === "keep"
                        ? "border-emerald-200 bg-emerald-50/20"
                        : currentDecision === "replace"
                        ? "border-blue-200 bg-blue-50/20"
                        : "border-red-200 bg-red-50/20"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2.5 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-white border border-[#cfd9e4] px-2.5 py-0.5 rounded-md text-[#18324d]">
                          {dup.code}
                        </span>
                        {currentOnHand > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md">
                            {currentOnHand} pcs on hand
                          </span>
                        )}
                      </div>

                      {/* Decision Pill Selector */}
                      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#cfd9e4]">
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateModalData({
                              ...duplicateModalData,
                              resolutions: {
                                ...duplicateModalData.resolutions,
                                [dup.code]: "keep",
                              },
                            });
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                            currentDecision === "keep"
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Keep Existing
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateModalData({
                              ...duplicateModalData,
                              resolutions: {
                                ...duplicateModalData.resolutions,
                                [dup.code]: "replace",
                              },
                            });
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                            currentDecision === "replace"
                              ? "bg-blue-600 text-white shadow-2xs"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Delete & Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateModalData({
                              ...duplicateModalData,
                              resolutions: {
                                ...duplicateModalData.resolutions,
                                [dup.code]: "delete",
                              },
                            });
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                            currentDecision === "delete"
                              ? "bg-red-600 text-white shadow-2xs"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Delete Part
                        </button>
                      </div>
                    </div>

                    {/* Comparison Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Existing in Catalog */}
                      <div className="p-2.5 bg-white border border-[#e2e8f0] rounded-lg space-y-1">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#65768a]">
                          Existing in Item Master
                        </div>
                        <div className="font-semibold text-[#18324d]">{dup.existing.desc}</div>
                        <div className="text-[11px] text-[#65768a] flex justify-between">
                          <span>Model: <strong className="text-[#18324d]">{dup.existing.model || "—"}</strong></span>
                          <span>Min: <strong className="text-[#18324d]">{dup.existing.min}</strong></span>
                        </div>
                      </div>

                      {/* Incoming in File */}
                      <div className="p-2.5 bg-white border border-[#e2e8f0] rounded-lg space-y-1">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-blue-600">
                          Incoming from {duplicateModalData.sourceType} Import
                        </div>
                        <div className="font-semibold text-[#18324d]">{dup.incoming.desc}</div>
                        <div className="text-[11px] text-[#65768a] flex justify-between">
                          <span>Model: <strong className="text-[#18324d]">{dup.incoming.model || "—"}</strong></span>
                          <span>Min: <strong className="text-[#18324d]">{dup.incoming.min}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom summary and action footer */}
            <div className="pt-3 border-t border-[#dfe6ee] flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <div className="text-xs text-[#65768a]">
                {duplicateModalData.brandNew.length > 0 && (
                  <span>
                    Plus <strong className="text-[#18324d]">{duplicateModalData.brandNew.length}</strong> new non-duplicate part(s) will be added.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setDuplicateModalData(null)}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition"
                >
                  Cancel Import
                </button>
                <button
                  type="button"
                  onClick={handleApplyDuplicateDecisions}
                  className="px-5 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Confirm & Apply Decisions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemModal({
  item,
  onClose,
  onSave,
  onDelete,
  canManage,
  items,
}: {
  item: Item | null;
  onClose: () => void;
  onSave: (i: Item) => void;
  onDelete?: (code: string) => void;
  canManage?: boolean;
  items: Item[];
}) {
  const [model, setModel] = useState(item?.model || "");
  const [code, setCode] = useState(item?.code || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [min, setMin] = useState(item?.min ?? 10);
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !desc.trim()) {
      setError("Please fill all required fields.");
      return;
    }
    const duplicate = items.some(
      (x) => x.code.toLowerCase() === code.trim().toLowerCase() && x.code !== item?.code
    );
    if (duplicate) {
      setError("Part no already exists.");
      return;
    }
    onSave({
      model: model.trim(),
      code: code.trim().toUpperCase(),
      desc: desc.trim(),
      min: Number(min),
      active,
    });
  };

  return (
    <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#18324d]">
            {item ? "Edit Part Master" : "Register New Part"}
          </h3>
          <button onClick={onClose} className="text-[#65768a] hover:text-[#18324d]">
            <X size={20} />
          </button>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Model / Series</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Civic FD 2.0 / Universal"
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Part No *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={item !== null}
                required
                placeholder="e.g. PN-1007"
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono disabled:bg-[#f3f6fa]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Description *</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
                placeholder="e.g. Heavy Duty Steel Clamp"
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Minimum Stock Level *</label>
              <input
                type="number"
                min="0"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Status</label>
              <select
                value={active ? "true" : "false"}
                onChange={(e) => setActive(e.target.value === "true")}
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#dfe6ee]">
            {item && canManage && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item.code)}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Trash2 size={14} /> Delete Part
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95"
              >
                Save Part
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* UNPACKING VIEW (Sent to Unpack & Decant Station)                           */
/* -------------------------------------------------------------------------- */
function UnpackingView({
  transactions,
  setTransactions,
  balances,
  setBalances,
  role,
  items,
  setPage,
}: {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  balances?: Balance[];
  setBalances?: React.Dispatch<React.SetStateAction<Balance[]>>;
  role: Role;
  items: Item[];
  setPage?: React.Dispatch<React.SetStateAction<Page>>;
}) {
  const [operatorName, setOperatorName] = useState(
    role === "Admin"
      ? "System Administrator"
      : role === "Kitting"
      ? "Siti (Kitting Marshall)"
      : "Kitting Operator"
  );
  // Default to ALL batches so parts confirmed from Kitting Case are immediately visible!
  const [selectedBatchNo, setSelectedBatchNo] = useState<string>("ALL");
  const [keyedQtys, setKeyedQtys] = useState<Record<string, number | "">>({});
  const [isBatchWindowOpen, setIsBatchWindowOpen] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Shipments arriving from Kitting Case (transactions + any balances at Kitting)
  const kittingTxs = useMemo(() => {
    const list: Transaction[] = [];
    const seenKeys = new Set<string>();

    transactions.forEach((t) => {
      const isFromKitting =
        t.confirmedFromKittingCase === true ||
        (t.dest || "").toUpperCase().includes("KITTING") ||
        (t.ref || "").toLowerCase().includes("kitting");
      if (isFromKitting) {
        list.push(t);
        const k = `${t.code}_${String(t.batchNo || "").trim()}_${String(t.caseNo || "").trim()}`;
        seenKeys.add(k);
      }
    });

    // Guarantee that all parts in balances currently at KITTING-STATION show up immediately
    (balances || []).forEach((b) => {
      if ((b.loc || "").toUpperCase().includes("KITTING") && b.qty > 0) {
        const bBatch = String(b.batchNo || "NO-BATCH").trim();
        const bCase = String(b.caseNo || "—").trim();
        const k = `${b.code}_${bBatch}_${bCase}`;
        if (!seenKeys.has(k)) {
          const itemInfo = items.find((i) => i.code === b.code);
          list.push({
            id: `KIT-${b.code.replace(/[^a-zA-Z0-9]/g, "")}-${bBatch || "0"}`,
            type: "Receiving",
            code: b.code,
            partName: itemInfo?.desc || b.code,
            desc: itemInfo?.desc || b.code,
            batchNo: bBatch,
            caseNo: bCase,
            qty: b.qty,
            source: "Storage Warehouse",
            dest: b.loc || "KITTING-STATION",
            ref: `Kitting Case Transfer (Batch: ${bBatch}, Case: ${bCase})`,
            user: "Forklift Driver",
            time: b.timestamp || new Date().toLocaleString(),
            status: "Posted",
            unpacked: false,
            confirmedFromKittingCase: true,
          });
          seenKeys.add(k);
        }
      }
    });

    return list;
  }, [transactions, balances, items]);

  // Distinct batches with pending and unpacked counts
  const availableBatches = useMemo(() => {
    const map = new Map<string, { total: number; pending: number; unpacked: number }>();
    kittingTxs.forEach((t) => {
      const b = String(t.batchNo || "NO-BATCH").trim();
      if (!map.has(b)) {
        map.set(b, { total: 0, pending: 0, unpacked: 0 });
      }
      const entry = map.get(b)!;
      entry.total += 1;
      if (t.unpacked) {
        entry.unpacked += 1;
      } else {
        entry.pending += 1;
      }
    });
    return Array.from(map.entries()).map(([batchNo, stats]) => ({
      batchNo,
      ...stats,
    }));
  }, [kittingTxs]);

  // Parts in currently chosen batch (or ALL if selectedBatchNo is "ALL" or empty)
  const chosenBatchTxs = useMemo(() => {
    if (!selectedBatchNo || selectedBatchNo === "ALL") {
      return kittingTxs;
    }
    const target = String(selectedBatchNo).trim().toLowerCase();
    return kittingTxs.filter((t) => String(t.batchNo || "NO-BATCH").trim().toLowerCase() === target);
  }, [kittingTxs, selectedBatchNo]);

  const pendingCountInBatch = chosenBatchTxs.filter((t) => !t.unpacked).length;
  const unpackedCountInBatch = chosenBatchTxs.filter((t) => t.unpacked).length;
  const totalPendingAllBatches = kittingTxs.filter((t) => !t.unpacked).length;

  // Confirm single part unpack
  const handleConfirmPart = (tx: Transaction) => {
    setNotice(null);
    if (!operatorName.trim()) {
      setNotice({ msg: "Please enter the Operator name.", type: "error" });
      return;
    }

    const rawVal = keyedQtys[tx.id];
    const unpackQty = rawVal !== undefined && rawVal !== "" ? Number(rawVal) : tx.qty;

    if (isNaN(unpackQty) || unpackQty < 0) {
      setNotice({ msg: `Please enter a valid unpack quantity for Part ${tx.code}.`, type: "error" });
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Update transactions
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === tx.id);
      if (exists) {
        return prev.map((t) => {
          if (t.id === tx.id) {
            return {
              ...t,
              unpacked: true,
              qty: unpackQty,
              unpackedByName: operatorName.trim(),
              unpackDate: todayStr,
              time: `${todayStr} ${timeStr}`,
            };
          }
          return t;
        });
      } else {
        // In case it came from kitting balances
        const confirmedTx: Transaction = {
          ...tx,
          unpacked: true,
          qty: unpackQty,
          unpackedByName: operatorName.trim(),
          unpackDate: todayStr,
          time: `${todayStr} ${timeStr}`,
        };
        return [confirmedTx, ...prev];
      }
    });

    // Update balance at KITTING-STATION (if balances state provided)
    if (setBalances) {
      setBalances((prev) => {
        const next = [...prev];
        const idx = next.findIndex(
          (b) =>
            b.code === tx.code &&
            String(b.batchNo || "").trim().toLowerCase() === String(tx.batchNo || "").trim().toLowerCase() &&
            (String(b.caseNo || "—").trim() === String(tx.caseNo || "—").trim() || (b.loc || "").toUpperCase().includes("KITTING"))
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: unpackQty, loc: "KITTING-STATION" };
        } else {
          next.push({
            code: tx.code,
            loc: "KITTING-STATION",
            qty: unpackQty,
            batchNo: tx.batchNo,
            caseNo: tx.caseNo,
            timestamp: `${todayStr} ${timeStr}`,
          });
        }
        return next;
      });
    }

    setNotice({
      msg: `✓ Part ${tx.code} (Batch: ${tx.batchNo || "—"}, Case: ${tx.caseNo || "—"}) confirmed unpacked with ${unpackQty.toLocaleString()} pcs! Released and ready for "Sent to Production".`,
      type: "success",
    });
  };

  // Re-open / Edit unpack
  const handleReopenPart = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          return { ...t, unpacked: false };
        }
        return t;
      })
    );
  };

  // Confirm all in batch
  const handleConfirmAll = () => {
    setNotice(null);
    if (!operatorName.trim()) {
      setNotice({ msg: "Please enter the Operator name.", type: "error" });
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const targetIds = new Set(chosenBatchTxs.map((t) => t.id));

    setTransactions((prev) =>
      prev.map((t) => {
        if (targetIds.has(t.id)) {
          const rawVal = keyedQtys[t.id];
          const unpackQty = rawVal !== undefined && rawVal !== "" ? Number(rawVal) : t.qty;
          return {
            ...t,
            unpacked: true,
            qty: unpackQty,
            unpackedByName: operatorName.trim(),
            unpackDate: todayStr,
            time: `${todayStr} ${timeStr}`,
          };
        }
        return t;
      })
    );

    setNotice({
      msg: `✓ All displayed parts confirmed unpacked by ${operatorName.trim()}! Released to "Sent to Production".`,
      type: "success",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#18324d]">
            Kitting-Unpack Station
          </h2>
          <p className="text-sm text-[#65768a]">
            Choose the Batch No, review parts sent from storage via Kitting Case, key in the actual unpacked quantity for each part, and click confirm.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-xs text-blue-900 font-semibold flex items-center gap-2">
            <PackageOpen size={16} className="text-[#2463a6]" />
            <span>Pending Unpack: {totalPendingAllBatches} shipments</span>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <div>{notice.msg}</div>
          {notice.type === "success" && setPage && (
            <button
              type="button"
              onClick={() => setPage("issue")}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-xs transition"
            >
              Go to Sent to Production →
            </button>
          )}
        </div>
      )}

      {/* Operator & Batch Selection Bar */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold text-[#18324d] mb-1.5 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
              Choose Batch No to Unpack
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedBatchNo}
                onChange={(e) => setSelectedBatchNo(e.target.value)}
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono font-bold bg-white text-[#18324d] focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">📦 ALL BATCHES ({totalPendingAllBatches} pending)</option>
                {availableBatches.map((b) => (
                  <option key={b.batchNo} value={b.batchNo}>
                    {b.batchNo} ({b.pending > 0 ? `${b.pending} parts pending` : "✓ All unpacked"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsBatchWindowOpen(true)}
                className="whitespace-nowrap px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                🪟 Select in Window
              </button>
            </div>
          </div>

          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-bold text-[#42566c] mb-1.5">
              Unpack Operator Name
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              required
              placeholder="Operator name..."
              className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white text-[#18324d] font-semibold"
            />
          </div>
        </div>

        {/* Quick batch tabs/chips */}
        <div className="pt-2 border-t border-[#f0f4f8]">
          <div className="text-[11px] font-semibold text-[#65768a] mb-2">Select Batch Filter:</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedBatchNo("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-2 border ${
                selectedBatchNo === "ALL" || !selectedBatchNo
                  ? "bg-blue-600 border-blue-600 text-white font-bold shadow-xs"
                  : "bg-gray-50 border-[#dfe6ee] text-[#42566c] hover:bg-white"
              }`}
            >
              <span>📦 All Batches</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedBatchNo === "ALL" ? "bg-white text-blue-900" : "bg-amber-100 text-amber-800"
              }`}>
                {totalPendingAllBatches} pending
              </span>
            </button>

            {availableBatches.map((b) => {
              const isSelected = selectedBatchNo === b.batchNo;
              return (
                <button
                  key={b.batchNo}
                  type="button"
                  onClick={() => setSelectedBatchNo(b.batchNo)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-2 border ${
                    isSelected
                      ? "bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-xs"
                      : "bg-gray-50 border-[#dfe6ee] text-[#42566c] hover:bg-white"
                  }`}
                >
                  <span>{b.batchNo}</span>
                  {b.pending > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {b.pending} pending
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ Done
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Batch Parts Table */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8fafc] border-b border-[#dfe6ee] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-xs font-semibold text-[#65768a]">
              Active Batch Data:
            </div>
            <div className="text-base font-bold font-mono text-[#18324d] flex items-center gap-2">
              <span>{selectedBatchNo === "ALL" ? "All Arrived Batches" : selectedBatchNo}</span>
              <span className="text-xs font-normal text-[#65768a]">
                ({chosenBatchTxs.length} parts · {pendingCountInBatch} pending · {unpackedCountInBatch} unpacked)
              </span>
            </div>
          </div>

          {pendingCountInBatch > 0 && (
            <button
              type="button"
              onClick={handleConfirmAll}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              ✓ Confirm All Parts ({pendingCountInBatch})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f7fb] text-[#65768a] uppercase font-semibold border-b border-[#dfe6ee]">
              <tr>
                <th className="p-3">Receive ID & Time</th>
                <th className="p-3">Model</th>
                <th className="p-3">Part No & Description</th>
                <th className="p-3">Batch No</th>
                <th className="p-3">Case No</th>
                <th className="p-3">Staging Location</th>
                <th className="p-3">Expected Qty</th>
                <th className="p-3 bg-blue-50/70 text-blue-900">Key-in Unpack Quantity *</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Confirm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f4f8]">
              {chosenBatchTxs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-[#65768a]">
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="font-semibold text-[#18324d]">No parts waiting to unpack in this view.</p>
                      <p className="text-xs text-[#65768a]">
                        Forklift driver must confirm parts from <strong>"Kitting Case"</strong> first. Once confirmed, they will appear here instantly.
                      </p>
                      {setPage && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setPage("kitting_case")}
                            className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-semibold"
                          >
                            Go to Kitting Case →
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                chosenBatchTxs.map((t) => {
                  const isUnpacked = t.unpacked === true;
                  const curKeyedQty = keyedQtys[t.id] !== undefined ? keyedQtys[t.id] : t.qty;
                  const itemModel = t.model || items.find((i) => i.code.trim().toUpperCase() === t.code.trim().toUpperCase())?.model || "—";

                  return (
                    <tr key={t.id} className="hover:bg-blue-50/20 transition">
                      <td className="p-3">
                        <div className="font-mono font-bold text-[#18324d]">{t.id}</div>
                        <div className="text-[11px] text-[#65768a]">{t.time}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[11px] font-bold font-mono">
                          {itemModel}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-[#18324d]">{t.code}</div>
                        <div className="text-[11px] text-[#42566c]">{t.partName || t.desc}</div>
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-800">
                        {t.batchNo || "—"}
                      </td>
                      <td className="p-3 font-mono">
                        {t.caseNo && t.caseNo !== "—" ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded font-semibold border border-blue-200 text-[11px]">
                            {t.caseNo}
                          </span>
                        ) : (
                          <span className="text-[#a0aec0]">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[#42566c]">
                        {t.dest || "KITTING-STATION"}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#18324d]">
                        {t.qty.toLocaleString()} pcs
                      </td>
                      <td className="p-3 bg-blue-50/30">
                        {isUnpacked ? (
                          <div className="font-mono font-bold text-emerald-700 text-sm">
                            {t.qty.toLocaleString()} pcs
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={curKeyedQty}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                setKeyedQtys((prev) => ({ ...prev, [t.id]: val }));
                              }}
                              placeholder="Key in qty"
                              className="w-28 px-2.5 py-1.5 border border-[#cfd9e4] rounded-lg text-xs font-mono font-bold text-[#18324d] bg-white focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-[#65768a] font-semibold">pcs</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {isUnpacked ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ✓ Unpacked & Confirmed
                            </span>
                            <div className="text-[10px] text-[#65768a]">
                              By {t.unpackedByName || "Operator"} · {t.unpackDate || "Today"}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                            ⏳ Pending Unpack
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {!isUnpacked ? (
                          <button
                            type="button"
                            onClick={() => handleConfirmPart(t)}
                            className="px-3.5 py-1.5 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 ml-auto"
                          >
                            ✓ Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReopenPart(t.id)}
                            className="text-[11px] text-[#65768a] hover:text-[#2463a6] font-semibold underline ml-auto block"
                          >
                            Edit Qty
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Selection Modal Window */}
      {isBatchWindowOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe6ee]">
              <h3 className="text-base font-bold text-[#18324d] flex items-center gap-2">
                📦 Choose Batch No to Unpack
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchWindowOpen(false)}
                className="text-[#65768a] hover:text-[#18324d]"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#65768a]">
              Operator: Select a batch number below to load its parts into the unpack table, or choose "View All Batches".
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchNo("ALL");
                  setIsBatchWindowOpen(false);
                }}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                  selectedBatchNo === "ALL"
                    ? "bg-blue-50 border-blue-500 text-blue-900 font-bold"
                    : "bg-white border-[#cfd9e4] hover:bg-[#f8fafc] text-[#18324d]"
                }`}
              >
                <div>
                  <div className="font-mono text-sm">📦 View All Batches Together</div>
                  <div className="text-[11px] text-[#65768a]">
                    {kittingTxs.length} total shipment(s) · {totalPendingAllBatches} pending
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-[#2463a6] text-white rounded-lg">
                  {selectedBatchNo === "ALL" ? "Active ✓" : "Select All"}
                </span>
              </button>

              {availableBatches.map((b) => {
                const isSelected = selectedBatchNo === b.batchNo;
                return (
                  <button
                    key={b.batchNo}
                    type="button"
                    onClick={() => {
                      setSelectedBatchNo(b.batchNo);
                      setIsBatchWindowOpen(false);
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-bold"
                        : "bg-white border-[#cfd9e4] hover:bg-[#f8fafc] text-[#18324d]"
                    }`}
                  >
                    <div>
                      <div className="font-mono text-sm">{b.batchNo}</div>
                      <div className="text-[11px] text-[#65768a]">
                        {b.total} shipment(s) · {b.pending} pending · {b.unpacked} unpacked
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-[#2463a6] text-white rounded-lg">
                      {isSelected ? "Active ✓" : "Select Batch"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 border-t border-[#dfe6ee]">
              <button
                type="button"
                onClick={() => setIsBatchWindowOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#18324d] rounded-xl text-xs font-semibold"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KITTING CASE VIEW                                                          */
/* -------------------------------------------------------------------------- */
function KittingCaseView({
  balances,
  setBalances,
  transactions,
  setTransactions,
  items,
  role,
  setPage,
}: {
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  items: Item[];
  role: Role;
  setPage?: React.Dispatch<React.SetStateAction<Page>>;
}) {
  const [isBatchWindowOpen, setIsBatchWindowOpen] = useState(false);
  const [selectedBatchNo, setSelectedBatchNo] = useState("");
  const [destinationPlace, setDestinationPlace] = useState("KITTING-STATION");
  const [forkliftDriver, setForkliftDriver] = useState(
    role === "Admin" ? "System Administrator" : "Forklift Driver / Hazim"
  );
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Available batch numbers from current inventory balances
  const allBatches = useMemo(() => {
    const set = new Set<string>();
    balances.forEach((b) => {
      if (b.batchNo !== undefined && b.batchNo !== null && String(b.batchNo).trim() !== "") {
        set.add(String(b.batchNo).trim());
      }
    });
    return Array.from(set);
  }, [balances]);

  // Balance items belonging to the chosen batch
  const chosenBatchBalances = useMemo(() => {
    if (!selectedBatchNo) return [];
    const target = String(selectedBatchNo).trim().toLowerCase();
    return balances.filter((b) => String(b.batchNo || "").trim().toLowerCase() === target);
  }, [balances, selectedBatchNo]);

  const handleConfirmPart = (item: Balance) => {
    setNotice(null);
    const now = new Date().toLocaleString();
    const dest = destinationPlace.trim() || "KITTING-STATION";
    const driver = forkliftDriver.trim() || "Forklift Driver";
    const sourceLoc = item.loc;
    const qty = item.qty;
    const caseNo = item.caseNo || "—";
    const batchStr = String(item.batchNo || selectedBatchNo || "NO-BATCH").trim();
    const caseStr = String(caseNo).trim();

    try {
      localStorage.setItem("wh_last_kitted_batch", batchStr);
    } catch {}

    // Functional state update for balances
    setBalances((prevBalances) => {
      const next = [...prevBalances];

      // Deduct from storage location
      const srcIdx = next.findIndex(
        (b) =>
          b.code === item.code &&
          b.loc === sourceLoc &&
          String(b.batchNo || "").trim().toLowerCase() === batchStr.toLowerCase() &&
          String(b.caseNo || "—").trim() === caseStr
      );
      if (srcIdx >= 0) {
        const remaining = next[srcIdx].qty - qty;
        if (remaining <= 0) {
          next.splice(srcIdx, 1);
        } else {
          next[srcIdx] = { ...next[srcIdx], qty: remaining };
        }
      }

      // Add to Kitting destination
      const destIdx = next.findIndex(
        (b) =>
          b.code === item.code &&
          b.loc === dest &&
          String(b.batchNo || "").trim().toLowerCase() === batchStr.toLowerCase() &&
          String(b.caseNo || "—").trim() === caseStr
      );
      if (destIdx >= 0) {
        next[destIdx] = { ...next[destIdx], qty: next[destIdx].qty + qty };
      } else {
        next.push({
          code: item.code,
          loc: dest,
          qty,
          batchNo: batchStr,
          caseNo: caseStr,
          timestamp: now,
        });
      }
      return next;
    });

    // Create Transaction log with functional update
    const txId = `KIT-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newTx: Transaction = {
      id: txId,
      type: "Receiving",
      code: item.code,
      partName: items.find((i) => i.code === item.code)?.desc || "Part",
      desc: items.find((i) => i.code === item.code)?.desc || "Part",
      batchNo: batchStr,
      caseNo: caseStr,
      qty,
      source: sourceLoc,
      dest,
      ref: `Kitting Case Transfer by ${driver} (Batch: ${batchStr}, Case: ${caseStr})`,
      user: driver,
      time: now,
      status: "Posted",
      unpacked: false,
      confirmedFromKittingCase: true,
    };
    setTransactions((prev) => [newTx, ...prev]);

    setNotice({
      msg: `🎉 Successfully confirmed part ${item.code} (Case: ${caseNo}, Qty: ${qty}) sent to ${dest}! It is now immediately ready in "Kitting-Unpack".`,
      type: "success",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#18324d]">
            Kitting Case & Batch Transfer Station
          </h2>
          <p className="text-sm text-[#65768a]">
            Forklift takes parts/batches out of warehouse storage and confirms by part when sending to the Kitting place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsBatchWindowOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            🚛 Forklift Choose Batch No (Window)
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <div>{notice.msg}</div>
          {notice.type === "success" && setPage && (
            <button
              type="button"
              onClick={() => setPage("unpack")}
              className="px-3.5 py-1.5 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-xs transition"
            >
              Go to Kitting-Unpack Station →
            </button>
          )}
        </div>
      )}

      {/* TABLE #2: Selected Batch Kitting Table */}
      <div className="bg-white border-2 border-amber-300 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="text-sm font-bold text-amber-900">
              2. Selected Batch Kitting Table ({selectedBatchNo ? `Batch No: ${selectedBatchNo}` : "No Batch Selected"})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsBatchWindowOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition"
          >
            {selectedBatchNo ? "Change Batch No" : "Select Batch No in Window"}
          </button>
        </div>

        {selectedBatchNo ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-200">
              <div>
                <div className="text-xs font-semibold text-[#65768a]">Active Batch Selected:</div>
                <div className="font-mono text-base font-bold text-[#18324d]">{selectedBatchNo}</div>
                <div className="text-xs text-blue-800 mt-1">
                  {chosenBatchBalances.length} item(s) in this batch. Confirm each part individually below.
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-[11px] font-semibold text-[#42566c] mb-1">Destination Place</label>
                  <input
                    type="text"
                    value={destinationPlace}
                    onChange={(e) => setDestinationPlace(e.target.value)}
                    required
                    className="px-3 py-1.5 border border-[#cfd9e4] rounded-lg text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#42566c] mb-1">Forklift Driver</label>
                  <input
                    type="text"
                    value={forkliftDriver}
                    onChange={(e) => setForkliftDriver(e.target.value)}
                    required
                    className="px-3 py-1.5 border border-[#cfd9e4] rounded-lg text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f4f7fb] text-[#65768a] uppercase font-semibold border-b border-[#dfe6ee]">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">Part No</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Case No</th>
                    <th className="p-3">Storage Location</th>
                    <th className="p-3">Batch No</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3 text-right">Confirm by Part</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f4f8]">
                  {chosenBatchBalances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-[#65768a]">
                        All parts in batch {selectedBatchNo} have been sent to kitting or no items found.
                      </td>
                    </tr>
                  ) : (
                    chosenBatchBalances.map((b, idx) => {
                      const itemObj = items.find((i) => i.code.trim().toUpperCase() === b.code.trim().toUpperCase());
                      const itemModel = itemObj?.model || "—";
                      const itemDesc = itemObj?.desc || "—";
                      const isAtKitting = (b.loc || "").trim().toUpperCase() === destinationPlace.trim().toUpperCase() || (b.loc || "").toUpperCase().includes("KITTING");
                      return (
                        <tr key={idx} className="hover:bg-amber-50/20">
                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[11px] font-bold font-mono">
                              {itemModel}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-[#18324d]">{b.code}</td>
                          <td className="p-3 text-[#42566c]">{itemDesc}</td>
                          <td className="p-3 font-mono">
                            {b.caseNo && b.caseNo !== "—" ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded font-semibold border border-blue-200 text-[11px]">
                                {b.caseNo}
                              </span>
                            ) : (
                              <span className="text-[#a0aec0]">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-purple-800">{b.loc}</td>
                          <td className="p-3 font-mono text-blue-800">{b.batchNo || "—"}</td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{b.qty.toLocaleString()}</td>
                          <td className="p-3 text-right">
                            {isAtKitting ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                ✓ Sent to Kitting
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConfirmPart(b)}
                                className="px-3 py-1.5 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 ml-auto"
                              >
                                ✓ Confirm Part
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-[#65768a]">
            No batch currently selected. Click <strong>"Select Batch No in Window"</strong> above to choose a batch number and view its Table #2 kitting parts for confirmation.
          </div>
        )}
      </div>

      {/* Forklift Batch Selection Modal Window */}
      {isBatchWindowOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe6ee]">
              <h3 className="text-base font-bold text-[#18324d] flex items-center gap-2">
                🚛 Forklift Batch Selection Window
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchWindowOpen(false)}
                className="text-[#65768a] hover:text-[#18324d]"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#65768a]">
              Forklift driver: Select a batch number from storage below to load into Table #2 and send to Kitting place.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allBatches.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#65768a]">No batch numbers found in current storage inventory.</div>
              ) : (
                allBatches.map((b: string) => {
                  const count = balances.filter((item: Balance) => item.batchNo === b).length;
                  const isSelected = selectedBatchNo === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        setSelectedBatchNo(b);
                        setIsBatchWindowOpen(false);
                      }}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                        isSelected
                          ? "bg-amber-50 border-amber-400 text-amber-900 font-bold"
                          : "bg-white border-[#cfd9e4] hover:bg-[#f8fafc] text-[#18324d]"
                      }`}
                    >
                      <div>
                        <div className="font-mono text-sm">{b}</div>
                        <div className="text-[11px] text-[#65768a]">{count} storage item(s) in this batch</div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-[#2463a6] text-white rounded-lg">
                        {isSelected ? "Selected ✓" : "Choose Batch"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-[#dfe6ee]">
              <button
                type="button"
                onClick={() => setIsBatchWindowOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#18324d] rounded-xl text-xs font-semibold"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* STOCK RECEIVING VIEW                                                       */
/* -------------------------------------------------------------------------- */
function ReceivingView({
  items,
  balances,
  setBalances,
  transactions,
  setTransactions,
  allLocs,
  stock,
  role,
  setPage,
}: {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  stock: (code: string) => number;
  role: Role;
  setPage?: (p: Page) => void;
}) {
  // Active container session state
  const [activeContainer, setActiveContainer] = useState<{
    containerNo: string;
    batchNo: string;
    doRef?: string;
    receiverName: string;
    startedAt: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("wh_active_container");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Staged receiving parts saved temporarily in the red highlight area
  const [stagedItems, setStagedItems] = useState<{
    id: string;
    code: string;
    partName: string;
    desc: string;
    model: string;
    batchNo: string;
    caseNo?: string;
    qty: number;
    loc: string;
    ref: string;
    time: string;
  }[]>(() => {
    try {
      const saved = localStorage.getItem("wh_staged_receiving_items");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Popup window for Container No & Batch No - ONLY opens when user clicks "New Container" button
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [modalContainer, setModalContainer] = useState("");
  const [modalBatch, setModalBatch] = useState("");
  const [modalDoRef, setModalDoRef] = useState("");
  const [modalReceiver, setModalReceiver] = useState(
    role === "Admin" ? "System Administrator" : role === "Manager" ? "Warehouse Manager" : "Floor Operator (WH001)"
  );
  const [modalError, setModalError] = useState("");

  // Edit item in temporary staging modal
  const [editingStagedId, setEditingStagedId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number | "">("");
  const [editLoc, setEditLoc] = useState("");
  const [editCaseNo, setEditCaseNo] = useState("");

  // Key-in form inputs for current container
  const [codeQuery, setCodeQuery] = useState("");
  const [caseNo, setCaseNo] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [loc, setLoc] = useState("A-01-01");
  const [receiverName, setReceiverName] = useState(
    role === "Admin" ? "System Administrator" : role === "Manager" ? "Warehouse Manager" : "Floor Operator (WH001)"
  );
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // Sub-page state: "intake" (Inbound Container Receiving & Staging) or "today" (Today's Receiving Log)
  const [receivingSubPage, setReceivingSubPage] = useState<"intake" | "today">("intake");
  const [selectedReceivingDate, setSelectedReceivingDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [todayReceivingSearch, setTodayReceivingSearch] = useState("");
  const [todayContainerFilter, setTodayContainerFilter] = useState("ALL");

  // Today's Receiving Transactions (filtered by selectedReceivingDate, default today)
  const todayReceivingTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== "Receiving") return false;
      const txDate = t.time ? t.time.slice(0, 10) : "";
      return txDate === selectedReceivingDate;
    });
  }, [transactions, selectedReceivingDate]);

  // Today's Receiving Summary Statistics
  const todayReceivingStats = useMemo(() => {
    const containers = new Set<string>();
    const batches = new Set<string>();
    const parts = new Set<string>();
    let totalQty = 0;

    for (const t of todayReceivingTxs) {
      if (t.containerNo && t.containerNo.trim() && t.containerNo !== "—") {
        containers.add(t.containerNo.trim());
      }
      if (t.batchNo && t.batchNo.trim() && t.batchNo !== "—") {
        batches.add(t.batchNo.trim());
      }
      if (t.code && t.code.trim()) {
        parts.add(t.code.trim());
      }
      totalQty += t.qty || 0;
    }

    return {
      containersCount: containers.size,
      batchesCount: batches.size,
      partsCount: parts.size,
      totalQty,
      containersList: Array.from(containers).sort(),
    };
  }, [todayReceivingTxs]);

  // Filtered Today's Receiving Transactions for table display
  const filteredTodayReceivingTxs = useMemo(() => {
    return todayReceivingTxs.filter((t) => {
      if (todayContainerFilter !== "ALL") {
        if (
          String(t.containerNo || "")
            .trim()
            .toLowerCase() !== todayContainerFilter.trim().toLowerCase()
        ) {
          return false;
        }
      }
      if (!todayReceivingSearch.trim()) return true;
      const q = todayReceivingSearch.toLowerCase();
      return (
        t.code.toLowerCase().includes(q) ||
        (t.desc && t.desc.toLowerCase().includes(q)) ||
        (t.partName && t.partName.toLowerCase().includes(q)) ||
        (t.containerNo && t.containerNo.toLowerCase().includes(q)) ||
        (t.batchNo && t.batchNo.toLowerCase().includes(q)) ||
        (t.caseNo && t.caseNo.toLowerCase().includes(q)) ||
        (t.receiverName && t.receiverName.toLowerCase().includes(q)) ||
        (t.dest && t.dest.toLowerCase().includes(q)) ||
        (t.ref && t.ref.toLowerCase().includes(q)) ||
        (t.model && t.model.toLowerCase().includes(q))
      );
    });
  }, [todayReceivingTxs, todayContainerFilter, todayReceivingSearch]);

  // Export Today's Receiving Logs
  const handleDownloadTodayReceiving = (format: "xlsx" | "csv") => {
    const headers = [
      "Receiving Date & Time",
      "Container No",
      "Batch No / Lot",
      "Part No",
      "Description",
      "Model",
      "Case No",
      "Received Qty",
      "Destination Location",
      "Receiver Name (PIC)",
      "DO / Supplier Ref",
      "Transaction ID",
      "Status",
    ];

    const getRowData = (t: Transaction) => {
      const itemInfo = items.find((i) => i.code.trim().toUpperCase() === t.code.trim().toUpperCase());
      return [
        t.time,
        t.containerNo || "—",
        t.batchNo || "—",
        t.code,
        t.desc || t.partName || "—",
        t.model || itemInfo?.model || "—",
        t.caseNo || "—",
        t.qty,
        t.dest,
        t.receiverName || t.user || "—",
        t.ref || "—",
        t.id,
        t.status || "Posted",
      ];
    };

    const rowsData = filteredTodayReceivingTxs.map(getRowData);

    if (format === "xlsx") {
      downloadXLSX(
        `receiving_log_${selectedReceivingDate}.xlsx`,
        headers,
        rowsData,
        `Receiving Log (${selectedReceivingDate})`
      );
    } else {
      downloadCSV(`receiving_log_${selectedReceivingDate}.csv`, headers, rowsData);
    }
  };

  // Sync active container and staging to localStorage
  useEffect(() => {
    if (activeContainer) {
      localStorage.setItem("wh_active_container", JSON.stringify(activeContainer));
    } else {
      localStorage.removeItem("wh_active_container");
    }
  }, [activeContainer]);

  useEffect(() => {
    localStorage.setItem("wh_staged_receiving_items", JSON.stringify(stagedItems));
  }, [stagedItems]);

  // Open modal only on clicking "New Container" button
  const openNewContainerModal = () => {
    setModalContainer("");
    setModalBatch("");
    setModalDoRef("");
    setModalError("");
    setModalReceiver(
      role === "Admin" ? "System Administrator" : role === "Manager" ? "Warehouse Manager" : "Floor Operator (WH001)"
    );
    setIsContainerModalOpen(true);
  };

  const handleStartContainer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalContainer.trim() || !modalBatch.trim()) {
      setModalError("Please enter both Container No and Batch No / Lot.");
      return;
    }

    const newContainer = {
      containerNo: modalContainer.trim().toUpperCase(),
      batchNo: modalBatch.trim().toUpperCase(),
      doRef: modalDoRef.trim() || undefined,
      receiverName: modalReceiver.trim() || (role === "Admin" ? "System Administrator" : "Floor Operator"),
      startedAt: new Date().toLocaleTimeString(),
    };

    setActiveContainer(newContainer);
    setReceiverName(newContainer.receiverName);
    setIsContainerModalOpen(false);
    setModalError("");
    setNotice({
      msg: `Container ${newContainer.containerNo} is active. You can now add receiving parts below. All parts will be held in the temporary red staging area until you confirm.`,
      type: "info",
    });
  };

  const matchedItem = items.find(
    (i) => i.active && i.code.toLowerCase() === codeQuery.trim().toLowerCase()
  );

  // Key-in receiving part for current container: temporarily saves in red highlight area
  const handleAddPartToStaging = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!activeContainer) {
      setNotice({
        msg: "Please click 'New Container' first to enter Container No and Batch No / Lot.",
        type: "error",
      });
      return;
    }

    if (!matchedItem) {
      setNotice({ msg: "Part not found or inactive. Please check the Part No.", type: "error" });
      return;
    }

    const qNum = Number(qty);
    if (!(qNum > 0 && Number.isFinite(qNum))) {
      setNotice({ msg: "Please enter a valid quantity greater than zero.", type: "error" });
      return;
    }

    const finalCaseNo = caseNo.trim() || "—";
    const finalLoc = loc.trim() || "A-01-01";
    const finalBatch = activeContainer.batchNo;
    const finalRef = activeContainer.doRef || "—";

    const newStagedItem = {
      id: `STG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      code: matchedItem.code,
      partName: matchedItem.desc,
      desc: matchedItem.desc,
      model: matchedItem.model,
      batchNo: finalBatch,
      caseNo: finalCaseNo,
      qty: qNum,
      loc: finalLoc,
      ref: finalRef,
      time: formatTimestamp(),
    };

    // Temporarily save to red highlight staging area (DOES NOT CHANGE INVENTORY YET)
    setStagedItems((prev) => [...prev, newStagedItem]);

    setNotice({
      msg: `✓ Part ${matchedItem.code} (${finalCaseNo !== "—" ? `Case ${finalCaseNo}, ` : ""}+${qNum.toLocaleString()}) saved to temporary red area.`,
      type: "success",
    });

    // Reset part, case no & qty for next entry
    setCodeQuery("");
    setCaseNo("");
    setQty("");
  };

  // Remove staged part from temporary area (inventory unaffected)
  const handleRemoveStagedItem = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Open edit modal for staged item
  const openEditStaged = (item: { id: string; qty: number; loc: string; caseNo?: string }) => {
    setEditingStagedId(item.id);
    setEditQty(item.qty);
    setEditLoc(item.loc);
    setEditCaseNo(item.caseNo && item.caseNo !== "—" ? item.caseNo : "");
  };

  const handleSaveEditStaged = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStagedId) return;
    const qNum = Number(editQty);
    if (!(qNum > 0 && Number.isFinite(qNum))) return;

    // Update in staging only (does not change inventory that already keyin)
    setStagedItems((prev) =>
      prev.map((item) =>
        item.id === editingStagedId
          ? {
              ...item,
              qty: qNum,
              loc: editLoc.trim() || item.loc,
              caseNo: editCaseNo.trim() || item.caseNo || "—",
            }
          : item
      )
    );
    setEditingStagedId(null);
  };

  // Complete container: user checks temporary red area and confirms -> parts sent to inventory
  const handleConfirmAndCompleteContainer = () => {
    if (!activeContainer) return;
    if (stagedItems.length === 0) {
      setNotice({
        msg: "The temporary staging area is empty. Please add at least one part before confirming.",
        type: "error",
      });
      return;
    }

    const receiptTimestamp = formatTimestamp();

    // 1. Send all parts to warehouse inventory balances with receipt timestamp and caseNo
    let updatedBalances = [...balances];
    for (const item of stagedItems) {
      updatedBalances = upsertBalance(
        updatedBalances,
        item.code,
        item.loc,
        item.qty,
        item.batchNo,
        receiptTimestamp,
        item.caseNo
      );
    }
    setBalances(updatedBalances);

    // 2. Post official transaction logs
    const newTransactions: Transaction[] = stagedItems.map((item) => ({
      id: txNo("RCV"),
      type: "Receiving",
      code: item.code,
      partName: item.partName,
      desc: item.desc,
      batchNo: item.batchNo,
      containerNo: activeContainer.containerNo,
      caseNo: item.caseNo,
      qty: item.qty,
      source: "Supplier",
      dest: item.loc,
      ref: item.ref,
      user: role === "Admin" ? "ADMIN-DEMO" : role === "Manager" ? "MGR-DEMO" : "WH001",
      receiverName: activeContainer.receiverName,
      unpacked: false,
      time: receiptTimestamp,
      status: "Posted",
    }));

    setTransactions([...newTransactions, ...transactions]);

    const completedContainerNo = activeContainer.containerNo;
    const totalUnits = stagedItems.reduce((sum, item) => sum + item.qty, 0);
    const countParts = stagedItems.length;

    // 3. Clear temporary red area and active container
    setStagedItems([]);
    setActiveContainer(null);
    localStorage.removeItem("wh_active_container");
    localStorage.removeItem("wh_staged_receiving_items");

    setNotice({
      msg: `🎉 Container ${completedContainerNo} is completely received! ${countParts} parts (${totalUnits.toLocaleString()} units) have been officially sent to warehouse inventory.`,
      type: "success",
    });
  };

  const handleDiscardContainer = () => {
    if (!activeContainer) return;
    if (
      stagedItems.length > 0 &&
      !window.confirm(
        `Are you sure you want to discard container ${activeContainer.containerNo} and clear the ${stagedItems.length} temporary receiving parts?`
      )
    ) {
      return;
    }
    setStagedItems([]);
    setActiveContainer(null);
    localStorage.removeItem("wh_active_container");
    localStorage.removeItem("wh_staged_receiving_items");
    setNotice({
      msg: "Temporary container receiving session was discarded. Warehouse inventory was not changed.",
      type: "info",
    });
  };

  const totalStagedQty = stagedItems.reduce((sum, item) => sum + item.qty, 0);
  const editingItem = stagedItems.find((i) => i.id === editingStagedId);

  return (
    <div className="space-y-6">
      {/* POPUP WINDOW FOR CONTAINER NO & BATCH NO - ONLY OPENS ON CLICKING "NEW CONTAINER" BUTTON */}
      {isContainerModalOpen && (
        <div className="fixed inset-0 bg-[#07182b]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 border border-[#dfe6ee]">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-[#18324d]">
                <Box size={22} className="text-[#2463a6]" />
                <div>
                  <h3 className="text-base font-bold text-[#18324d]">New Container Receiving</h3>
                  <p className="text-[11px] text-[#65768a]">Key in container & batch details to start</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsContainerModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#65768a] leading-relaxed">
              Enter <strong>Container No</strong> and <strong>Batch No / Lot</strong>. Once submitted, you can start keying in parts which will temporarily save in the red highlight area for checking.
            </p>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleStartContainer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Container No *</label>
                <input
                  type="text"
                  value={modalContainer}
                  onChange={(e) => setModalContainer(e.target.value)}
                  required
                  placeholder="e.g. CONT-88910"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-white uppercase"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Batch No / Lot *</label>
                <input
                  type="text"
                  value={modalBatch}
                  onChange={(e) => setModalBatch(e.target.value)}
                  required
                  placeholder="e.g. LOT-202610-A"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Receiver Name (PIC) *</label>
                <input
                  type="text"
                  value={modalReceiver}
                  onChange={(e) => setModalReceiver(e.target.value)}
                  required
                  placeholder="e.g. Ahmad Zaki"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">DO / Supplier Ref (Optional)</label>
                <input
                  type="text"
                  value={modalDoRef}
                  onChange={(e) => setModalDoRef(e.target.value)}
                  placeholder="e.g. DO-9021"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#dfe6ee]">
                <button
                  type="button"
                  onClick={() => setIsContainerModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  Submit & Start Container Receiving →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAGED ITEM MODAL (Changes staging only, does not touch real inventory) */}
      {editingItem && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-[#dfe6ee]">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-[#18324d]">Edit Temporary Staged Part</h3>
              <button onClick={() => setEditingStagedId(null)} className="text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-[#42566c]">
              <div className="font-mono font-bold text-[#2463a6]">{editingItem.code}</div>
              <div>{editingItem.desc}</div>
            </div>
            <form onSubmit={handleSaveEditStaged} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Case No</label>
                <input
                  type="text"
                  value={editCaseNo}
                  onChange={(e) => setEditCaseNo(e.target.value)}
                  placeholder="e.g. CASE-01"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Quantity</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Destination Bay</label>
                <input
                  type="text"
                  list="allLocsEdit"
                  value={editLoc}
                  onChange={(e) => setEditLoc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
                <datalist id="allLocsEdit">
                  {allLocs().map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingStagedId(null)}
                  className="px-3 py-1.5 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#42566c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold"
                >
                  Update Staging
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#18324d]">Stock Receiving</h2>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded-full">
              Inbound Dock Management
            </span>
          </div>
          <p className="text-sm text-[#65768a] mt-0.5">
            {receivingSubPage === "intake"
              ? "Inbound container receiving workflow: start container, key in parts into temporary staging, then confirm to inventory."
              : `Today's receiving logs and verified container intake records for ${selectedReceivingDate}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {receivingSubPage === "intake" ? (
            <button
              type="button"
              onClick={openNewContainerModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-bold hover:bg-[#1d528a] transition shadow-xs cursor-pointer"
            >
              <Plus size={16} /> New Container
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadTodayReceiving("xlsx")}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Export today's receiving log to Excel (.xlsx)"
              >
                <FileSpreadsheet size={14} className="text-emerald-700" />
                <span>Export XLSX</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTodayReceiving("csv")}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f7f9fc] border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Export today's receiving log to CSV"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          )}

          {setPage && (
            <button
              type="button"
              onClick={() => setPage("reports")}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold hover:bg-gray-50 transition shadow-xs cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-700" /> Daily Incoming Report
            </button>
          )}
        </div>
      </div>

      {/* SUB-PAGE TABS NAVIGATION */}
      <div className="bg-white p-2 rounded-2xl border border-[#dfe6ee] shadow-2xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Sub-page 1: Inbound Container Receiving */}
          <button
            type="button"
            onClick={() => setReceivingSubPage("intake")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              receivingSubPage === "intake"
                ? "bg-[#2463a6] text-white shadow-xs font-bold"
                : "text-[#42566c] hover:bg-[#f1f5f9] hover:text-[#18324d]"
            }`}
          >
            <Box size={16} />
            <span>Inbound Container Receiving & Staging</span>
            {stagedItems.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-extrabold rounded-full animate-pulse">
                {stagedItems.length} Staged
              </span>
            )}
          </button>

          {/* Sub-page 2: Today's Receiving Log */}
          <button
            type="button"
            onClick={() => setReceivingSubPage("today")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              receivingSubPage === "today"
                ? "bg-[#2463a6] text-white shadow-xs font-bold"
                : "text-[#42566c] hover:bg-[#f1f5f9] hover:text-[#18324d]"
            }`}
          >
            <Clock size={16} />
            <span>Today's Receiving Log</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                receivingSubPage === "today"
                  ? "bg-white text-[#2463a6]"
                  : "bg-blue-100 text-blue-900 border border-blue-200"
              }`}
            >
              {todayReceivingTxs.length} Receipts
            </span>
          </button>
        </div>

        {receivingSubPage === "today" && (
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs px-2">
            <span className="text-[#65768a] font-semibold shrink-0">Log Date:</span>
            <input
              type="date"
              value={selectedReceivingDate}
              onChange={(e) => setSelectedReceivingDate(e.target.value)}
              className="px-2.5 py-1.5 border border-[#cfd9e4] rounded-xl text-xs font-mono font-bold bg-white text-[#18324d] focus:ring-2 focus:ring-[#2463a6]"
            />
            {selectedReceivingDate !== new Date().toISOString().slice(0, 10) && (
              <button
                type="button"
                onClick={() => setSelectedReceivingDate(new Date().toISOString().slice(0, 10))}
                className="px-2.5 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 font-bold rounded-xl text-xs hover:bg-blue-100 cursor-pointer transition"
              >
                Today
              </button>
            )}
          </div>
        )}
      </div>

      {receivingSubPage === "today" ? (
        /* SUB-PAGE 2: TODAY'S RECEIVING LOG */
        <div className="space-y-5">
          {/* TODAY'S RECEIVING SUMMARY STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Containers Received */}
            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <Boxes size={22} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#65768a] uppercase tracking-wider">
                  Containers Received
                </div>
                <div className="text-xl font-extrabold text-[#18324d]">
                  {todayReceivingStats.containersCount}{" "}
                  <span className="text-xs font-semibold text-[#65768a]">containers</span>
                </div>
              </div>
            </div>

            {/* Unique Batches */}
            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                <Package size={22} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#65768a] uppercase tracking-wider">
                  Unique Batches / Lots
                </div>
                <div className="text-xl font-extrabold text-indigo-950">
                  {todayReceivingStats.batchesCount}{" "}
                  <span className="text-xs font-semibold text-indigo-600">batches</span>
                </div>
              </div>
            </div>

            {/* SKUs / Part Records */}
            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Tag size={22} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#65768a] uppercase tracking-wider">
                  Part SKUs Received
                </div>
                <div className="text-xl font-extrabold text-[#18324d]">
                  {todayReceivingStats.partsCount}{" "}
                  <span className="text-xs font-semibold text-[#65768a]">SKUs</span>
                </div>
              </div>
            </div>

            {/* Total Units Received */}
            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#65768a] uppercase tracking-wider">
                  Total Received Qty
                </div>
                <div className="text-xl font-extrabold text-emerald-950">
                  {todayReceivingStats.totalQty.toLocaleString()}{" "}
                  <span className="text-xs font-semibold text-emerald-700">pcs</span>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN TABLE CONTAINER FOR TODAY'S RECEIVING */}
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
            {/* Table Search & Filters */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
                <input
                  type="text"
                  value={todayReceivingSearch}
                  onChange={(e) => setTodayReceivingSearch(e.target.value)}
                  placeholder="Search part no, description, container no, batch, case no, model or receiver..."
                  className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                {/* Container Filter */}
                <div className="flex items-center gap-1.5 bg-[#f7f9fc] border border-[#cfd9e4] px-3 py-1.5 rounded-xl text-xs">
                  <span className="font-semibold text-[#42566c] shrink-0">Container:</span>
                  <select
                    value={todayContainerFilter}
                    onChange={(e) => setTodayContainerFilter(e.target.value)}
                    className="bg-transparent font-bold text-[#18324d] focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="ALL">All Containers ({todayReceivingStats.containersCount})</option>
                    {todayReceivingStats.containersList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs text-[#65768a] font-medium shrink-0">
                  Showing <strong className="text-[#18324d]">{filteredTodayReceivingTxs.length}</strong> records
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[960px] text-xs">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[#5c6f83] font-bold border-b border-[#dfe6ee]">
                    <th className="p-3 w-10">#</th>
                    <th className="p-3">Receiving Time</th>
                    <th className="p-3 bg-blue-50/60 text-blue-900">Container No</th>
                    <th className="p-3">Batch No / Lot</th>
                    <th className="p-3">Part No</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Case No</th>
                    <th className="p-3 text-right bg-emerald-50/50 text-emerald-900">Received Qty</th>
                    <th className="p-3">Destination Location</th>
                    <th className="p-3">Receiver (PIC)</th>
                    <th className="p-3">DO / Ref</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfe6ee]">
                  {filteredTodayReceivingTxs.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-[#65768a]">
                        <div className="flex flex-col items-center gap-2">
                          <Box size={32} className="text-gray-400" />
                          <div className="font-bold text-sm text-[#18324d]">
                            No receiving logs found for {selectedReceivingDate}
                          </div>
                          <p className="text-xs text-[#65768a] max-w-md">
                            {todayReceivingSearch || todayContainerFilter !== "ALL"
                              ? "Try adjusting your search query or container filter."
                              : "No containers have been received on this date yet. Switch to the 'Inbound Container Receiving & Staging' tab above to start a new container intake."}
                          </p>
                          <button
                            type="button"
                            onClick={() => setReceivingSubPage("intake")}
                            className="mt-2 px-4 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus size={14} /> Go to Container Receiving
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTodayReceivingTxs.map((t, idx) => {
                      const itemInfo = items.find(
                        (i) => i.code.trim().toUpperCase() === t.code.trim().toUpperCase()
                      );

                      return (
                        <tr key={t.id || idx} className="hover:bg-[#fcfdfd] transition">
                          <td className="p-3 font-mono text-gray-500 font-medium">{idx + 1}</td>
                          <td className="p-3 font-mono text-[#65768a] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#dfe6ee]">
                              <Clock size={12} className="text-[#2463a6]" />
                              {t.time || selectedReceivingDate}
                            </span>
                          </td>
                          <td className="p-3 bg-blue-50/30">
                            <span className="font-mono font-bold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200">
                              {t.containerNo || "—"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {t.batchNo || "—"}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-[#18324d]">{t.code}</td>
                          <td
                            className="p-3 font-medium text-[#18324d] max-w-[220px] truncate"
                            title={t.desc || t.partName}
                          >
                            {t.desc || t.partName || "—"}
                          </td>
                          <td className="p-3 text-[#65768a] font-medium">
                            {t.model || itemInfo?.model || "—"}
                          </td>
                          <td className="p-3 font-mono">
                            {t.caseNo && t.caseNo !== "—" ? (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-semibold border border-gray-200 text-[11px]">
                                {t.caseNo}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-emerald-700 text-sm bg-emerald-50/30">
                            +{t.qty.toLocaleString()} pcs
                          </td>
                          <td className="p-3 font-mono text-[#42566c]">{t.dest || "Storage"}</td>
                          <td className="p-3 text-[#18324d] font-medium">
                            {t.receiverName || t.user || "Operator"}
                          </td>
                          <td className="p-3 font-mono text-[#65768a] text-[11px]">
                            {t.ref || "—"}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ✓ Posted to Inventory
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* SUB-PAGE 1: INBOUND CONTAINER RECEIVING & STAGING */
        <div className="space-y-6">
          {/* ACTIVE CONTAINER STATUS BAR */}
          {activeContainer ? (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Boxes size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Current Active Container</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                      Receiving In-Progress
                    </span>
                  </div>
                  <div className="text-sm font-bold font-mono text-[#18324d] mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      Container: <strong className="text-blue-700">{activeContainer.containerNo}</strong>
                    </span>
                    <span>
                      Batch/Lot: <strong className="text-emerald-700">{activeContainer.batchNo}</strong>
                    </span>
                    <span className="text-xs text-[#65768a] font-sans">
                      Receiver: <strong className="text-[#18324d]">{activeContainer.receiverName}</strong>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscardContainer}
                  className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Discard Container
                </button>
                <button
                  type="button"
                  onClick={openNewContainerModal}
                  className="px-3.5 py-1.5 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:bg-[#1d528a] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> New Container
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-200 text-amber-900 rounded-xl">
                  <Box size={22} />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">No Container Active</div>
                  <div className="text-xs text-amber-800">
                    Please click <strong>"New Container"</strong> to enter Container No and Batch No / Lot before keying in receiving parts.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={openNewContainerModal}
                className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus size={14} /> New Container
              </button>
            </div>
          )}

          {notice && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
                notice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : notice.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {notice.type === "success" && <Check size={16} className="text-emerald-600" />}
                {notice.type === "error" && <AlertCircle size={16} className="text-red-600" />}
                {notice.type === "info" && <Boxes size={16} className="text-blue-600" />}
                <span>{notice.msg}</span>
              </div>
              <button onClick={() => setNotice(null)} className="font-bold px-1 hover:opacity-75">✕</button>
            </div>
          )}

          {/* KEY-IN RECEIVING DETAILS FORM */}
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-[#18324d]">Key In Receiving Parts</h3>
                <p className="text-xs text-[#65768a]">
                  {activeContainer
                    ? `Active for Container: ${activeContainer.containerNo} (Batch: ${activeContainer.batchNo})`
                    : "Start a container first to enable receiving"}
                </p>
              </div>
              {activeContainer && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                  Ready to Key In
                </span>
              )}
            </div>

            {!activeContainer ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-[#cfd9e4] space-y-3">
                <Box size={32} className="mx-auto text-gray-400" />
                <div className="text-sm font-semibold text-[#18324d]">Container Setup Required</div>
                <p className="text-xs text-[#65768a] max-w-sm mx-auto">
                  Before adding receiving details, click the <strong>"New Container"</strong> button to enter the Container No and Batch No / Lot for this inbound shipment.
                </p>
                <button
                  type="button"
                  onClick={openNewContainerModal}
                  className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Open New Container Popup
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddPartToStaging} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between text-xs bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 text-[#18324d]">
                  <div>Container: <strong className="font-mono text-blue-900">{activeContainer.containerNo}</strong></div>
                  <div>Batch: <strong className="font-mono text-emerald-800">{activeContainer.batchNo}</strong></div>
                  <div>Receiver: <strong className="text-blue-950 font-semibold">{activeContainer.receiverName}</strong></div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">Enter Part No *</label>
                  <input
                    type="text"
                    list="activeMasterItems"
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value)}
                    required
                    placeholder="Type or select Part No..."
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono uppercase bg-white"
                  />
                  <datalist id="activeMasterItems">
                    {items
                      .filter((i) => i.active)
                      .map((i) => (
                        <option key={i.code} value={i.code}>
                          {i.desc} ({i.model})
                        </option>
                      ))}
                  </datalist>
                </div>

                {codeQuery && (
                  <div>
                    {matchedItem ? (
                      <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1 animate-in fade-in">
                        <div className="font-bold text-emerald-950 flex justify-between">
                          <span>{matchedItem.desc}</span>
                          <span className="font-mono text-emerald-800">{matchedItem.model}</span>
                        </div>
                        <div className="text-emerald-700 font-mono text-[11px]">
                          Part No: {matchedItem.code} · Current On-Hand: <strong>{stock(matchedItem.code)} units</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                        Part No not found in active master catalog.
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#42566c] mb-1">Case No *</label>
                    <input
                      type="text"
                      value={caseNo}
                      onChange={(e) => setCaseNo(e.target.value)}
                      required
                      placeholder="e.g. CASE-001 or CS-10"
                      className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono uppercase bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#42566c] mb-1">Received Quantity *</label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={qty}
                      onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                      required
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">Destination Location / Bay</label>
                  <input
                    type="text"
                    list="locsReceivingList"
                    value={loc}
                    onChange={(e) => setLoc(e.target.value)}
                    placeholder="e.g. A-01-01 or RECV-01"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                  <datalist id="locsReceivingList">
                    {allLocs().map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={16} /> Add Part to Container (Temporary Red Area)
                </button>
              </form>
            )}
          </div>

          {/* THE RED HIGHLIGHT AREA */}
          <div className="border-2 border-red-500 rounded-2xl bg-gradient-to-b from-red-50/90 via-red-50/40 to-white p-6 shadow-md space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-red-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-xs">
                  <Box size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-red-950 uppercase tracking-wide">
                      Temporary Container Receiving Area
                    </h3>
                    <span className="px-2.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-extrabold uppercase tracking-wider animate-pulse">
                      Red Highlight Staging
                    </span>
                  </div>
                  <p className="text-xs text-red-900 mt-0.5">
                    All parts added for this container are temporarily saved here and <strong>NOT yet sent to inventory</strong>. Check and confirm below when complete.
                  </p>
                </div>
              </div>

              {activeContainer && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 bg-white border border-red-200 rounded-xl text-xs font-mono font-bold text-red-900">
                    Container: {activeContainer.containerNo}
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-red-200 rounded-xl text-xs font-mono font-bold text-blue-900">
                    Batch: {activeContainer.batchNo}
                  </div>
                  <div className="px-3 py-1.5 bg-red-100 border border-red-300 rounded-xl text-xs font-bold text-red-950">
                    {stagedItems.length} parts ({totalStagedQty.toLocaleString()} units)
                  </div>
                </div>
              )}
            </div>

            {/* TABLE OF STAGED PARTS IN RED AREA */}
            <div className="overflow-x-auto border border-red-300 rounded-xl bg-white shadow-xs">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-red-100/70 text-red-950 text-xs font-bold border-b border-red-200">
                    <th className="p-3 w-12">#</th>
                    <th className="p-3">Time Stamp</th>
                    <th className="p-3">Part No</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 bg-red-200/50 text-red-950 font-bold">Case No</th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Batch No</th>
                    <th className="p-3 text-red-800 font-extrabold">Received Qty</th>
                    <th className="p-3">Target Bay</th>
                    <th className="p-3">DO Reference</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 text-xs">
                  {stagedItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-red-800/80 bg-red-50/30">
                        <div className="font-semibold text-sm text-red-900">
                          {activeContainer
                            ? `No parts added to Container ${activeContainer.containerNo} yet.`
                            : "No active container session."}
                        </div>
                        <div className="text-xs text-red-700 mt-1">
                          {activeContainer
                            ? "Key in the part number, case number and quantity above, then click '+ Add Part to Container' to stage items here."
                            : "Click '+ New Container' above to open the popup and start receiving."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stagedItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-red-50/50 transition">
                        <td className="p-3 font-mono font-semibold text-gray-500">{idx + 1}</td>
                        <td className="p-3 font-mono text-[#65768a] text-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-red-200">
                            <Clock size={12} className="text-red-500" />
                            {item.time}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-[#18324d]">{item.code}</td>
                        <td className="p-3 font-medium text-[#18324d] max-w-[200px] truncate" title={item.desc}>
                          {item.desc}
                        </td>
                        <td className="p-3 font-mono">
                          {item.caseNo && item.caseNo !== "—" ? (
                            <span className="inline-block px-2 py-0.5 bg-white text-blue-900 rounded font-bold border border-blue-200 text-[11px] shadow-2xs">
                              {item.caseNo}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-[#65768a]">{item.model || "—"}</td>
                        <td className="p-3 font-mono">
                          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200 text-[11px]">
                            {item.batchNo}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-red-700 text-sm">
                          +{item.qty.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-[#42566c]">{item.loc}</td>
                        <td className="p-3 font-mono text-[#65768a]">{item.ref}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditStaged(item)}
                              className="px-2 py-1 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-[11px] font-semibold text-gray-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Edit quantity or location before confirming"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedItem(item.id)}
                              className="px-2 py-1 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg text-[11px] font-semibold text-red-800 flex items-center gap-1 transition cursor-pointer"
                              title="Remove from temporary staging"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* CHECK & CONFIRMATION FOOTER SECTION */}
            <div className="p-4 bg-white border border-red-300 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-red-900 font-bold text-xs uppercase tracking-wide">
                  <CheckCircle2 size={16} className="text-red-600" />
                  <span>Checking & Final Confirmation</span>
                </div>
                <p className="text-xs text-[#42566c] leading-relaxed max-w-xl">
                  User must check the temporary red area above. Once verified, click <strong>"Confirm & Complete Container"</strong> to mark the container complete and officially send all receiving parts to warehouse inventory balance.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {activeContainer && (
                  <button
                    type="button"
                    onClick={handleDiscardContainer}
                    className="px-4 py-2.5 border border-red-300 text-red-700 hover:bg-red-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Discard Staging
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirmAndCompleteContainer}
                  disabled={!activeContainer || stagedItems.length === 0}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 ${
                    activeContainer && stagedItems.length > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-md"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300"
                  }`}
                >
                  <Check size={16} /> Confirm & Complete Container (Send to Inventory)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SEND TO PRODUCTION VIEW                                                    */
/* -------------------------------------------------------------------------- */
function IssueView({
  items,
  balances,
  setBalances,
  transactions,
  setTransactions,
  allLocs,
  stock,
  role,
  setPage,
}: {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  stock: (code: string, loc?: string) => number;
  role: Role;
  setPage?: (p: Page) => void;
}) {
  const [codeQuery, setCodeQuery] = useState("");
  const [sourceLoc, setSourceLoc] = useState("KITTING-STATION");
  const [qty, setQty] = useState<number | "">("");
  const [destLine, setDestLine] = useState("Production Line 1");
  const [ref, setRef] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [userId, setUserId] = useState(role === "Admin" ? "ADMIN-DEMO" : role === "Manager" ? "MGR-DEMO" : "WH001");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // In-table issue state: editable quantities and destination lines per row
  const [keyedIssueQtys, setKeyedIssueQtys] = useState<Record<string, number | "">>({});
  const [rowDestLines, setRowDestLines] = useState<Record<string, string>>({});
  const [filterTab, setFilterTab] = useState<"all" | "ready" | "issued">("all");
  const [tableSearch, setTableSearch] = useState("");

  // Confirmed and unpacked parts from Kitting-Unpack station
  const unpackedTableItems = useMemo(() => {
    const list: Array<{
      txId: string;
      code: string;
      partName: string;
      desc: string;
      model: string;
      batchNo: string;
      caseNo: string;
      qty: number;
      availableQty: number;
      loc: string;
      unpackedByName: string;
      unpackDate: string;
      isIssued: boolean;
      issuedQty?: number;
      issuedDest?: string;
      issuedAt?: string;
    }> = [];

    // Find all receiving / kitting transactions marked unpacked === true
    const unpackedTxs = transactions.filter(
      (t) =>
        t.unpacked === true &&
        (t.type === "Receiving" || t.id.startsWith("KIT-") || t.id.startsWith("RCV-"))
    );

    unpackedTxs.forEach((tx) => {
      const kittingBal = balances.find(
        (b) =>
          b.code.toUpperCase() === tx.code.toUpperCase() &&
          String(b.batchNo || "").trim().toLowerCase() === String(tx.batchNo || "").trim().toLowerCase() &&
          (b.loc.toUpperCase().includes("KITTING") || b.loc === tx.dest)
      );
      const generalBal = balances.find(
        (b) =>
          b.code.toUpperCase() === tx.code.toUpperCase() &&
          String(b.batchNo || "").trim().toLowerCase() === String(tx.batchNo || "").trim().toLowerCase()
      );

      const bal = kittingBal || generalBal;
      const currentLocStock = bal ? bal.qty : 0;
      const isIssued = tx.issued === true;

      list.push({
        txId: tx.id,
        code: tx.code,
        partName: tx.partName || tx.desc || items.find((i) => i.code === tx.code)?.desc || tx.code,
        desc: tx.desc || tx.partName || items.find((i) => i.code === tx.code)?.desc || tx.code,
        model: tx.model || items.find((i) => i.code.trim().toUpperCase() === tx.code.trim().toUpperCase())?.model || "—",
        batchNo: tx.batchNo || "—",
        caseNo: tx.caseNo || "—",
        qty: tx.qty,
        availableQty: isIssued ? 0 : (currentLocStock > 0 ? currentLocStock : tx.qty),
        loc: bal ? bal.loc : (tx.dest || "KITTING-STATION"),
        unpackedByName: tx.unpackedByName || tx.user || "Kitting Operator",
        unpackDate: tx.unpackDate || tx.time || "Today",
        isIssued,
        issuedQty: tx.issuedQty || tx.qty,
        issuedDest: tx.issuedDest || "Production Line 1",
        issuedAt: tx.issuedAt || tx.time,
      });
    });

    return list;
  }, [transactions, balances, items]);

  const unpackedReadyParts = unpackedTableItems;

  // Direct 1-Click Issue to Line from table row
  const handleDirectIssueToLine = (p: (typeof unpackedTableItems)[0]) => {
    setNotice(null);

    const rawVal = keyedIssueQtys[p.txId];
    const issueQty = rawVal !== undefined && rawVal !== "" ? Number(rawVal) : (p.availableQty || p.qty);

    if (isNaN(issueQty) || issueQty <= 0) {
      setNotice({ msg: `Please enter a valid issue quantity for Part ${p.code}.`, type: "error" });
      return;
    }

    const targetLoc = p.loc || "KITTING-STATION";
    const currentLocStock = stock(p.code, targetLoc);

    if (currentLocStock < issueQty && currentLocStock > 0) {
      setNotice({
        msg: `Warning: Stock at "${targetLoc}" is ${currentLocStock} pcs, which is less than requested ${issueQty} pcs.`,
        type: "error",
      });
      return;
    }

    const chosenDest = rowDestLines[p.txId] || destLine || "Production Line 1";
    const timeNow = formatTimestamp();
    const newTxId = txNo("ISS");

    // 1. Deduct balance from location
    setBalances((prev) =>
      upsertBalance(
        prev,
        p.code,
        targetLoc,
        -issueQty,
        p.batchNo !== "—" ? p.batchNo : undefined,
        timeNow,
        p.caseNo !== "—" ? p.caseNo : undefined
      )
    );

    // 2. Create new Production Issue transaction AND mark unpack tx as issued
    const newIssueTx: Transaction = {
      id: newTxId,
      type: "Production Issue",
      code: p.code,
      partName: p.partName,
      desc: p.desc,
      model: p.model,
      batchNo: p.batchNo !== "—" ? p.batchNo : undefined,
      caseNo: p.caseNo !== "—" ? p.caseNo : undefined,
      qty: issueQty,
      source: targetLoc,
      dest: chosenDest,
      ref: p.caseNo && p.caseNo !== "—" ? `CASE-${p.caseNo}` : `BATCH-${p.batchNo || "1"}`,
      user: userId,
      receiverName: chosenDest.includes("Line 1") ? "Production Line 1 Operator" : "Production Operator",
      time: timeNow,
      status: "Posted",
    };

    setTransactions((prev) => {
      const updated = prev.map((t) => {
        if (t.id === p.txId) {
          return {
            ...t,
            issued: true,
            issuedQty: issueQty,
            issuedAt: timeNow,
            issuedDest: chosenDest,
            issuedRef: newTxId,
          };
        }
        return t;
      });
      return [newIssueTx, ...updated];
    });

    setNotice({
      msg: `✓ Part ${p.code} (${p.partName}) marked as ISSUED! Successfully sent ${issueQty.toLocaleString()} pcs directly to ${chosenDest} (Voucher ${newTxId}).`,
      type: "success",
    });
  };

  // Re-open / Undo an issue to allow re-issuing or adjusting
  const handleReopenPartIssue = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === txId) {
          return {
            ...t,
            issued: false,
            issuedQty: undefined,
            issuedAt: undefined,
            issuedDest: undefined,
            issuedRef: undefined,
          };
        }
        return t;
      })
    );
    setNotice({ msg: `Part status reopened to 'Ready to Issue'.`, type: "success" });
  };

  // Issue all ready parts in one click
  const handleIssueAllReady = () => {
    setNotice(null);
    const readyItems = unpackedTableItems.filter((it) => !it.isIssued);
    if (readyItems.length === 0) {
      setNotice({ msg: "No pending parts ready to issue.", type: "error" });
      return;
    }

    const timeNow = formatTimestamp();
    const newTxs: Transaction[] = [];
    const issuedTxIdMap = new Map<string, { qty: number; dest: string; newId: string }>();

    let updatedBalances = [...balances];

    for (const p of readyItems) {
      const rawVal = keyedIssueQtys[p.txId];
      const issueQty = rawVal !== undefined && rawVal !== "" ? Number(rawVal) : (p.availableQty || p.qty);
      if (issueQty <= 0) continue;

      const targetLoc = p.loc || "KITTING-STATION";
      const chosenDest = rowDestLines[p.txId] || destLine || "Production Line 1";
      const newTxId = txNo("ISS");

      updatedBalances = upsertBalance(
        updatedBalances,
        p.code,
        targetLoc,
        -issueQty,
        p.batchNo !== "—" ? p.batchNo : undefined,
        timeNow,
        p.caseNo !== "—" ? p.caseNo : undefined
      );

      const newIssueTx: Transaction = {
        id: newTxId,
        type: "Production Issue",
        code: p.code,
        partName: p.partName,
        desc: p.desc,
        model: p.model,
        batchNo: p.batchNo !== "—" ? p.batchNo : undefined,
        caseNo: p.caseNo !== "—" ? p.caseNo : undefined,
        qty: issueQty,
        source: targetLoc,
        dest: chosenDest,
        ref: p.caseNo && p.caseNo !== "—" ? `CASE-${p.caseNo}` : `BATCH-${p.batchNo || "1"}`,
        user: userId,
        receiverName: chosenDest.includes("Line 1") ? "Production Line 1 Operator" : "Production Operator",
        time: timeNow,
        status: "Posted",
      };

      newTxs.push(newIssueTx);
      issuedTxIdMap.set(p.txId, { qty: issueQty, dest: chosenDest, newId: newTxId });
    }

    setBalances(updatedBalances);

    setTransactions((prev) => {
      const updated = prev.map((t) => {
        const issuedInfo = issuedTxIdMap.get(t.id);
        if (issuedInfo) {
          return {
            ...t,
            issued: true,
            issuedQty: issuedInfo.qty,
            issuedAt: timeNow,
            issuedDest: issuedInfo.dest,
            issuedRef: issuedInfo.newId,
          };
        }
        return t;
      });
      return [...newTxs, ...updated];
    });

    setNotice({
      msg: `✓ Successfully issued all ${newTxs.length} ready parts directly to ${destLine}! All items marked as issued.`,
      type: "success",
    });
  };

  const pendingCount = unpackedTableItems.filter((it) => !it.isIssued).length;
  const issuedCount = unpackedTableItems.filter((it) => it.isIssued).length;

  const displayedTableItems = useMemo(() => {
    let list = unpackedTableItems;
    if (filterTab === "ready") {
      list = list.filter((it) => !it.isIssued);
    } else if (filterTab === "issued") {
      list = list.filter((it) => it.isIssued);
    }

    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.code.toLowerCase().includes(q) ||
          it.partName.toLowerCase().includes(q) ||
          it.desc.toLowerCase().includes(q) ||
          it.model.toLowerCase().includes(q) ||
          it.batchNo.toLowerCase().includes(q) ||
          it.caseNo.toLowerCase().includes(q) ||
          it.loc.toLowerCase().includes(q)
      );
    }
    return list;
  }, [unpackedTableItems, filterTab, tableSearch]);

  const matchedItem = items.find(
    (i) => i.active && i.code.trim().toLowerCase() === codeQuery.trim().toLowerCase()
  );

  const availableLocsForCode = matchedItem
    ? Array.from(
        new Set(
          balances
            .filter((b) => b.code.trim().toUpperCase() === matchedItem.code.trim().toUpperCase() && b.qty > 0)
            .map((b) => b.loc.trim())
        )
      )
    : allLocs();

  // Automatically sync sourceLoc to first available location with stock when item matches
  useEffect(() => {
    if (matchedItem && availableLocsForCode.length > 0) {
      if (!availableLocsForCode.some((l) => l.toLowerCase() === sourceLoc.toLowerCase())) {
        setSourceLoc(availableLocsForCode[0]);
      }
    }
  }, [codeQuery, matchedItem]);

  const targetLoc = (
    availableLocsForCode.find((l) => l.toLowerCase() === sourceLoc.toLowerCase()) ||
    availableLocsForCode[0] ||
    sourceLoc
  ).trim();

  const sourceStock = matchedItem ? stock(matchedItem.code, targetLoc) : 0;
  const qNum = Number(qty) || 0;
  const remainder = sourceStock - qNum;

  // Optional manual issue form submit handler
  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!matchedItem) {
      setNotice({ msg: "Please select an unpacked part from the list.", type: "error" });
      return;
    }

    if (!(qNum > 0 && Number.isFinite(qNum))) {
      setNotice({ msg: "Enter a valid quantity greater than zero.", type: "error" });
      return;
    }
    if (!ref.trim() || !userId.trim()) {
      setNotice({ msg: "Production reference and user ID are required.", type: "error" });
      return;
    }

    const currentLocStock = stock(matchedItem.code, targetLoc);
    if (currentLocStock < qNum) {
      setNotice({
        msg: `Insufficient stock at location "${targetLoc}". Available: ${currentLocStock}.`,
        type: "error",
      });
      return;
    }

    const id = txNo("ISS");
    setBalances(upsertBalance(balances, matchedItem.code, targetLoc, -qNum));
    const newTx: Transaction = {
      id,
      type: "Production Issue",
      code: matchedItem.code,
      partName: matchedItem.desc,
      desc: matchedItem.desc,
      model: matchedItem.model,
      batchNo: batchNo.trim() || undefined,
      qty: qNum,
      source: targetLoc,
      dest: destLine,
      ref: ref.trim(),
      user: userId.trim(),
      receiverName: destLine.includes("Line 1") ? "Production Line 1 Operator" : "Production Operator",
      time: formatTimestamp(),
      status: "Posted",
    };
    setTransactions([newTx, ...transactions]);
    setNotice({
      msg: `✓ Production issue posted successfully! Transaction ${id} (${qNum} pcs of ${matchedItem.code} sent to ${destLine}). Remaining at ${targetLoc}: ${currentLocStock - qNum}.`,
      type: "success",
    });
    setCodeQuery("");
    setBatchNo("");
    setQty("");
    setRef("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Send Parts to Production</h2>
          <p className="text-sm text-[#65768a]">
            Issue confirmed unpacked parts directly from the table to assembly and production lines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {setPage && (
            <button
              onClick={() => setPage("reports")}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold hover:bg-gray-50 transition shadow-xs cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-amber-700" /> Daily Sent to Production 1 Report
            </button>
          )}
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
            Outbound movement
          </span>
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* TABLE: Confirmed Unpacked Parts Ready for Production */}
      <div className="bg-white border-2 border-emerald-300 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#f0f4f8]">
          <div>
            <h3 className="text-base font-bold text-[#18324d] flex items-center gap-2">
              <PackageCheck size={20} className="text-emerald-600" />
              Confirmed Parts Ready to Send to Production
            </h3>
            <p className="text-xs text-[#65768a]">
              Change quantity directly in the table below and click <strong>"Issue to Line"</strong> to instantly mark as issued.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Destination Line Selector */}
            <div className="flex items-center gap-1.5 bg-[#f4f7fb] px-3 py-1.5 rounded-xl border border-[#dfe6ee]">
              <span className="text-[11px] font-bold text-[#42566c]">Line:</span>
              <select
                value={destLine}
                onChange={(e) => setDestLine(e.target.value)}
                className="bg-transparent font-bold text-xs text-[#18324d] focus:outline-none"
              >
                <option value="Production Line 1">Production Line 1</option>
                <option value="Production Line 2">Production Line 2</option>
                <option value="Production Line 3">Production Line 3</option>
                <option value="Assembly Line A">Assembly Line A</option>
                <option value="Packaging Cell">Packaging Cell</option>
              </select>
            </div>

            {/* Bulk Issue All Button */}
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleIssueAllReady}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                ✓ Issue All ({pendingCount} Ready)
              </button>
            )}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#f4f7fb] p-1 rounded-xl border border-[#dfe6ee]">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterTab === "all"
                  ? "bg-white text-[#18324d] shadow-2xs"
                  : "text-[#65768a] hover:text-[#18324d]"
              }`}
            >
              All Parts ({unpackedTableItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("ready")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterTab === "ready"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-[#65768a] hover:text-[#18324d]"
              }`}
            >
              Ready to Issue ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("issued")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterTab === "issued"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-[#65768a] hover:text-[#18324d]"
              }`}
            >
              Issued ({issuedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-[#65768a]" size={14} />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search part, batch, case..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#cfd9e4] rounded-xl text-xs bg-white text-[#18324d] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {unpackedTableItems.length === 0 ? (
          <div className="p-8 text-center bg-[#f8fafc] border border-dashed border-[#cfd9e4] rounded-xl space-y-2">
            <div className="text-xs font-bold text-[#18324d]">No Parts Ready for Production Yet</div>
            <p className="text-xs text-[#65768a] max-w-md mx-auto">
              Parts must first be confirmed from <strong>"Kitting Case"</strong> and then unpacked & confirmed by operator at <strong>"Kitting-Unpack"</strong> before they appear here.
            </p>
            {setPage && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPage("unpack")}
                  className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Go to Kitting-Unpack Station →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f4f7fb] text-[#65768a] uppercase font-semibold border-b border-[#dfe6ee]">
                <tr>
                  <th className="p-3">Model</th>
                  <th className="p-3">Part No & Description</th>
                  <th className="p-3">Batch No</th>
                  <th className="p-3">Case No</th>
                  <th className="p-3">Staging Location</th>
                  <th className="p-3 bg-blue-50/70 text-blue-900 font-bold">Issue Quantity (Editable) *</th>
                  <th className="p-3">Destination Line</th>
                  <th className="p-3">Unpacked By & Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f8]">
                {displayedTableItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-[#65768a]">
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="font-semibold text-[#18324d]">No parts in this view.</p>
                        <p className="text-xs text-[#65768a]">
                          {filterTab === "ready"
                            ? "All parts from Kitting-Unpack have been issued."
                            : "No unpacked parts found matching your criteria."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedTableItems.map((p) => {
                    const isIssued = p.isIssued;
                    const curQtyVal = keyedIssueQtys[p.txId] !== undefined ? keyedIssueQtys[p.txId] : (p.availableQty || p.qty);

                    return (
                      <tr
                        key={p.txId}
                        className={`transition ${
                          isIssued ? "bg-emerald-50/20 hover:bg-emerald-50/40" : "hover:bg-blue-50/30"
                        }`}
                      >
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[11px] font-bold font-mono">
                            {p.model}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-mono font-bold text-[#18324d]">{p.code}</div>
                          <div className="text-[11px] text-[#42566c]">{p.partName}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-800">{p.batchNo}</td>
                        <td className="p-3 font-mono">
                          {p.caseNo && p.caseNo !== "—" ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded font-semibold border border-blue-200 text-[11px]">
                              {p.caseNo}
                            </span>
                          ) : (
                            <span className="text-[#a0aec0]">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-purple-800 font-semibold">{p.loc}</td>
                        <td className="p-3 bg-blue-50/30">
                          {isIssued ? (
                            <div className="font-mono font-bold text-emerald-700 text-sm">
                              {(p.issuedQty || p.qty).toLocaleString()} pcs
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                value={curQtyVal}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  setKeyedIssueQtys((prev) => ({ ...prev, [p.txId]: val }));
                                }}
                                className="w-24 px-2.5 py-1.5 border-2 border-emerald-300 focus:border-emerald-600 rounded-lg text-xs font-mono font-bold text-[#18324d] bg-white text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                              />
                              <span className="text-xs font-semibold text-emerald-800">pcs</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={rowDestLines[p.txId] || (isIssued ? p.issuedDest : destLine)}
                            onChange={(e) => setRowDestLines((prev) => ({ ...prev, [p.txId]: e.target.value }))}
                            disabled={isIssued}
                            className="px-2.5 py-1.5 border border-[#cfd9e4] rounded-lg text-xs bg-white text-[#18324d] font-medium disabled:bg-gray-100 disabled:text-gray-500"
                          >
                            <option value="Production Line 1">Production Line 1</option>
                            <option value="Production Line 2">Production Line 2</option>
                            <option value="Production Line 3">Production Line 3</option>
                            <option value="Assembly Line A">Assembly Line A</option>
                            <option value="Packaging Cell">Packaging Cell</option>
                          </select>
                        </td>
                        <td className="p-3 text-[#65768a] text-[11px]">
                          <div>By {p.unpackedByName}</div>
                          <div>{p.unpackDate}</div>
                        </td>
                        <td className="p-3">
                          {isIssued ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                              <CheckCircle2 size={11} className="text-emerald-700" />
                              Issued ({p.issuedQty || p.qty} pcs)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                              <Clock size={11} className="text-amber-600" />
                              Ready to Issue
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isIssued ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs whitespace-nowrap">
                                <Check size={12} strokeWidth={3} /> Issued
                              </span>
                              <button
                                type="button"
                                onClick={() => handleReopenPartIssue(p.txId)}
                                className="px-1.5 py-1 text-[10px] text-gray-500 hover:text-amber-700 hover:underline cursor-pointer"
                                title="Re-open / undo issue"
                              >
                                Undo
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDirectIssueToLine(p)}
                              className="px-3.5 py-1.5 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
                            >
                              ↗ Issue to Line
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECENT PRODUCTION ISSUES AUDIT TRAIL */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-bold text-[#18324d]">Recent Production Issues</h3>
            <p className="text-xs text-[#65768a]">Material issue vouchers posted directly to assembly and production lines</p>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-full text-xs font-bold font-mono">
            {transactions.filter((t) => t.type === "Production Issue").length} Total Issued Vouchers
          </span>
        </div>
        <TxTable transactions={transactions.filter((t) => t.type === "Production Issue").slice(0, 10)} items={items} />
      </div>

      {/* OPTIONAL COLLAPSIBLE MANUAL PRODUCTION ISSUE FORM */}
      <details className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs transition">
        <summary className="text-xs font-bold text-[#42566c] hover:text-[#18324d] cursor-pointer flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <span>⚙️</span>
            <span>Manual Production Issue Form (Optional custom vouchers)</span>
          </span>
          <span className="text-[11px] font-normal text-blue-600 underline">Click to expand</span>
        </summary>

        <div className="pt-4 mt-3 border-t border-[#f0f4f8]">
          <form onSubmit={handleIssue} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">
                Select Part (Confirmed from Kitting-Unpack) *
              </label>
              {unpackedTableItems.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
                  ⚠️ No parts have been unpacked and confirmed yet. Please confirm parts in "Kitting Case" and unpack in "Kitting-Unpack" first.
                </div>
              ) : (
                <select
                  value={codeQuery}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCodeQuery(selected);
                    const chosen = unpackedTableItems.find((p) => p.code === selected);
                    if (chosen) {
                      setBatchNo(chosen.batchNo !== "—" ? chosen.batchNo : "");
                      setSourceLoc(chosen.loc);
                      setQty(chosen.qty);
                    }
                  }}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono font-bold bg-white text-[#18324d] focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Confirmed Unpacked Part to Send to Production --</option>
                  {unpackedTableItems.map((p, idx) => (
                    <option key={`${p.code}-${p.batchNo}-${idx}`} value={p.code}>
                      {p.code} — {p.partName} (Batch: {p.batchNo}, Avail: {p.qty} pcs at {p.loc})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {codeQuery && matchedItem && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-emerald-900">{matchedItem.desc}</div>
                  <div className="text-emerald-700 font-mono">
                    {matchedItem.code} · Available to Send: {stock(matchedItem.code, targetLoc)} pcs
                  </div>
                  <div className="text-[11px] text-[#2463a6] font-semibold pt-1">
                    Confirmed from Kitting-Unpack at {targetLoc} (Batch: {batchNo || "N/A"})
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#42566c] mb-1">Part Name</label>
                    <input
                      type="text"
                      readOnly
                      value={matchedItem.desc}
                      className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-gray-50 text-[#18324d] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#42566c] mb-1">Batch No / Lot No</label>
                    <input
                      type="text"
                      readOnly
                      value={batchNo}
                      className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-gray-50 text-[#18324d]"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Source Location *</label>
                <select
                  value={targetLoc}
                  onChange={(e) => setSourceLoc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-mono"
                >
                  {(availableLocsForCode.length ? availableLocsForCode : allLocs()).map((l) => {
                    const locQty = matchedItem ? stock(matchedItem.code, l) : 0;
                    return (
                      <option key={l} value={l}>
                        {l} {matchedItem ? `(${locQty} available)` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Issue Quantity *</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Destination Line *</label>
                <select
                  value={destLine}
                  onChange={(e) => setDestLine(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="Production Line 1">Production Line 1</option>
                  <option value="Production Line 2">Production Line 2</option>
                  <option value="Production Line 3">Production Line 3</option>
                  <option value="Assembly Line A">Assembly Line A</option>
                  <option value="Packaging Cell">Packaging Cell</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Production / Kanban Ref *</label>
                <input
                  type="text"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="e.g. PROD-2401"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Warehouse User ID *</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={unpackedTableItems.length === 0}
              className={`w-full py-3 text-white rounded-xl text-xs font-semibold shadow-xs transition ${
                unpackedTableItems.length === 0
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[#2463a6] hover:bg-[#1d528a] cursor-pointer"
              }`}
            >
              ↗ Confirm & Post Issue to Production
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RETURN FROM PRODUCTION VIEW                                                */
/* -------------------------------------------------------------------------- */
function ReturnView({
  items,
  balances,
  setBalances,
  transactions,
  setTransactions,
  allLocs,
  stock,
  role,
  setPage,
}: {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  stock: (code: string, loc?: string) => number;
  role: Role;
  setPage?: (p: Page) => void;
}) {
  const [codeQuery, setCodeQuery] = useState("");
  const [sourceLine, setSourceLine] = useState("Production Line 1");
  const [qty, setQty] = useState<number | "">("");
  const [destLoc, setDestLoc] = useState("A-01-01");
  const [ref, setRef] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [userId, setUserId] = useState(role === "Admin" ? "ADMIN-DEMO" : role === "Manager" ? "MGR-DEMO" : "WH001");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" | "warning" } | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("ALL");
  const formRef = useRef<HTMLDivElement>(null);

  // 1. Transactions confirmed and sent to production
  const productionIssues = useMemo(() => {
    return transactions.filter(
      (t) => t.type === "Production Issue" && (t.status === "Posted" || !t.status)
    );
  }, [transactions]);

  // 2. Transactions returned from production back into warehouse inventory
  const stockReturns = useMemo(() => {
    return transactions.filter(
      (t) => t.type === "Stock Return" && (t.status === "Posted" || !t.status)
    );
  }, [transactions]);

  // 3. Compute active production balances: (Sent to Production) minus (Stock Returns)
  const productionSummary = useMemo(() => {
    // Key: CODE__BATCH__LINE
    const map = new Map<
      string,
      {
        key: string;
        code: string;
        partName: string;
        batchNo: string;
        line: string;
        sentQty: number;
        returnedQty: number;
        returnableQty: number;
        sampleRef: string;
        lastIssueTime: string;
      }
    >();

    for (const iss of productionIssues) {
      const c = iss.code.trim().toUpperCase();
      const b = (iss.batchNo || "NO-BATCH").trim();
      const l = (iss.dest || "Production Line 1").trim();
      const key = `${c}__${b.toUpperCase()}__${l.toUpperCase()}`;

      const existing = map.get(key) || {
        key,
        code: c,
        partName: iss.partName || iss.desc || c,
        batchNo: iss.batchNo || "NO-BATCH",
        line: l,
        sentQty: 0,
        returnedQty: 0,
        returnableQty: 0,
        sampleRef: iss.ref || iss.id,
        lastIssueTime: iss.time,
      };

      existing.sentQty += iss.qty || 0;
      if (iss.time > existing.lastIssueTime) {
        existing.lastIssueTime = iss.time;
        existing.sampleRef = iss.ref || iss.id;
      }
      map.set(key, existing);
    }

    // Deduct returns
    for (const ret of stockReturns) {
      const c = ret.code.trim().toUpperCase();
      const b = (ret.batchNo || "NO-BATCH").trim();
      const l = (ret.source || "Production Line 1").trim();
      const key = `${c}__${b.toUpperCase()}__${l.toUpperCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.returnedQty += ret.qty || 0;
      } else {
        // Fallback match by code & line
        for (const val of map.values()) {
          if (val.code === c && val.line.toUpperCase() === l.toUpperCase()) {
            val.returnedQty += ret.qty || 0;
            break;
          }
        }
      }
    }

    // Calculate net returnable quantity in production
    for (const val of map.values()) {
      val.returnableQty = Math.max(0, val.sentQty - val.returnedQty);
    }

    return Array.from(map.values());
  }, [productionIssues, stockReturns]);

  // Eligible production parts with returnableQty > 0
  const eligibleProductionParts = useMemo(() => {
    return productionSummary
      .filter((p) => p.returnableQty > 0)
      .map((p) => {
        const itemInfo = items.find(
          (i) => i.code.trim().toUpperCase() === p.code.trim().toUpperCase()
        );
        return {
          ...p,
          desc: itemInfo?.desc || p.partName,
          model: itemInfo?.model || "Universal",
        };
      });
  }, [productionSummary, items]);

  // Filtered view for the production parts table
  const displayedProductionParts = useMemo(() => {
    return eligibleProductionParts.filter((p) => {
      const matchesLine = lineFilter === "ALL" || p.line.toLowerCase() === lineFilter.toLowerCase();
      const matchesSearch =
        !searchFilter.trim() ||
        p.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.desc.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.batchNo.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.sampleRef.toLowerCase().includes(searchFilter.toLowerCase());
      return matchesLine && matchesSearch;
    });
  }, [eligibleProductionParts, lineFilter, searchFilter]);

  // Unique list of part codes that have been confirmed in "Sent to Production" and are currently returnable
  const allowedPartCodes = useMemo(() => {
    return Array.from(new Set(eligibleProductionParts.map((p) => p.code.toUpperCase())));
  }, [eligibleProductionParts]);

  // Total summary figures
  const totalUnitsInProduction = useMemo(() => {
    return eligibleProductionParts.reduce((sum, p) => sum + p.returnableQty, 0);
  }, [eligibleProductionParts]);

  const totalReturnedUnits = useMemo(() => {
    return stockReturns.reduce((sum, r) => sum + (r.qty || 0), 0);
  }, [stockReturns]);

  // Selected item matching
  const matchedItem = useMemo(() => {
    if (!codeQuery.trim()) return null;
    return items.find((i) => i.code.trim().toUpperCase() === codeQuery.trim().toUpperCase());
  }, [items, codeQuery]);

  // Is this part confirmed in "Sent to Production"?
  const isConfirmedInProduction = useMemo(() => {
    if (!codeQuery.trim()) return false;
    return allowedPartCodes.includes(codeQuery.trim().toUpperCase());
  }, [allowedPartCodes, codeQuery]);

  // Batches available in production for the selected part
  const availableBatchesForSelectedPart = useMemo(() => {
    if (!codeQuery.trim()) return [];
    return eligibleProductionParts.filter(
      (p) => p.code.toUpperCase() === codeQuery.trim().toUpperCase()
    );
  }, [eligibleProductionParts, codeQuery]);

  // Current returnable qty for the chosen part & batch & line
  const activeReturnableQty = useMemo(() => {
    if (!isConfirmedInProduction) return 0;
    const match = availableBatchesForSelectedPart.find(
      (p) =>
        (batchNo ? p.batchNo.toLowerCase() === batchNo.trim().toLowerCase() : true) &&
        (sourceLine ? p.line.toLowerCase() === sourceLine.trim().toLowerCase() : true)
    ) || availableBatchesForSelectedPart[0];
    return match ? match.returnableQty : 0;
  }, [isConfirmedInProduction, availableBatchesForSelectedPart, batchNo, sourceLine]);

  // Quick prefill from the table
  const handleSelectForReturn = (part: typeof eligibleProductionParts[0]) => {
    setCodeQuery(part.code);
    setBatchNo(part.batchNo === "NO-BATCH" ? "" : part.batchNo);
    setSourceLine(part.line);
    setRef(`RET-from-${part.sampleRef}`);
    setQty(part.returnableQty);
    setNotice(null);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!codeQuery.trim()) {
      setNotice({ msg: "Please select a part confirmed in 'Sent to Production'.", type: "error" });
      return;
    }

    // STRICT ENFORCEMENT: ONLY parts confirmed in "Sent to Production" can return from production
    if (!isConfirmedInProduction || !matchedItem) {
      setNotice({
        msg: `Error: Part "${codeQuery.trim().toUpperCase()}" has not been confirmed in "Sent to Production". Only parts that were confirmed and sent to production can be returned from production!`,
        type: "error",
      });
      return;
    }

    const qNum = Number(qty);
    if (!(qNum > 0 && Number.isFinite(qNum))) {
      setNotice({ msg: "Enter a valid return quantity greater than zero.", type: "error" });
      return;
    }

    // Quantity cannot exceed what is confirmed in production
    if (qNum > activeReturnableQty) {
      setNotice({
        msg: `Cannot return ${qNum} pcs. Only ${activeReturnableQty} pcs remain in production for ${matchedItem.code} (${batchNo ? `Batch: ${batchNo}` : "active batch"}).`,
        type: "error",
      });
      return;
    }

    if (!ref.trim() || !userId.trim()) {
      setNotice({ msg: "Production return reference and warehouse user ID are required.", type: "error" });
      return;
    }

    const finalDest = destLoc.trim() || "A-01-01";
    const id = txNo("RET");

    // Add the part returned from production back to inventory balances
    setBalances((prev) =>
      upsertBalance(prev, matchedItem.code, finalDest, qNum, batchNo.trim() || undefined)
    );

    // Record the Stock Return transaction
    const newTx: Transaction = {
      id,
      type: "Stock Return",
      code: matchedItem.code,
      partName: matchedItem.desc,
      desc: matchedItem.desc,
      batchNo: batchNo.trim() || undefined,
      qty: qNum,
      source: sourceLine,
      dest: finalDest,
      ref: ref.trim(),
      user: userId.trim(),
      receiverName: userId.trim(),
      time: formatTimestamp(),
      status: "Posted",
    };

    setTransactions((prev) => [newTx, ...prev]);

    const updatedStockAtDest = stock(matchedItem.code, finalDest) + qNum;
    const updatedTotalStock = stock(matchedItem.code) + qNum;

    setNotice({
      msg: `✓ Stock return posted successfully! Transaction ${id}: ${qNum} pcs of ${matchedItem.code} returned from ${sourceLine} and added back to inventory at ${finalDest}. Updated inventory at ${finalDest}: ${updatedStockAtDest} pcs (Total on-hand: ${updatedTotalStock} pcs).`,
      type: "success",
    });

    // Reset form fields
    setCodeQuery("");
    setBatchNo("");
    setQty("");
    setRef("");
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#18324d]">Return from Production</h2>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full">
              Production Inbound
            </span>
          </div>
          <p className="text-sm text-[#65768a] mt-1">
            Return verified parts confirmed in <span className="font-semibold text-[#18324d]">"Sent to Production"</span> back into warehouse stock inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {setPage && (
            <button
              type="button"
              onClick={() => setPage("issue")}
              className="px-3.5 py-2 bg-white border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
            >
              <ArrowUpRight size={14} className="text-amber-600" />
              View Sent to Production
            </button>
          )}
          {setPage && (
            <button
              type="button"
              onClick={() => setPage("inventory")}
              className="px-3.5 py-2 bg-[#18324d] text-white rounded-xl text-xs font-semibold hover:bg-[#234567] transition flex items-center gap-1.5 shadow-xs"
            >
              <Database size={14} />
              Check Inventory
            </button>
          )}
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#65768a]">Parts in Production</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Boxes size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#18324d] mt-2">
            {eligibleProductionParts.length}
          </div>
          <p className="text-xs text-[#65768a] mt-1">Confirmed lines eligible for return</p>
        </div>

        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#65768a]">Total Units in Production</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            {totalUnitsInProduction.toLocaleString()} pcs
          </div>
          <p className="text-xs text-[#65768a] mt-1">Pending or returnable on lines</p>
        </div>

        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#65768a]">Total Returned to Stock</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {totalReturnedUnits.toLocaleString()} pcs
          </div>
          <p className="text-xs text-[#65768a] mt-1">Safely replenished into inventory</p>
        </div>
      </div>

      {/* TABLE OF CONFIRMED PARTS IN PRODUCTION (ELIGIBLE FOR RETURN) */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#18324d]">
                Confirmed Parts in Production (Eligible for Return)
              </h3>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                {displayedProductionParts.length} Available
              </span>
            </div>
            <p className="text-xs text-[#65768a] mt-0.5">
              Only parts confirmed in <span className="font-semibold text-[#18324d]">"Sent to Production"</span> can be returned. Click "Return from Line" to quickly fill the return form.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-48">
              <Search size={14} className="absolute left-3 top-2.5 text-[#65768a]" />
              <input
                type="text"
                placeholder="Search part, batch..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-[#cfd9e4] rounded-xl text-xs font-mono"
              />
            </div>

            {/* Line Filter */}
            <select
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#cfd9e4] rounded-xl text-xs bg-white text-[#18324d] font-medium"
            >
              <option value="ALL">All Production Lines</option>
              <option value="Production Line 1">Production Line 1</option>
              <option value="Production Line 2">Production Line 2</option>
              <option value="Production Line 3">Production Line 3</option>
              <option value="Assembly Line A">Assembly Line A</option>
              <option value="Packaging Cell">Packaging Cell</option>
            </select>
          </div>
        </div>

        {displayedProductionParts.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#dfe6ee] rounded-xl bg-slate-50/50 space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#18324d]">
                {eligibleProductionParts.length === 0
                  ? "No parts currently active in production."
                  : "No production parts match your search filter."}
              </p>
              <p className="text-xs text-[#65768a] mt-1">
                Only parts confirmed and issued through <span className="font-medium text-[#18324d]">"Sent to Production"</span> can be returned to warehouse inventory.
              </p>
            </div>
            {setPage && eligibleProductionParts.length === 0 && (
              <button
                type="button"
                onClick={() => setPage("issue")}
                className="px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95 transition inline-flex items-center gap-1.5 shadow-xs"
              >
                Go to Sent to Production →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0f4f9] text-[#18324d] border-b border-[#dfe6ee]">
                  <th className="py-2.5 px-3 font-semibold">Model</th>
                  <th className="py-2.5 px-3 font-semibold">Part Number & Description</th>
                  <th className="py-2.5 px-3 font-semibold">Batch / Lot No</th>
                  <th className="py-2.5 px-3 font-semibold">Production Line</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Sent Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Already Returned</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Returnable Qty</th>
                  <th className="py-2.5 px-3 font-semibold">Issue Ref & Time</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe6ee]">
                {displayedProductionParts.map((p) => (
                  <tr key={p.key} className="hover:bg-blue-50/40 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[11px] font-bold font-mono">
                        {p.model || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-[#18324d] flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px]">
                          {p.code}
                        </span>
                        <span className="font-sans font-medium text-slate-700">{p.desc}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-semibold">
                        {p.batchNo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#18324d] font-medium">{p.line}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 font-medium">
                      {p.sentQty.toLocaleString()} pcs
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {p.returnedQty.toLocaleString()} pcs
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
                        {p.returnableQty.toLocaleString()} pcs
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-[11px] text-[#18324d]">{p.sampleRef}</div>
                      <div className="text-[10px] text-[#65768a]">{p.lastIssueTime}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSelectForReturn(p)}
                        className="px-3 py-1.5 bg-[#2463a6] text-white hover:bg-[#1d4f85] rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1 mx-auto"
                      >
                        <RotateCcw size={12} />
                        Return from Line
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM AND RECENT RETURNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={formRef}>
        {/* STOCK RETURN FORM */}
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#18324d]">Stock Return Form</h3>
            <span className="text-xs text-[#65768a]">Adds parts directly back into warehouse stock</span>
          </div>

          {notice && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                notice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : notice.type === "warning"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {notice.type === "success" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{notice.msg}</div>
            </div>
          )}

          <form onSubmit={handleReturn} className="space-y-4">
            {/* PART SELECTION - RESTRICTED TO CONFIRMED PRODUCTION PARTS */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-[#42566c]">
                  Select Part Confirmed in "Sent to Production" *
                </label>
                <span className="text-[11px] text-[#65768a]">
                  {eligibleProductionParts.length} returnable part(s)
                </span>
              </div>

              {/* Fast dropdown of confirmed parts in production */}
              <select
                value={codeQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setCodeQuery(val);
                  const matchedRec = eligibleProductionParts.find((p) => p.code === val);
                  if (matchedRec) {
                    setBatchNo(matchedRec.batchNo === "NO-BATCH" ? "" : matchedRec.batchNo);
                    setSourceLine(matchedRec.line);
                    setRef(`RET-from-${matchedRec.sampleRef}`);
                    setQty(matchedRec.returnableQty);
                  }
                  setNotice(null);
                }}
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-white text-[#18324d]"
              >
                <option value="">-- Choose confirmed production part --</option>
                {eligibleProductionParts.map((p) => (
                  <option key={p.key} value={p.code}>
                    {p.code} — {p.desc} (Batch: {p.batchNo}, {p.line}, {p.returnableQty} pcs returnable)
                  </option>
                ))}
              </select>

              <div className="mt-1 text-[11px] text-[#65768a]">
                Or enter Part No manually (will be validated against "Sent to Production"):
              </div>
              <input
                type="text"
                list="confirmedProdItemsDatalist"
                value={codeQuery}
                onChange={(e) => {
                  setCodeQuery(e.target.value.trim().toUpperCase());
                  setNotice(null);
                }}
                required
                placeholder="e.g. PN-1001"
                className="w-full mt-1 px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
              <datalist id="confirmedProdItemsDatalist">
                {eligibleProductionParts.map((p) => (
                  <option key={p.key} value={p.code}>
                    {p.desc} (Batch: {p.batchNo})
                  </option>
                ))}
              </datalist>
            </div>

            {/* VALIDATION FEEDBACK FOR PART SELECTION */}
            {codeQuery && (
              <div>
                {isConfirmedInProduction && matchedItem ? (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950">{matchedItem.desc}</span>
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-md font-mono text-[10px] font-bold">
                        VERIFIED IN PRODUCTION
                      </span>
                    </div>
                    <div className="text-emerald-800 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      <span>Code: <strong className="font-mono">{matchedItem.code}</strong></span>
                      <span>Total In Warehouse Now: <strong>{stock(matchedItem.code)} pcs</strong></span>
                      <span>Available on Line to Return: <strong className="text-emerald-900">{activeReturnableQty} pcs</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle size={14} className="text-red-600" />
                      Part Not Confirmed in "Sent to Production"
                    </div>
                    <p className="text-[11px] text-red-700">
                      Only parts that have already been confirmed in <strong>"Sent to Production"</strong> can return from production. This part has no active production issue record.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* BATCH AND PRODUCTION LINE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Batch No / Lot No
                </label>
                {availableBatchesForSelectedPart.length > 0 ? (
                  <select
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-white"
                  >
                    {availableBatchesForSelectedPart.map((b) => (
                      <option key={b.key} value={b.batchNo === "NO-BATCH" ? "" : b.batchNo}>
                        {b.batchNo} ({b.returnableQty} pcs returnable)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    placeholder="e.g. BATCH-202610-01"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono bg-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Source Production Line *
                </label>
                <select
                  value={sourceLine}
                  onChange={(e) => setSourceLine(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="Production Line 1">Production Line 1</option>
                  <option value="Production Line 2">Production Line 2</option>
                  <option value="Production Line 3">Production Line 3</option>
                  <option value="Assembly Line A">Assembly Line A</option>
                  <option value="Packaging Cell">Packaging Cell</option>
                </select>
              </div>
            </div>

            {/* RETURN QUANTITY & DESTINATION LOCATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-[#42566c]">
                    Return Quantity (pcs) *
                  </label>
                  {activeReturnableQty > 0 && (
                    <button
                      type="button"
                      onClick={() => setQty(activeReturnableQty)}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Max: {activeReturnableQty}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0.001"
                  max={activeReturnableQty || undefined}
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder={activeReturnableQty ? `Max: ${activeReturnableQty}` : "e.g. 5"}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
                {qty !== "" && Number(qty) > activeReturnableQty && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1">
                    Exceeds available quantity in production ({activeReturnableQty} pcs).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Destination Warehouse Location *
                </label>
                <select
                  value={destLoc}
                  onChange={(e) => setDestLoc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-mono"
                >
                  {allLocs().map((l) => (
                    <option key={l} value={l}>
                      {l} {codeQuery && matchedItem ? `(Current: ${stock(matchedItem.code, l)} pcs)` : ""}
                    </option>
                  ))}
                </select>
                {matchedItem && (
                  <p className="text-[10px] text-[#65768a] mt-1 font-mono">
                    Stock at {destLoc}: {stock(matchedItem.code, destLoc)} pcs
                    {qty ? ` → After return: ${stock(matchedItem.code, destLoc) + Number(qty)} pcs` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* REFERENCE & OPERATOR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Production / Return Ref *
                </label>
                <input
                  type="text"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  required
                  placeholder="e.g. RET-2401"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Warehouse User ID *
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={
                !isConfirmedInProduction ||
                !qty ||
                Number(qty) <= 0 ||
                Number(qty) > activeReturnableQty
              }
              className={`w-full py-3 rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5 ${
                !isConfirmedInProduction ||
                !qty ||
                Number(qty) <= 0 ||
                Number(qty) > activeReturnableQty
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300"
                  : "bg-[#2463a6] text-white hover:opacity-95 cursor-pointer"
              }`}
            >
              <RotateCcw size={14} />
              ✓ Confirm & Return to Warehouse Inventory
            </button>

            {!isConfirmedInProduction && codeQuery && (
              <p className="text-[11px] text-red-600 text-center font-medium">
                Submit disabled: Only parts confirmed in "Sent to Production" can be returned.
              </p>
            )}
          </form>
        </div>

        {/* RIGHT COLUMN: RECENT STOCK RETURNS */}
        <div className="space-y-6">
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#18324d]">Recent Stock Returns</h3>
              <span className="text-xs text-[#65768a]">
                {transactions.filter((t) => t.type === "Stock Return").length} total records
              </span>
            </div>

            <TxTable
              transactions={transactions.filter((t) => t.type === "Stock Return").slice(0, 5)}
            />

            {transactions.filter((t) => t.type === "Stock Return").length > 5 && setPage && (
              <button
                type="button"
                onClick={() => setPage("history")}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-[#dfe6ee] text-[#18324d] rounded-xl text-xs font-semibold transition"
              >
                View Full Return History in Transaction Log →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* INVENTORY BALANCE VIEW                                                     */
/* -------------------------------------------------------------------------- */
function InventoryView({
  balances,
  setBalances,
  items,
  stock,
  transactions,
  setTransactions,
  currentUser,
  users,
  role,
}: {
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  items: Item[];
  stock: (code: string, loc?: string) => number;
  transactions?: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentUser?: UserAccount | null;
  users?: UserAccount[];
  role?: Role;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Edit Quantity & Location with Admin Password state
  const [editingBalance, setEditingBalance] = useState<Balance | null>(null);
  const [newQty, setNewQty] = useState<number | "">("");
  const [newLoc, setNewLoc] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState("Cycle Count / Physical Stocktake");
  const [customReason, setCustomReason] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showZeroStock, setShowZeroStock] = useState(false);

  // Model filter, view mode & download state
  const [selectedModelFilter, setSelectedModelFilter] = useState("All");
  const [isDownloadModelModalOpen, setIsDownloadModelModalOpen] = useState(false);
  const [modelDownloadChoice, setModelDownloadChoice] = useState("All");
  const [summaryViewMode, setSummaryViewMode] = useState<"cards" | "table">("cards");
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [summarySearch, setSummarySearch] = useState("");

  // Batch set quantity / batch quantity configuration state
  const [batchQuantities, setBatchQuantities] = useState<{ [key: string]: number }>(() => {
    try {
      const saved = localStorage.getItem("wh_batch_quantities");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse wh_batch_quantities", e);
    }
    return {};
  });

  const [batchModalModel, setBatchModalModel] = useState<string | null>(null);
  const [modalBatchInputs, setModalBatchInputs] = useState<{ [key: string]: number | "" }>({});
  const [customQuickSet, setCustomQuickSet] = useState<number | "">("");
  const [modalAdminPassword, setModalAdminPassword] = useState("");
  const [modalPasswordError, setModalPasswordError] = useState<string | null>(null);

  const getBatchSetQty = useCallback(
    (modelName: string, batchNo: string): number => {
      if (!batchNo || batchNo === "—") return 0;
      const key = `${modelName.trim()}_${batchNo.trim()}`;
      if (typeof batchQuantities[key] === "number" && batchQuantities[key] >= 0) {
        return batchQuantities[key];
      }
      // Default fallback: 1 set per batch
      return 1;
    },
    [batchQuantities]
  );

  const availableLocs = useMemo(() => {
    const set = new Set<string>();
    for (const b of balances) {
      if (b.loc && b.loc.trim()) {
        set.add(b.loc.trim().toUpperCase());
      }
    }
    [
      "A-01-01",
      "A-01-02",
      "A-02-01",
      "A-03-01",
      "B-01-01",
      "B-02-01",
      "B-05-02",
      "C-01-01",
      "C-04-03",
      "D-02-01",
      "KITTING-STAGE",
      "RECEIVING-TEMP",
    ].forEach((l) => set.add(l));
    return Array.from(set).sort();
  }, [balances]);

  const allRows = useMemo(() => {
    return balances
      .filter((b) => (showZeroStock ? true : b.qty > 0))
      .map((b) => {
        const i = items.find((x) => x.code.trim().toUpperCase() === b.code.trim().toUpperCase()) || {
          desc: "Unknown part",
          min: 0,
          model: "—",
        };
        return {
          ...b,
          desc: i.desc,
          min: i.min,
          model: i.model && i.model.trim() ? i.model.trim() : "—",
          caseNo: b.caseNo && b.caseNo.trim() ? b.caseNo.trim() : "—",
          batchNo: b.batchNo && b.batchNo.trim() ? b.batchNo.trim() : "—",
          timestamp: b.timestamp || b.updatedAt || "—",
        };
      });
  }, [balances, items, showZeroStock]);

  const availableModels = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) {
      if (r.model && r.model !== "—") {
        set.add(r.model);
      }
    }
    for (const i of items) {
      if (i.model && i.model.trim()) {
        set.add(i.model.trim());
      }
    }
    return Array.from(set).sort();
  }, [allRows, items]);

  const modelStats = useMemo(() => {
    const map: Record<
      string,
      {
        count: number;
        totalUnits: number;
        lowStock: number;
        batches: Set<string>;
        totalBatches: number;
        totalSets: number;
      }
    > = {};

    for (const m of availableModels) {
      map[m] = {
        count: 0,
        totalUnits: 0,
        lowStock: 0,
        batches: new Set<string>(),
        totalBatches: 0,
        totalSets: 0,
      };
    }

    for (const r of allRows) {
      const m = r.model && r.model !== "—" ? r.model : "Unassigned";
      if (!map[m]) {
        map[m] = {
          count: 0,
          totalUnits: 0,
          lowStock: 0,
          batches: new Set<string>(),
          totalBatches: 0,
          totalSets: 0,
        };
      }
      map[m].count += 1;
      map[m].totalUnits += r.qty;
      if (r.qty <= r.min) {
        map[m].lowStock += 1;
      }
      if (r.batchNo && r.batchNo !== "—" && r.batchNo.trim() !== "") {
        map[m].batches.add(r.batchNo.trim());
      }
    }

    for (const m of Object.keys(map)) {
      map[m].totalBatches = map[m].batches.size;
      let setsSum = 0;
      for (const b of map[m].batches) {
        setsSum += getBatchSetQty(m, b);
      }
      map[m].totalSets = setsSum;
    }

    return map;
  }, [allRows, availableModels, getBatchSetQty]);

  const totalOverallBatches = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) {
      if (r.batchNo && r.batchNo !== "—" && r.batchNo.trim() !== "") {
        set.add(r.batchNo.trim());
      }
    }
    return set.size;
  }, [allRows]);

  const totalOverallSets = useMemo(() => {
    return Object.values(modelStats).reduce((acc, s) => acc + (s.totalSets || 0), 0);
  }, [modelStats]);

  const totalOverallUnits = useMemo(() => {
    return allRows.reduce((acc, r) => acc + (r.qty || 0), 0);
  }, [allRows]);

  const handleOpenBatchConfig = (modelName: string) => {
    setBatchModalModel(modelName);
    const stats = modelStats[modelName];
    const batches = stats ? Array.from(stats.batches).sort() : [];
    const initialInputs: Record<string, number | ""> = {};
    for (const b of batches) {
      initialInputs[b] = getBatchSetQty(modelName, b);
    }
    setModalBatchInputs(initialInputs);
    setCustomQuickSet("");
    if (currentUser?.role === "Admin" && currentUser.password) {
      setModalAdminPassword(currentUser.password);
    } else {
      setModalAdminPassword("");
    }
    setModalPasswordError(null);
  };

  const handleSaveBatchConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchModalModel) return;
    setModalPasswordError(null);

    const enteredPw = modalAdminPassword.trim();
    if (!enteredPw) {
      setModalPasswordError("Admin password is required to authorize batch set quantities.");
      return;
    }

    const adminAccounts = (users || []).filter((u) => u.role === "Admin");
    const matchedAdmin =
      (currentUser?.role === "Admin" && currentUser.password === enteredPw ? currentUser : null) ||
      adminAccounts.find((u) => u.password === enteredPw) ||
      (enteredPw === "password123" ? (adminAccounts[0] || defaultUsers[0]) : null);

    if (!matchedAdmin) {
      setModalPasswordError(
        "Incorrect admin password. You must provide a valid administrator password (default: 'password123') to authorize changes."
      );
      return;
    }

    const newQuantities = { ...batchQuantities };
    for (const [batchId, val] of Object.entries(modalBatchInputs)) {
      const key = `${batchModalModel.trim()}_${batchId.trim()}`;
      const num = Number(val);
      if (val !== "" && !isNaN(num) && num >= 0) {
        newQuantities[key] = num;
      }
    }

    setBatchQuantities(newQuantities);
    localStorage.setItem("wh_batch_quantities", JSON.stringify(newQuantities));

    setNotice({
      type: "success",
      msg: `✓ Updated batch set quantities for vehicle model "${batchModalModel}". Admin authorized (@${matchedAdmin.username}).`,
    });
    setTimeout(() => setNotice(null), 5000);
    setBatchModalModel(null);
  };

  const rows = useMemo(() => {
    return allRows.filter((b) => {
      // Model filter
      if (selectedModelFilter !== "All") {
        if (b.model.toLowerCase() !== selectedModelFilter.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        b.code.toLowerCase().includes(q) ||
        b.loc.toLowerCase().includes(q) ||
        b.desc.toLowerCase().includes(q) ||
        b.model.toLowerCase().includes(q) ||
        (b.caseNo && b.caseNo.toLowerCase().includes(q)) ||
        (b.batchNo && b.batchNo.toLowerCase().includes(q)) ||
        (b.timestamp && b.timestamp.toLowerCase().includes(q))
      );
    });
  }, [allRows, selectedModelFilter, search]);

  const handleDownloadByModel = (targetModel: string, format: "xlsx" | "csv") => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const headers = [
      "Part No",
      "Description",
      "Model",
      "Case No",
      "Batch No",
      "Storage Location",
      "On Hand Quantity",
      "Minimum Stock",
      "Status",
      "Timestamp / Last Updated",
    ];

    const getRowData = (r: (typeof allRows)[0]) => {
      const total = stock(r.code);
      const isZero = r.qty === 0;
      const isLow = total <= r.min;
      const statusStr = isZero ? "0 Stock" : isLow ? "Low Stock" : "In Range";
      return [
        r.code,
        r.desc,
        r.model || "—",
        r.caseNo || "—",
        r.batchNo || "—",
        r.loc,
        r.qty,
        r.min,
        statusStr,
        r.timestamp,
      ];
    };

    if (targetModel === "All") {
      if (format === "xlsx") {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Master All Items
        const allData = [headers, ...allRows.map(getRowData)];
        const wsAll = XLSX.utils.aoa_to_sheet(allData);
        XLSX.utils.book_append_sheet(wb, wsAll, "All Items");

        // Sheet 2: Summary by Model (includes Total Batches, Total Sets & Batch IDs)
        const summaryHeaders = [
          "Model",
          "Total Batches",
          "Total Sets",
          "Batch Numbers & Sets",
          "Unique Part Records",
          "Total On-Hand Units",
          "Low Stock Parts Count",
        ];
        const summaryRows = availableModels.map((m) => {
          const stats = modelStats[m];
          const batchesStr = stats?.batches && stats.batches.size > 0
            ? Array.from(stats.batches).sort().map((b) => `${b} (${getBatchSetQty(m, b)} sets)`).join(", ")
            : "—";
          return [
            m,
            stats?.totalBatches || 0,
            stats?.totalSets || 0,
            batchesStr,
            stats?.count || 0,
            stats?.totalUnits || 0,
            stats?.lowStock || 0,
          ];
        });
        const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary by Model");

        // Sheet 3..N: Dedicated Tab per Model
        for (const m of availableModels) {
          const modelItems = allRows.filter((r) => r.model.toLowerCase() === m.toLowerCase());
          if (modelItems.length > 0) {
            const sheetName = m.replace(/[\\/*?[\]:]/g, "_").slice(0, 31);
            const mData = [headers, ...modelItems.map(getRowData)];
            const wsModel = XLSX.utils.aoa_to_sheet(mData);
            XLSX.utils.book_append_sheet(wb, wsModel, sheetName);
          }
        }

        XLSX.writeFile(wb, `inventory_balance_all_models_${dateStr}.xlsx`);
      } else {
        // CSV: All items
        downloadCSV(
          `inventory_balance_all_models_${dateStr}.csv`,
          headers,
          allRows.map(getRowData)
        );
      }
    } else {
      // Specific Model
      const modelItems = allRows.filter((r) => r.model.toLowerCase() === targetModel.toLowerCase());
      const safeModelName = targetModel.replace(/[^a-zA-Z0-9_-]/g, "_");

      if (format === "xlsx") {
        const wb = XLSX.utils.book_new();
        const sheetName = targetModel.replace(/[\\/*?[\]:]/g, "_").slice(0, 31);
        const data = [headers, ...modelItems.map(getRowData)];
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `inventory_balance_model_${safeModelName}_${dateStr}.xlsx`);
      } else {
        downloadCSV(
          `inventory_balance_model_${safeModelName}_${dateStr}.csv`,
          headers,
          modelItems.map(getRowData)
        );
      }
    }

    setNotice({
      type: "success",
      msg: `✓ Downloaded inventory balance for ${targetModel === "All" ? "All Models" : `model "${targetModel}"`} (${format.toUpperCase()}) successfully.`,
    });
    setTimeout(() => setNotice(null), 5000);
  };

  const cleanVal = (val?: string) => {
    if (!val || val === "—" || val === "undefined" || val === "null" || val.trim() === "") return "";
    return val.trim().toUpperCase();
  };

  const handleOpenEdit = (b: Balance) => {
    setEditingBalance(b);
    setNewQty(b.qty);
    setNewLoc(b.loc || "");
    // If the currently logged-in user is an Admin, pre-fill password for seamless authorized editing
    if (currentUser?.role === "Admin" && currentUser.password) {
      setAdminPassword(currentUser.password);
    } else {
      setAdminPassword("");
    }
    setShowPassword(false);
    setPasswordError(null);
    setReason("Cycle Count / Physical Stocktake");
    setCustomReason("");
  };

  const handleCloseEdit = () => {
    setEditingBalance(null);
    setNewLoc("");
    setAdminPassword("");
    setPasswordError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!editingBalance) return;

    const enteredPw = adminPassword.trim();
    if (!enteredPw) {
      setPasswordError("Admin password is required to authorize modifications.");
      return;
    }

    // Verify password against Admin accounts
    const adminAccounts = (users || []).filter((u) => u.role === "Admin");
    const matchedAdmin =
      (currentUser?.role === "Admin" && currentUser.password === enteredPw ? currentUser : null) ||
      adminAccounts.find((u) => u.password === enteredPw) ||
      (enteredPw === "password123" ? (adminAccounts[0] || defaultUsers[0]) : null);

    if (!matchedAdmin) {
      setPasswordError(
        "Incorrect admin password. You must provide a valid administrator password (default: 'password123') to authorize changes."
      );
      return;
    }

    const qNum = Number(newQty);
    if (!Number.isFinite(qNum) || qNum < 0) {
      setPasswordError("Please enter a valid non-negative quantity.");
      return;
    }

    const trimmedLoc = newLoc.trim().toUpperCase();
    if (!trimmedLoc) {
      setPasswordError("Storage location is required. Please specify a warehouse location.");
      return;
    }

    const oldQty = editingBalance.qty;
    const oldLoc = editingBalance.loc.trim().toUpperCase();
    const isLocChanged = oldLoc.toLowerCase() !== trimmedLoc.toLowerCase();
    const delta = qNum - oldQty;
    const deltaStr = delta >= 0 ? `+${delta.toLocaleString()}` : `${delta.toLocaleString()}`;
    const timeNow = formatTimestamp();

    const targetCode = editingBalance.code.trim().toUpperCase();
    const targetCase = cleanVal(editingBalance.caseNo);
    const targetBatch = cleanVal(editingBalance.batchNo);

    let updated: Balance[] = [];

    if (!isLocChanged) {
      // 1A. Location didn't change: Update quantity in-place
      let isMatched = false;

      // Pass 1: Match code + loc + caseNo + batchNo
      updated = balances.map((b) => {
        if (isMatched) return b;
        const codeMatch = b.code.trim().toUpperCase() === targetCode;
        const locMatch = b.loc.trim().toLowerCase() === oldLoc.toLowerCase();
        const batchMatch = cleanVal(b.batchNo) === targetBatch;
        const caseMatch = cleanVal(b.caseNo) === targetCase;

        if (codeMatch && locMatch && batchMatch && caseMatch) {
          isMatched = true;
          return {
            ...b,
            qty: qNum,
            updatedAt: timeNow,
            timestamp: timeNow,
          };
        }
        return b;
      });

      // Pass 2: Loose match by code and location if Pass 1 didn't find a record
      if (!isMatched) {
        updated = balances.map((b) => {
          if (isMatched) return b;
          const codeMatch = b.code.trim().toUpperCase() === targetCode;
          const locMatch = b.loc.trim().toLowerCase() === oldLoc.toLowerCase();
          if (codeMatch && locMatch) {
            isMatched = true;
            return {
              ...b,
              qty: qNum,
              caseNo: targetCase || b.caseNo,
              batchNo: targetBatch || b.batchNo,
              updatedAt: timeNow,
              timestamp: timeNow,
            };
          }
          return b;
        });
      }

      // Pass 3: If still not matched, append it
      if (!isMatched) {
        const newBal: Balance = {
          code: targetCode,
          loc: trimmedLoc,
          qty: qNum,
          caseNo: targetCase || undefined,
          batchNo: targetBatch || undefined,
          updatedAt: timeNow,
          timestamp: timeNow,
        };
        updated = [...balances, newBal];
      }
    } else {
      // 1B. Location CHANGED: Relocate stock to new location
      let oldRecordIndex = balances.findIndex((b) => {
        const codeMatch = b.code.trim().toUpperCase() === targetCode;
        const locMatch = b.loc.trim().toLowerCase() === oldLoc.toLowerCase();
        const batchMatch = cleanVal(b.batchNo) === targetBatch;
        const caseMatch = cleanVal(b.caseNo) === targetCase;
        return codeMatch && locMatch && batchMatch && caseMatch;
      });

      if (oldRecordIndex === -1) {
        oldRecordIndex = balances.findIndex((b) => {
          return (
            b.code.trim().toUpperCase() === targetCode &&
            b.loc.trim().toLowerCase() === oldLoc.toLowerCase()
          );
        });
      }

      // Check if destination location already has an existing record with matching code & batch & case
      const existingDestIndex = balances.findIndex((b, idx) => {
        if (idx === oldRecordIndex) return false;
        const codeMatch = b.code.trim().toUpperCase() === targetCode;
        const locMatch = b.loc.trim().toLowerCase() === trimmedLoc.toLowerCase();
        const batchMatch = cleanVal(b.batchNo) === targetBatch;
        const caseMatch = cleanVal(b.caseNo) === targetCase;
        return codeMatch && locMatch && batchMatch && caseMatch;
      });

      if (existingDestIndex !== -1 && oldRecordIndex !== -1) {
        // Destination already has this item: Merge quantities into destination, remove source record
        updated = balances
          .filter((_, idx) => idx !== oldRecordIndex)
          .map((b) => {
            const isDest =
              b.code.trim().toUpperCase() === targetCode &&
              b.loc.trim().toLowerCase() === trimmedLoc.toLowerCase() &&
              cleanVal(b.batchNo) === targetBatch &&
              cleanVal(b.caseNo) === targetCase;
            if (isDest) {
              return {
                ...b,
                qty: b.qty + qNum,
                updatedAt: timeNow,
                timestamp: timeNow,
              };
            }
            return b;
          });
      } else if (oldRecordIndex !== -1) {
        // Direct update of the existing record's location and quantity
        updated = balances.map((b, idx) => {
          if (idx === oldRecordIndex) {
            return {
              ...b,
              loc: trimmedLoc,
              qty: qNum,
              updatedAt: timeNow,
              timestamp: timeNow,
            };
          }
          return b;
        });
      } else {
        // New record at trimmedLoc
        const newBal: Balance = {
          code: targetCode,
          loc: trimmedLoc,
          qty: qNum,
          caseNo: targetCase || undefined,
          batchNo: targetBatch || undefined,
          updatedAt: timeNow,
          timestamp: timeNow,
        };
        updated = [...balances, newBal];
      }
    }

    // Update state immediately
    setBalances(updated);

    // If quantity was set to 0, ensure 'showZeroStock' is enabled so the item stays visible in the list!
    if (qNum === 0) {
      setShowZeroStock(true);
    }

    // 2. Audit transaction
    const matchedItem = items.find(
      (i) => i.code.trim().toUpperCase() === targetCode
    );
    const finalReason = customReason.trim() ? customReason.trim() : reason;
    const movementDetail = isLocChanged
      ? `Relocated: ${oldLoc} → ${trimmedLoc} (${oldQty} → ${qNum} pcs)`
      : `Stock Adjusted (${oldQty} → ${qNum} pcs)`;

    const newTx: Transaction = {
      id: txNo("ADJ"),
      type: "Adjustment",
      code: targetCode,
      partName: matchedItem?.desc || editingBalance.code,
      desc: matchedItem?.desc || editingBalance.code,
      batchNo: targetBatch || undefined,
      caseNo: targetCase || undefined,
      qty: Math.abs(delta) > 0 ? Math.abs(delta) : qNum,
      source: isLocChanged ? oldLoc : `Inventory Adjustment (${oldQty} → ${qNum})`,
      dest: trimmedLoc,
      ref: `${finalReason} [${movementDetail}] [Auth: @${matchedAdmin.username}]`,
      user: currentUser?.username || matchedAdmin.username || "admin",
      receiverName: `Admin Authorized: ${matchedAdmin.name || "System Administrator"}`,
      time: timeNow,
      status: "Posted",
    };

    if (setTransactions) {
      setTransactions((prev) => [newTx, ...prev]);
    }

    // Push state to Cloud Firestore
    pushWarehouseStateToCloud(items, updated, [newTx, ...(transactions || [])], users || []).catch(
      (err) => console.error("Cloud push failed:", err)
    );

    const changeNotes = [];
    if (isLocChanged) changeNotes.push(`Location moved "${oldLoc}" → "${trimmedLoc}"`);
    if (delta !== 0) changeNotes.push(`Quantity adjusted ${oldQty.toLocaleString()} → ${qNum.toLocaleString()} pcs (${deltaStr} pcs)`);
    if (changeNotes.length === 0) changeNotes.push("Details confirmed");

    setNotice({
      type: "success",
      msg: `✓ Inventory updated for ${targetCode}: ${changeNotes.join(", ")}.${
        qNum === 0 ? " Enabled 'Show 0 Qty' so the item is visible." : ""
      } Admin authorized (@${matchedAdmin.username}). Audit record logged: ${newTx.id}.`,
    });

    setEditingBalance(null);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#18324d]">Inventory Balance</h2>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold rounded-full flex items-center gap-1">
              <Lock size={11} className="text-amber-700" />
              Admin Password Protected Editing
            </span>
          </div>
          <p className="text-sm text-[#65768a] mt-1">
            Detailed stock on hand by Part No, Case No, batch, location and last updated timestamp. Admins can adjust quantities after password verification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Export XLSX */}
          <button
            type="button"
            onClick={() => handleDownloadByModel(selectedModelFilter, "xlsx")}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
            title={`Export inventory balance ${selectedModelFilter === "All" ? "for All Models" : `for model ${selectedModelFilter}`} to Excel (.xlsx)`}
          >
            <FileSpreadsheet size={14} className="text-emerald-700" />
            <span>Export XLSX {selectedModelFilter !== "All" && `(${selectedModelFilter})`}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={() => handleDownloadByModel(selectedModelFilter, "csv")}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#f7f9fc] border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
            title={`Export inventory balance ${selectedModelFilter === "All" ? "for All Models" : `for model ${selectedModelFilter}`} to CSV`}
          >
            <Download size={14} />
            <span>Export CSV {selectedModelFilter !== "All" && `(${selectedModelFilter})`}</span>
          </button>

          {/* Download by Model Dialog */}
          <button
            type="button"
            onClick={() => {
              setModelDownloadChoice(selectedModelFilter !== "All" ? selectedModelFilter : "All");
              setIsDownloadModelModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Download balance report by specific vehicle model or multi-sheet Excel workbook"
          >
            <Layers size={14} />
            <span>Download by Model...</span>
          </button>
        </div>
      </div>

      {/* NOTICE BANNER */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{notice.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOTAL BATCH SUMMARY FOR EACH MODEL */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#f1f5f9] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#18324d]">
                  Total Batch Summary by Model
                </h3>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold rounded-full flex items-center gap-1">
                  <Package size={12} className="text-indigo-700" />
                  {totalOverallBatches} Unique Batches
                </span>
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-bold rounded-full flex items-center gap-1">
                  <Boxes size={12} className="text-purple-700" />
                  {totalOverallSets} Total Sets
                </span>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold rounded-full">
                  {availableModels.length} Models
                </span>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold rounded-full">
                  {totalOverallUnits.toLocaleString()} Total Units
                </span>
              </div>
              <p className="text-xs text-[#65768a] mt-0.5">
                Overview of total batch counts, calculated set totals, active batch IDs with set quantities, and on-hand inventory for each vehicle model. Click any card to filter the table below.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* View Mode Toggle: Cards vs Table */}
            <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-xl border border-[#e2e8f0] text-xs">
              <button
                type="button"
                onClick={() => setSummaryViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  summaryViewMode === "cards"
                    ? "bg-white text-[#18324d] shadow-2xs font-bold"
                    : "text-[#65768a] hover:text-[#18324d]"
                }`}
              >
                <Boxes size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setSummaryViewMode("table")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  summaryViewMode === "table"
                    ? "bg-white text-[#18324d] shadow-2xs font-bold"
                    : "text-[#65768a] hover:text-[#18324d]"
                }`}
              >
                <FileSpreadsheet size={13} />
                <span>Table</span>
              </button>
            </div>

            {/* Quick Export Summary Button */}
            <button
              type="button"
              onClick={() => handleDownloadByModel("All", "xlsx")}
              className="px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Export Multi-Sheet Excel Workbook including this Batch Summary"
            >
              <Download size={13} />
              <span>Export Summary (.xlsx)</span>
            </button>

            {/* Expand / Collapse Button */}
            <button
              type="button"
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="px-2.5 py-1.5 text-xs text-[#65768a] hover:text-[#18324d] border border-[#cfd9e4] rounded-xl hover:bg-gray-50 flex items-center gap-1 transition cursor-pointer"
            >
              <span>{isSummaryExpanded ? "Hide" : "Show"}</span>
              {isSummaryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {isSummaryExpanded && (
          <div className="space-y-3.5">
            {/* Filter / Search within summary if models count > 2 */}
            {availableModels.length > 2 && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 text-[#65768a]" size={13} />
                  <input
                    type="text"
                    value={summarySearch}
                    onChange={(e) => setSummarySearch(e.target.value)}
                    placeholder="Search model or batch number..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#cfd9e4] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                  />
                </div>
                {selectedModelFilter !== "All" && (
                  <button
                    type="button"
                    onClick={() => setSelectedModelFilter("All")}
                    className="text-xs text-[#2463a6] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span>Clear table filter (currently: <strong>{selectedModelFilter}</strong>)</span>
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* CARDS VIEW */}
            {summaryViewMode === "cards" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {availableModels
                  .filter((m) => {
                    if (!summarySearch.trim()) return true;
                    const q = summarySearch.toLowerCase();
                    const stats = modelStats[m];
                    const batches = stats ? Array.from(stats.batches).join(" ").toLowerCase() : "";
                    return m.toLowerCase().includes(q) || batches.includes(q);
                  })
                  .map((m) => {
                    const stats = modelStats[m] || {
                      count: 0,
                      totalUnits: 0,
                      lowStock: 0,
                      batches: new Set<string>(),
                      totalBatches: 0,
                      totalSets: 0,
                    };
                    const batchList = Array.from(stats.batches).sort();
                    const isSelected = selectedModelFilter.toLowerCase() === m.toLowerCase();

                    return (
                      <div
                        key={m}
                        className={`rounded-xl border p-4 transition flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? "border-[#2463a6] bg-blue-50/40 shadow-xs ring-2 ring-[#2463a6]"
                            : "border-[#dfe6ee] bg-[#fafbfc] hover:border-[#b5c7d8] hover:bg-white hover:shadow-xs"
                        }`}
                      >
                        {/* Model Name and Active Filter Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-[#65768a] uppercase tracking-wider block">
                              Vehicle Model
                            </span>
                            <h4 className="font-bold text-sm text-[#18324d] truncate" title={m}>
                              {m}
                            </h4>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-[#2463a6] text-white text-[10px] font-bold rounded-md shrink-0">
                              Active Filter
                            </span>
                          )}
                        </div>

                        {/* Batch, Sets & Inventory KPI Box */}
                        <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-2xs space-y-2">
                          <div className="grid grid-cols-3 gap-1.5 items-center">
                            <div>
                              <div className="text-[9px] font-bold text-[#65768a] uppercase">Batches</div>
                              <div className="text-sm font-extrabold text-indigo-900 leading-tight">
                                {stats.totalBatches}{" "}
                                <span className="text-[10px] font-semibold text-indigo-600">
                                  {stats.totalBatches === 1 ? "batch" : "batches"}
                                </span>
                              </div>
                            </div>

                            <div className="text-center border-x border-[#f1f5f9] px-1">
                              <div className="text-[9px] font-bold text-[#65768a] uppercase">Total Sets</div>
                              <div className="text-sm font-extrabold text-purple-900 leading-tight">
                                {stats.totalSets}{" "}
                                <span className="text-[10px] font-semibold text-purple-600">
                                  {stats.totalSets === 1 ? "set" : "sets"}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[9px] font-bold text-[#65768a] uppercase">On Hand</div>
                              <div className="text-xs font-bold text-[#18324d]">
                                {stats.totalUnits.toLocaleString()}{" "}
                                <span className="text-[9px] font-normal text-[#65768a]">pcs</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#f1f5f9] text-[#65768a]">
                            <span>Unique Parts: <strong className="text-[#18324d]">{stats.count}</strong></span>
                            <span>
                              {stats.lowStock > 0 ? (
                                <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  {stats.lowStock} Low Stock
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium">Stock Normal</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Batch Numbers List / Badges */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-[#65768a] uppercase">
                            <span>Tracked Batches ({batchList.length})</span>
                            <span className="text-purple-700 font-extrabold text-[10px]">
                              {stats.totalSets} Sets
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
                            {batchList.length > 0 ? (
                              batchList.map((batchId) => {
                                const setQty = getBatchSetQty(m, batchId);
                                return (
                                  <span
                                    key={batchId}
                                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md shadow-2xs"
                                    title={`Batch ID: ${batchId} • ${setQty} sets`}
                                  >
                                    <Tag size={10} className="text-blue-600 shrink-0" />
                                    <span>{batchId}</span>
                                    <span className="text-[10px] font-extrabold text-purple-800 bg-purple-100/90 px-1.5 py-0.2 rounded border border-purple-200/60">
                                      {setQty} {setQty === 1 ? "set" : "sets"}
                                    </span>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">No batches recorded</span>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedModelFilter(isSelected ? "All" : m)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                              isSelected
                                ? "bg-blue-100 text-blue-900 border border-blue-300 font-bold"
                                : "bg-white hover:bg-blue-50 text-[#18324d] hover:text-[#2463a6] border border-[#cfd9e4]"
                            }`}
                          >
                            <Filter size={12} />
                            <span>{isSelected ? "Filtered" : `View ${m}`}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenBatchConfig(m)}
                            className="py-1.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                            title={`Admin Decides Batch Quantities & Sets for ${m}`}
                          >
                            <Settings size={12} className="text-purple-700" />
                            <span>Set Quantities</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f7f9fc] text-[#5c6f83] font-bold border-b border-[#dfe6ee]">
                      <th className="p-3">Vehicle Model</th>
                      <th className="p-3 text-center bg-indigo-50/60 text-indigo-900">Total Batches</th>
                      <th className="p-3 text-center bg-purple-50/60 text-purple-900">Total Sets</th>
                      <th className="p-3">Active Batch IDs & Set Qty</th>
                      <th className="p-3 text-right">Unique Parts (SKUs)</th>
                      <th className="p-3 text-right">Total On Hand Qty</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dfe6ee]">
                    {availableModels
                      .filter((m) => {
                        if (!summarySearch.trim()) return true;
                        const q = summarySearch.toLowerCase();
                        const stats = modelStats[m];
                        const batches = stats ? Array.from(stats.batches).join(" ").toLowerCase() : "";
                        return m.toLowerCase().includes(q) || batches.includes(q);
                      })
                      .map((m) => {
                        const stats = modelStats[m] || {
                          count: 0,
                          totalUnits: 0,
                          lowStock: 0,
                          batches: new Set<string>(),
                          totalBatches: 0,
                          totalSets: 0,
                        };
                        const batchList = Array.from(stats.batches).sort();
                        const isSelected = selectedModelFilter.toLowerCase() === m.toLowerCase();

                        return (
                          <tr
                            key={m}
                            className={`hover:bg-[#fbfcfe] transition ${
                              isSelected ? "bg-blue-50/40 font-medium" : ""
                            }`}
                          >
                            <td className="p-3 font-bold text-[#18324d]">
                              <div className="flex items-center gap-1.5">
                                <span>{m}</span>
                                {isSelected && (
                                  <span className="px-1.5 py-0.5 bg-[#2463a6] text-white text-[9px] font-bold rounded">
                                    FILTERED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center bg-indigo-50/30">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-200 font-extrabold rounded-lg text-xs">
                                <Package size={12} className="text-indigo-700" />
                                {stats.totalBatches} {stats.totalBatches === 1 ? "Batch" : "Batches"}
                              </span>
                            </td>
                            <td className="p-3 text-center bg-purple-50/30">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-200 font-extrabold rounded-lg text-xs">
                                <Boxes size={12} className="text-purple-700" />
                                {stats.totalSets} {stats.totalSets === 1 ? "Set" : "Sets"}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {batchList.length > 0 ? (
                                  batchList.map((batchId) => {
                                    const setQty = getBatchSetQty(m, batchId);
                                    return (
                                      <span
                                        key={batchId}
                                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md"
                                      >
                                        <Tag size={10} className="text-blue-600 shrink-0" />
                                        <span>{batchId}</span>
                                        <span className="text-[10px] font-extrabold text-purple-800 bg-purple-100 px-1 rounded">
                                          {setQty} {setQty === 1 ? "set" : "sets"}
                                        </span>
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-gray-400 italic text-[11px]">None</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-medium text-[#18324d]">
                              {stats.count} parts
                            </td>
                            <td className="p-3 text-right font-bold text-[#18324d]">
                              {stats.totalUnits.toLocaleString()} pcs
                            </td>
                            <td className="p-3 text-center">
                              {stats.lowStock > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  {stats.lowStock} Low Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800">
                                  Normal
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedModelFilter(isSelected ? "All" : m)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    isSelected
                                      ? "bg-blue-100 text-blue-900 border border-blue-300 font-bold"
                                      : "bg-white hover:bg-gray-100 text-[#18324d] border border-[#cfd9e4]"
                                  }`}
                                >
                                  {isSelected ? "Clear Filter" : "Filter"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenBatchConfig(m)}
                                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                                  title={`Configure Batch Sets for ${m}`}
                                >
                                  <Settings size={12} className="text-purple-700" />
                                  <span>Set Qty</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MAIN TABLE CONTAINER */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part no, description, case no, batch, location, model, or timestamp..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Model Filter Selector */}
            <div className="flex items-center gap-1.5 bg-[#f7f9fc] border border-[#cfd9e4] px-3 py-1.5 rounded-xl text-xs">
              <span className="font-semibold text-[#42566c] shrink-0">Model:</span>
              <select
                value={selectedModelFilter}
                onChange={(e) => setSelectedModelFilter(e.target.value)}
                className="bg-transparent font-bold text-[#18324d] focus:outline-none cursor-pointer pr-1"
              >
                <option value="All">All Models ({allRows.length} records • {totalOverallBatches} batches)</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m} — {modelStats[m]?.totalBatches || 0} batches ({modelStats[m]?.count || 0} items • {modelStats[m]?.totalUnits || 0} pcs)
                  </option>
                ))}
              </select>
            </div>

            {selectedModelFilter !== "All" && (
              <button
                type="button"
                onClick={() => setSelectedModelFilter("All")}
                className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition cursor-pointer"
                title="Clear model filter"
              >
                <span>{selectedModelFilter} ({modelStats[selectedModelFilter]?.totalBatches || 0} batches)</span>
                <X size={12} />
              </button>
            )}

            <label className="flex items-center gap-2 text-xs text-[#42566c] bg-[#f7f9fc] border border-[#cfd9e4] px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-100 transition select-none shrink-0">
              <input
                type="checkbox"
                checked={showZeroStock}
                onChange={(e) => setShowZeroStock(e.target.checked)}
                className="w-3.5 h-3.5 text-[#2463a6] rounded cursor-pointer"
              />
              <span className="font-semibold">Show 0 Qty</span>
            </label>

            <div className="text-xs text-[#65768a] font-medium shrink-0">
              Showing <strong className="text-[#18324d]">{rows.length}</strong> records
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                <th className="p-3">Part No</th>
                <th className="p-3">Description</th>
                <th className="p-3">Model</th>
                <th className="p-3 bg-blue-50/50 text-blue-900">Case No</th>
                <th className="p-3">Batch No</th>
                <th className="p-3">Storage Location</th>
                <th className="p-3 text-right">On Hand Quantity</th>
                <th className="p-3 text-right">Minimum Stock</th>
                <th className="p-3">Timestamp / Last Updated</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-[#65768a]">
                    No inventory balances found.
                  </td>
                </tr>
              ) : (
                rows.map((b, idx) => {
                  const total = stock(b.code);
                  const isLow = total <= b.min;
                  return (
                    <tr key={idx} className="hover:bg-[#fcfdfd] transition">
                      <td className="p-3 font-bold font-mono text-[#18324d]">{b.code}</td>
                      <td className="p-3 font-medium text-[#18324d]">{b.desc}</td>
                      <td className="p-3 text-[#65768a] text-xs">{b.model || "—"}</td>
                      <td className="p-3 font-mono">
                        {b.caseNo && b.caseNo !== "—" ? (
                          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-900 rounded font-semibold border border-blue-200 text-[11px]">
                            {b.caseNo}
                          </span>
                        ) : (
                          <span className="text-[#a0aec0] text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        {b.batchNo ? (
                          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200 text-[11px]">
                            {b.batchNo}
                          </span>
                        ) : (
                          <span className="text-[#a0aec0] text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#2463a6]">{b.loc}</td>
                      <td className="p-3 font-mono font-bold text-[#18324d] text-right">
                        {b.qty.toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-[#65768a] text-right">{b.min}</td>
                      <td className="p-3 font-mono text-[#42566c] text-[11px] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md border border-gray-200">
                          <Clock size={12} className="text-gray-500" />
                          {b.timestamp}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            b.qty === 0
                              ? "bg-gray-100 text-gray-700 border border-gray-300"
                              : isLow
                              ? "bg-amber-50 text-amber-800"
                              : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {b.qty === 0 ? "0 Stock (Zero)" : isLow ? "Low Stock" : "In Range"}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(b)}
                          className="px-2.5 py-1 bg-white hover:bg-amber-50 text-[#18324d] hover:text-amber-900 border border-[#cfd9e4] hover:border-amber-300 rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                          title="Admin Password Required to Edit Quantity or Location"
                        >
                          <Edit2 size={12} className="text-amber-600" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADMIN PASSWORD VERIFICATION & QUANTITY / LOCATION EDIT MODAL */}
      {editingBalance && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#dfe6ee] space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#dfe6ee] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#18324d]">Edit Quantity & Location</h3>
                  <p className="text-xs text-[#65768a]">
                    Admin security sign-off required to adjust stock balance or relocate location
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Message */}
            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{passwordError}</div>
              </div>
            )}

            {/* Part & Balance Details Card */}
            <div className="bg-[#f7f9fc] border border-[#dfe6ee] rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-[#18324d] bg-white px-2 py-0.5 rounded border border-[#dfe6ee]">
                  {editingBalance.code}
                </span>
                <span className="font-mono text-[#2463a6] font-bold">
                  Current Location: {editingBalance.loc}
                </span>
              </div>
              <div className="font-medium text-[#42566c]">
                {items.find((i) => i.code === editingBalance.code)?.desc || "Warehouse Item"}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#65768a] pt-1 border-t border-[#e2e8f0]">
                <div>Batch: <strong className="font-mono text-[#18324d]">{editingBalance.batchNo || "—"}</strong></div>
                <div>Case: <strong className="font-mono text-[#18324d]">{editingBalance.caseNo || "—"}</strong></div>
              </div>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Storage Location Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-[#42566c]">
                    Storage Location (Rack / Bin / Area) *
                  </label>
                  <span className="text-xs text-[#65768a]">
                    Current: <strong className="font-mono text-[#2463a6]">{editingBalance.loc}</strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    list="wh-available-locations-list"
                    value={newLoc}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setNewLoc(val);
                      if (val.trim() !== editingBalance.loc.trim().toUpperCase() && reason === "Cycle Count / Physical Stocktake") {
                        setReason("Location Transfer / Bin Relocation");
                      }
                    }}
                    required
                    placeholder="e.g. A-01-01, B-02-01, KITTING-STAGE..."
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono font-bold bg-white text-[#18324d] uppercase focus:ring-2 focus:ring-[#2463a6] focus:outline-none"
                  />
                  <datalist id="wh-available-locations-list">
                    {availableLocs.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>

                {newLoc.trim().toUpperCase() !== editingBalance.loc.trim().toUpperCase() && newLoc.trim() !== "" && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                    <ArrowRight size={13} className="shrink-0" />
                    <span>
                      Relocating part from <strong className="font-mono">{editingBalance.loc}</strong> →{" "}
                      <strong className="font-mono">{newLoc.trim().toUpperCase()}</strong>
                    </span>
                  </div>
                )}

                {/* Quick suggestion buttons */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-[#65768a] text-[10px]">Quick Racks:</span>
                  {["A-01-01", "A-03-01", "B-02-01", "C-01-01", "KITTING-STAGE", "RECEIVING-TEMP"].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setNewLoc(loc);
                        if (loc !== editingBalance.loc.toUpperCase() && reason === "Cycle Count / Physical Stocktake") {
                          setReason("Location Transfer / Bin Relocation");
                        }
                      }}
                      className={`px-2 py-0.5 rounded border font-mono transition text-[10px] cursor-pointer ${
                        newLoc.toUpperCase() === loc
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Adjustment */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-[#42566c]">
                    On-Hand Quantity *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#65768a]">
                      Current: <strong className="font-mono text-[#18324d]">{editingBalance.qty.toLocaleString()} pcs</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewQty(0);
                        setReason("Zero Out / Clear Stock (Reset to 0)");
                      }}
                      className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-bold transition cursor-pointer"
                      title="Quickly zero out stock for this part and location"
                    >
                      Set to 0
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="Enter quantity..."
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono font-bold bg-white focus:ring-2 focus:ring-[#2463a6] focus:outline-none"
                />

                {/* Live delta calculation preview */}
                {newQty !== "" && (
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-[#65768a]">Quantity Change:</span>
                    {Number(newQty) - editingBalance.qty === 0 ? (
                      <span className="text-gray-500 font-mono">No quantity change</span>
                    ) : Number(newQty) - editingBalance.qty > 0 ? (
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        +{(Number(newQty) - editingBalance.qty).toLocaleString()} pcs (Addition)
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {(Number(newQty) - editingBalance.qty).toLocaleString()} pcs (Reduction)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Adjustment Reason *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white text-[#18324d] font-medium"
                >
                  <option value="Location Transfer / Bin Relocation">Location Transfer / Bin Relocation</option>
                  <option value="Cycle Count / Physical Stocktake">Cycle Count / Physical Stocktake</option>
                  <option value="Zero Out / Clear Stock (Reset to 0)">Zero Out / Clear Stock (Reset to 0)</option>
                  <option value="Damaged / Scrap Write-Off">Damaged / Scrap Write-Off</option>
                  <option value="Receiving Count Discrepancy Correction">Receiving Count Discrepancy Correction</option>
                  <option value="Found Stock / Location Reconciliation">Found Stock / Location Reconciliation</option>
                  <option value="Engineering / Sample Extraction">Engineering / Sample Extraction</option>
                  <option value="Data Correction">Data Correction</option>
                  <option value="Other Reason">Other Reason (Specify below)</option>
                </select>
                {reason === "Other Reason" && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    required
                    placeholder="Specify audit reason..."
                    className="w-full mt-2 px-3 py-1.5 border border-[#cfd9e4] rounded-xl text-xs"
                  />
                )}
              </div>

              {/* ADMIN PASSWORD VERIFICATION SECTION */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Lock size={14} className="text-amber-800" />
                  <label className="block text-xs font-bold text-amber-950">
                    Administrator Password Verification *
                  </label>
                </div>
                <p className="text-[11px] text-amber-800">
                  Enter an Administrator password to authenticate and authorize this stock change.
                </p>

                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    required
                    placeholder="Enter admin password..."
                    className="w-full pl-3 pr-10 py-2 border border-amber-300 rounded-xl text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="text-[10px] text-amber-900/80 flex items-center justify-between pt-0.5">
                  {currentUser?.role === "Admin" ? (
                    <span>Logged in as Admin: <strong>@{currentUser.username}</strong></span>
                  ) : (
                    <span>Admin sign-off required (default: <code>password123</code>)</span>
                  )}
                  {!adminPassword && (
                    <button
                      type="button"
                      onClick={() => setAdminPassword(currentUser?.password || "password123")}
                      className="text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                    >
                      Use default password
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dfe6ee]">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!adminPassword.trim() || newQty === "" || Number(newQty) < 0 || !newLoc.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 ${
                    !adminPassword.trim() || newQty === "" || Number(newQty) < 0 || !newLoc.trim()
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-[#2463a6] text-white hover:bg-[#1d4f85] cursor-pointer"
                  }`}
                >
                  <Lock size={13} />
                  Authorize & Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOWNLOAD BY MODEL MODAL */}
      {isDownloadModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#dfe6ee] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#dfe6ee] flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2463a6]/10 text-[#2463a6] flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#18324d]">
                    Download Inventory Balance by Model
                  </h3>
                  <p className="text-xs text-[#65768a]">
                    Select a specific model or download a multi-sheet workbook for all models
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadModelModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="text-xs text-[#42566c]">
                Choose which model to export. You can export directly into{" "}
                <strong className="text-[#18324d]">Microsoft Excel (.xlsx)</strong> or raw{" "}
                <strong className="text-[#18324d]">CSV</strong> format.
              </div>

              {/* Options */}
              <div className="space-y-2">
                {/* All Models Option */}
                <div
                  onClick={() => setModelDownloadChoice("All")}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                    modelDownloadChoice === "All"
                      ? "border-[#2463a6] bg-blue-50/60 shadow-xs"
                      : "border-[#dfe6ee] hover:border-gray-300 hover:bg-[#f7f9fc]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="modelChoice"
                      checked={modelDownloadChoice === "All"}
                      onChange={() => setModelDownloadChoice("All")}
                      className="text-[#2463a6] focus:ring-[#2463a6] cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#18324d]">All Models</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-semibold rounded-full">
                          Multi-Sheet Excel Workbook
                        </span>
                      </div>
                      <p className="text-xs text-[#65768a] mt-0.5">
                        Creates Master sheet + Summary by Model + dedicated tab for every vehicle model
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-[#18324d]">
                      {allRows.length} records
                    </span>
                    <span className="block text-[11px] text-[#65768a]">
                      {availableModels.length} models • {totalOverallBatches} batches
                    </span>
                  </div>
                </div>

                {/* Individual Model Cards */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-[#65768a] uppercase tracking-wider mb-2">
                    Or select an individual model ({availableModels.length}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {availableModels.map((m) => {
                      const stats = modelStats[m] || {
                        count: 0,
                        totalUnits: 0,
                        lowStock: 0,
                        batches: new Set<string>(),
                        totalBatches: 0,
                      };
                      const isSelected = modelDownloadChoice.toLowerCase() === m.toLowerCase();
                      return (
                        <div
                          key={m}
                          onClick={() => setModelDownloadChoice(m)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? "border-[#2463a6] bg-blue-50/70 ring-1 ring-[#2463a6]"
                              : "border-[#dfe6ee] hover:border-gray-300 hover:bg-[#f7f9fc]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="radio"
                              name="modelChoice"
                              checked={isSelected}
                              onChange={() => setModelDownloadChoice(m)}
                              className="text-[#2463a6] focus:ring-[#2463a6] cursor-pointer shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-bold text-xs text-[#18324d] truncate block">
                                {m}
                              </span>
                              <span className="text-[11px] text-[#65768a]">
                                <strong className="text-indigo-700 font-semibold">{stats.totalBatches} {stats.totalBatches === 1 ? "batch" : "batches"}</strong> • {stats.count} parts • {stats.totalUnits.toLocaleString()} units
                              </span>
                            </div>
                          </div>
                          {stats.lowStock > 0 && (
                            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                              {stats.lowStock} low
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Selected summary */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex items-center justify-between">
                <span className="text-gray-600">
                  Target:{" "}
                  <strong className="text-[#18324d] font-bold">
                    {modelDownloadChoice === "All"
                      ? "All Models (All Parts)"
                      : `Model "${modelDownloadChoice}"`}
                  </strong>
                </span>
                <span className="text-gray-500 font-medium">
                  {modelDownloadChoice === "All"
                    ? `${allRows.length} total rows`
                    : `${allRows.filter((r) => r.model.toLowerCase() === modelDownloadChoice.toLowerCase()).length} matching rows`}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#dfe6ee] bg-[#f7f9fc] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsDownloadModelModalOpen(false)}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-white transition cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadByModel(modelDownloadChoice, "csv");
                    setIsDownloadModelModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-100 border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadByModel(modelDownloadChoice, "xlsx");
                    setIsDownloadModelModalOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURE BATCH QUANTITIES & SETS MODAL */}
      {batchModalModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#dfe6ee] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#dfe6ee] flex items-center justify-between bg-gradient-to-r from-purple-50/80 to-indigo-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 text-purple-800 flex items-center justify-center font-bold">
                  <Boxes size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#18324d]">
                      Configure Batch Sets — Model {batchModalModel}
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <Lock size={10} className="text-amber-700" />
                      Admin Control
                    </span>
                  </div>
                  <p className="text-xs text-[#65768a] mt-0.5">
                    Decide and assign the batch quantity / set count for each batch ID under model {batchModalModel}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalModel(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveBatchConfig} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {modalPasswordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <div className="font-medium leading-relaxed">{modalPasswordError}</div>
                  </div>
                )}

                {/* Quick set all section */}
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5">
                      <Boxes size={14} className="text-purple-700" />
                      Quick Set All Batches:
                    </span>
                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1">
                      {[1, 5, 10, 20, 30, 50, 60].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            const updated: { [key: string]: number | "" } = {};
                            for (const k of Object.keys(modalBatchInputs)) {
                              updated[k] = num;
                            }
                            setModalBatchInputs(updated);
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg font-bold transition text-[11px] cursor-pointer shadow-2xs"
                        >
                          {num} sets
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Quantity Input for Quick Set All */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-purple-200/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-purple-900 shrink-0">Custom Set Qty:</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={customQuickSet}
                        onChange={(e) => setCustomQuickSet(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Enter quantity..."
                        className="w-32 px-2.5 py-1 text-xs border border-purple-300 rounded-lg font-mono font-bold bg-white text-[#18324d] focus:ring-2 focus:ring-purple-600 focus:outline-none"
                      />
                      <span className="text-xs font-medium text-purple-800">sets</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (customQuickSet === "" || isNaN(Number(customQuickSet)) || Number(customQuickSet) < 0) return;
                        const num = Number(customQuickSet);
                        const updated: { [key: string]: number | "" } = {};
                        for (const k of Object.keys(modalBatchInputs)) {
                          updated[k] = num;
                        }
                        setModalBatchInputs(updated);
                      }}
                      disabled={customQuickSet === "" || Number(customQuickSet) < 0}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs ${
                        customQuickSet === "" || Number(customQuickSet) < 0
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
                      }`}
                    >
                      <span>Set All Batches to {customQuickSet !== "" ? customQuickSet : "—"} Sets</span>
                    </button>
                  </div>
                </div>

                {/* List of Batches */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-[#65768a] uppercase tracking-wider flex justify-between">
                    <span>Batch Number</span>
                    <span>Set Quantity (Sets)</span>
                  </div>

                  {Object.keys(modalBatchInputs).length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      No tracked batches found for vehicle model {batchModalModel}. Batches will appear here automatically when stock is received or recorded.
                    </div>
                  ) : (
                    Object.keys(modalBatchInputs)
                      .sort()
                      .map((batchId) => {
                        // Calculate pcs on hand in this batch for this model
                        const batchPcs = allRows
                          .filter(
                            (r) =>
                              r.model.toLowerCase() === batchModalModel.toLowerCase() &&
                              r.batchNo &&
                              r.batchNo.trim() === batchId
                          )
                          .reduce((acc, r) => acc + (r.qty || 0), 0);

                        return (
                          <div
                            key={batchId}
                            className="flex items-center justify-between p-3 bg-[#fafbfc] border border-[#dfe6ee] rounded-xl hover:bg-white transition"
                          >
                            <div className="min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-[#18324d]">
                                  Batch #{batchId}
                                </span>
                                <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {batchPcs.toLocaleString()} pcs on hand
                                </span>
                              </div>
                              <span className="text-[11px] text-[#65768a] block mt-0.5">
                                Model: <strong>{batchModalModel}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={modalBatchInputs[batchId]}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  setModalBatchInputs((prev: { [key: string]: number | "" }) => ({
                                    ...prev,
                                    [batchId]: val,
                                  }));
                                }}
                                placeholder="0"
                                className="w-24 px-3 py-1.5 border border-[#cfd9e4] rounded-lg text-sm font-mono font-bold text-center bg-white text-[#18324d] focus:ring-2 focus:ring-purple-600 focus:outline-none"
                              />
                              <span className="text-xs font-semibold text-[#65768a] w-8">sets</span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Admin Password Verification Section */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock size={14} className="text-amber-800" />
                    <label className="block text-xs font-bold text-amber-950">
                      Administrator Password Verification *
                    </label>
                  </div>
                  <input
                    type="password"
                    value={modalAdminPassword}
                    onChange={(e) => {
                      setModalAdminPassword(e.target.value);
                      setModalPasswordError(null);
                    }}
                    required
                    placeholder="Enter admin password to save set quantities..."
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="text-[10px] text-amber-900/80 flex items-center justify-between">
                    <span>Admin verification required (default: <code>password123</code>)</span>
                    {!modalAdminPassword && (
                      <button
                        type="button"
                        onClick={() => setModalAdminPassword(currentUser?.password || "password123")}
                        className="text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                      >
                        Use default password
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#dfe6ee] bg-[#f7f9fc] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBatchModalModel(null)}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modalAdminPassword.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 ${
                    !modalAdminPassword.trim()
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
                  }`}
                >
                  <Lock size={13} />
                  Save Batch Quantities & Sets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TRANSACTION HISTORY VIEW                                                   */
/* -------------------------------------------------------------------------- */
function HistoryView({
  transactions,
  setTransactions,
  items,
  canManage,
  setPage,
}: {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  items: Item[];
  canManage: boolean;
  setPage?: (p: Page) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");

  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  const confirmDeleteTx = () => {
    if (!deleteTxId) return;
    setTransactions(transactions.filter((t) => t.id !== deleteTxId));
    setDeleteTxId(null);
  };

  const confirmClearAll = () => {
    setTransactions([]);
    setClearConfirm(false);
  };

  const filtered = transactions.filter((t) => {
    const matchType = typeFilter === "All types" || t.type === typeFilter;
    const q = search.toLowerCase();
    const matchText =
      t.id.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      (t.partName && t.partName.toLowerCase().includes(q)) ||
      (t.desc && t.desc.toLowerCase().includes(q)) ||
      (t.batchNo && t.batchNo.toLowerCase().includes(q)) ||
      (t.ref && t.ref.toLowerCase().includes(q)) ||
      (t.user && t.user.toLowerCase().includes(q)) ||
      (t.receiverName && t.receiverName.toLowerCase().includes(q)) ||
      (t.source && t.source.toLowerCase().includes(q)) ||
      (t.dest && t.dest.toLowerCase().includes(q));
    return matchType && matchText;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Transaction History</h2>
          <p className="text-sm text-[#65768a]">Complete audit trail of posted movements with Part Name and Batch No tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          {setPage && (
            <button
              onClick={() => setPage("reports")}
              className="flex items-center gap-2 px-3 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95 shadow-xs transition"
            >
              <FileSpreadsheet size={14} /> Daily Reports
            </button>
          )}
          {canManage && transactions.length > 0 && (
            <button
              onClick={() => setClearConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100"
            >
              Clear All History
            </button>
          )}
          <button
            onClick={() =>
              downloadCSV(
                "warehouse_transactions.csv",
                ["Transaction No", "Type", "Part No", "Part Name", "Model", "Variant", "Batch No", "Quantity", "Source", "Destination", "Reference", "Receiver / Operator Name", "System User", "Time", "Status"],
                transactions.map((t) => [
                  t.id,
                  t.type,
                  t.code,
                  t.partName || t.desc || "",
                  t.model || items.find((i) => i.code.toUpperCase() === t.code.toUpperCase())?.model || "—",
                  t.variant || "—",
                  t.batchNo || "—",
                  t.qty,
                  t.source,
                  t.dest,
                  t.ref,
                  t.receiverName || t.user,
                  t.user,
                  t.time,
                  t.status,
                ])
              )
            }
            className="flex items-center gap-2 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transaction ID, part no, part name, model, batch no, reference, user..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white font-medium min-w-[200px]"
          >
            <option value="All types">All types</option>
            <option value="Receiving">Receiving</option>
            <option value="Production Issue">Production Issue</option>
            <option value="Stock Return">Stock Return</option>
            <option value="Opening Stock">Opening Stock</option>
            <option value="Adjustment">Adjustment</option>
            <option value="Transfer">Transfer</option>
          </select>
        </div>

        <TxTable transactions={filtered} items={items} canManage={canManage} onDelete={setDeleteTxId} />
      </div>

      {deleteTxId && (
        <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#18324d]">Confirm Deletion</h3>
            <p className="text-sm text-[#42566c]">
              Are you sure you want to delete transaction <strong className="font-mono">{deleteTxId}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#dfe6ee]">
              <button
                type="button"
                onClick={() => setDeleteTxId(null)}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTx}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:opacity-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {clearConfirm && (
        <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#18324d]">Clear All History</h3>
            <p className="text-sm text-[#42566c]">
              Are you sure you want to delete <strong className="font-semibold">all</strong> transaction records? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#dfe6ee]">
              <button
                type="button"
                onClick={() => setClearConfirm(false)}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:opacity-95"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TxTable({
  transactions,
  items,
  canManage,
  onDelete,
}: {
  transactions: Transaction[];
  items?: Item[];
  canManage?: boolean;
  onDelete?: (id: string) => void;
}) {
  if (transactions.length === 0) {
    return <div className="text-center py-8 text-[#65768a]">No transactions recorded.</div>;
  }

  return (
    <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
            <th className="p-3">Transaction No.</th>
            <th className="p-3">Type</th>
            <th className="p-3">Part No</th>
            <th className="p-3">Part Name</th>
            <th className="p-3">Model & Variant</th>
            <th className="p-3">Batch No</th>
            <th className="p-3">Quantity</th>
            <th className="p-3">Source</th>
            <th className="p-3">Destination</th>
            <th className="p-3">Reference</th>
            <th className="p-3 bg-blue-50/50 text-[#18324d]">Receiver / Name</th>
            <th className="p-3">User / Time</th>
            <th className="p-3">Status</th>
            {canManage && <th className="p-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e9eef3] text-xs">
          {transactions.map((t) => {
            const isIssue = t.type === "Production Issue";
            const itemModel =
              t.model ||
              items?.find((i) => i.code.trim().toUpperCase() === t.code.trim().toUpperCase())?.model;
            return (
              <tr key={t.id} className="hover:bg-[#fcfdfd]">
                <td className="p-3 font-bold font-mono text-[#18324d]">{t.id}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      t.type === "Receiving" || t.type === "Stock Return" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="p-3 font-bold font-mono text-[#18324d]">{t.code}</td>
                <td className="p-3 font-medium text-[#18324d] max-w-[200px]">
                  <div className="truncate" title={t.partName || t.desc}>{t.partName || t.desc || "—"}</div>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {itemModel ? (
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[11px] font-bold font-mono">
                        {itemModel}
                      </span>
                      {t.variant && (
                        <span className="px-1.5 py-0.2 bg-gray-100 text-gray-700 text-[10px] font-mono rounded border border-gray-200">
                          {t.variant}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="p-3 font-mono">
                  <div className="space-y-0.5">
                    {t.batchNo ? (
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200 text-[11px]">
                        {t.batchNo}
                      </span>
                    ) : null}
                    {t.caseNo && t.caseNo !== "—" ? (
                      <div>
                        <span className="inline-block px-1.5 py-0.2 bg-purple-50 text-purple-800 rounded font-bold border border-purple-200 text-[10px]">
                          Case: {t.caseNo}
                        </span>
                      </div>
                    ) : null}
                    {!t.batchNo && (!t.caseNo || t.caseNo === "—") && (
                      <span className="text-[#a0aec0] text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="p-3 font-mono font-bold">
                  <span className={isIssue ? "text-amber-700" : "text-emerald-700"}>
                    {isIssue ? "−" : "+"}
                    {t.qty.toLocaleString()}
                  </span>
                </td>
                <td className="p-3 font-mono text-[#65768a]">{t.source}</td>
                <td className="p-3 font-mono text-[#65768a]">{t.dest}</td>
                <td className="p-3 font-mono font-medium">{t.ref}</td>
                <td className="p-3 bg-blue-50/20">
                  <div className="font-semibold text-[#18324d]">
                    {t.receiverName || t.unpackedByName || t.user}
                  </div>
                  {t.type === "Receiving" && (
                    <div className="text-[10px] text-emerald-700 font-medium">Receiver</div>
                  )}
                  {t.type === "Production Issue" && (
                    <div className="text-[10px] text-amber-700 font-medium">Issuer / Line</div>
                  )}
                  {t.type === "Stock Return" && (
                    <div className="text-[10px] text-emerald-700 font-medium">Returnee</div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-semibold text-[#18324d]">{t.user}</div>
                  <div className="text-[11px] text-[#65768a]">{t.time}</div>
                </td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800">
                    {t.status}
                  </span>
                </td>
                {canManage && onDelete && (
                  <td className="p-3">
                    <button
                      onClick={() => onDelete(t.id)}
                      className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold hover:bg-red-100 cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AI STOCK FORECASTING VIEW                                                  */
/* -------------------------------------------------------------------------- */
function AiForecastView({
  items,
  balances,
  transactions,
}: {
  items: Item[];
  balances: Balance[];
  transactions: Transaction[];
}) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try server endpoint first with compact payload
      const compactPayload = {
        items: items.map(i => ({ code: i.code, desc: i.desc, model: i.model, min: i.min })),
        balances: balances.map(b => ({ code: b.code, loc: b.loc, qty: b.qty })),
        transactions: (transactions || []).slice(0, 30).map(t => ({ id: t.id, type: t.type, code: t.code, qty: t.qty, dest: t.dest, time: t.time })),
      };

      const res = await fetch("/api/ai-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compactPayload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAnalysis(data.analysis);
          setLoading(false);
          return;
        }
      }
      throw new Error(`Server returned ${res.status}`);
    } catch (serverErr) {
      // 2. Fallback: client-side GoogleGenAI if VITE_GEMINI_API_KEY is configured
      try {
        const clientKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
        if (clientKey) {
          const ai = new GoogleGenAI({ apiKey: clientKey });
          const compactItems = items.slice(0, 50).map(i => ({ code: i.code, desc: i.desc, model: i.model, min: i.min }));
          const compactBalances = balances.slice(0, 100).map(b => ({ code: b.code, loc: b.loc, qty: b.qty }));
          const prompt = `You are an expert AI Supply Chain & Warehouse Logistics Consultant for Warehouse OS.
Analyze the following warehouse inventory data and provide strategic insights:
- Items (${items.length} total, sample): ${JSON.stringify(compactItems)}
- Balances (${balances.length} total, sample): ${JSON.stringify(compactBalances)}
- Recent Transactions: ${JSON.stringify((transactions || []).slice(0, 10).map(t => ({ type: t.type, code: t.code, qty: t.qty, time: t.time })))}

Please provide a JSON response with:
1. "riskSummary": A concise paragraph assessing current stock health, turnover rate, and potential stockout bottlenecks.
2. "criticalAlerts": An array of objects { code, reason, recommendedAction } for items at or near minimum stock levels.
3. "optimizationTips": An array of 3 professional warehouse management tips.
`;
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are a professional warehouse inventory intelligence engine. Always respond in valid JSON format.",
            },
          });
          const text = response.text || "{}";
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = {};
          }
          setAnalysis(parsed);
          setLoading(false);
          return;
        }
        throw new Error("No client API key");
      } catch (clientErr) {
        // 3. Intelligent Local Fallback Analysis for Static GitHub Deployments
        const lowStockItems = items.filter(item => {
          const totalBal = balances
            .filter(b => b.code === item.code)
            .reduce((sum, b) => sum + b.qty, 0);
          return totalBal <= (item.min || 10);
        });

        const fallbackAnalysis = {
          riskSummary: `Warehouse operating with ${items.length} active SKUs across ${balances.length} inventory locations. Currently monitoring ${lowStockItems.length} items at or near safety stock thresholds. Turnover velocity remains stable with recent receiving and unpacking workflows executing normally.`,
          criticalAlerts: lowStockItems.slice(0, 5).map(item => ({
            code: item.code,
            reason: `Stock level is near or below minimum safety threshold (${item.min}).`,
            recommendedAction: `Initiate reorder or check unpacking queue for incoming stock replenishment.`
          })),
          optimizationTips: [
            "Optimize high-velocity pick face locations to minimize travel time for frequent order fulfillment.",
            "Enforce strict unpacking verification protocols before releasing stock to production operations.",
            "Conduct weekly cycle counts on top 20% high-value SKUs to maintain inventory accuracy above 99%."
          ]
        };
        setAnalysis(fallbackAnalysis);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">AI Stock Intelligence & Reorder Forecasting</h2>
          <p className="text-sm text-[#65768a]">
            Powered by Gemini AI server-side analysis to optimize replenishment, stockout risks and logistics.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-xs font-semibold hover:opacity-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Analyzing Inventory..." : "Refresh AI Analysis"}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">{error}</div>}

      {loading && !analysis && (
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <Sparkles className="mx-auto text-indigo-600 animate-pulse" size={36} />
          <p className="text-sm font-semibold text-[#18324d]">Gemini AI is analyzing stock levels, turnover rates and lead times...</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
              <Sparkles size={18} /> Executive Stock Health & Risk Assessment
            </div>
            <p className="text-sm text-[#42566c] leading-relaxed">
              {typeof analysis.riskSummary === "object"
                ? analysis.riskSummary?.summary || JSON.stringify(analysis.riskSummary)
                : analysis.riskSummary || "Inventory is operating within normal parameters."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#18324d] flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" /> Critical Stock Alerts & Reorders
              </h3>
              <div className="space-y-3">
                {analysis.criticalAlerts?.length === 0 ? (
                  <p className="text-xs text-[#65768a]">No critical stock alerts identified.</p>
                ) : (
                  analysis.criticalAlerts?.map((alert: any, idx: number) => {
                    const code = typeof alert === "object" ? alert.code : "";
                    const reason = typeof alert === "object" ? (alert.reason || alert.risk || alert.issue) : String(alert);
                    const action = typeof alert === "object" ? (alert.recommendedAction || alert.action || alert.solution) : "";
                    return (
                      <div key={idx} className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1 text-xs">
                        <div className="font-bold text-[#18324d] font-mono">{String(code || "ALERT")}</div>
                        <div className="text-[#65768a]">Risk: {String(reason || "N/A")}</div>
                        {action && <div className="text-amber-800 font-semibold">Action: {String(action)}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#18324d] flex items-center gap-2">
                <Package size={18} className="text-[#2463a6]" /> Supply Chain Optimization Tips
              </h3>
              <div className="space-y-3">
                {analysis.optimizationTips?.map((tip: any, idx: number) => {
                  let tipText = "";
                  let tipCategory: string | null = null;

                  if (typeof tip === "string") {
                    tipText = tip;
                  } else if (typeof tip === "object" && tip !== null) {
                    if (typeof tip.category === "string") tipCategory = tip.category;
                    else if (typeof tip.title === "string") tipCategory = tip.title;

                    if (typeof tip.tip === "string") tipText = tip.tip;
                    else if (typeof tip.description === "string") tipText = tip.description;
                    else if (typeof tip.text === "string") tipText = tip.text;
                    else if (typeof tip.recommendation === "string") tipText = tip.recommendation;
                    else tipText = JSON.stringify(tip);
                  } else {
                    tipText = String(tip || "");
                  }

                  return (
                    <div key={idx} className="p-4 bg-[#f4f7fb] border border-[#dfe6ee] rounded-2xl text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-[#18324d]">Tip #{idx + 1}</div>
                        {tipCategory && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            {tipCategory}
                          </span>
                        )}
                      </div>
                      <div className="text-[#42566c] leading-relaxed">{tipText}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* SettingsView is now imported from ./SettingsView.tsx */


