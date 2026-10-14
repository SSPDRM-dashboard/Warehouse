import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Upload,
  RefreshCw,
  Database,
  ExternalLink,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Share2
} from "lucide-react";
import { Item, Balance, Transaction, UserAccount } from "./types";
import { seedItems, initialBalances, initialTransactions } from "./mockData";
import { defaultUsers } from "./App";

interface SyncBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  balances: Balance[];
  transactions: Transaction[];
  users: UserAccount[];
  onRestoreData: (data: {
    items: Item[];
    balances: Balance[];
    transactions: Transaction[];
    users?: UserAccount[];
  }) => void;
}

export function SyncBackupModal({
  isOpen,
  onClose,
  items,
  balances,
  transactions,
  users,
  onRestoreData,
}: SyncBackupModalProps) {
  const [activeTab, setActiveTab] = useState<"code" | "file" | "demo" | "git">("code");
  const [copied, setCopied] = useState(false);
  const [pasteCode, setPasteCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const generateSyncPayload = () => {
    const payload = {
      version: "1.0",
      app: "Warehouse OS",
      exportedAt: new Date().toISOString(),
      counts: {
        items: items.length,
        balances: balances.length,
        transactions: transactions.length,
        users: users.length,
      },
      items,
      balances,
      transactions,
      users,
    };
    return JSON.stringify(payload, null, 2);
  };

  const generateCompressedCode = () => {
    try {
      const payload = {
        v: 1,
        items,
        balances,
        transactions,
        users,
      };
      const jsonStr = JSON.stringify(payload);
      // UTF-8 safe base64
      const b64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      ));
      return `WHOS:${b64}`;
    } catch (e: any) {
      return JSON.stringify({ items, balances, transactions, users });
    }
  };

  const handleCopyCode = () => {
    const code = generateCompressedCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setStatusMessage({ type: "success", text: "Sync Code copied to clipboard! Paste it on your Vercel deployment." });
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleApplyPasteCode = () => {
    setStatusMessage(null);
    const trimmed = pasteCode.trim();
    if (!trimmed) {
      setStatusMessage({ type: "error", text: "Please paste a sync code or JSON payload." });
      return;
    }

    try {
      let parsedData: any = null;
      if (trimmed.startsWith("WHOS:")) {
        const rawB64 = trimmed.slice(5);
        const decodedStr = decodeURIComponent(
          Array.prototype.map
            .call(atob(rawB64), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        parsedData = JSON.parse(decodedStr);
      } else {
        parsedData = JSON.parse(trimmed);
      }

      if (!parsedData || !Array.isArray(parsedData.items) || !Array.isArray(parsedData.balances)) {
        setStatusMessage({
          type: "error",
          text: "Invalid sync format. Ensure the data contains valid items and balances.",
        });
        return;
      }

      onRestoreData({
        items: parsedData.items,
        balances: parsedData.balances,
        transactions: Array.isArray(parsedData.transactions) ? parsedData.transactions : [],
        users: Array.isArray(parsedData.users) ? parsedData.users : undefined,
      });

      setStatusMessage({
        type: "success",
        text: `Successfully synced! Restored ${parsedData.items.length} parts, ${parsedData.balances.length} stock bins, and ${(parsedData.transactions || []).length} transactions.`,
      });
      setPasteCode("");
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Failed to parse sync code: ${err.message || "Unknown error"}`,
      });
    }
  };

  const handleDownloadJSON = () => {
    const content = generateSyncPayload();
    const blob = new Blob([content], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.href = url;
    a.download = `warehouse_os_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({ type: "success", text: "Backup file downloaded successfully!" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.items) || !Array.isArray(data.balances)) {
          throw new Error("File missing items or balances arrays");
        }

        onRestoreData({
          items: data.items,
          balances: data.balances,
          transactions: Array.isArray(data.transactions) ? data.transactions : [],
          users: Array.isArray(data.users) ? data.users : undefined,
        });

        setStatusMessage({
          type: "success",
          text: `Backup file restored! Loaded ${data.items.length} parts and ${data.balances.length} stock bins.`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: `File restore error: ${err.message || "Invalid JSON"}`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleLoadDemo = () => {
    if (confirm("Reset current warehouse data to standard sample automotive parts and transactions?")) {
      onRestoreData({
        items: seedItems,
        balances: initialBalances,
        transactions: initialTransactions,
        users: defaultUsers,
      });
      setStatusMessage({
        type: "success",
        text: "Standard demo dataset loaded with 6 parts, 5 balance locations, and transactions.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#10243b] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-300">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">Warehouse Data & Deployment Sync</h3>
              <p className="text-xs text-[#9fb3c8]">Sync your parts, stock & records between Google Studio & Vercel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9fb3c8] hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Why this is needed explanation banner */}
        <div className="bg-[#f0f5fc] border-b border-[#d8e4f5] px-6 py-3 text-xs text-[#2b4c73] flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#2463a6] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Why are Google Studio and Vercel showing different data?</strong> Web browsers isolate local storage by domain.
            Your warehouse records created in Google Studio stay on Google Studio until you transfer them. Use the tools below to sync seamlessly in seconds!
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`px-6 py-3 text-xs flex items-center gap-2 border-b ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {statusMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#dfe6ee] bg-[#f7f9fc] px-6 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("code")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "code"
                ? "border-[#2463a6] text-[#2463a6]"
                : "border-transparent text-[#65768a] hover:text-[#18324d]"
            }`}
          >
            <Copy size={14} /> One-Click Sync Code
          </button>
          <button
            onClick={() => setActiveTab("file")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "file"
                ? "border-[#2463a6] text-[#2463a6]"
                : "border-transparent text-[#65768a] hover:text-[#18324d]"
            }`}
          >
            <Download size={14} /> JSON File Backup
          </button>
          <button
            onClick={() => setActiveTab("demo")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "demo"
                ? "border-[#2463a6] text-[#2463a6]"
                : "border-transparent text-[#65768a] hover:text-[#18324d]"
            }`}
          >
            <Database size={14} /> Load Demo Data
          </button>
          <button
            onClick={() => setActiveTab("git")}
            className={`pb-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "git"
                ? "border-[#2463a6] text-[#2463a6]"
                : "border-transparent text-[#65768a] hover:text-[#18324d]"
            }`}
          >
            <Terminal size={14} /> Code / Git Sync
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#42566c] flex-1">
          {activeTab === "code" && (
            <div className="space-y-4">
              <div className="bg-white border border-[#dfe6ee] rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-[#18324d] text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                      Export Data from Current Environment
                    </h4>
                    <p className="text-xs text-[#65768a] mt-0.5">
                      Includes {items.length} parts, {balances.length} bin balances, and {transactions.length} movements.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2463a6] text-white rounded-xl font-semibold hover:opacity-95 transition"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Sync Code"}
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#dfe6ee] rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="font-bold text-[#18324d] text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
                  Import & Apply Sync Code
                </h4>
                <p className="text-xs text-[#65768a]">
                  Open your other site (e.g., your Vercel deployment), open this Sync dialog, and paste the code below:
                </p>
                <textarea
                  value={pasteCode}
                  onChange={(e) => setPasteCode(e.target.value)}
                  placeholder="Paste WHOS:... sync code or JSON payload here"
                  className="w-full h-24 p-3 border border-[#cfd9e4] rounded-xl font-mono text-[11px] bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                />
                <button
                  onClick={handleApplyPasteCode}
                  disabled={!pasteCode.trim()}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} /> Apply Sync to Current Environment
                </button>
              </div>
            </div>
          )}

          {activeTab === "file" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-[#dfe6ee] rounded-xl p-5 bg-[#fafbfd] flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                    <Download size={20} />
                  </div>
                  <h4 className="font-bold text-sm text-[#18324d]">Export Backup (.json)</h4>
                  <p className="text-xs text-[#65768a] mt-1 leading-relaxed">
                    Download a full snapshot of your warehouse database including Item Master, stock bin balances, transaction audit logs, and users.
                  </p>
                </div>
                <button
                  onClick={handleDownloadJSON}
                  className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2463a6] text-white rounded-xl font-semibold hover:opacity-95 transition"
                >
                  <Download size={14} /> Download Backup JSON
                </button>
              </div>

              <div className="border border-[#dfe6ee] rounded-xl p-5 bg-[#fafbfd] flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                    <Upload size={20} />
                  </div>
                  <h4 className="font-bold text-sm text-[#18324d]">Restore Backup (.json)</h4>
                  <p className="text-xs text-[#65768a] mt-1 leading-relaxed">
                    Upload a previously downloaded JSON backup file to instantly overwrite or populate this environment.
                  </p>
                </div>
                <label className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#cfd9e4] text-[#18324d] rounded-xl font-semibold hover:bg-[#f7f9fc] cursor-pointer transition">
                  <Upload size={14} /> Select Backup File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "demo" && (
            <div className="border border-[#dfe6ee] rounded-xl p-5 bg-[#fafbfd] space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#18324d]">Restore Automotive Demo Dataset</h4>
                <p className="text-xs text-[#65768a] mt-1 leading-relaxed">
                  If your Vercel deployment opened blank (0 Part Masters, 0 Units), you can instantly initialize it with standard automotive assembly parts (Civic FD brackets, packaging trays, bearings, and location balances).
                </p>
              </div>
              <div className="bg-white border border-[#dfe6ee] rounded-xl p-3 text-[11px] font-mono text-[#5c6f83] space-y-1">
                <div>• 6 Standard Registered Part Numbers (PN-1001 to PN-1006)</div>
                <div>• 5 Warehouse Locations (A-01-01, B-02-01, C-01-02, etc.) with 476 total units</div>
                <div>• Initial audit receiving and production issue transactions</div>
              </div>
              <button
                onClick={handleLoadDemo}
                className="w-full py-2.5 bg-[#10243b] text-white rounded-xl font-bold hover:bg-[#1a334f] transition flex items-center justify-center gap-2"
              >
                <Database size={14} /> Populate Standard Demo Dataset
              </button>
            </div>
          )}

          {activeTab === "git" && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-[#18324d]">Deploying Latest Google Studio Code to Vercel</h4>
                <p className="text-xs text-[#65768a] mt-1">
                  If you connected your GitHub repository to Vercel, push the latest commits from this project to your repository so Vercel builds the newest version:
                </p>
              </div>

              <div className="bg-[#0f172a] text-[#e2e8f0] p-4 rounded-xl font-mono text-xs space-y-2">
                <div className="text-emerald-400"># 1. Add your GitHub repository as origin (if not already added):</div>
                <div className="text-white select-all">git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git</div>
                <div className="text-emerald-400 mt-2"># 2. Push the commits to your GitHub main branch:</div>
                <div className="text-white select-all">git push -u origin main --force</div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-[#18324d]">Vercel Redeployment Tip:</div>
                <div className="text-[#65768a] leading-relaxed">
                  On vercel.com &gt; your project &gt; <strong>Deployments</strong>, click the three dots (<code>...</code>) &gt; <strong>Redeploy</strong> &gt; uncheck <em>"Use existing Build Cache"</em> to ensure Vite and dependencies compile cleanly.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f7f9fc] border-t border-[#dfe6ee] px-6 py-3 flex items-center justify-between text-xs text-[#65768a]">
          <span className="font-mono">Warehouse OS Data Bridge</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#cfd9e4] rounded-xl font-semibold text-[#18324d] hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
