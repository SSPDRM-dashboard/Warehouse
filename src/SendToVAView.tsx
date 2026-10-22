import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Truck,
  Plus,
  Search,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Boxes,
  PackageCheck,
  Printer,
  X,
  RefreshCw,
  QrCode,
  Calendar,
  Filter,
  ArrowRight,
  ShieldCheck,
  User,
  Clock,
  Sparkles,
} from "lucide-react";
import { Item, Balance, Transaction, Role, UserAccount, Page } from "./types";
import { pushWarehouseStateToCloud } from "./warehouseStore";

export interface SendToVAViewProps {
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentUser?: UserAccount | null;
  users?: UserAccount[];
  role?: Role;
  setPage: (p: Page) => void;
}

export type FGModuleKey = "IP" | "Center Console" | "Door Trim" | "Cooling Module" | "Custom";

export interface FGModuleConfig {
  id: FGModuleKey;
  label: string;
  fullName: string;
  defaultPartNo: string;
  defaultDesc: string;
  defaultDest: string;
  defaultTrolleyPrefix: string;
  color: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
  };
}

export const FG_MODULES_CONFIG: FGModuleConfig[] = [
  {
    id: "IP",
    label: "IP",
    fullName: "Instrument Panel / Dashboard Assembly",
    defaultPartNo: "FG-IP-101",
    defaultDesc: "IP (Instrument Panel) Cockpit Module Assembly",
    defaultDest: "VA Main Line 1 - Cockpit Decking",
    defaultTrolleyPrefix: "TR-IP-",
    color: {
      bg: "bg-blue-50/70",
      border: "border-blue-200",
      text: "text-blue-900",
      badgeBg: "bg-blue-100",
      badgeText: "text-blue-800",
    },
  },
  {
    id: "Center Console",
    label: "Center Console",
    fullName: "Center Console Floor Module Assembly",
    defaultPartNo: "FG-CC-201",
    defaultDesc: "Center Console Floor Module Assembly",
    defaultDest: "VA Main Line 1 - Interior Trim",
    defaultTrolleyPrefix: "TR-CC-",
    color: {
      bg: "bg-purple-50/70",
      border: "border-purple-200",
      text: "text-purple-900",
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-800",
    },
  },
  {
    id: "Door Trim",
    label: "Door Trim",
    fullName: "Door Trim Lining Assembly Set (FR/RR)",
    defaultPartNo: "FG-DT-301",
    defaultDesc: "Door Trim Lining Assembly Set (Front & Rear)",
    defaultDest: "VA Door Sub-Line",
    defaultTrolleyPrefix: "TR-DT-",
    color: {
      bg: "bg-amber-50/70",
      border: "border-amber-200",
      text: "text-amber-900",
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-800",
    },
  },
  {
    id: "Cooling Module",
    label: "Cooling Module",
    fullName: "Cooling Module & Front End Radiator Pack",
    defaultPartNo: "FG-CM-401",
    defaultDesc: "Cooling Module & Front End Radiator Pack",
    defaultDest: "VA Front Decking Station",
    defaultTrolleyPrefix: "TR-CM-",
    color: {
      bg: "bg-cyan-50/70",
      border: "border-cyan-200",
      text: "text-cyan-900",
      badgeBg: "bg-cyan-100",
      badgeText: "text-cyan-800",
    },
  },
];

const VEHICLE_MODELS = [
  "Civic FD",
  "Civic FC",
  "CR-V Gen 5",
  "City GN",
  "HR-V",
  "Accord",
  "Universal",
];

const VA_DESTINATION_LINES = [
  "VA Main Line 1 - Cockpit Decking",
  "VA Main Line 1 - Interior Trim",
  "VA Door Sub-Line",
  "VA Front Decking Station",
  "VA Main Line 2 - Final Assembly",
  "VA Station 04 - Body Mount",
  "VA Offline Rework / Staging",
];

export function SendToVAView({
  items,
  balances,
  setBalances,
  transactions,
  setTransactions,
  currentUser,
  users = [],
  role,
  setPage,
}: SendToVAViewProps) {
  // Modal states
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [viewingSlipTx, setViewingSlipTx] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "7days">("all");

  // Form states
  const [selectedModule, setSelectedModule] = useState<FGModuleKey>("IP");
  const [partNo, setPartNo] = useState("FG-IP-101");
  const [description, setDescription] = useState("IP (Instrument Panel) Cockpit Module Assembly");
  const [model, setModel] = useState("Civic FD");
  const [quantity, setQuantity] = useState<number | "">(10);
  const [batchNo, setBatchNo] = useState(() => `LOT-IP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-A`);
  const [trolleyNo, setTrolleyNo] = useState("TR-IP-01");
  const [sourceLoc, setSourceLoc] = useState("FG-BUFFER-01");
  const [destinationLine, setDestinationLine] = useState("VA Main Line 1 - Cockpit Decking");
  const [dispatchRef, setDispatchRef] = useState(() => `VA-DO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`);
  const [dispatcherName, setDispatcherName] = useState(currentUser?.name || currentUser?.username || "Warehouse Admin");
  const [vaReceiver, setVaReceiver] = useState("Azman (VA Line Leader)");
  const [carrierMethod, setCarrierMethod] = useState("AGV / Tugger Train");
  const [qualityChecked, setQualityChecked] = useState(true);
  const [notes, setNotes] = useState("Passed 100% Quality Check, Ready for VA Line");

  // Helper to format date
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const todayStr = getTodayStr();

  // Filter all "Send to VA" transactions
  const vaTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === "Send to VA" || tx.dest.toLowerCase().includes("va ") || tx.ref.startsWith("VA-")
    );
  }, [transactions]);

  // Calculations for KPIs
  const kpiStats = useMemo(() => {
    let totalSentToday = 0;
    let totalSentAllTime = 0;
    const moduleCounts: Record<string, { today: number; all: number }> = {
      IP: { today: 0, all: 0 },
      "Center Console": { today: 0, all: 0 },
      "Door Trim": { today: 0, all: 0 },
      "Cooling Module": { today: 0, all: 0 },
      Other: { today: 0, all: 0 },
    };

    for (const tx of vaTransactions) {
      const isToday = tx.time && tx.time.startsWith(todayStr);
      const qty = tx.qty || 0;
      totalSentAllTime += qty;
      if (isToday) totalSentToday += qty;

      // Identify module
      let mod = tx.finishedGoodModule;
      if (!mod) {
        const text = `${tx.code} ${tx.desc} ${tx.partName}`.toLowerCase();
        if (text.includes("ip") || text.includes("instrument panel")) mod = "IP";
        else if (text.includes("console") || text.includes("center")) mod = "Center Console";
        else if (text.includes("door") || text.includes("trim")) mod = "Door Trim";
        else if (text.includes("cooling") || text.includes("radiator")) mod = "Cooling Module";
        else mod = "Other";
      }

      const key = moduleCounts[mod] ? mod : "Other";
      moduleCounts[key].all += qty;
      if (isToday) moduleCounts[key].today += qty;
    }

    return {
      totalSentToday,
      totalSentAllTime,
      totalDispatches: vaTransactions.length,
      moduleCounts,
    };
  }, [vaTransactions, todayStr]);

  // Buffer stock on-hand for Finished Goods
  const fgStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of balances) {
      if (b.qty > 0) {
        map.set(b.code.toUpperCase(), (map.get(b.code.toUpperCase()) || 0) + b.qty);
      }
    }
    return map;
  }, [balances]);

  // Filtered transactions for the table
  const filteredTransactions = useMemo(() => {
    return vaTransactions.filter((tx) => {
      // 1. Search filter
      const searchMatch =
        !search ||
        tx.ref.toLowerCase().includes(search.toLowerCase()) ||
        tx.code.toLowerCase().includes(search.toLowerCase()) ||
        (tx.desc && tx.desc.toLowerCase().includes(search.toLowerCase())) ||
        (tx.dest && tx.dest.toLowerCase().includes(search.toLowerCase())) ||
        (tx.receiverName && tx.receiverName.toLowerCase().includes(search.toLowerCase())) ||
        (tx.caseNo && tx.caseNo.toLowerCase().includes(search.toLowerCase())) ||
        (tx.trolleyNo && tx.trolleyNo.toLowerCase().includes(search.toLowerCase())) ||
        (tx.model && tx.model.toLowerCase().includes(search.toLowerCase()));

      if (!searchMatch) return false;

      // 2. Module filter
      if (selectedModuleFilter !== "All") {
        let mod = tx.finishedGoodModule;
        if (!mod) {
          const text = `${tx.code} ${tx.desc} ${tx.partName}`.toLowerCase();
          if (text.includes("ip")) mod = "IP";
          else if (text.includes("console")) mod = "Center Console";
          else if (text.includes("door")) mod = "Door Trim";
          else if (text.includes("cooling")) mod = "Cooling Module";
        }
        if (mod !== selectedModuleFilter) return false;
      }

      // 3. Date filter
      if (dateRangeFilter === "today") {
        if (!tx.time || !tx.time.startsWith(todayStr)) return false;
      } else if (dateRangeFilter === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const sevenDaysAgo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const txDate = tx.time ? tx.time.slice(0, 10) : "";
        if (txDate < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [vaTransactions, search, selectedModuleFilter, dateRangeFilter, todayStr]);

  // Quick module preset handler
  const handleSelectModulePreset = (modKey: FGModuleKey) => {
    setSelectedModule(modKey);
    const cfg = FG_MODULES_CONFIG.find((c) => c.id === modKey);
    if (cfg) {
      setPartNo(cfg.defaultPartNo);
      setDescription(cfg.defaultDesc);
      setDestinationLine(cfg.defaultDest);
      const randNo = Math.floor(1 + Math.random() * 9);
      setTrolleyNo(`${cfg.defaultTrolleyPrefix}0${randNo}`);
      setBatchNo(`LOT-${modKey.slice(0, 2).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-A`);
      setSourceLoc(`FG-BUFFER-0${FG_MODULES_CONFIG.findIndex((c) => c.id === modKey) + 1}`);
    }
  };

  const handleOpenDispatchForModule = (modKey: FGModuleKey) => {
    handleSelectModulePreset(modKey);
    setDispatchRef(`VA-DO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`);
    setQuantity(10);
    setIsDispatchModalOpen(true);
  };

  const handleAutoGenerateRef = () => {
    setDispatchRef(`VA-DO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleAutoGenerateBatch = () => {
    const pfx = selectedModule === "Custom" ? "FG" : selectedModule.slice(0, 2).toUpperCase();
    setBatchNo(`LOT-${pfx}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(10 + Math.random() * 90)}`);
  };

  // Submit dispatch to VA
  const handleSubmitDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const qNum = Number(quantity);

    if (!qNum || qNum <= 0) {
      setNotice({ msg: "Please enter a valid dispatch quantity greater than 0.", type: "error" });
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    if (!partNo.trim()) {
      setNotice({ msg: "Finished Good Part No is required.", type: "error" });
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    const curTime = `${todayStr} ${new Date().toTimeString().slice(0, 8)}`;
    const finalCode = partNo.trim().toUpperCase();

    // 1. Create Transaction record
    const newTx: Transaction = {
      id: `TX-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      type: "Send to VA",
      code: finalCode,
      partName: selectedModule,
      desc: description.trim() || `${selectedModule} Module`,
      finishedGoodModule: selectedModule,
      model: model.trim(),
      batchNo: batchNo.trim(),
      caseNo: trolleyNo.trim(),
      trolleyNo: trolleyNo.trim(),
      qty: qNum,
      source: sourceLoc.trim(),
      dest: destinationLine.trim(),
      ref: dispatchRef.trim(),
      user: dispatcherName.trim() || "Warehouse Operator",
      receiverName: vaReceiver.trim() || "VA Team Leader",
      time: curTime,
      status: "Posted",
      notes: notes.trim(),
    };

    // 2. Adjust Finished Good balances if matching stock exists
    let updatedBalances = [...balances];
    const matchIdx = updatedBalances.findIndex(
      (b) => b.code.toUpperCase() === finalCode && b.loc.toLowerCase() === sourceLoc.trim().toLowerCase()
    );

    if (matchIdx >= 0) {
      const currentQ = updatedBalances[matchIdx].qty;
      const newQ = Math.max(0, currentQ - qNum);
      updatedBalances[matchIdx] = {
        ...updatedBalances[matchIdx],
        qty: newQ,
        updatedAt: curTime,
      };
    }

    const updatedTransactions = [newTx, ...transactions];

    // 3. Update React state
    setBalances(updatedBalances);
    setTransactions(updatedTransactions);

    // 4. Push to Firestore
    pushWarehouseStateToCloud(items, updatedBalances, updatedTransactions, users);

    setIsDispatchModalOpen(false);
    setViewingSlipTx(newTx);
    setNotice({
      msg: `✓ Finished Good (${selectedModule}) dispatched to VA successfully! Ref: ${newTx.ref}. Delivery Slip ready.`,
      type: "success",
    });
    setTimeout(() => setNotice(null), 6000);
  };

  // Export to Excel (.xlsx)
  const handleExportXLSX = () => {
    const headers = [
      "Date & Time",
      "Dispatch Ref",
      "FG Module",
      "Part No",
      "Description",
      "Model",
      "Quantity (units)",
      "Source Bay",
      "VA Destination Line",
      "Trolley / Carrier #",
      "Batch / Lot #",
      "Dispatched By",
      "VA Receiver",
      "Status",
      "Notes",
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.time,
      tx.ref,
      tx.finishedGoodModule || tx.partName || "Finished Good",
      tx.code,
      tx.desc,
      tx.model || "—",
      tx.qty,
      tx.source,
      tx.dest,
      tx.trolleyNo || tx.caseNo || "—",
      tx.batchNo || "—",
      tx.user,
      tx.receiverName || "—",
      tx.status,
      tx.notes || "—",
    ]);

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Send to VA Log");
    XLSX.writeFile(wb, `send_to_va_dispatches_${todayStr}.xlsx`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Date & Time",
      "Dispatch Ref",
      "FG Module",
      "Part No",
      "Description",
      "Model",
      "Quantity",
      "Source Bay",
      "VA Destination",
      "Trolley #",
      "Batch No",
      "Dispatched By",
      "VA Receiver",
      "Status",
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.time,
      tx.ref,
      tx.finishedGoodModule || tx.partName || "Finished Good",
      tx.code,
      tx.desc,
      tx.model || "—",
      tx.qty,
      tx.source,
      tx.dest,
      tx.trolleyNo || tx.caseNo || "—",
      tx.batchNo || "—",
      tx.user,
      tx.receiverName || "—",
      tx.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(","))
      .join("\r\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `send_to_va_dispatches_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#2463a6]/10 text-[#2463a6] rounded-lg">
              <Truck size={20} />
            </span>
            <h2 className="text-2xl font-bold text-[#18324d]">Send to VA (Vehicle Assembly)</h2>
          </div>
          <p className="text-sm text-[#65768a]">
            Record Finished Goods modules (<strong className="text-[#18324d]">IP</strong>,{" "}
            <strong className="text-[#18324d]">Center Console</strong>,{" "}
            <strong className="text-[#18324d]">Door Trim</strong>,{" "}
            <strong className="text-[#18324d]">Cooling Module</strong>) dispatched to the Vehicle Assembly line.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportXLSX}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
            title="Export all VA Dispatches to Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} /> Export XLSX
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition shadow-2xs cursor-pointer"
            title="Export all VA Dispatches to CSV"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              handleSelectModulePreset("IP");
              handleAutoGenerateRef();
              setIsDispatchModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Plus size={15} /> Record Dispatch to VA
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border animate-in fade-in duration-200 ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
            )}
            <span>{notice.msg}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-gray-400 hover:text-gray-700 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#65768a] mb-1">
            Total Sent Today
          </div>
          <div className="text-2xl font-bold font-mono text-[#18324d]">
            {kpiStats.totalSentToday.toLocaleString()}{" "}
            <span className="text-xs font-normal text-gray-500">units</span>
          </div>
          <div className="text-[11px] text-[#65768a] mt-1 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            All-time: <strong className="text-[#18324d]">{kpiStats.totalSentAllTime}</strong> pcs
          </div>
        </div>

        {FG_MODULES_CONFIG.map((m) => {
          const stats = kpiStats.moduleCounts[m.id] || { today: 0, all: 0 };
          const stockOnHand = fgStockMap.get(m.defaultPartNo) || 0;
          return (
            <div key={m.id} className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs relative">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#65768a]">
                  {m.label} Sent
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${m.color.badgeBg} ${m.color.badgeText}`}>
                  {m.label}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-[#18324d]">
                {stats.today.toLocaleString()}{" "}
                <span className="text-xs font-normal text-gray-500">today</span>
              </div>
              <div className="text-[11px] text-[#65768a] mt-1 flex justify-between items-center">
                <span>Total: <strong className="text-[#18324d]">{stats.all}</strong></span>
                <span className="text-gray-400">Stock: <strong className="text-emerald-700">{stockOnHand}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* The 4 Finished Good Module Cards - 1-Click Quick Dispatch */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#18324d] flex items-center gap-2">
            <span>Finished Goods Modules Active for VA</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full border border-blue-200 font-semibold">
              4 Core Assemblies
            </span>
          </h3>
          <span className="text-xs text-[#65768a]">Click &quot;Quick Dispatch&quot; to pre-fill dispatch order</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FG_MODULES_CONFIG.map((m) => {
            const stockOnHand = fgStockMap.get(m.defaultPartNo) || 0;
            const stats = kpiStats.moduleCounts[m.id] || { today: 0, all: 0 };

            return (
              <div
                key={m.id}
                className={`bg-white border ${m.color.border} rounded-2xl p-4.5 shadow-xs hover:shadow-md transition flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${m.color.badgeBg} ${m.color.badgeText}`}>
                        {m.id === "IP" ? (
                          <Layers size={18} />
                        ) : m.id === "Center Console" ? (
                          <Boxes size={18} />
                        ) : m.id === "Door Trim" ? (
                          <PackageCheck size={18} />
                        ) : (
                          <Truck size={18} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#18324d]">{m.fullName}</h4>
                        <span className="text-[11px] font-mono font-semibold text-[#65768a]">
                          {m.defaultPartNo}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#526477] line-clamp-2 mb-3 leading-relaxed">
                    {m.defaultDesc}
                  </p>

                  <div className="bg-[#f8fafc] border border-gray-100 rounded-xl p-2.5 space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between items-center text-[#65768a]">
                      <span>VA Dest Line:</span>
                      <strong className="text-[#18324d] text-right truncate max-w-[150px]">
                        {m.defaultDest.replace("VA ", "")}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-[#65768a]">
                      <span>Buffer Stock:</span>
                      <strong className={stockOnHand > 0 ? "text-emerald-700 font-mono font-bold" : "text-amber-700 font-mono font-bold"}>
                        {stockOnHand} units on hand
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-[#65768a]">
                      <span>Dispatched Today:</span>
                      <strong className="text-blue-800 font-mono font-bold">
                        {stats.today} units
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenDispatchForModule(m.id)}
                  className="w-full py-2 px-3 bg-white hover:bg-blue-50 text-[#2463a6] border border-[#2463a6]/30 hover:border-[#2463a6] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                >
                  <Truck size={14} /> Quick Dispatch {m.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* VA Dispatch Records Table & Controls */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        {/* Table Filter Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#dfe6ee] pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[#42566c] mr-1 flex items-center gap-1">
              <Filter size={13} /> Filter:
            </span>
            {["All", "IP", "Center Console", "Door Trim", "Cooling Module"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedModuleFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedModuleFilter === tab
                    ? "bg-[#2463a6] text-white shadow-2xs"
                    : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
                }`}
              >
                {tab === "All" ? "All Finished Goods" : tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#65768a]">Time:</span>
            <div className="flex items-center gap-1 bg-[#f1f5f9] p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setDateRangeFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  dateRangeFilter === "all" ? "bg-white text-[#18324d] shadow-2xs font-bold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter("today")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  dateRangeFilter === "today" ? "bg-white text-[#18324d] shadow-2xs font-bold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Today Only
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter("7days")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  dateRangeFilter === "7days" ? "bg-white text-[#18324d] shadow-2xs font-bold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Last 7 Days
              </button>
            </div>
          </div>
        </div>

        {/* Search bar & count */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 text-[#65768a]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Dispatch Ref, Part No, Description, Model, Trolley #, or VA Receiver..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
            />
          </div>

          <div className="text-xs text-[#65768a] shrink-0">
            Showing <strong className="text-[#18324d]">{filteredTransactions.length}</strong> dispatch record(s)
          </div>
        </div>

        {/* Table of Records */}
        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                <th className="p-3">Date / Time</th>
                <th className="p-3">Dispatch Ref #</th>
                <th className="p-3">FG Module</th>
                <th className="p-3">Part No & Description</th>
                <th className="p-3">Model</th>
                <th className="p-3">Qty</th>
                <th className="p-3">VA Destination</th>
                <th className="p-3">Trolley / Dolly</th>
                <th className="p-3">Dispatcher / Receiver</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-[#65768a]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck size={32} className="text-gray-300" />
                      <p className="font-semibold text-gray-600">No &quot;Send to VA&quot; records found.</p>
                      <p className="text-xs text-gray-400">
                        Record a finished goods dispatch above to begin tracking line transfers to Vehicle Assembly.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const modKey = tx.finishedGoodModule || tx.partName || "Finished Good";
                  const cfg = FG_MODULES_CONFIG.find((c) => c.id === modKey);

                  return (
                    <tr key={tx.id} className="hover:bg-[#fcfdfd] transition">
                      <td className="p-3 font-mono text-[#42566c] text-[11px] whitespace-nowrap">
                        {tx.time}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#18324d] whitespace-nowrap">
                        {tx.ref}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            cfg ? `${cfg.color.badgeBg} ${cfg.color.badgeText}` : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {modKey}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-[#18324d]">{tx.code}</div>
                        <div className="text-[11px] text-[#65768a] max-w-[220px] truncate">
                          {tx.desc || tx.partName}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-[#42566c] whitespace-nowrap">
                        {tx.model || "—"}
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-sm bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">
                          {tx.qty} <span className="text-[10px] font-normal">units</span>
                        </span>
                      </td>
                      <td className="p-3 font-medium text-[#18324d] max-w-[180px] truncate" title={tx.dest}>
                        {tx.dest}
                      </td>
                      <td className="p-3 font-mono text-[#42566c]">
                        {tx.trolleyNo || tx.caseNo || "—"}
                      </td>
                      <td className="p-3 text-[11px]">
                        <div>By: <strong className="text-[#18324d]">{tx.user}</strong></div>
                        <div className="text-[#65768a]">To: {tx.receiverName || "VA Line"}</div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setViewingSlipTx(tx)}
                          className="px-2.5 py-1 bg-white hover:bg-[#f0f5fc] text-[#2463a6] border border-[#cfd9e4] rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs mx-auto cursor-pointer"
                          title="View and print delivery transfer ticket"
                        >
                          <Printer size={13} /> Slip
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

      {/* DISPATCH TO VA MODAL */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#dfe6ee] max-h-[92vh] flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#dfe6ee] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#2463a6]/10 text-[#2463a6] rounded-xl">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#18324d]">Record Finished Good Sent to VA</h3>
                  <p className="text-xs text-[#65768a]">
                    Dispatch finished goods modules directly to Vehicle Assembly lines
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSubmitDispatch} className="overflow-y-auto space-y-4 flex-1 pr-1">
              {/* Finished Good Module Selector */}
              <div>
                <label className="block text-xs font-bold text-[#18324d] mb-1.5">
                  1. Finished Good Module *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FG_MODULES_CONFIG.map((m) => {
                    const isSelected = selectedModule === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModulePreset(m.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                          isSelected
                            ? "border-[#2463a6] bg-[#2463a6]/10 text-[#2463a6] shadow-xs"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {m.id === "IP" ? (
                          <Layers size={18} />
                        ) : m.id === "Center Console" ? (
                          <Boxes size={18} />
                        ) : m.id === "Door Trim" ? (
                          <PackageCheck size={18} />
                        ) : (
                          <Truck size={18} />
                        )}
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Part Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Part No / FG Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={partNo}
                    onChange={(e) => setPartNo(e.target.value)}
                    placeholder="e.g. FG-IP-101"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Vehicle Model Platform *
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  >
                    {VEHICLE_MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Finished Good Description *
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. IP (Instrument Panel) Cockpit Module Assembly"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                />
              </div>

              {/* Quantity and Source */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#18324d] mb-1">
                    Dispatch Quantity (units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-blue-400 rounded-xl text-base font-mono font-bold text-[#18324d] bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Source Staging Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceLoc}
                    onChange={(e) => setSourceLoc(e.target.value)}
                    placeholder="e.g. FG-BUFFER-01"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Trolley / Dolly / AGV # *
                  </label>
                  <input
                    type="text"
                    required
                    value={trolleyNo}
                    onChange={(e) => setTrolleyNo(e.target.value)}
                    placeholder="e.g. TR-IP-01"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>
              </div>

              {/* Destination VA Line */}
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  VA Destination Line / Station *
                </label>
                <div className="flex gap-2">
                  <select
                    value={destinationLine}
                    onChange={(e) => setDestinationLine(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  >
                    {VA_DESTINATION_LINES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Batch No & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-[#42566c]">
                      Batch / Lot No *
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateBatch}
                      className="text-[11px] text-[#2463a6] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Auto-Gen
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-[#42566c]">
                      Dispatch Order / Slip Ref *
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateRef}
                      className="text-[11px] text-[#2463a6] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Auto-Gen
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={dispatchRef}
                    onChange={(e) => setDispatchRef(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>
              </div>

              {/* Dispatcher and Receiver */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Dispatcher / Operator *
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatcherName}
                    onChange={(e) => setDispatcherName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    VA Receiver / Team Leader *
                  </label>
                  <input
                    type="text"
                    required
                    value={vaReceiver}
                    onChange={(e) => setVaReceiver(e.target.value)}
                    placeholder="e.g. Azman (VA Line Leader)"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  />
                </div>
              </div>

              {/* Carrier Method and Quality Verification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Delivery Transport Method
                  </label>
                  <select
                    value={carrierMethod}
                    onChange={(e) => setCarrierMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                  >
                    <option value="AGV / Tugger Train">Automated Tugger / AGV Train</option>
                    <option value="Manual Trolley Cart">Manual Trolley / Dolly Cart</option>
                    <option value="Forklift Delivery">Forklift Pallet Transfer</option>
                    <option value="Roller Conveyor Line">Direct Roller Conveyor</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#18324d] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qualityChecked}
                      onChange={(e) => setQualityChecked(e.target.checked)}
                      className="w-4 h-4 text-[#2463a6] rounded focus:ring-0 cursor-pointer"
                    />
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>Quality Inspected & OK for VA</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Dispatch Remarks / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Inspected OK, immediate assembly schedule"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#dfe6ee] flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Truck size={15} /> Confirm & Dispatch to VA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH SLIP / TRANSFER TICKET MODAL */}
      {viewingSlipTx && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#dfe6ee] max-h-[92vh] flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#dfe6ee] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Printer size={20} className="text-[#2463a6]" />
                <h3 className="text-base font-bold text-[#18324d]">VA Finished Goods Transfer Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingSlipTx(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable KANBAN Ticket Area */}
            <div
              id="va-dispatch-slip-card"
              className="border-2 border-dashed border-[#18324d] rounded-2xl p-5 bg-[#fafcff] space-y-4 text-xs font-sans"
            >
              <div className="flex justify-between items-start border-b border-gray-300 pb-3">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-[#65768a]">
                    WAREHOUSE OS • FINISHED GOODS TO VA
                  </div>
                  <h2 className="text-lg font-black text-[#18324d] uppercase tracking-wide">
                    {viewingSlipTx.finishedGoodModule || viewingSlipTx.partName} DISPATCH
                  </h2>
                  <div className="text-xs font-mono text-[#65768a]">
                    Ref: <strong className="text-[#18324d]">{viewingSlipTx.ref}</strong>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="p-1.5 bg-white border border-gray-300 rounded-lg">
                    <QrCode size={36} className="text-[#18324d]" />
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 mt-0.5">KANBAN-VA-SLIP</span>
                </div>
              </div>

              {/* Barcode graphic representation */}
              <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-center">
                <div className="font-mono text-xs tracking-widest uppercase text-gray-800 font-bold mb-1">
                  |||||| |||||||||| ||||| |||||||| ||||||| |||||||||| |||||||
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  *{viewingSlipTx.ref}*{viewingSlipTx.code}*
                </div>
              </div>

              {/* Key details grid */}
              <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Part No:</span>
                  <div className="font-mono font-bold text-sm text-[#18324d]">{viewingSlipTx.code}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Vehicle Model:</span>
                  <div className="font-bold text-sm text-[#18324d]">{viewingSlipTx.model || "—"}</div>
                </div>

                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Description:</span>
                  <div className="font-medium text-xs text-[#18324d]">{viewingSlipTx.desc}</div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Quantity Sent:</span>
                  <div className="font-mono font-black text-xl text-blue-700">{viewingSlipTx.qty} SETS</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Trolley / Carrier #:</span>
                  <div className="font-mono font-bold text-sm text-[#18324d]">{viewingSlipTx.trolleyNo || viewingSlipTx.caseNo || "—"}</div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">VA Destination:</span>
                  <div className="font-bold text-xs text-[#18324d]">{viewingSlipTx.dest}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Batch / Lot #:</span>
                  <div className="font-mono text-xs text-[#18324d]">{viewingSlipTx.batchNo || "—"}</div>
                </div>
              </div>

              {/* Signatures & Verification */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                <div className="border border-gray-200 bg-white p-2.5 rounded-lg space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Dispatched By (Warehouse)</span>
                  <div className="font-semibold text-xs text-[#18324d]">{viewingSlipTx.user}</div>
                  <div className="text-[10px] text-gray-400">{viewingSlipTx.time}</div>
                  <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-1">
                    ✓ QC INSPECTED OK
                  </div>
                </div>

                <div className="border border-gray-200 bg-white p-2.5 rounded-lg space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Received By (VA Line)</span>
                  <div className="font-semibold text-xs text-[#18324d]">{viewingSlipTx.receiverName || "VA Team Leader"}</div>
                  <div className="border-b border-gray-300 w-full mt-3"></div>
                  <div className="text-[9px] text-gray-400 text-center mt-1">Signature / Date</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-[#dfe6ee] shrink-0">
              <button
                type="button"
                onClick={() => setViewingSlipTx(null)}
                className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Print Transfer Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
