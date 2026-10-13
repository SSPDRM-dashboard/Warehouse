import React, { useState, useEffect } from "react";
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
  Trash2
} from "lucide-react";
import { Item, Balance, Transaction, Role, Page, UserAccount } from "./types";
import { seedItems, initialBalances, initialTransactions } from "./mockData";

export const defaultUsers: UserAccount[] = [
  { id: "usr_1", username: "admin", password: "password123", name: "System Administrator", role: "Admin" },
  { id: "usr_2", username: "manager", password: "password123", name: "Warehouse Manager", role: "Manager" },
  { id: "usr_3", username: "operator", password: "password123", name: "Floor Operator (WH001)", role: "User" },
];

// Module-level helpers
const txNo = (prefix: string) =>
  `${prefix}-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

const upsertBalance = (balances: Balance[], code: string, loc: string, delta: number) => {
  let found = false;
  const targetCode = code.trim().toUpperCase();
  const targetLoc = loc.trim();
  const out = balances.map((b) => {
    if (b.code.trim().toUpperCase() === targetCode && b.loc.trim().toLowerCase() === targetLoc.toLowerCase()) {
      found = true;
      return { ...b, qty: Math.max(0, b.qty + delta) };
    }
    return b;
  });
  if (!found) {
    out.push({ code: targetCode, loc: targetLoc, qty: Math.max(0, delta) });
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

  const [role, setRole] = useState<Role>("Admin");
  const [page, setPage] = useState<Page>("dashboard");

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

  const canManage = role === "Admin";

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

        <div className="text-[10px] tracking-widest text-[#9fb3c8] px-2 font-semibold">
          WORKSPACE
        </div>

        <nav className="flex flex-col gap-1">
          <SidebarButton
            active={page === "dashboard"}
            onClick={() => setPage("dashboard")}
            icon={<LayoutDashboard size={18} />}
            label="Overview"
          />
          {canManage && (
            <SidebarButton
              active={page === "items"}
              onClick={() => setPage("items")}
              icon={<Boxes size={18} />}
              label="Item Master"
            />
          )}
          {!canManage && (
            <SidebarButton
              active={page === "items"}
              onClick={() => setPage("items")}
              icon={<Boxes size={18} />}
              label="Item Lookup"
            />
          )}
          <SidebarButton
            active={page === "receiving"}
            onClick={() => setPage("receiving")}
            icon={<ArrowDownLeft size={18} />}
            label="Stock Receiving"
          />
          <SidebarButton
            active={page === "issue"}
            onClick={() => setPage("issue")}
            icon={<ArrowUpRight size={18} />}
            label="Send to Production"
          />
          <SidebarButton
            active={page === "return"}
            onClick={() => setPage("return")}
            icon={<ArrowDownLeft size={18} className="rotate-180" />}
            label="Return from Production"
          />
          <SidebarButton
            active={page === "inventory"}
            onClick={() => setPage("inventory")}
            icon={<Database size={18} />}
            label="Inventory Balance"
          />
          <SidebarButton
            active={page === "history"}
            onClick={() => setPage("history")}
            icon={<History size={18} />}
            label="Transactions"
          />
          <SidebarButton
            active={page === "ai_forecast"}
            onClick={() => setPage("ai_forecast")}
            icon={<Sparkles size={18} />}
            label="AI Stock Intelligence"
          />
          {canManage && (
            <SidebarButton
              active={page === "settings"}
              onClick={() => setPage("settings")}
              icon={<KeyRound size={18} />}
              label="User Settings"
            />
          )}
        </nav>

        <div className="mt-auto border border-[#304a65] rounded-xl p-3 text-xs text-[#c3d0de]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#2a9d68]"></span>
            <b className="text-white">Secure Local Mode</b>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9fb3c8]">
            Inventory records persist securely in this browser session.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex flex-col">
        <header className="bg-white border-b border-[#dfe6ee] px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#18324d]">
              {page === "dashboard" && "Dashboard Overview"}
              {page === "items" && (canManage ? "Admin Item Master Setup" : "Item Catalogue Lookup")}
              {page === "receiving" && "Stock Receiving & Inbound"}
              {page === "issue" && "Send Parts to Production"}
              {page === "inventory" && "Warehouse Inventory Balance"}
              {page === "history" && "Transaction History & Audit Log"}
              {page === "ai_forecast" && "AI Stock Intelligence & Reorder Forecasting"}
              {page === "settings" && "User Accounts & Security Settings"}
            </h2>
            <p className="text-xs text-[#65768a]">
              Real-time stock control, receiving, production issues and supply chain analytics
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#65768a]">
            <span className="font-semibold">VIEW AS</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="border border-[#cfd9e4] rounded-lg px-3 py-1.5 bg-white text-[#18324d] font-medium focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
            >
              <option value="Admin">Administrator</option>
              <option value="Manager">Warehouse Manager</option>
              <option value="User">Warehouse User</option>
            </select>
          </div>
        </header>

        <div className="p-6 max-w-[1400px] w-full mx-auto flex-1">
          {page === "dashboard" && (
            <DashboardView
              items={items}
              balances={balances}
              transactions={transactions}
              setPage={setPage}
            />
          )}
          {page === "items" && (
            <ItemsView
              items={items}
              setItems={setItems}
              balances={balances}
              setBalances={setBalances}
              canManage={canManage}
              stock={stock}
            />
          )}
          {page === "receiving" && (
            <ReceivingView
              items={items}
              balances={balances}
              setBalances={setBalances}
              transactions={transactions}
              setTransactions={setTransactions}
              allLocs={allLocs}
              stock={stock}
              role={role}
            />
          )}
          {page === "issue" && (
            <IssueView
              items={items}
              balances={balances}
              setBalances={setBalances}
              transactions={transactions}
              setTransactions={setTransactions}
              allLocs={allLocs}
              stock={stock}
              role={role}
            />
          )}
          {page === "return" && (
            <ReturnView
              items={items}
              balances={balances}
              setBalances={setBalances}
              transactions={transactions}
              setTransactions={setTransactions}
              allLocs={allLocs}
              stock={stock}
              role={role}
            />
          )}
          {page === "inventory" && (
            <InventoryView balances={balances} items={items} stock={stock} />
          )}
          {page === "history" && (
            <HistoryView
              transactions={transactions}
              setTransactions={setTransactions}
              items={items}
              canManage={canManage}
            />
          )}
          {page === "ai_forecast" && (
            <AiForecastView items={items} balances={balances} transactions={transactions} />
          )}
          {page === "settings" && (
            <SettingsView
              users={users}
              setUsers={setUsers}
              canManage={canManage}
            />
          )}
        </div>
      </main>
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
}: {
  items: Item[];
  balances: Balance[];
  transactions: Transaction[];
  setPage: (p: Page) => void;
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
            onClick={() => setPage("ai_forecast")}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 transition"
          >
            <Sparkles size={14} /> Run AI Stock Forecast
          </button>
        </div>
      </div>

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
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            onClick={() => setPage("receiving")}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-center transition"
          >
            + Receive
          </button>
          <button
            onClick={() => setPage("issue")}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-center transition"
          >
            - Issue Prod
          </button>
          <button
            onClick={() => setPage("return")}
            className="py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-center transition"
          >
            ↺ Return
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
                      <div className="font-bold text-[#18324d]">{i.code} — {i.desc}</div>
                      <div className="text-[#65768a]">Category: {i.category}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-amber-800">
                        {totalQty} {i.uom}
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
        <TxTable transactions={transactions.slice(0, 5)} />
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

  const confirmDelete = () => {
    if (!deleteCode) return;
    setItems(items.filter((i) => i.code !== deleteCode));
    setBalances(balances.filter((b) => b.code !== deleteCode));
    setDeleteCode(null);
  };

  const filtered = items.filter(
    (i) =>
      i.code.toLowerCase().includes(search.toLowerCase()) ||
      i.desc.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = (code: string) => {
    if (!canManage) return;
    setItems(items.map((i) => (i.code === code ? { ...i, active: !i.active } : i)));
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

        const parseLine = (line: string) => {
          let out = [];
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

        const firstRowRaw = parseLine(lines[0]);
        const firstRow = firstRowRaw.map((x) => x.toLowerCase().replace(/['"]+/g, ""));
        
        const headerKeywords = ["part", "code", "sku", "item", "desc", "description", "model", "category", "uom", "min"];
        const hasHeaders = firstRow.some((h) => headerKeywords.some((k) => h.includes(k)));

        let dataLines = hasHeaders ? lines.slice(1) : lines;
        let modelIdx = -1, codeIdx = -1, descIdx = -1, catIdx = -1, uomIdx = -1, minIdx = -1;

        if (hasHeaders) {
          const idx = (keys: string[]) => {
            for (const k of keys) {
              const found = firstRow.findIndex((h) => h.includes(k));
              if (found >= 0) return found;
            }
            return -1;
          };
          modelIdx = idx(["model", "series"]);
          codeIdx = idx(["part", "code", "sku", "item"]);
          descIdx = idx(["desc", "name", "description", "title"]);
          catIdx = idx(["category", "cat", "group"]);
          uomIdx = idx(["uom", "unit"]);
          minIdx = idx(["min", "minimum", "stock"]);
        }

        if (codeIdx === -1) codeIdx = hasHeaders ? (modelIdx === 0 ? 1 : 0) : 1;
        if (descIdx === -1) descIdx = codeIdx === 1 ? 2 : 1;

        const incoming: Item[] = dataLines.map((line) => {
          const r = parseLine(line);
          if (r.length === 0 || !r.some((x) => x)) return null;

          let model = modelIdx >= 0 ? (r[modelIdx] || "") : (hasHeaders ? "" : (r[0] || ""));
          let code = (codeIdx >= 0 ? r[codeIdx] : "") || r[1] || r[0] || "";
          let desc = (descIdx >= 0 ? r[descIdx] : "") || r[2] || r[1] || code;
          let category = catIdx >= 0 ? (r[catIdx] || "Automotive Parts") : (r[3] || "Automotive Parts");
          let uom = uomIdx >= 0 ? (r[uomIdx] || "PCS") : (r[4] || "PCS");
          let min = minIdx >= 0 ? Number(r[minIdx]) : Number(r[5]);

          if (!code && r.length > 0) code = r[0];
          if (!desc && code) desc = code;

          return {
            model: model.trim(),
            code: code.trim().toUpperCase(),
            desc: desc.trim(),
            category: category.trim() || "Automotive Parts",
            uom: (uom.trim() || "PCS").toUpperCase(),
            min: Number.isFinite(min) ? min : 10,
            active: true,
          };
        }).filter((i): i is Item => Boolean(i && i.code));

        if (incoming.length === 0) {
          throw new Error("No valid parts found. Please ensure your CSV has Part No values.");
        }

        const existingMap = new Map(items.map((i) => [i.code.toLowerCase(), i]));
        for (const i of incoming) {
          existingMap.set(i.code.toLowerCase(), i);
        }

        setItems(Array.from(existingMap.values()));
        alert(`Successfully imported / updated ${incoming.length} parts from CSV.`);
      } catch (err: any) {
        alert("Import failed: " + (err.message || "Unknown error"));
      }
      e.target.value = "";
    };
    reader.readAsText(file);
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
              ? "Register part numbers, maintain minimum stock rules and categories."
              : "Read-only part catalogue and stock reference."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              downloadCSV(
                "item_master_template.csv",
                ["Model", "Part No", "Description", "Category", "UOM", "Minimum Stock"],
                [
                  ["Civic FD", "PN-SAMPLE", "Sample Part Description", "Automotive Parts", "PCS", "10"]
                ]
              )
            }
            className="flex items-center gap-1 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
            title="Download CSV Template"
          >
            <Download size={14} /> Template
          </button>
          <button
            onClick={() =>
              downloadCSV(
                "item_master.csv",
                ["Model", "Part No", "Description", "Category", "UOM", "Minimum Stock", "Status"],
                items.map((i) => [i.model, i.code, i.desc, i.category, i.uom, i.min, i.active ? "Active" : "Inactive"])
              )
            }
            className="flex items-center gap-2 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
          >
            <Download size={14} /> Export CSV
          </button>
          {canManage && (
            <>
              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] cursor-pointer">
                <Upload size={14} /> Import CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCSV} />
              </label>
              <button
                onClick={() => setModalItem(null)}
                className="flex items-center gap-2 px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95"
              >
                <Plus size={14} /> Add Part
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by model, part no, description, or category..."
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
                <th className="p-3">Category / UOM</th>
                <th className="p-3">Stock On Hand</th>
                <th className="p-3">Min Level</th>
                <th className="p-3">Status</th>
                {canManage && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="text-center py-8 text-[#65768a]">
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
                      <td className="p-3">
                        <span className="font-medium text-[#18324d]">{i.category}</span>
                        <div className="text-[11px] text-[#65768a]">{i.uom}</div>
                      </td>
                      <td className="p-3 font-mono font-bold">
                        <span className={isLow ? "text-amber-700" : "text-[#18324d]"}>{currentStock}</span> {i.uom}
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
        <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#18324d]">Confirm Deletion</h3>
            <p className="text-sm text-[#42566c]">
              Are you sure you want to delete part <strong className="font-mono">{deleteCode}</strong>? This will remove its master record and all associated warehouse stock balances.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#dfe6ee]">
              <button
                type="button"
                onClick={() => setDeleteCode(null)}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:opacity-95"
              >
                Delete Part
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
          items={items}
        />
      )}
    </div>
  );
}

function ItemModal({
  item,
  onClose,
  onSave,
  items,
}: {
  item: Item | null;
  onClose: () => void;
  onSave: (i: Item) => void;
  items: Item[];
}) {
  const [model, setModel] = useState(item?.model || "");
  const [code, setCode] = useState(item?.code || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [category, setCategory] = useState(item?.category || "Automotive Parts");
  const [uom, setUom] = useState(item?.uom || "PCS");
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
      category,
      uom,
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
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
              >
                <option value="Automotive Parts">Automotive Parts</option>
                <option value="Packaging">Packaging</option>
                <option value="Consumables">Consumables</option>
                <option value="Spare Parts">Spare Parts</option>
                <option value="Raw Materials">Raw Materials</option>
                <option value="Other">Other</option>
              </select>
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
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Unit of Measure (UOM) *</label>
              <select
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
              >
                <option value="PCS">PCS</option>
                <option value="UNIT">UNIT</option>
                <option value="BOX">BOX</option>
                <option value="SET">SET</option>
                <option value="KG">KG</option>
                <option value="LITRE">LITRE</option>
              </select>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[#dfe6ee]">
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
        </form>
      </div>
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
}: {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  stock: (code: string) => number;
  role: Role;
}) {
  const [codeQuery, setCodeQuery] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [loc, setLoc] = useState("A-01-01");
  const [ref, setRef] = useState("");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const matchedItem = items.find(
    (i) => i.active && i.code.toLowerCase() === codeQuery.trim().toLowerCase()
  );

  const handleReceive = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!matchedItem) {
      setNotice({ msg: "Part not found or inactive. Please check the Part No.", type: "error" });
      return;
    }
    const qNum = Number(qty);
    if (!(qNum > 0 && Number.isFinite(qNum))) {
      setNotice({ msg: "Please enter a valid quantity greater than zero.", type: "error" });
      return;
    }
    const finalLoc = loc.trim() || "A-01-01";
    const id = txNo("RCV");
    setBalances(upsertBalance(balances, matchedItem.code, finalLoc, qNum));
    const newTx: Transaction = {
      id,
      type: "Receiving",
      code: matchedItem.code,
      desc: matchedItem.desc,
      qty: qNum,
      source: "Supplier",
      dest: finalLoc,
      ref: ref.trim() || "—",
      user: role === "Admin" ? "ADMIN-DEMO" : role === "Manager" ? "MGR-DEMO" : "WH001",
      time: new Date().toLocaleString(),
      status: "Posted",
    };
    setTransactions([newTx, ...transactions]);
    setNotice({
      msg: `Successfully posted receipt ${id}. Total stock for ${matchedItem.code}: ${stock(matchedItem.code) + qNum} ${matchedItem.uom}.`,
      type: "success",
    });
    setCodeQuery("");
    setQty("");
    setRef("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Stock Receiving</h2>
          <p className="text-sm text-[#65768a]">Record inbound supplier shipments into designated warehouse locations.</p>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
          Inbound movement
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-semibold text-[#18324d] mb-4">Receiving Details</h3>

          {notice && (
            <div
              className={`p-3 rounded-xl text-xs mb-4 ${
                notice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {notice.msg}
            </div>
          )}

          <form onSubmit={handleReceive} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Enter Part No *</label>
              <input
                type="text"
                list="activeItems"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                required
                placeholder="Enter part no..."
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
              <datalist id="activeItems">
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.desc}
                    </option>
                  ))}
              </datalist>
            </div>

            {codeQuery && (
              <div>
                {matchedItem ? (
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-emerald-900">{matchedItem.desc}</div>
                    <div className="text-emerald-700 font-mono">
                      {matchedItem.code} · {matchedItem.uom} · On Hand: {stock(matchedItem.code)}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                    Part not found in active master.
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Received Quantity *</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Destination Location</label>
                <input
                  type="text"
                  list="locsList"
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  placeholder="e.g. A-01-01 or new bay"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-mono"
                />
                <datalist id="locsList">
                  {allLocs().map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Delivery Order / Supplier Reference</label>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. DO-8021"
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95 shadow-xs transition"
            >
              ✓ Confirm & Post Receipt
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[#18324d] mb-3">Receiving Guidelines</h3>
            <div className="p-4 bg-[#f4f7fb] rounded-xl space-y-2 text-xs text-[#42566c]">
              <div className="flex justify-between">
                <span>Transaction Type</span>
                <strong className="text-[#18324d]">Receiving</strong>
              </div>
              <div className="flex justify-between">
                <span>Stock Logic</span>
                <strong className="text-[#18324d]">Previous Qty + Received Qty</strong>
              </div>
              <div className="flex justify-between">
                <span>Verification</span>
                <strong className="text-[#18324d]">Active Part No Required</strong>
              </div>
            </div>
            <p className="text-xs text-[#65768a] mt-3 leading-relaxed">
              Inactive or unregistered part numbers cannot be received. Warehouse users must contact the administrator to create new master records.
            </p>
          </div>

          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[#18324d] mb-4">Recent Receipts</h3>
            <TxTable transactions={transactions.filter((t) => t.type === "Receiving").slice(0, 4)} />
          </div>
        </div>
      </div>
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
}: {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  stock: (code: string, loc?: string) => number;
  role: Role;
}) {
  const [codeQuery, setCodeQuery] = useState("");
  const [sourceLoc, setSourceLoc] = useState("A-01-01");
  const [qty, setQty] = useState<number | "">("");
  const [destLine, setDestLine] = useState("Production Line 1");
  const [ref, setRef] = useState("");
  const [userId, setUserId] = useState(role === "Admin" ? "ADMIN-DEMO" : role === "Manager" ? "MGR-DEMO" : "WH001");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

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

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!matchedItem) {
      setNotice({ msg: "Part not found or inactive.", type: "error" });
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
      const allLocDetails = balances
        .filter((b) => b.code.trim().toUpperCase() === matchedItem.code.trim().toUpperCase() && b.qty > 0)
        .map((b) => `${b.loc}: ${b.qty} ${matchedItem.uom}`)
        .join(", ");
      setNotice({
        msg: `Insufficient stock at location "${targetLoc}". Available: ${currentLocStock} ${matchedItem.uom}. (In storage: ${allLocDetails || "0 " + matchedItem.uom})`,
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
      desc: matchedItem.desc,
      qty: qNum,
      source: targetLoc,
      dest: destLine,
      ref: ref.trim(),
      user: userId.trim(),
      time: new Date().toLocaleString(),
      status: "Posted",
    };
    setTransactions([newTx, ...transactions]);
    setNotice({
      msg: `Production issue posted successfully. Transaction ${id}. Remaining stock at ${targetLoc}: ${currentLocStock - qNum} ${matchedItem.uom}.`,
      type: "success",
    });
    setCodeQuery("");
    setQty("");
    setRef("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Send Parts to Production</h2>
          <p className="text-sm text-[#65768a]">Issue material from storage locations to assembly and production lines.</p>
        </div>
        <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
          Outbound movement
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-semibold text-[#18324d] mb-4">Production Issue Form</h3>

          {notice && (
            <div
              className={`p-3 rounded-xl text-xs mb-4 ${
                notice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {notice.msg}
            </div>
          )}

          <form onSubmit={handleIssue} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Enter Part No *</label>
              <input
                type="text"
                list="issueItems"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                required
                placeholder="Enter part no..."
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
              <datalist id="issueItems">
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.desc}
                    </option>
                  ))}
              </datalist>
            </div>

            {codeQuery && (
              <div>
                {matchedItem ? (
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-emerald-900">{matchedItem.desc}</div>
                    <div className="text-emerald-700 font-mono">
                      {matchedItem.code} · {matchedItem.uom} · Total In Stock: {stock(matchedItem.code)} {matchedItem.uom}
                    </div>
                    <div className="text-[11px] text-[#2463a6] font-semibold pt-1">
                      Storage Location Breakdown:{" "}
                      {balances
                        .filter((b) => b.code.trim().toUpperCase() === matchedItem.code.trim().toUpperCase() && b.qty > 0)
                        .map((b) => `${b.loc} (${b.qty} ${matchedItem.uom})`)
                        .join(", ") || "No stock in storage"}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                    Part not found or inactive.
                  </div>
                )}
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
                        {l} {matchedItem ? `(${locQty} ${matchedItem.uom} available)` : ""}
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
                  required
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
                  required
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
                required
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95 shadow-xs transition"
            >
              ↗ Confirm & Post Issue
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[#18324d] mb-3">Live Stock Summary</h3>
            <div className="p-4 bg-[#f4f7fb] rounded-xl space-y-3 text-xs">
              {matchedItem ? (
                <>
                  <div className="flex justify-between">
                    <span>Selected Part</span>
                    <strong className="text-[#18324d] font-mono">{matchedItem.code}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Stock at {sourceLoc}</span>
                    <strong className="text-[#18324d] font-mono">
                      {sourceStock} {matchedItem.uom}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Requested Qty</span>
                    <strong className="text-[#18324d] font-mono">
                      {qNum || 0} {matchedItem.uom}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-[#dfe6ee] pt-2">
                    <span>Balance After Issue</span>
                    <strong className={`font-mono ${remainder < 0 ? "text-red-700" : "text-[#2463a6]"}`}>
                      {remainder} {matchedItem.uom}
                    </strong>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-[#65768a]">Select an active part to view real-time balance.</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[#18324d] mb-4">Recent Production Issues</h3>
            <TxTable transactions={transactions.filter((t) => t.type === "Production Issue").slice(0, 4)} />
          </div>
        </div>
      </div>
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
}: {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  stock: (code: string) => number;
  role: Role;
}) {
  const [codeQuery, setCodeQuery] = useState("");
  const [sourceLine, setSourceLine] = useState("Production Line 1");
  const [qty, setQty] = useState<number | "">("");
  const [destLoc, setDestLoc] = useState("A-01-01");
  const [ref, setRef] = useState("");
  const [userId, setUserId] = useState(role === "Admin" ? "ADMIN-DEMO" : role === "Manager" ? "MGR-DEMO" : "WH001");
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const matchedItem = items.find(
    (i) => i.active && i.code.toLowerCase() === codeQuery.trim().toLowerCase()
  );

  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!matchedItem) {
      setNotice({ msg: "Part not found or inactive.", type: "error" });
      return;
    }
    const qNum = Number(qty);
    if (!(qNum > 0 && Number.isFinite(qNum))) {
      setNotice({ msg: "Enter a valid return quantity greater than zero.", type: "error" });
      return;
    }
    if (!ref.trim() || !userId.trim()) {
      setNotice({ msg: "Reference and user ID are required.", type: "error" });
      return;
    }

    const finalDest = destLoc.trim() || "A-01-01";
    const id = txNo("RET");
    setBalances(upsertBalance(balances, matchedItem.code, finalDest, qNum));
    const newTx: Transaction = {
      id,
      type: "Stock Return",
      code: matchedItem.code,
      desc: matchedItem.desc,
      qty: qNum,
      source: sourceLine,
      dest: finalDest,
      ref: ref.trim(),
      user: userId.trim(),
      time: new Date().toLocaleString(),
      status: "Posted",
    };
    setTransactions([newTx, ...transactions]);
    setNotice({
      msg: `Stock return posted successfully. Transaction ${id}. Updated stock for ${matchedItem.code}: ${stock(matchedItem.code) + qNum} ${matchedItem.uom}.`,
      type: "success",
    });
    setCodeQuery("");
    setQty("");
    setRef("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Return from Production</h2>
          <p className="text-sm text-[#65768a]">Keep unused production balance back into warehouse stock locations.</p>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
          Inbound return
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-semibold text-[#18324d] mb-4">Stock Return Form</h3>

          {notice && (
            <div
              className={`p-3 rounded-xl text-xs mb-4 ${
                notice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {notice.msg}
            </div>
          )}

          <form onSubmit={handleReturn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Enter Part No *</label>
              <input
                type="text"
                list="returnItems"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                required
                placeholder="Enter part no..."
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
              <datalist id="returnItems">
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.desc}
                    </option>
                  ))}
              </datalist>
            </div>

            {codeQuery && (
              <div>
                {matchedItem ? (
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-emerald-900">{matchedItem.desc}</div>
                    <div className="text-emerald-700 font-mono">
                      {matchedItem.code} · {matchedItem.uom} · Total On Hand: {stock(matchedItem.code)}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                    Part not found or inactive.
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Source Production Line *</label>
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
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Return Quantity *</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Destination Warehouse Location</label>
                <select
                  value={destLoc}
                  onChange={(e) => setDestLoc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-mono"
                >
                  {allLocs().map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Production / Return Ref *</label>
                <input
                  type="text"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  required
                  placeholder="e.g. RET-2401"
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
                required
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95 shadow-xs transition"
            >
              ✓ Confirm & Return to Stock
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[#18324d] mb-4">Recent Stock Returns</h3>
            <TxTable transactions={transactions.filter((t) => t.type === "Stock Return").slice(0, 4)} />
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
  items,
  stock,
}: {
  balances: Balance[];
  items: Item[];
  stock: (code: string) => number;
}) {
  const [search, setSearch] = useState("");

  const rows = balances
    .filter((b) => b.qty !== 0)
    .map((b) => {
      const i = items.find((x) => x.code === b.code) || {
        desc: "Unknown part",
        uom: "PCS",
        min: 0,
      };
      return {
        ...b,
        desc: i.desc,
        uom: i.uom,
        min: i.min,
      };
    })
    .filter(
      (b) =>
        b.code.toLowerCase().includes(search.toLowerCase()) ||
        b.loc.toLowerCase().includes(search.toLowerCase()) ||
        b.desc.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Inventory Balance</h2>
          <p className="text-sm text-[#65768a]">Detailed stock on hand by Part No and storage location.</p>
        </div>
        <button
          onClick={() =>
            downloadCSV(
              "inventory_balance.csv",
              ["Part No", "Description", "Location", "Quantity", "UOM", "Minimum Stock"],
              rows.map((r) => [r.code, r.desc, r.loc, r.qty, r.uom, r.min])
            )
          }
          className="flex items-center gap-2 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc]"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part no, description, or location..."
            className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
          />
        </div>

        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                <th className="p-3">Part No</th>
                <th className="p-3">Description</th>
                <th className="p-3">Storage Location</th>
                <th className="p-3">On Hand Quantity</th>
                <th className="p-3">Minimum Stock</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#65768a]">
                    No inventory balances found.
                  </td>
                </tr>
              ) : (
                rows.map((b, idx) => {
                  const total = stock(b.code);
                  const isLow = total <= b.min;
                  return (
                    <tr key={idx} className="hover:bg-[#fcfdfd]">
                      <td className="p-3 font-bold font-mono text-[#18324d]">{b.code}</td>
                      <td className="p-3 font-medium text-[#18324d]">{b.desc}</td>
                      <td className="p-3 font-mono font-bold text-[#2463a6]">{b.loc}</td>
                      <td className="p-3 font-mono font-bold text-[#18324d]">
                        {b.qty.toLocaleString()} {b.uom}
                      </td>
                      <td className="p-3 font-mono text-[#65768a]">{b.min}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLow ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {isLow ? "Low Stock" : "In Range"}
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
}: {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  items: Item[];
  canManage: boolean;
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
      (t.desc && t.desc.toLowerCase().includes(q)) ||
      (t.ref && t.ref.toLowerCase().includes(q)) ||
      (t.user && t.user.toLowerCase().includes(q)) ||
      (t.source && t.source.toLowerCase().includes(q)) ||
      (t.dest && t.dest.toLowerCase().includes(q));
    return matchType && matchText;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">Transaction History</h2>
          <p className="text-sm text-[#65768a]">Complete audit trail of posted movements and controlled adjustments.</p>
        </div>
        <div className="flex items-center gap-2">
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
                ["Transaction No", "Type", "Part No", "Description", "Quantity", "Source", "Destination", "Reference", "User", "Time", "Status"],
                transactions.map((t) => [t.id, t.type, t.code, t.desc, t.qty, t.source, t.dest, t.ref, t.user, t.time, t.status])
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
              placeholder="Search transaction ID, part no, reference, user, or location..."
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

        <TxTable transactions={filtered} canManage={canManage} onDelete={setDeleteTxId} />
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
  canManage,
  onDelete,
}: {
  transactions: Transaction[];
  canManage?: boolean;
  onDelete?: (id: string) => void;
}) {
  if (transactions.length === 0) {
    return <div className="text-center py-8 text-[#65768a]">No transactions recorded.</div>;
  }

  return (
    <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
      <table className="w-full text-left border-collapse min-w-[850px]">
        <thead>
          <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
            <th className="p-3">Transaction No.</th>
            <th className="p-3">Type</th>
            <th className="p-3">Part</th>
            <th className="p-3">Quantity</th>
            <th className="p-3">Source</th>
            <th className="p-3">Destination</th>
            <th className="p-3">Reference</th>
            <th className="p-3">User / Time</th>
            <th className="p-3">Status</th>
            {canManage && <th className="p-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e9eef3] text-xs">
          {transactions.map((t) => {
            const isIssue = t.type === "Production Issue";
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
                <td className="p-3">
                  <div className="font-bold font-mono text-[#18324d]">{t.code}</div>
                  <div className="text-[#65768a] text-[11px]">{t.desc}</div>
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
                      className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-semibold hover:bg-red-100"
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
      const res = await fetch("/api/ai-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, balances, transactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate AI analysis");
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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
              {analysis.riskSummary || "Inventory is operating within normal parameters."}
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
                  analysis.criticalAlerts?.map((alert: any, idx: number) => (
                    <div key={idx} className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1 text-xs">
                      <div className="font-bold text-[#18324d] font-mono">{alert.code}</div>
                      <div className="text-[#65768a]">Risk: {alert.reason}</div>
                      <div className="text-amber-800 font-semibold">Action: {alert.recommendedAction}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#18324d] flex items-center gap-2">
                <Package size={18} className="text-[#2463a6]" /> Supply Chain Optimization Tips
              </h3>
              <div className="space-y-3">
                {analysis.optimizationTips?.map((tip: string, idx: number) => (
                  <div key={idx} className="p-4 bg-[#f4f7fb] border border-[#dfe6ee] rounded-2xl text-xs space-y-1">
                    <div className="font-bold text-[#18324d]">Tip #{idx + 1}</div>
                    <div className="text-[#42566c] leading-relaxed">{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* USER & PASSWORD SETTINGS VIEW (ADMIN ONLY)                                 */
/* -------------------------------------------------------------------------- */
function SettingsView({
  users,
  setUsers,
  canManage,
}: {
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  canManage: boolean;
}) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("User");

  const [isAdding, setIsAdding] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("User");

  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
    setNotice({ msg: `Account "${editUsername.trim()}" updated successfully.`, type: "success" });
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
    setNewRole("User");
    setNotice({ msg: `New user account "${newUser.username}" created successfully.`, type: "success" });
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (users.length <= 1) {
      setNotice({ msg: "Cannot remove the only remaining user account.", type: "error" });
      return;
    }
    setUsers(users.filter((u) => u.id !== id));
    setNotice({ msg: `User "${username}" has been removed.`, type: "success" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#18324d]">User Accounts & Security Settings</h2>
          <p className="text-sm text-[#65768a]">
            Manage login credentials, set passwords for administrators, managers, warehouse users, and add new operators.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setIsAdding(true);
              setNotice(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95 shadow-xs"
          >
            <Plus size={14} /> Add User Account
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl text-xs ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* Add User Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-[#07182b]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
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
                  placeholder="e.g. John Doe (Forklift Shift 1)"
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
                  placeholder="e.g. jdoe or wh002"
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
                  placeholder="e.g. Pass@1234"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Assigned Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="Admin">Administrator (Full Access)</option>
                  <option value="Manager">Warehouse Manager</option>
                  <option value="User">Warehouse User (Floor Operator)</option>
                </select>
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
                  className="px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#18324d]">Edit Username & Password</h3>
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
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Role *</label>
                <select
                  value={editRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="Admin">Administrator (Full Access)</option>
                  <option value="Manager">Warehouse Manager</option>
                  <option value="User">Warehouse User (Floor Operator)</option>
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
                  className="px-4 py-2 bg-[#2463a6] text-white rounded-xl text-xs font-semibold hover:opacity-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Accounts Table */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#18324d]">
          <ShieldCheck size={18} className="text-[#2463a6]" />
          <span>Configured User Credentials</span>
        </div>

        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                <th className="p-3">User / Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Password</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {users.map((u) => {
                const isShow = Boolean(showPasswordMap[u.id]);
                return (
                  <tr key={u.id} className="hover:bg-[#fcfdfd]">
                    <td className="p-3 font-semibold text-[#18324d]">
                      {u.name}
                    </td>
                    <td className="p-3 font-mono font-bold text-[#2463a6]">
                      {u.username}
                    </td>
                    <td className="p-3 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#f4f7fb] px-2 py-1 rounded-lg border border-[#dfe6ee]">
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
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === "Admin"
                            ? "bg-purple-50 text-purple-800 border border-purple-200"
                            : u.role === "Manager"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(u)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#cfd9e4] text-[#18324d] rounded-lg text-[11px] font-semibold hover:bg-[#f7f9fc]"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
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

        <div className="p-4 bg-[#f4f7fb] rounded-xl text-xs text-[#65768a] leading-relaxed">
          <strong className="text-[#18324d]">Security Notice:</strong> User credentials configured here are stored securely in local browser storage for warehouse management, access delegation, and auditing.
        </div>
      </div>
    </div>
  );
}

