import React, { useState } from "react";
import {
  Truck,
  PackageOpen,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Search,
  Download,
  Plus,
  RefreshCw,
  Printer,
  X,
  Boxes,
  Factory,
  Layers,
  Clock,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  FileText
} from "lucide-react";
import { Item, Balance, Transaction, Role, UnpackRecord, UnpackStage } from "./types";

interface UnpackingViewProps {
  records: UnpackRecord[];
  setRecords: React.Dispatch<React.SetStateAction<UnpackRecord[]>>;
  items: Item[];
  balances: Balance[];
  setBalances: React.Dispatch<React.SetStateAction<Balance[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  allLocs: () => string[];
  role: Role;
}

export function UnpackingView({
  records,
  setRecords,
  items,
  balances,
  setBalances,
  transactions,
  setTransactions,
  allLocs,
  role,
}: UnpackingViewProps) {
  const [activeTab, setActiveTab] = useState<"pipeline" | "records" | "new">("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  // Modals state
  const [selectedForForklift, setSelectedForForklift] = useState<UnpackRecord | null>(null);
  const [selectedForUnpack, setSelectedForUnpack] = useState<UnpackRecord | null>(null);
  const [selectedForOperation, setSelectedForOperation] = useState<UnpackRecord | null>(null);
  const [slipRecord, setSlipRecord] = useState<UnpackRecord | null>(null);

  // Form states for actions
  const [forkliftDriver, setForkliftDriver] = useState("Forklift #2 - Hazim");
  const [targetUnpackBay, setTargetUnpackBay] = useState("UNPACK-BAY-A");

  const [operatorName, setOperatorName] = useState("Operator Siti (OP-14)");
  const [unpackedQtyInput, setUnpackedQtyInput] = useState<number | "">("");
  const [goodQtyInput, setGoodQtyInput] = useState<number | "">("");
  const [damagedQtyInput, setDamagedQtyInput] = useState<number | "">(0);
  const [unpackNotes, setUnpackNotes] = useState("");

  const [operationDestInput, setOperationDestInput] = useState("OP-LINE-1");
  const [receiverName, setReceiverName] = useState("Line Lead Rosli");
  const [carrierMethod, setCarrierMethod] = useState("Tugger Train / AGV");
  const [operationNotes, setOperationNotes] = useState("");

  // New Record manual entry form
  const [manualCode, setManualCode] = useState("");
  const [manualQty, setManualQty] = useState<number | "">("");
  const [manualRef, setManualRef] = useState("");
  const [manualSourceDock, setManualSourceDock] = useState("RECV-BAY-01");
  const [manualUnpackBay, setManualUnpackBay] = useState("UNPACK-BAY-A");
  const [manualPackaging, setManualPackaging] = useState("Wooden Crate / Pallet");
  const [manualTargetOp, setManualTargetOp] = useState("OP-LINE-1");
  const [manualNotice, setManualNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Stats calculation
  const awaitingForklift = records.filter((r) => r.stage === "Awaiting Forklift");
  const inTransit = records.filter((r) => r.stage === "Forklift In-Transit");
  const atUnpackBay = records.filter((r) => r.stage === "At Unpacking Bay");
  const readyForOp = records.filter((r) => r.stage === "Unpacked & Ready for Operation");
  const sentToOp = records.filter((r) => r.stage === "Sent to Operation");

  // Helper to upsert balance
  const adjustBalance = (
    currentBalances: Balance[],
    code: string,
    fromLoc: string,
    toLoc: string,
    qty: number
  ): Balance[] => {
    let next = [...currentBalances];
    // Deduct from fromLoc
    const fromIndex = next.findIndex((b) => b.code === code && b.loc === fromLoc);
    if (fromIndex >= 0) {
      const remaining = next[fromIndex].qty - qty;
      if (remaining <= 0) {
        next.splice(fromIndex, 1);
      } else {
        next[fromIndex] = { ...next[fromIndex], qty: remaining };
      }
    }
    // Add to toLoc
    const toIndex = next.findIndex((b) => b.code === code && b.loc === toLoc);
    if (toIndex >= 0) {
      next[toIndex] = { ...next[toIndex], qty: next[toIndex].qty + qty };
    } else {
      next.push({ code, loc: toLoc, qty });
    }
    return next;
  };

  /* ------------------------------------------------------------------------ */
  /* STEP 1: FORKLIFT DISPATCH & TRANSFER TO UNPACKING BAY                    */
  /* ------------------------------------------------------------------------ */
  const handleForkliftTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForForklift) return;

    const record = selectedForForklift;
    const now = new Date().toLocaleString();
    const finalBay = targetUnpackBay || "UNPACK-BAY-A";
    const driver = forkliftDriver.trim() || "Forklift #1";

    // Update balances: move stock from source dock (e.g. RECV-BAY-01) to unpacking bay
    const updatedBalances = adjustBalance(
      balances,
      record.code,
      record.sourceDock,
      finalBay,
      record.receivedQty
    );
    setBalances(updatedBalances);

    // Create transaction log
    const txId = `FLT-${Date.now().toString().slice(-6)}`;
    const tx: Transaction = {
      id: txId,
      type: "Forklift Transfer",
      code: record.code,
      desc: record.desc,
      qty: record.receivedQty,
      source: record.sourceDock,
      dest: finalBay,
      ref: `Forklift Haul: ${driver} (${record.id})`,
      user: driver,
      time: now,
      status: "Posted",
    };
    setTransactions([tx, ...transactions]);

    // Update record stage to "At Unpacking Bay"
    const updatedRecords = records.map((r) => {
      if (r.id === record.id) {
        return {
          ...r,
          stage: "At Unpacking Bay" as UnpackStage,
          forkliftDriver: driver,
          unpackBay: finalBay,
          forkliftDispatchedAt: now,
          notes: r.notes
            ? `${r.notes} | Delivered to ${finalBay} by ${driver}`
            : `Delivered to ${finalBay} by ${driver}`,
        };
      }
      return r;
    });

    setRecords(updatedRecords);
    setSelectedForForklift(null);
  };

  /* ------------------------------------------------------------------------ */
  /* STEP 2: OPERATOR UNPACKING PROCESS & QUANTITY RECORDING                  */
  /* ------------------------------------------------------------------------ */
  const handleUnpackRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForUnpack) return;

    const record = selectedForUnpack;
    const now = new Date().toLocaleString();
    const op = operatorName.trim() || "Operator (Unpacking)";
    const unpQty = Number(unpackedQtyInput) || record.receivedQty;
    const goodQty = Number(goodQtyInput) || unpQty;
    const damQty = Number(damagedQtyInput) || 0;

    // Create transaction log for the unpack event
    const txId = `UNP-${Date.now().toString().slice(-6)}`;
    const tx: Transaction = {
      id: txId,
      type: "Unpack Log",
      code: record.code,
      desc: record.desc,
      qty: unpQty,
      source: record.unpackBay,
      dest: record.unpackBay,
      ref: `Unpacked by ${op} - Good: ${goodQty}, Dmg: ${damQty} (${record.id})`,
      user: op,
      time: now,
      status: "Posted",
    };
    setTransactions([tx, ...transactions]);

    // Update unpack record to "Unpacked & Ready for Operation"
    const updatedRecords = records.map((r) => {
      if (r.id === record.id) {
        return {
          ...r,
          stage: "Unpacked & Ready for Operation" as UnpackStage,
          operatorName: op,
          unpackedQty: unpQty,
          goodQty: goodQty,
          damagedQty: damQty,
          unpackedAt: now,
          notes: unpackNotes.trim()
            ? `${r.notes ? r.notes + " | " : ""}${unpackNotes.trim()}`
            : r.notes,
        };
      }
      return r;
    });

    setRecords(updatedRecords);
    setSelectedForUnpack(null);
    setUnpackNotes("");
  };

  /* ------------------------------------------------------------------------ */
  /* STEP 3: DISPATCH / SEND TO OPERATION SIDE                                */
  /* ------------------------------------------------------------------------ */
  const handleSendToOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForOperation) return;

    const record = selectedForOperation;
    const now = new Date().toLocaleString();
    const targetDest = operationDestInput.trim() || "OP-LINE-1";
    const receiver = receiverName.trim() || "Operation Team";
    const carrier = carrierMethod.trim() || "Runner / Tugger";
    const finalQty = record.goodQty ?? record.unpackedQty ?? record.receivedQty;

    // Move inventory balance from Unpack Bay to Operation side location (e.g. OP-LINE-1)
    const updatedBalances = adjustBalance(
      balances,
      record.code,
      record.unpackBay,
      targetDest,
      finalQty
    );
    setBalances(updatedBalances);

    // Create transaction log
    const txId = `OPS-${Date.now().toString().slice(-6)}`;
    const tx: Transaction = {
      id: txId,
      type: "Sent to Operation",
      code: record.code,
      desc: record.desc,
      qty: finalQty,
      source: record.unpackBay,
      dest: targetDest,
      ref: `Sent to ${targetDest} via ${carrier} (Recv: ${receiver})`,
      user: receiver,
      time: now,
      status: "Posted",
    };
    setTransactions([tx, ...transactions]);

    // Update record stage to "Sent to Operation"
    const updatedRecords = records.map((r) => {
      if (r.id === record.id) {
        return {
          ...r,
          stage: "Sent to Operation" as UnpackStage,
          operationDest: targetDest,
          operationReceiver: receiver,
          carrierToOperation: carrier,
          sentToOperationAt: now,
          notes: operationNotes.trim()
            ? `${r.notes ? r.notes + " | " : ""}${operationNotes.trim()}`
            : r.notes,
        };
      }
      return r;
    });

    setRecords(updatedRecords);
    setSelectedForOperation(null);
    setOperationNotes("");
  };

  /* ------------------------------------------------------------------------ */
  /* CREATE NEW UNPACK RECORD MANUALLY                                        */
  /* ------------------------------------------------------------------------ */
  const handleCreateManualRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setManualNotice(null);

    const foundItem = items.find(
      (i) => i.active && i.code.toLowerCase() === manualCode.trim().toLowerCase()
    );
    if (!foundItem) {
      setManualNotice({ msg: "Invalid or inactive Part Number. Please select a registered part.", type: "error" });
      return;
    }
    const qNum = Number(manualQty);
    if (!(qNum > 0 && Number.isFinite(qNum))) {
      setManualNotice({ msg: "Please enter a valid quantity greater than zero.", type: "error" });
      return;
    }

    const newId = `UNP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
      100 + Math.random() * 900
    )}`;
    const now = new Date().toLocaleString();

    // Add balance at source dock
    setBalances(adjustBalance(balances, foundItem.code, "", manualSourceDock, qNum));

    const newRecord: UnpackRecord = {
      id: newId,
      receivingRef: manualRef.trim() || `MANUAL-${Date.now().toString().slice(-4)}`,
      code: foundItem.code,
      desc: foundItem.desc,
      model: foundItem.model,
      receivedQty: qNum,
      packagingType: manualPackaging,
      sourceDock: manualSourceDock,
      unpackBay: manualUnpackBay,
      targetOperation: manualTargetOp,
      stage: "Awaiting Forklift",
      createdAt: now,
      notes: "Direct manual unpack workflow record created.",
    };

    setRecords([newRecord, ...records]);
    setManualNotice({
      msg: `Created record ${newId} for ${foundItem.code} (${qNum}). Forklift is notified to transport to ${manualUnpackBay}.`,
      type: "success",
    });

    setManualCode("");
    setManualQty("");
    setManualRef("");
    setActiveTab("pipeline");
  };

  // Filtered records
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.receivingRef && r.receivingRef.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.operatorName && r.operatorName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = stageFilter === "all" || r.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const exportCSV = () => {
    const headers = [
      "Record ID",
      "Receiving Ref",
      "Part No",
      "Description",
      "Model",
      "Received Qty",
      "Unpacked Qty",
      "Good Qty",
      "Damaged Qty",
      "Stage",
      "Source Dock",
      "Unpack Bay",
      "Operation Dest",
      "Forklift Driver",
      "Operator",
      "Created At",
      "Unpacked At",
      "Sent To Op At",
    ];
    const rows = records.map((r) => [
      `"${r.id}"`,
      `"${r.receivingRef || ""}"`,
      `"${r.code}"`,
      `"${r.desc.replace(/"/g, '""')}"`,
      `"${r.model}"`,
      r.receivedQty,
      r.unpackedQty ?? "",
      r.goodQty ?? "",
      r.damagedQty ?? "",
      `"${r.stage}"`,
      `"${r.sourceDock}"`,
      `"${r.unpackBay}"`,
      `"${r.operationDest || r.targetOperation}"`,
      `"${r.forkliftDriver || ""}"`,
      `"${r.operatorName || ""}"`,
      `"${r.createdAt}"`,
      `"${r.unpackedAt || ""}"`,
      `"${r.sentToOperationAt || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `unpacking_operations_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Truck size={14} /> Material Flow
            </span>
            <span className="text-xs text-[#65768a]">Forklift Delivery → Unpacking → Operation</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#18324d] mt-1">
            Forklift Transfer & Part Unpacking Process
          </h2>
          <p className="text-xs text-[#65768a] mt-0.5">
            After stock receiving, forklift transports parts to the unpacking station. Operators record what item and how many units are unpacked before dispatching to the operation side.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("new")}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus size={14} /> New Unpack Lot
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 border border-[#cfd9e4] text-[#18324d] rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Visual Workflow Steps Banner */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-[#65768a] mb-3 flex items-center justify-between">
          <span>Standard Operating Procedure (SOP) Pipeline</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-semibold">
            Real-time Material Movement
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Step 1 */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                {awaitingForklift.length + inTransit.length} queued
              </span>
            </div>
            <div className="font-bold text-sm text-[#18324d] flex items-center gap-2">
              <Truck size={16} className="text-amber-700" />
              Forklift Transfer
            </div>
            <p className="text-xs text-[#52667d] mt-1 leading-relaxed">
              Forklift picks up delivered pallets from receiving docks and hauls them to designated Unpacking Bays (Bay A / B).
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-200/80 text-blue-900">
                {atUnpackBay.length} in progress
              </span>
            </div>
            <div className="font-bold text-sm text-[#18324d] flex items-center gap-2">
              <PackageOpen size={16} className="text-blue-700" />
              Operator Unpacking & Count
            </div>
            <p className="text-xs text-[#52667d] mt-1 leading-relaxed">
              Operator opens packaging, verifies Part No & description, counts unpacked quantity (good vs damaged), and logs inspection.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                {readyForOp.length} ready · {sentToOp.length} sent
              </span>
            </div>
            <div className="font-bold text-sm text-[#18324d] flex items-center gap-2">
              <Factory size={16} className="text-emerald-700" />
              Sent to Operation Side
            </div>
            <p className="text-xs text-[#52667d] mt-1 leading-relaxed">
              Verified parts are dispatched to the operation side (Line 1, Line 2, Assembly Cells) via runner/tugger with transfer slips.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#dfe6ee] gap-2">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
            activeTab === "pipeline"
              ? "border-[#2463a6] text-[#2463a6] bg-white"
              : "border-transparent text-[#65768a] hover:text-[#18324d]"
          }`}
        >
          <Layers size={14} /> Live Kanban Pipeline ({records.length})
        </button>
        <button
          onClick={() => setActiveTab("records")}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
            activeTab === "records"
              ? "border-[#2463a6] text-[#2463a6] bg-white"
              : "border-transparent text-[#65768a] hover:text-[#18324d]"
          }`}
        >
          <ClipboardCheck size={14} /> Full Unpack Audit Log
        </button>
        <button
          onClick={() => setActiveTab("new")}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
            activeTab === "new"
              ? "border-[#2463a6] text-[#2463a6] bg-white"
              : "border-transparent text-[#65768a] hover:text-[#18324d]"
          }`}
        >
          <Plus size={14} /> Create Manual Lot
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: KANBAN WORKFLOW PIPELINE                                      */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "pipeline" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUMN 1: Awaiting Forklift Transfer */}
          <div className="bg-[#f8fafc] border border-[#cfd9e4] rounded-2xl p-4 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe6ee] mb-4">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-amber-600" />
                <h3 className="text-sm font-bold text-[#18324d]">1. Awaiting Forklift</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-xs font-bold">
                {awaitingForklift.length}
              </span>
            </div>
            <p className="text-[11px] text-[#65768a] mb-3">
              Received at receiving docks. Click to assign forklift driver and haul to unpacking bay.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {awaitingForklift.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8292a4] border border-dashed border-[#cfd9e4] rounded-xl bg-white/60">
                  <Truck className="mx-auto text-gray-300 mb-2" size={24} />
                  No stock waiting at receiving docks. All received parts have been hauled to unpacking!
                </div>
              ) : (
                awaitingForklift.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-[#cfd9e4] hover:border-amber-400 p-4 rounded-xl shadow-xs transition space-y-2.5"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-mono font-bold text-[#2463a6]">{r.id}</span>
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                        Dock: {r.sourceDock}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-[#18324d] font-mono">{r.code}</div>
                      <div className="text-xs text-[#42566c] font-medium line-clamp-1">{r.desc}</div>
                      <div className="text-[11px] text-[#65768a] mt-0.5">
                        Model: {r.model} · Ref: {r.receivingRef || "—"}
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50/50 rounded-lg flex items-center justify-between text-xs font-mono">
                      <span className="text-[#65768a]">Received Qty:</span>
                      <span className="font-bold text-amber-900">
                        {r.receivedQty}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#65768a] flex items-center justify-between">
                      <span>Pkg: {r.packagingType || "Pallet"}</span>
                      <span>Target: {r.unpackBay}</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedForForklift(r);
                        setTargetUnpackBay(r.unpackBay || "UNPACK-BAY-A");
                      }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      <Truck size={13} />
                      <span>Dispatch Forklift to Unpack Bay →</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: At Unpacking Bay (Operator Process) */}
          <div className="bg-[#f8fafc] border border-[#cfd9e4] rounded-2xl p-4 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe6ee] mb-4">
              <div className="flex items-center gap-2">
                <PackageOpen size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-[#18324d]">2. At Unpacking Bay</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-mono text-xs font-bold">
                {atUnpackBay.length}
              </span>
            </div>
            <p className="text-[11px] text-[#65768a] mb-3">
              Delivered by forklift. Operators record unpacked item details & quantity.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {atUnpackBay.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8292a4] border border-dashed border-[#cfd9e4] rounded-xl bg-white/60">
                  <PackageOpen className="mx-auto text-gray-300 mb-2" size={24} />
                  No pallets currently waiting at the unpacking bay.
                </div>
              ) : (
                atUnpackBay.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-[#cfd9e4] hover:border-blue-400 p-4 rounded-xl shadow-xs transition space-y-2.5"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-mono font-bold text-[#2463a6]">{r.id}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                        Station: {r.unpackBay}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-[#18324d] font-mono">{r.code}</div>
                      <div className="text-xs text-[#42566c] font-medium line-clamp-1">{r.desc}</div>
                      <div className="text-[11px] text-[#65768a] mt-0.5">
                        Delivered by: {r.forkliftDriver || "Forklift Operator"}
                      </div>
                    </div>

                    <div className="p-2.5 bg-blue-50/50 rounded-lg flex items-center justify-between text-xs font-mono">
                      <span className="text-[#65768a]">To Unpack:</span>
                      <span className="font-bold text-blue-900">
                        {r.receivedQty}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#65768a] flex items-center justify-between">
                      <span>Dest: {r.targetOperation}</span>
                      <span className="text-emerald-700 font-semibold">Ready for Count</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedForUnpack(r);
                        setUnpackedQtyInput(r.receivedQty);
                        setGoodQtyInput(r.receivedQty);
                        setDamagedQtyInput(0);
                      }}
                      className="w-full py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      <ClipboardCheck size={13} />
                      <span>Record & Count Unpacked Items →</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: Ready / Sent to Operation Side */}
          <div className="bg-[#f8fafc] border border-[#cfd9e4] rounded-2xl p-4 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe6ee] mb-4">
              <div className="flex items-center gap-2">
                <Factory size={18} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-[#18324d]">3. Operation Handover</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-xs font-bold">
                {readyForOp.length + sentToOp.length}
              </span>
            </div>
            <p className="text-[11px] text-[#65768a] mb-3">
              Unpacking verified. Send parts to production line / operation side with sign-off.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {readyForOp.length === 0 && sentToOp.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8292a4] border border-dashed border-[#cfd9e4] rounded-xl bg-white/60">
                  <Factory className="mx-auto text-gray-300 mb-2" size={24} />
                  No unpacked parts ready for operations.
                </div>
              ) : (
                <>
                  {/* Ready for handover cards */}
                  {readyForOp.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white border-2 border-emerald-300 p-4 rounded-xl shadow-xs space-y-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-mono font-bold text-[#2463a6]">{r.id}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                          ✓ Unpacked & Inspected
                        </span>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-[#18324d] font-mono">{r.code}</div>
                        <div className="text-xs text-[#42566c] font-medium line-clamp-1">{r.desc}</div>
                        <div className="text-[11px] text-[#65768a] mt-0.5">
                          Operator: <strong>{r.operatorName}</strong> ({r.unpackedAt?.split(" ")[1] || "Today"})
                        </div>
                      </div>

                      <div className="p-2.5 bg-emerald-50 rounded-lg text-xs font-mono space-y-1">
                        <div className="flex justify-between text-[#18324d]">
                          <span>Unpacked Count:</span>
                          <strong className="text-emerald-900 font-bold">
                            {r.unpackedQty}
                          </strong>
                        </div>
                        <div className="flex justify-between text-[11px] text-[#65768a]">
                          <span>Good: {r.goodQty ?? r.unpackedQty}</span>
                          {r.damagedQty ? (
                            <span className="text-red-600 font-bold">Dmg: {r.damagedQty}</span>
                          ) : (
                            <span className="text-emerald-600">0 Defects</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedForOperation(r);
                            setOperationDestInput(r.targetOperation || "OP-LINE-1");
                          }}
                          className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition"
                        >
                          <Factory size={13} />
                          <span>Dispatch to Operation →</span>
                        </button>
                        <button
                          onClick={() => setSlipRecord(r)}
                          className="px-2.5 py-2 bg-white border border-[#cfd9e4] hover:bg-gray-50 text-[#18324d] rounded-lg text-xs"
                          title="Print Transfer Slip"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Recently Sent to Operation Cards */}
                  {sentToOp.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="bg-white/80 border border-gray-200 p-3 rounded-xl opacity-80 hover:opacity-100 transition space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-mono font-bold text-gray-600">{r.id}</span>
                        <span className="text-gray-500 font-medium">
                          Sent to <strong>{r.operationDest}</strong>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono font-bold text-[#18324d]">{r.code}</span>
                        <span className="font-mono font-bold text-emerald-800">
                          {r.goodQty ?? r.unpackedQty}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 flex justify-between">
                        <span>Receiver: {r.operationReceiver || "Operation Lead"}</span>
                        <button
                          onClick={() => setSlipRecord(r)}
                          className="text-[#2463a6] hover:underline flex items-center gap-0.5"
                        >
                          <FileText size={10} /> Slip
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: AUDIT LOG & COMPREHENSIVE TABLE                               */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "records" && (
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-2.5 text-[#9fb3c8]" size={15} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter part, ID, operator..."
                  className="w-full pl-9 pr-3 py-2 border border-[#cfd9e4] rounded-xl text-xs font-mono"
                />
              </div>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-3 py-2 border border-[#cfd9e4] rounded-xl text-xs bg-white text-[#18324d] font-medium"
              >
                <option value="all">All Stages ({records.length})</option>
                <option value="Awaiting Forklift">Awaiting Forklift</option>
                <option value="At Unpacking Bay">At Unpacking Bay</option>
                <option value="Unpacked & Ready for Operation">Unpacked & Ready</option>
                <option value="Sent to Operation">Sent to Operation</option>
              </select>
            </div>

            <span className="text-xs text-[#65768a]">
              Showing {filteredRecords.length} of {records.length} records
            </span>
          </div>

          <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f4f7fb] text-[#42566c] uppercase text-[10px] font-bold tracking-wider border-b border-[#dfe6ee]">
                <tr>
                  <th className="py-3 px-3">Unpack ID</th>
                  <th className="py-3 px-3">Part Details</th>
                  <th className="py-3 px-3">Qty Breakdown</th>
                  <th className="py-3 px-3">Locations Flow</th>
                  <th className="py-3 px-3">Status / Stage</th>
                  <th className="py-3 px-3">Operator & Forklift</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe6ee]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#65768a]">
                      No records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition font-sans">
                      <td className="py-3 px-3 font-mono font-bold text-[#2463a6]">
                        {r.id}
                        {r.receivingRef && (
                          <div className="text-[10px] font-normal text-[#65768a]">
                            Ref: {r.receivingRef}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-[#18324d]">{r.code}</div>
                        <div className="text-[#65768a] text-[11px] line-clamp-1">{r.desc}</div>
                        <div className="text-[10px] text-[#8292a4]">Model: {r.model}</div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div>
                          <strong>Recv:</strong> {r.receivedQty}
                        </div>
                        {r.unpackedQty !== undefined && (
                          <div className="text-emerald-800 font-bold">
                            <strong>Unpacked:</strong> {r.unpackedQty}
                          </div>
                        )}
                        {r.damagedQty ? (
                          <div className="text-red-600 font-bold">Dmg: {r.damagedQty}</div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        <div className="flex items-center gap-1 font-mono text-[#18324d]">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                            {r.sourceDock}
                          </span>
                          <ChevronRight size={12} className="text-gray-400" />
                          <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {r.unpackBay}
                          </span>
                          <ChevronRight size={12} className="text-gray-400" />
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {r.operationDest || r.targetOperation}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            r.stage === "Awaiting Forklift"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : r.stage === "Forklift In-Transit"
                              ? "bg-purple-100 text-purple-900 border border-purple-300"
                              : r.stage === "At Unpacking Bay"
                              ? "bg-blue-100 text-blue-900 border border-blue-300"
                              : r.stage === "Unpacked & Ready for Operation"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : "bg-gray-100 text-gray-800 border border-gray-300"
                          }`}
                        >
                          {r.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[#42566c]">
                        {r.operatorName && (
                          <div>
                            <strong>Operator:</strong> {r.operatorName}
                          </div>
                        )}
                        {r.forkliftDriver && (
                          <div>
                            <strong>Forklift:</strong> {r.forkliftDriver}
                          </div>
                        )}
                        {r.operationReceiver && (
                          <div>
                            <strong>Receiver:</strong> {r.operationReceiver}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSlipRecord(r)}
                          className="px-2.5 py-1.5 bg-[#f0f5fc] hover:bg-[#e1edfc] text-[#2463a6] rounded-lg font-semibold text-xs flex items-center gap-1 ml-auto"
                        >
                          <Printer size={12} /> Slip
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: CREATE MANUAL LOT / WORKFLOW                                  */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "new" && (
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs max-w-2xl">
          <h3 className="text-base font-bold text-[#18324d] mb-1">
            Create Inbound Lot for Forklift & Unpacking
          </h3>
          <p className="text-xs text-[#65768a] mb-4">
            Initialize an incoming pallet to notify forklift drivers and generate the unpacking schedule.
          </p>

          {manualNotice && (
            <div
              className={`p-3 rounded-xl text-xs mb-4 ${
                manualNotice.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {manualNotice.msg}
            </div>
          )}

          <form onSubmit={handleCreateManualRecord} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Part Number *</label>
              <input
                type="text"
                list="unpackActiveItems"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                required
                placeholder="e.g. PN-1001"
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
              />
              <datalist id="unpackActiveItems">
                {items
                  .filter((i) => i.active)
                  .map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.desc} ({i.model})
                    </option>
                  ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Received Quantity *</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  placeholder="e.g. 60"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Delivery Ref / DO</label>
                <input
                  type="text"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="e.g. DO-9044"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Receiving Dock</label>
                <select
                  value={manualSourceDock}
                  onChange={(e) => setManualSourceDock(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="RECV-BAY-01">RECV-BAY-01 (Dock A)</option>
                  <option value="RECV-BAY-02">RECV-BAY-02 (Dock B)</option>
                  <option value="RECV-01">RECV-01</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Unpacking Bay</label>
                <select
                  value={manualUnpackBay}
                  onChange={(e) => setManualUnpackBay(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="UNPACK-BAY-A">UNPACK-BAY-A</option>
                  <option value="UNPACK-BAY-B">UNPACK-BAY-B</option>
                  <option value="UNPACK-BAY-C">UNPACK-BAY-C</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">Operation Side Target</label>
                <select
                  value={manualTargetOp}
                  onChange={(e) => setManualTargetOp(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="OP-LINE-1">OP-LINE-1 (Main Assy)</option>
                  <option value="OP-LINE-2">OP-LINE-2 (Sub Assy)</option>
                  <option value="OP-CELL-3">OP-CELL-3 (Machining)</option>
                  <option value="OPERATION-SIDE">OPERATION-SIDE (General)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#42566c] mb-1">Packaging Type</label>
              <input
                type="text"
                value={manualPackaging}
                onChange={(e) => setManualPackaging(e.target.value)}
                placeholder="e.g. Wooden Crate / Corrugated Box"
                className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              ✓ Save & Queue for Forklift Transfer
            </button>
          </form>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 1: FORKLIFT TRANSFER DISPATCH                                  */}
      {/* -------------------------------------------------------------------- */}
      {selectedForForklift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Truck className="text-amber-600" size={20} />
                <h3 className="text-base font-bold text-[#18324d]">Forklift Transport Dispatch</h3>
              </div>
              <button
                onClick={() => setSelectedForForklift(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#65768a]">Record ID:</span>
                <strong className="font-mono text-[#18324d]">{selectedForForklift.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Part No & Model:</span>
                <strong className="font-mono text-[#18324d]">
                  {selectedForForklift.code} ({selectedForForklift.model})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Description:</span>
                <span className="text-[#18324d] font-medium">{selectedForForklift.desc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Quantity on Pallet:</span>
                <strong className="text-amber-900 font-bold font-mono">
                  {selectedForForklift.receivedQty}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Current Pick-up Dock:</span>
                <span className="font-mono font-bold text-[#18324d]">{selectedForForklift.sourceDock}</span>
              </div>
            </div>

            <form onSubmit={handleForkliftTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Forklift Operator Name / Driver ID *
                </label>
                <input
                  type="text"
                  value={forkliftDriver}
                  onChange={(e) => setForkliftDriver(e.target.value)}
                  required
                  placeholder="e.g. Forklift #2 - Hazim"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Deliver to Unpacking Bay *
                </label>
                <select
                  value={targetUnpackBay}
                  onChange={(e) => setTargetUnpackBay(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white"
                >
                  <option value="UNPACK-BAY-A">UNPACK-BAY-A (Primary Automotive Bay)</option>
                  <option value="UNPACK-BAY-B">UNPACK-BAY-B (Heavy Parts Station)</option>
                  <option value="UNPACK-BAY-C">UNPACK-BAY-C (Express Inbound)</option>
                </select>
              </div>

              <div className="text-[11px] text-[#65768a] bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                ⚡ <strong>Stock Movement:</strong> Submitting will transfer {selectedForForklift.receivedQty}{" "}
                units from <code>{selectedForForklift.sourceDock}</code> to <code>{targetUnpackBay}</code>{" "}
                and alert unpacking station operators.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForForklift(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Truck size={14} /> Confirm Delivery at Unpacking Bay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 2: OPERATOR UNPACKING RECORD & ITEM COUNT                      */}
      {/* -------------------------------------------------------------------- */}
      {selectedForUnpack && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <PackageOpen className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-[#18324d]">
                  Operator Unpacking & Verification
                </h3>
              </div>
              <button
                onClick={() => setSelectedForUnpack(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#65768a]">Lot Number:</span>
                <strong className="font-mono text-[#18324d]">{selectedForUnpack.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Item to Unpack:</span>
                <strong className="font-mono text-[#18324d]">{selectedForUnpack.code}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Part Description:</span>
                <span className="text-[#18324d] font-medium">{selectedForUnpack.desc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Received on Pallet:</span>
                <strong className="font-mono text-blue-900 font-bold">
                  {selectedForUnpack.receivedQty}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Delivered by Forklift:</span>
                <span>{selectedForUnpack.forkliftDriver || "Yes"}</span>
              </div>
            </div>

            <form onSubmit={handleUnpackRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Operator Name & Badge ID *
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  required
                  placeholder="e.g. Operator Siti (OP-14)"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Unpacked Qty *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={unpackedQtyInput}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setUnpackedQtyInput(val);
                      setGoodQtyInput(val);
                    }}
                    required
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-emerald-800 mb-1">
                    Good Units *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={goodQtyInput}
                    onChange={(e) => setGoodQtyInput(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-sm font-mono font-bold text-emerald-800 bg-emerald-50/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    Damaged / Reject
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={damagedQtyInput}
                    onChange={(e) => setDamagedQtyInput(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-red-300 rounded-xl text-sm font-mono text-red-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Operator Inspection Notes / Packaging Condition
                </label>
                <input
                  type="text"
                  value={unpackNotes}
                  onChange={(e) => setUnpackNotes(e.target.value)}
                  placeholder="e.g. Unpacked completely, seal intact, labels verified"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForUnpack(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Confirm & Log Unpacked Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 3: SEND UNPACKED PARTS TO OPERATION SIDE                       */}
      {/* -------------------------------------------------------------------- */}
      {selectedForOperation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Factory className="text-emerald-700" size={20} />
                <h3 className="text-base font-bold text-[#18324d]">
                  Dispatch to Operation Side
                </h3>
              </div>
              <button
                onClick={() => setSelectedForOperation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#65768a]">Part No & Model:</span>
                <strong className="font-mono text-[#18324d]">
                  {selectedForOperation.code} ({selectedForOperation.model})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Verified Unpacked Qty:</span>
                <strong className="font-mono text-emerald-900 font-bold">
                  {selectedForOperation.goodQty ?? selectedForOperation.unpackedQty}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Inspected by Operator:</span>
                <span className="font-medium text-[#18324d]">{selectedForOperation.operatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#65768a]">Current Location:</span>
                <span className="font-mono">{selectedForOperation.unpackBay}</span>
              </div>
            </div>

            <form onSubmit={handleSendToOperation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Destination Operation Line / Cell *
                </label>
                <select
                  value={operationDestInput}
                  onChange={(e) => setOperationDestInput(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm bg-white font-medium"
                >
                  <option value="OP-LINE-1">OP-LINE-1 (Main Assembly Line)</option>
                  <option value="OP-LINE-2">OP-LINE-2 (Chassis & Suspension)</option>
                  <option value="OP-CELL-3">OP-CELL-3 (Engine Sub-Assembly)</option>
                  <option value="OPERATION-SIDE">OPERATION-SIDE (Factory Floor Buffer)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Operation Receiver / Line Lead *
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    required
                    placeholder="e.g. Line Lead Rosli"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#42566c] mb-1">
                    Internal Carrier / Method
                  </label>
                  <input
                    type="text"
                    value={carrierMethod}
                    onChange={(e) => setCarrierMethod(e.target.value)}
                    placeholder="e.g. Tugger Train / Runner"
                    className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#42566c] mb-1">
                  Handover Remarks / Work Order
                </label>
                <input
                  type="text"
                  value={operationNotes}
                  onChange={(e) => setOperationNotes(e.target.value)}
                  placeholder="e.g. Handed over to Shift A line feed"
                  className="w-full px-3 py-2 border border-[#cfd9e4] rounded-xl text-sm"
                />
              </div>

              <div className="text-[11px] text-[#65768a] bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                📦 <strong>Inventory Impact:</strong> Moves{" "}
                {selectedForOperation.goodQty ?? selectedForOperation.unpackedQty} units from{" "}
                <code>{selectedForOperation.unpackBay}</code> directly into operation station balance at{" "}
                <code>{operationDestInput}</code>.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForOperation(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Factory size={14} /> Confirm Handover to Operation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 4: PRINTABLE MATERIAL TRANSFER & UNPACK SLIP                   */}
      {/* -------------------------------------------------------------------- */}
      {slipRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-[#2463a6]" size={20} />
                <h3 className="text-base font-bold text-[#18324d]">
                  Unpack & Operation Handover Slip
                </h3>
              </div>
              <button
                onClick={() => setSlipRecord(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border border-gray-300 rounded-xl p-4 bg-gray-50/60 font-mono text-xs space-y-3">
              <div className="text-center border-b pb-2">
                <div className="font-bold text-sm tracking-wider">WH-OS AUTO LOGISTICS</div>
                <div className="text-[10px] text-gray-500">
                  MATERIAL UNPACKING & OPERATION DISPATCH RECORD
                </div>
                <div className="text-[11px] font-bold mt-1 text-[#2463a6]">{slipRecord.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-500">Part No:</span>
                  <div className="font-bold text-sm text-black">{slipRecord.code}</div>
                </div>
                <div>
                  <span className="text-gray-500">Model:</span>
                  <div className="font-bold text-black">{slipRecord.model}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Description:</span>
                  <div className="font-bold text-black">{slipRecord.desc}</div>
                </div>
              </div>

              <div className="border-t border-b py-2 grid grid-cols-3 gap-1 text-center">
                <div className="bg-white p-1 rounded border">
                  <div className="text-[9px] text-gray-500">RECEIVED</div>
                  <div className="font-bold">{slipRecord.receivedQty}</div>
                </div>
                <div className="bg-white p-1 rounded border">
                  <div className="text-[9px] text-gray-500">UNPACKED</div>
                  <div className="font-bold text-blue-700">
                    {slipRecord.unpackedQty ?? "—"}
                  </div>
                </div>
                <div className="bg-white p-1 rounded border">
                  <div className="text-[9px] text-gray-500">TO OPERATION</div>
                  <div className="font-bold text-emerald-700">
                    {slipRecord.goodQty ?? slipRecord.unpackedQty ?? slipRecord.receivedQty}
                  </div>
                </div>
              </div>

              <div className="text-[10px] space-y-1 text-gray-600">
                <div className="flex justify-between">
                  <span>Forklift Driver:</span>
                  <strong>{slipRecord.forkliftDriver || "Pending"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Unpack Bay / Station:</span>
                  <strong>{slipRecord.unpackBay}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Unpacking Operator:</span>
                  <strong>{slipRecord.operatorName || "Pending"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Operation Destination:</span>
                  <strong>{slipRecord.operationDest || slipRecord.targetOperation}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Operation Receiver:</span>
                  <strong>{slipRecord.operationReceiver || "Pending Handover"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Timestamp:</span>
                  <span>{slipRecord.sentToOperationAt || slipRecord.unpackedAt || slipRecord.createdAt}</span>
                </div>
              </div>

              {slipRecord.notes && (
                <div className="border-t pt-2 text-[10px] text-gray-500">
                  Notes: {slipRecord.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSlipRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d528a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer size={13} /> Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
