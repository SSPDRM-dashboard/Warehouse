import React, { useState, useMemo } from "react";
import {
  Download,
  Calendar,
  ArrowDownLeft,
  PackageOpen,
  ArrowUpRight,
  Search,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Clock,
  User,
  Boxes
} from "lucide-react";
import { Transaction, Item, Balance } from "./types";

interface DailyReportsViewProps {
  transactions: Transaction[];
  items: Item[];
  balances: Balance[];
}

export function DailyReportsView({
  transactions,
  items,
  balances,
}: DailyReportsViewProps) {
  // Default to today in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeReportTab, setActiveReportTab] = useState<"all" | "incoming" | "unpacking" | "prod1">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getItemModel = (code: string) => {
    const item = items.find((i) => i.code.trim().toUpperCase() === code.trim().toUpperCase());
    return item ? item.model : "—";
  };

  // Check if transaction matches date
  const matchesDate = (txTime: string, dateStr: string) => {
    if (!dateStr) return true;
    if (txTime.includes(dateStr)) return true;
    const parsed = new Date(txTime);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}` === dateStr;
    }
    return false;
  };

  // 1. Daily Incoming Transactions
  const incomingTx = useMemo(() => {
    return transactions.filter(
      (t) => t.type === "Receiving" && matchesDate(t.time, selectedDate)
    );
  }, [transactions, selectedDate]);

  // 2. Daily Unpacking Transactions (marked unpacked OR type === "Unpacking")
  const unpackingTx = useMemo(() => {
    return transactions.filter((t) => {
      const isUnpack = t.type === "Unpacking" || (t.type === "Receiving" && t.unpacked !== false);
      const isDateMatch = t.unpackDate
        ? t.unpackDate === selectedDate
        : matchesDate(t.time, selectedDate);
      return isUnpack && isDateMatch;
    });
  }, [transactions, selectedDate]);

  // 3. Daily Sent to Production 1 Transactions
  const prod1Tx = useMemo(() => {
    return transactions.filter((t) => {
      const isIssue = t.type === "Production Issue";
      const isLine1 =
        t.dest.toLowerCase().includes("production line 1") ||
        t.dest.toLowerCase().includes("line 1") ||
        t.dest.toLowerCase().includes("prod 1") ||
        t.dest.trim() === "Production Line 1";
      return isIssue && isLine1 && matchesDate(t.time, selectedDate);
    });
  }, [transactions, selectedDate]);

  // CSV Downloader Helper
  const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => '"' + String(cell ?? "").replace(/"/g, '""') + '"')
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download Handlers
  const handleDownloadIncoming = () => {
    const headers = [
      "Report Date",
      "Transaction ID",
      "Timestamp",
      "Part No",
      "Part Name",
      "Batch No",
      "Model",
      "Quantity Received",
      "Destination Bin",
      "DO / Supplier Reference",
      "Receiver Name",
      "System User / Operator",
      "Status"
    ];

    const rows = incomingTx.map((t) => [
      selectedDate,
      t.id,
      t.time,
      t.code,
      t.partName || t.desc || "",
      t.batchNo || "—",
      getItemModel(t.code),
      t.qty,
      t.dest,
      t.ref,
      t.receiverName || t.user,
      t.user,
      t.status
    ]);

    exportCSV(`daily_incoming_report_${selectedDate}.csv`, headers, rows);
  };

  const handleDownloadUnpacking = () => {
    const headers = [
      "Report Date",
      "Unpack Record / Tx ID",
      "Timestamp",
      "Part No",
      "Part Name",
      "Batch No",
      "Model",
      "Quantity Unpacked",
      "Storage Location",
      "Delivery Order / Batch Ref",
      "Unpacked By (Name)",
      "Received By (Name)",
      "Inspection / Status"
    ];

    const rows = unpackingTx.map((t) => [
      selectedDate,
      t.id,
      t.time,
      t.code,
      t.partName || t.desc || "",
      t.batchNo || "—",
      getItemModel(t.code),
      t.qty,
      t.dest,
      t.ref,
      t.unpackedByName || t.receiverName || t.user,
      t.receiverName || t.user,
      "Unpacked & Verified"
    ]);

    exportCSV(`daily_unpacking_report_${selectedDate}.csv`, headers, rows);
  };

  const handleDownloadProd1 = () => {
    const headers = [
      "Report Date",
      "Issue Voucher No",
      "Timestamp",
      "Part No",
      "Part Name",
      "Batch No",
      "Model",
      "Quantity Sent",
      "Source Location",
      "Destination Line",
      "Production Ref / WO No",
      "Issued By (Name / User)",
      "Receiver / Line Contact",
      "Status"
    ];

    const rows = prod1Tx.map((t) => [
      selectedDate,
      t.id,
      t.time,
      t.code,
      t.partName || t.desc || "",
      t.batchNo || "—",
      getItemModel(t.code),
      t.qty,
      t.source,
      t.dest,
      t.ref,
      t.user,
      t.receiverName || "Production Line 1 Operator",
      t.status
    ]);

    exportCSV(`daily_sent_to_production1_${selectedDate}.csv`, headers, rows);
  };

  const handleDownloadAll = () => {
    handleDownloadIncoming();
    setTimeout(() => handleDownloadUnpacking(), 400);
    setTimeout(() => handleDownloadProd1(), 800);
  };

  // Aggregated Stats
  const incomingTotalUnits = incomingTx.reduce((sum, t) => sum + t.qty, 0);
  const unpackingTotalUnits = unpackingTx.reduce((sum, t) => sum + t.qty, 0);
  const prod1TotalUnits = prod1Tx.reduce((sum, t) => sum + t.qty, 0);

  // Filtered views by search query
  const applySearch = (list: Transaction[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.partName && t.partName.toLowerCase().includes(q)) ||
        (t.desc && t.desc.toLowerCase().includes(q)) ||
        (t.batchNo && t.batchNo.toLowerCase().includes(q)) ||
        (t.receiverName && t.receiverName.toLowerCase().includes(q)) ||
        (t.ref && t.ref.toLowerCase().includes(q)) ||
        t.user.toLowerCase().includes(q)
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#18324d] flex items-center gap-2.5">
            <FileSpreadsheet className="text-[#2463a6]" size={26} />
            <span>Daily Warehouse Reports</span>
          </h2>
          <p className="text-sm text-[#65768a]">
            Download formal daily reports for Incoming Shipments, Daily Unpacking, and Daily Sent to Production 1.
          </p>
        </div>

        {/* Date Selector & Download All */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-[#cfd9e4] rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar size={16} className="text-[#2463a6]" />
            <span className="text-xs font-semibold text-[#42566c]">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-mono font-medium text-[#18324d] bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              selectedDate === todayStr
                ? "bg-[#2463a6] text-white border-[#2463a6]"
                : "bg-white text-[#18324d] border-[#cfd9e4] hover:bg-gray-50"
            }`}
          >
            Today
          </button>

          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#10243b] to-[#203c5b] text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-95 transition"
          >
            <Download size={14} /> Download All 3 Reports
          </button>
        </div>
      </div>

      {/* 3 Report Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Daily Incoming */}
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ArrowDownLeft size={22} />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Inbound
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18324d]">Daily Incoming Report</h3>
              <p className="text-xs text-[#65768a] mt-0.5">
                Inbound receipts from suppliers with Receiver Name, DO numbers & destination bins.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f0f4f8] grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#65768a] text-[11px]">Shipments</span>
                <div className="font-bold font-mono text-base text-[#18324d]">{incomingTx.length}</div>
              </div>
              <div>
                <span className="text-[#65768a] text-[11px]">Units Received</span>
                <div className="font-bold font-mono text-base text-emerald-700">{incomingTotalUnits.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <button
            onClick={handleDownloadIncoming}
            disabled={incomingTx.length === 0}
            className="mt-4 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
          >
            <Download size={14} /> Download Incoming Report (.csv)
          </button>
        </div>

        {/* Card 2: Daily Unpacking */}
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <PackageOpen size={22} />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                Unpack / Binning
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18324d]">Daily Unpacking Report</h3>
              <p className="text-xs text-[#65768a] mt-0.5">
                Pallets and shipments unpacked, decanted, and put away into storage locations.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f0f4f8] grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#65768a] text-[11px]">Unpacked Lots</span>
                <div className="font-bold font-mono text-base text-[#18324d]">{unpackingTx.length}</div>
              </div>
              <div>
                <span className="text-[#65768a] text-[11px]">Units Unpacked</span>
                <div className="font-bold font-mono text-base text-blue-700">{unpackingTotalUnits.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <button
            onClick={handleDownloadUnpacking}
            disabled={unpackingTx.length === 0}
            className="mt-4 w-full py-2.5 bg-[#2463a6] hover:bg-[#1d528a] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
          >
            <Download size={14} /> Download Unpacking Report (.csv)
          </button>
        </div>

        {/* Card 3: Daily Sent to Production 1 */}
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-amber-300 transition">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <ArrowUpRight size={22} />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Production Line 1
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-[#18324d]">Daily Sent to Production 1</h3>
              <p className="text-xs text-[#65768a] mt-0.5">
                Materials, components, and kits issued directly to Production Line 1 work cells.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f0f4f8] grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#65768a] text-[11px]">Issue Vouchers</span>
                <div className="font-bold font-mono text-base text-[#18324d]">{prod1Tx.length}</div>
              </div>
              <div>
                <span className="text-[#65768a] text-[11px]">Units Sent to Prod 1</span>
                <div className="font-bold font-mono text-base text-amber-700">{prod1TotalUnits.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <button
            onClick={handleDownloadProd1}
            disabled={prod1Tx.length === 0}
            className="mt-4 w-full py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
          >
            <Download size={14} /> Download Production 1 Report (.csv)
          </button>
        </div>
      </div>

      {/* Interactive Daily Report Table Preview */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-[#18324d]">Daily Data Table Preview ({selectedDate})</h3>
            <p className="text-xs text-[#65768a]">Inspect records matching the selected date prior to export</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-[#65768a]" size={14} />
              <input
                type="text"
                placeholder="Search part, name, DO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-[#cfd9e4] rounded-xl text-xs bg-white w-48 focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
              />
            </div>

            <div className="flex bg-[#f3f6fa] p-1 rounded-xl gap-1 text-xs font-semibold">
              <button
                onClick={() => setActiveReportTab("all")}
                className={`px-3 py-1 rounded-lg transition ${
                  activeReportTab === "all" ? "bg-white text-[#18324d] shadow-xs" : "text-[#65768a] hover:text-[#18324d]"
                }`}
              >
                All 3 Reports
              </button>
              <button
                onClick={() => setActiveReportTab("incoming")}
                className={`px-3 py-1 rounded-lg transition ${
                  activeReportTab === "incoming" ? "bg-white text-emerald-800 shadow-xs" : "text-[#65768a] hover:text-[#18324d]"
                }`}
              >
                Incoming ({incomingTx.length})
              </button>
              <button
                onClick={() => setActiveReportTab("unpacking")}
                className={`px-3 py-1 rounded-lg transition ${
                  activeReportTab === "unpacking" ? "bg-white text-blue-800 shadow-xs" : "text-[#65768a] hover:text-[#18324d]"
                }`}
              >
                Unpacking ({unpackingTx.length})
              </button>
              <button
                onClick={() => setActiveReportTab("prod1")}
                className={`px-3 py-1 rounded-lg transition ${
                  activeReportTab === "prod1" ? "bg-white text-amber-800 shadow-xs" : "text-[#65768a] hover:text-[#18324d]"
                }`}
              >
                Sent to Prod 1 ({prod1Tx.length})
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: INCOMING TABLE */}
        {(activeReportTab === "all" || activeReportTab === "incoming") && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ArrowDownLeft size={14} /> 1. Daily Incoming Shipments ({incomingTx.length} records)
              </h4>
              <button
                onClick={handleDownloadIncoming}
                disabled={incomingTx.length === 0}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-40 flex items-center gap-1"
              >
                <Download size={12} /> Export Incoming CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                    <th className="p-3">Tx ID</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Part No</th>
                    <th className="p-3">Part Name</th>
                    <th className="p-3">Batch No</th>
                    <th className="p-3">Qty Received</th>
                    <th className="p-3">Destination Bin</th>
                    <th className="p-3">DO / Ref</th>
                    <th className="p-3 bg-emerald-50/70 text-emerald-900">Receiver Name</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9eef3] text-xs">
                  {applySearch(incomingTx).length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-6 text-[#65768a]">
                        No incoming receipts recorded for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    applySearch(incomingTx).map((t) => (
                      <tr key={t.id} className="hover:bg-[#fcfdfd]">
                        <td className="p-3 font-mono font-bold text-[#18324d]">{t.id}</td>
                        <td className="p-3 font-mono text-[#65768a] text-[11px]">{t.time}</td>
                        <td className="p-3 font-mono font-bold text-[#18324d]">{t.code}</td>
                        <td className="p-3 font-medium text-[#18324d] max-w-[180px] truncate" title={t.partName || t.desc}>
                          {t.partName || t.desc || "—"}
                        </td>
                        <td className="p-3 font-mono">
                          {t.batchNo ? (
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200 text-[11px]">
                              {t.batchNo}
                            </span>
                          ) : (
                            <span className="text-[#a0aec0] text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          +{t.qty.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-[#42566c]">{t.dest}</td>
                        <td className="p-3 font-mono font-medium">{t.ref}</td>
                        <td className="p-3 bg-emerald-50/40 font-semibold text-emerald-950">
                          {t.receiverName || t.user}
                        </td>
                        <td className="p-3 text-[#65768a]">{t.user}</td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION: UNPACKING TABLE */}
        {(activeReportTab === "all" || activeReportTab === "unpacking") && (
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <PackageOpen size={14} /> 2. Daily Unpacking & Decanting ({unpackingTx.length} records)
              </h4>
              <button
                onClick={handleDownloadUnpacking}
                disabled={unpackingTx.length === 0}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-40 flex items-center gap-1"
              >
                <Download size={12} /> Export Unpacking CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                    <th className="p-3">Unpack ID</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Part No</th>
                    <th className="p-3">Part Name</th>
                    <th className="p-3">Batch No</th>
                    <th className="p-3">Qty Unpacked</th>
                    <th className="p-3">Storage Bin</th>
                    <th className="p-3">Source DO / Ref</th>
                    <th className="p-3 bg-blue-50/70 text-blue-900">Unpacked By (Name)</th>
                    <th className="p-3">Receiver Name</th>
                    <th className="p-3">Inspection Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9eef3] text-xs">
                  {applySearch(unpackingTx).length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-6 text-[#65768a]">
                        No unpacking records recorded for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    applySearch(unpackingTx).map((t) => (
                      <tr key={t.id} className="hover:bg-[#fcfdfd]">
                        <td className="p-3 font-mono font-bold text-[#18324d]">{t.id}</td>
                        <td className="p-3 font-mono text-[#65768a] text-[11px]">{t.time}</td>
                        <td className="p-3 font-mono font-bold text-[#18324d]">{t.code}</td>
                        <td className="p-3 font-medium text-[#18324d] max-w-[180px] truncate" title={t.partName || t.desc}>
                          {t.partName || t.desc || "—"}
                        </td>
                        <td className="p-3 font-mono">
                          {t.batchNo ? (
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200 text-[11px]">
                              {t.batchNo}
                            </span>
                          ) : (
                            <span className="text-[#a0aec0] text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-700">
                          {t.qty.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-[#42566c]">{t.dest}</td>
                        <td className="p-3 font-mono font-medium">{t.ref}</td>
                        <td className="p-3 bg-blue-50/40 font-semibold text-blue-950">
                          {t.unpackedByName || t.receiverName || t.user}
                        </td>
                        <td className="p-3 text-[#65768a]">{t.receiverName || t.user}</td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800">
                            Unpacked & Verified
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION: SENT TO PRODUCTION 1 TABLE */}
        {(activeReportTab === "all" || activeReportTab === "prod1") && (
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <ArrowUpRight size={14} /> 3. Daily Sent to Production Line 1 ({prod1Tx.length} records)
              </h4>
              <button
                onClick={handleDownloadProd1}
                disabled={prod1Tx.length === 0}
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-40 flex items-center gap-1"
              >
                <Download size={12} /> Export Production 1 CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                    <th className="p-3">Issue Voucher</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Part No</th>
                    <th className="p-3">Part Name</th>
                    <th className="p-3">Batch No</th>
                    <th className="p-3">Quantity Sent</th>
                    <th className="p-3">Source Bin</th>
                    <th className="p-3 bg-amber-50/70 text-amber-900">Destination Line</th>
                    <th className="p-3">Production WO / Ref</th>
                    <th className="p-3">Issued By</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9eef3] text-xs">
                  {applySearch(prod1Tx).length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-6 text-[#65768a]">
                        No parts issued to Production Line 1 for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    applySearch(prod1Tx).map((t) => (
                      <tr key={t.id} className="hover:bg-[#fcfdfd]">
                        <td className="p-3 font-mono font-bold text-[#18324d]">{t.id}</td>
                        <td className="p-3 font-mono text-[#65768a] text-[11px]">{t.time}</td>
                        <td className="p-3 font-mono font-bold text-[#18324d]">{t.code}</td>
                        <td className="p-3 font-medium text-[#18324d] max-w-[180px] truncate" title={t.partName || t.desc}>
                          {t.partName || t.desc || "—"}
                        </td>
                        <td className="p-3 font-mono">
                          {t.batchNo ? (
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold border border-blue-200 text-[11px]">
                              {t.batchNo}
                            </span>
                          ) : (
                            <span className="text-[#a0aec0] text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-700">
                          {t.qty.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-[#42566c]">{t.source}</td>
                        <td className="p-3 bg-amber-50/40 font-semibold text-amber-950 font-mono">
                          {t.dest}
                        </td>
                        <td className="p-3 font-mono font-medium">{t.ref}</td>
                        <td className="p-3 text-[#42566c]">{t.user}</td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
