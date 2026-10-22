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
  Copy,
  Eye,
  FileText,
  Trash2,
  Edit,
  RotateCcw,
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

/**
 * Exact 7 finished goods line items from the KB Teknik Delivery Order photo
 * Delivered to PEPS-JV Melaka (Vehicle Assembly - VA) for WEY G9 HEV (Variant M81)
 */
export interface VADOLineItem {
  bil: number;
  code: string;
  desc: string;
  module: FGModuleKey;
  qty: number;
  defaultQty?: number;
}

export const PHOTO_DO_ITEMS: VADOLineItem[] = [
  {
    bil: 1,
    code: "5305MA170001AZJL",
    desc: "CONSOLE SUB-ASSY (Local)",
    module: "Center Console",
    qty: 10,
    defaultQty: 10,
  },
  {
    bil: 2,
    code: "6102MA170001BZJL",
    desc: "TRIM PANEL SUB-ASSY, LH FR DOOR, INR (Local)",
    module: "Door Trim",
    qty: 10,
    defaultQty: 10,
  },
  {
    bil: 3,
    code: "6102MA170002AZJL",
    desc: "TRIM PANEL SUB-ASSY, RH FR DOOR, INR (Local)",
    module: "Door Trim",
    qty: 10,
    defaultQty: 10,
  },
  {
    bil: 4,
    code: "6202MA220001AZJL",
    desc: "TRIM PANEL SUB-ASSY, LH RR DOOR, INR (Local)",
    module: "Door Trim",
    qty: 10,
    defaultQty: 10,
  },
  {
    bil: 5,
    code: "6202MA220002AZJL",
    desc: "TRIM PANEL SUB-ASSY, RH RR DOOR, INR (Local)",
    module: "Door Trim",
    qty: 10,
    defaultQty: 10,
  },
  {
    bil: 6,
    code: "5306MA170011A8P",
    desc: "IP SUB ASSY (Local)",
    module: "IP",
    qty: 0,
    defaultQty: 0,
  },
  {
    bil: 7,
    code: "1301MA220001A",
    desc: "COOLING MODULE SUB-ASSY (Local)",
    module: "Cooling Module",
    qty: 12,
    defaultQty: 12,
  },
];

export interface FGModuleConfig {
  id: FGModuleKey;
  label: string;
  fullName: string;
  defaultPartNo: string;
  defaultDesc: string;
  defaultDest: string;
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
    fullName: "IP SUB ASSY (Local) - Instrument Panel",
    defaultPartNo: "5306MA170011A8P",
    defaultDesc: "IP SUB ASSY (Local)",
    defaultDest: "PEPS-JV MELAKA (VA) - Cockpit Decking",
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
    fullName: "CONSOLE SUB-ASSY (Local)",
    defaultPartNo: "5305MA170001AZJL",
    defaultDesc: "CONSOLE SUB-ASSY (Local)",
    defaultDest: "PEPS-JV MELAKA (VA) - Interior Trim",
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
    fullName: "TRIM PANEL SUB-ASSY (FR & RR Doors)",
    defaultPartNo: "6102MA170001BZJL",
    defaultDesc: "TRIM PANEL SUB-ASSY, LH FR DOOR, INR (Local)",
    defaultDest: "PEPS-JV MELAKA (VA) - Door Line",
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
    fullName: "COOLING MODULE SUB-ASSY (Local)",
    defaultPartNo: "1301MA220001A",
    defaultDesc: "COOLING MODULE SUB-ASSY (Local)",
    defaultDest: "PEPS-JV MELAKA (VA) - Front Decking",
    color: {
      bg: "bg-cyan-50/70",
      border: "border-cyan-200",
      text: "text-cyan-900",
      badgeBg: "bg-cyan-100",
      badgeText: "text-cyan-800",
    },
  },
];

export const VEHICLE_MODELS = [
  "WEY G9 HEV",
  "Civic FD",
  "Civic FC",
  "CR-V Gen 5",
  "City GN",
  "HR-V",
  "Accord",
  "Universal",
];

// Helper to format DO date
const formatDODate = (d: Date = new Date()) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper to format DO time (e.g. 3.20PM)
const formatDOTime = (d: Date = new Date()) => {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}.${minutes}${ampm}`;
};

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
  const [isDOModalOpen, setIsDOModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [viewingSlipTx, setViewingSlipTx] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "7days">("all");

  // Delivery Order Form State (Matching the Photo Details)
  const [customerName, setCustomerName] = useState("PEPS-JV MELAKA SDN. BHD.");
  const [customerAddress, setCustomerAddress] = useState(
    "VEHICLE ASSEMBLY (VA),\nJALAN HICOM PEGOH 7,\n78000 ALOR GAJAH\nMELAKA"
  );
  const [picInfo, setPicInfo] = useState("AKMAL (017-647 6682)");
  const [doNo, setDoNo] = useState("KBTM-21/10/2026-0002");
  const [doDate, setDoDate] = useState("21/10/2026");
  const [doTime, setDoTime] = useState("3.20PM");
  const [batchNo, setBatchNo] = useState("MYH6003");
  const [vehicleModel, setVehicleModel] = useState("WEY G9 HEV");
  const [vehicleVariant, setVehicleVariant] = useState("M81");
  const [dispatcherName, setDispatcherName] = useState(
    currentUser?.name || currentUser?.username || "Admin / Warehouse Clerk"
  );

  // Line items for the Delivery Order (Initialized from photo)
  const [doItems, setDoItems] = useState<
    { bil: number; code: string; desc: string; qty: number; module: FGModuleKey }[]
  >(PHOTO_DO_ITEMS);

  // Total quantity calculation for the current DO form
  const totalDOQuantity = useMemo(() => {
    return doItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [doItems]);

  // Today string helper
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const todayStr = getTodayISO();

  // Filter all "Send to VA" transactions
  const vaTransactions = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.type === "Send to VA" ||
        tx.dest.toLowerCase().includes("va") ||
        tx.ref.startsWith("KBTM-") ||
        tx.ref.startsWith("VA-")
    );
  }, [transactions]);

  // KPI Calculations
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

      if (tx.doItems && tx.doItems.length > 0) {
        for (const itm of tx.doItems) {
          const modKey = (itm.module as string) || "Other";
          if (moduleCounts[modKey]) {
            moduleCounts[modKey].all += itm.qty;
            if (isToday) moduleCounts[modKey].today += itm.qty;
          }
        }
      } else {
        let mod = tx.finishedGoodModule;
        if (!mod) {
          const text = `${tx.code} ${tx.desc} ${tx.partName}`.toLowerCase();
          if (text.includes("ip") || text.includes("instrument")) mod = "IP";
          else if (text.includes("console")) mod = "Center Console";
          else if (text.includes("door") || text.includes("trim")) mod = "Door Trim";
          else if (text.includes("cooling")) mod = "Cooling Module";
          else mod = "Other";
        }
        const key = moduleCounts[mod] ? mod : "Other";
        moduleCounts[key].all += qty;
        if (isToday) moduleCounts[key].today += qty;
      }
    }

    return {
      totalSentToday,
      totalSentAllTime,
      totalDispatches: vaTransactions.length,
      moduleCounts,
    };
  }, [vaTransactions, todayStr]);

  // Finished Goods on-hand stock map
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
      const q = search.toLowerCase();
      const searchMatch =
        !search ||
        tx.ref.toLowerCase().includes(q) ||
        (tx.doNo && tx.doNo.toLowerCase().includes(q)) ||
        tx.code.toLowerCase().includes(q) ||
        (tx.desc && tx.desc.toLowerCase().includes(q)) ||
        (tx.dest && tx.dest.toLowerCase().includes(q)) ||
        (tx.receiverName && tx.receiverName.toLowerCase().includes(q)) ||
        (tx.pic && tx.pic.toLowerCase().includes(q)) ||
        (tx.batchNo && tx.batchNo.toLowerCase().includes(q)) ||
        (tx.model && tx.model.toLowerCase().includes(q));

      if (!searchMatch) return false;

      // Module filter
      if (selectedModuleFilter !== "All") {
        let hasModule = false;
        if (tx.doItems && tx.doItems.length > 0) {
          hasModule = tx.doItems.some(
            (itm) => itm.module?.toLowerCase() === selectedModuleFilter.toLowerCase()
          );
        } else {
          hasModule = tx.finishedGoodModule?.toLowerCase() === selectedModuleFilter.toLowerCase();
        }
        if (!hasModule) return false;
      }

      // Date filter
      if (dateRangeFilter === "today") {
        if (!tx.time || !tx.time.startsWith(todayStr)) return false;
      } else if (dateRangeFilter === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const sevenDaysAgo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
        const txDate = tx.time ? tx.time.slice(0, 10) : "";
        if (txDate < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [vaTransactions, search, selectedModuleFilter, dateRangeFilter, todayStr]);

  // Auto-generate fresh DO reference based on current date
  const handleAutoGenerateDONo = () => {
    const d = new Date();
    const formatted = formatDODate(d);
    const randSeq = String(Math.floor(1 + Math.random() * 999)).padStart(4, "0");
    setDoNo(`KBTM-${formatted}-${randSeq}`);
    setDoDate(formatted);
    setDoTime(formatDOTime(d));
  };

  // Add a new line item row to the DO
  const handleAddLineItem = () => {
    setDoItems((prev) => [
      ...prev,
      {
        bil: prev.length + 1,
        code: "",
        desc: "",
        qty: 10,
        module: "Custom",
        defaultQty: 10,
      },
    ]);
  };

  // Remove a line item row and re-number bil cleanly
  const handleRemoveLineItem = (idxToRemove: number) => {
    setDoItems((prev) => {
      const next = prev.filter((_, idx) => idx !== idxToRemove);
      return next.map((item, i) => ({ ...item, bil: i + 1 }));
    });
  };

  // Clear all line items to allow building a completely custom list
  const handleClearAllLineItems = () => {
    setDoItems([]);
  };

  // Handle part code entry with automatic description & module detection from catalog
  const handlePartCodeChange = (idx: number, newCode: string) => {
    const upper = newCode.toUpperCase();
    const matchedItem = items.find((it) => it.code.toUpperCase() === upper);
    setDoItems((prev) => {
      const next = [...prev];
      let detectedModule: FGModuleKey = next[idx].module;
      if (matchedItem) {
        const text = `${matchedItem.code} ${matchedItem.desc || ""}`.toLowerCase();
        if (text.includes("console")) detectedModule = "Center Console";
        else if (text.includes("door") || text.includes("trim")) detectedModule = "Door Trim";
        else if (text.includes("ip") || text.includes("instrument")) detectedModule = "IP";
        else if (text.includes("cooling") || text.includes("radiator")) detectedModule = "Cooling Module";
      }

      next[idx] = {
        ...next[idx],
        code: upper,
        desc: matchedItem ? (matchedItem.desc || next[idx].desc) : next[idx].desc,
        module: detectedModule,
      };
      return next;
    });
  };

  // Open modal to create a fresh new Delivery Order
  const handleOpenNewDO = () => {
    setEditingTxId(null);
    handleAutoGenerateDONo();
    setIsDOModalOpen(true);
  };

  // Open modal to edit an existing Delivery Order
  const handleOpenEditDO = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setCustomerName(
      tx.dest ? tx.dest.replace(" - VEHICLE ASSEMBLY (VA)", "").trim() : "PEPS-JV MELAKA SDN. BHD."
    );
    setCustomerAddress(
      "VEHICLE ASSEMBLY (VA),\nJALAN HICOM PEGOH 7,\n78000 ALOR GAJAH\nMELAKA"
    );
    setPicInfo(tx.pic || tx.receiverName || "AKMAL (017-647 6682)");
    setDoNo(tx.doNo || tx.ref || `KBTM-${formatDODate()}-0001`);
    setDoDate(tx.time ? tx.time.slice(0, 10) : formatDODate());
    setDoTime(tx.time && tx.time.length > 11 ? tx.time.slice(11, 19) : "3.20PM");
    setBatchNo(tx.batchNo || "MYH6003");
    setVehicleModel(tx.model || "WEY G9 HEV");
    setVehicleVariant(tx.variant || "M81");
    setDispatcherName(tx.user || currentUser?.name || "Admin");

    if (tx.doItems && tx.doItems.length > 0) {
      setDoItems(
        tx.doItems.map((itm) => ({
          bil: itm.bil,
          code: itm.code,
          desc: itm.desc,
          qty: itm.qty,
          module: (itm.module as FGModuleKey) || "Custom",
        }))
      );
    } else {
      setDoItems([
        {
          bil: 1,
          code: tx.code,
          desc: tx.desc || tx.partName || "",
          qty: tx.qty,
          module: (tx.finishedGoodModule as FGModuleKey) || "Custom",
        },
      ]);
    }
    setIsDOModalOpen(true);
  };

  // Reset form to photo's exact values
  const handleResetToPhotoValues = () => {
    setEditingTxId(null);
    setCustomerName("PEPS-JV MELAKA SDN. BHD.");
    setCustomerAddress(
      "VEHICLE ASSEMBLY (VA),\nJALAN HICOM PEGOH 7,\n78000 ALOR GAJAH\nMELAKA"
    );
    setPicInfo("AKMAL (017-647 6682)");
    setDoNo("KBTM-21/10/2026-0002");
    setDoDate("21/10/2026");
    setDoTime("3.20PM");
    setBatchNo("MYH6003");
    setVehicleModel("WEY G9 HEV");
    setVehicleVariant("M81");
    setDoItems(PHOTO_DO_ITEMS.map((item) => ({ ...item })));
    setNotice({
      type: "success",
      msg: "✓ Loaded exact Delivery Order details from photo (KBTM-21/10/2026-0002, WEY G9 HEV M81, Total 62 pcs).",
    });
    setTimeout(() => setNotice(null), 4000);
  };

  // Submit Delivery Order (Create new or save manual edits)
  const handleSubmitDeliveryOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (doItems.length === 0) {
      setNotice({ msg: "Please add at least one line item to the Delivery Order.", type: "error" });
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    const curTime = `${todayStr} ${new Date().toTimeString().slice(0, 8)}`;
    const finalDONo = doNo.trim() || `KBTM-${formatDODate()}-0001`;

    // 1. If editing an existing DO record, update it directly
    if (editingTxId) {
      const updatedTransactions = transactions.map((t) => {
        if (t.id === editingTxId) {
          return {
            ...t,
            model: vehicleModel.trim(),
            variant: vehicleVariant.trim(),
            batchNo: batchNo.trim(),
            doNo: finalDONo,
            ref: finalDONo,
            caseNo: finalDONo,
            trolleyNo: finalDONo,
            pic: picInfo.trim(),
            dest: `${customerName} - VEHICLE ASSEMBLY (VA)`,
            user: dispatcherName.trim() || t.user,
            receiverName: picInfo.trim(),
            qty: totalDOQuantity,
            desc: `DELIVERY ORDER TO PEPS-JV (VA) - ${vehicleModel} ${vehicleVariant}`,
            doItems: doItems.map((itm) => ({
              bil: itm.bil,
              code: itm.code,
              desc: itm.desc,
              qty: Number(itm.qty) || 0,
              module: itm.module,
            })),
            notes: `Official Delivery Order ${finalDONo} for PEPS-JV VA. ${doItems.length} line items, total ${totalDOQuantity} units.`,
          };
        }
        return t;
      });

      setTransactions(updatedTransactions);
      pushWarehouseStateToCloud(items, balances, updatedTransactions, users);

      setIsDOModalOpen(false);
      const updatedTx = updatedTransactions.find((t) => t.id === editingTxId);
      if (updatedTx) {
        setViewingSlipTx(updatedTx);
      }
      setEditingTxId(null);
      setNotice({
        msg: `✓ Delivery Order "${finalDONo}" updated successfully with manual edits! Total: ${totalDOQuantity} units.`,
        type: "success",
      });
      setTimeout(() => setNotice(null), 5000);
      return;
    }

    // 2. Otherwise, create a new Transaction record matching Delivery Order format
    const newTx: Transaction = {
      id: `DO-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`,
      type: "Send to VA",
      code: doItems[0]?.code || "FG-MULTI-SET",
      partName: "Finished Goods Delivery Order Set",
      desc: `DELIVERY ORDER TO PEPS-JV (VA) - ${vehicleModel} ${vehicleVariant}`,
      finishedGoodModule: "Center Console",
      model: vehicleModel.trim(),
      variant: vehicleVariant.trim(),
      batchNo: batchNo.trim(),
      caseNo: finalDONo,
      trolleyNo: finalDONo,
      doNo: finalDONo,
      pic: picInfo.trim(),
      qty: totalDOQuantity,
      source: "KB TEKNIK (MELAKA) SDN. BHD.",
      dest: `${customerName} - VEHICLE ASSEMBLY (VA)`,
      ref: finalDONo,
      user: dispatcherName.trim() || "admin",
      receiverName: picInfo.trim() || "AKMAL (017-647 6682)",
      time: curTime,
      status: "Posted",
      notes: `Official Delivery Order ${finalDONo} for PEPS-JV VA. ${doItems.length} line items, total ${totalDOQuantity} units.`,
      doItems: doItems.map((itm) => ({
        bil: itm.bil,
        code: itm.code,
        desc: itm.desc,
        qty: Number(itm.qty) || 0,
        module: itm.module,
      })),
    };

    // 3. Adjust Finished Good balances if matching stock exists
    let updatedBalances = [...balances];
    for (const itm of doItems) {
      if (itm.qty > 0) {
        const matchIdx = updatedBalances.findIndex(
          (b) => b.code.toUpperCase() === itm.code.toUpperCase()
        );
        if (matchIdx >= 0) {
          const currentQ = updatedBalances[matchIdx].qty;
          const newQ = Math.max(0, currentQ - itm.qty);
          updatedBalances[matchIdx] = {
            ...updatedBalances[matchIdx],
            qty: newQ,
            updatedAt: curTime,
          };
        }
      }
    }

    const updatedTransactions = [newTx, ...transactions];

    // 4. Update React state
    setBalances(updatedBalances);
    setTransactions(updatedTransactions);

    // 5. Push to Firestore
    pushWarehouseStateToCloud(items, updatedBalances, updatedTransactions, users);

    setIsDOModalOpen(false);
    setViewingSlipTx(newTx);
    setNotice({
      msg: `✓ Delivery Order "${finalDONo}" dispatched to PEPS-JV VA successfully! Total: ${totalDOQuantity} units. Official DO ready for printing.`,
      type: "success",
    });
    setTimeout(() => setNotice(null), 6000);
  };

  // Export all VA dispatches to Excel
  const handleExportXLSX = () => {
    const headers = [
      "DO Date & Time",
      "DO Number (Ref)",
      "Customer (To)",
      "PIC & Phone",
      "Model",
      "Variant",
      "Batch",
      "Total Qty",
      "Line Items Count",
      "Source (Sender)",
      "Destination",
      "Dispatched By",
      "Status",
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.time,
      tx.ref,
      "PEPS-JV MELAKA SDN. BHD.",
      tx.pic || tx.receiverName || "AKMAL (017-647 6682)",
      tx.model || "WEY G9 HEV",
      tx.variant || "M81",
      tx.batchNo || "MYH6003",
      tx.qty,
      tx.doItems ? tx.doItems.length : 1,
      tx.source,
      tx.dest,
      tx.user,
      tx.status,
    ]);

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Send to VA Delivery Orders");
    XLSX.writeFile(wb, `kb_teknik_delivery_orders_va_${todayStr}.xlsx`);
  };

  // Export active viewing slip to Excel
  const handleExportSingleDOXLSX = (tx: Transaction) => {
    const itemsToExport =
      tx.doItems && tx.doItems.length > 0
        ? tx.doItems
        : [
            {
              bil: 1,
              code: tx.code,
              desc: tx.desc || tx.partName || "Finished Good Assembly",
              qty: tx.qty,
              module: tx.finishedGoodModule,
            },
          ];

    const headerBlock = [
      ["KB TEKNIK (MELAKA) SDN. BHD."],
      [
        "No. 2, Lot. 3684, Jalan Industri 23, Kawasan Perindustrian Kelemak, Mukim Kelemak, 78000, Alor Gajah, Melaka",
      ],
      [""],
      ["DELIVERY ORDER"],
      [""],
      ["TO:", "PEPS-JV MELAKA SDN. BHD.", "", "DO NO.:", tx.doNo || tx.ref],
      ["", "VEHICLE ASSEMBLY (VA),", "", "DATE:", tx.time.slice(0, 10)],
      ["", "JALAN HICOM PEGOH 7,", "", "TIME:", tx.time.slice(11, 19)],
      ["", "78000 ALOR GAJAH, MELAKA", "", "BATCH:", tx.batchNo || "MYH6003"],
      ["PIC:", tx.pic || tx.receiverName || "AKMAL (017-647 6682)"],
      [""],
      ["BIL.", "PART NUMBER", "DESCRIPTION", "QTY"],
    ];

    const itemRows = itemsToExport.map((itm) => [itm.bil, itm.code, itm.desc, itm.qty]);

    const totalQty = itemsToExport.reduce((sum, itm) => sum + itm.qty, 0);

    const footerBlock = [
      [""],
      ["REMARKS:"],
      ["MODEL:", tx.model || "WEY G9 HEV", "", "TOTAL:", totalQty],
      ["VARIANT:", tx.variant || "M81"],
      [""],
      ["KB Teknik Sdn Bhd (198801001857)"],
      ["PT 2230, Jalan Hicom Pegoh 7, 78000 Alor Gajah, Melaka"],
    ];

    const data = [...headerBlock, ...itemRows, ...footerBlock];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delivery Order");
    const safeRef = (tx.doNo || tx.ref).replace(/[/\\:*?"<>|]/g, "_");
    XLSX.writeFile(wb, `Delivery_Order_${safeRef}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner matching KB Teknik Delivery Order Context */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#2463a6]/10 text-[#2463a6] rounded-lg">
              <Truck size={20} />
            </span>
            <h2 className="text-2xl font-bold text-[#18324d]">
              Send to VA (Vehicle Assembly) — Delivery Order
            </h2>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-full">
              KB Teknik Melaka → PEPS-JV (VA)
            </span>
          </div>
          <p className="text-sm text-[#65768a]">
            Manage official Delivery Orders (DO) for Finished Goods dispatched from{" "}
            <strong className="text-[#18324d]">KB Teknik (Melaka) Sdn. Bhd.</strong> to{" "}
            <strong className="text-[#18324d]">PEPS-JV Melaka (Vehicle Assembly)</strong>: Console,
            Door Trim, IP, and Cooling Module.
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

          {/* Quick Match to Photo Template button */}
          <button
            type="button"
            onClick={() => {
              handleResetToPhotoValues();
              setIsDOModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100 transition shadow-2xs cursor-pointer"
            title="Create Delivery Order with exact 7 items from the photo (DO: KBTM-21/10/2026-0002, 62 pcs)"
          >
            <FileText size={14} className="text-amber-700" />
            <span>Load DO from Photo (62 pcs)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewDO}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Plus size={15} /> Create Delivery Order (DO)
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
          <button
            onClick={() => setNotice(null)}
            className="text-gray-400 hover:text-gray-700 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Document Snapshot Card from User's Photo */}
      <div className="bg-gradient-to-r from-blue-900 to-[#18324d] text-white rounded-2xl p-5 shadow-sm border border-blue-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-400 text-amber-950 font-bold text-[10px] rounded uppercase tracking-wider">
                Photo Matched Document
              </span>
              <span className="font-mono text-xs text-blue-200">
                KBTM-21/10/2026-0002 • 21/10/2026 3.20PM
              </span>
            </div>
            <h3 className="text-lg font-bold">
              PEPS-JV Melaka Sdn. Bhd. — Vehicle Assembly (VA)
            </h3>
            <p className="text-xs text-blue-200 max-w-2xl leading-relaxed">
              Standard 7-item Finished Goods Delivery Order: Console (10), LH FR Door (10), RH FR
              Door (10), LH RR Door (10), RH RR Door (10), IP (0), Cooling Module (12). Total:{" "}
              <strong className="text-white font-bold">62 pcs</strong> for Model:{" "}
              <strong className="text-white">WEY G9 HEV</strong> (Variant:{" "}
              <strong className="text-white">M81</strong>).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const photoTx = vaTransactions.find((t) => t.ref.includes("KBTM-21/10/2026-0002"));
                if (photoTx) {
                  setViewingSlipTx(photoTx);
                } else {
                  handleResetToPhotoValues();
                  setIsDOModalOpen(true);
                }
              }}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Eye size={14} /> View DO Slip (Photo Style)
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetToPhotoValues();
                setIsDOModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Copy size={14} /> New DO with Same 7 Parts
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#65768a] mb-1">
            Total Units Sent
          </div>
          <div className="text-2xl font-bold font-mono text-[#18324d]">
            {kpiStats.totalSentAllTime.toLocaleString()}{" "}
            <span className="text-xs font-normal text-gray-500">pcs</span>
          </div>
          <div className="text-[11px] text-[#65768a] mt-1 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Total Dispatches:{" "}
            <strong className="text-[#18324d]">{kpiStats.totalDispatches}</strong> DOs
          </div>
        </div>

        {FG_MODULES_CONFIG.map((m) => {
          const stats = kpiStats.moduleCounts[m.id] || { today: 0, all: 0 };
          const stockOnHand = fgStockMap.get(m.defaultPartNo) || 0;
          return (
            <div
              key={m.id}
              className="bg-white border border-[#dfe6ee] rounded-2xl p-4 shadow-2xs relative"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#65768a]">
                  {m.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${m.color.badgeBg} ${m.color.badgeText}`}
                >
                  {m.label}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-[#18324d]">
                {stats.all.toLocaleString()}{" "}
                <span className="text-xs font-normal text-gray-500">units</span>
              </div>
              <div className="text-[11px] text-[#65768a] mt-1 flex justify-between items-center">
                <span>
                  Part: <strong className="font-mono text-[10px]">{m.defaultPartNo}</strong>
                </span>
                <span className="text-gray-400">
                  Stock: <strong className="text-emerald-700">{stockOnHand}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7 Finished Goods Parts Catalog (Matching Photo) */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#18324d] flex items-center gap-2">
              <span>Finished Goods Standard Delivery Order Items</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full border border-blue-200 font-bold">
                WEY G9 HEV (Variant M81)
              </span>
            </h3>
            <p className="text-xs text-[#65768a] mt-0.5">
              The 7 standard finished goods assemblies recorded in Delivery Orders sent to PEPS-JV
              Melaka (VA):
            </p>
          </div>
          <span className="text-xs text-[#65768a] font-mono">Customer: PEPS-JV Melaka (VA)</span>
        </div>

        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] border-b border-[#dfe6ee] font-bold">
                <th className="p-2.5 text-center w-12">BIL.</th>
                <th className="p-2.5">PART NUMBER</th>
                <th className="p-2.5">DESCRIPTION</th>
                <th className="p-2.5">MODULE</th>
                <th className="p-2.5 text-center">STANDARD DO QTY</th>
                <th className="p-2.5 text-right">CURRENT STOCK ON-HAND</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3]">
              {PHOTO_DO_ITEMS.map((item) => {
                const stock = fgStockMap.get(item.code) || 0;
                return (
                  <tr key={item.bil} className="hover:bg-slate-50/70 transition">
                    <td className="p-2.5 text-center font-bold text-[#18324d]">{item.bil}</td>
                    <td className="p-2.5 font-mono font-bold text-[#18324d]">{item.code}</td>
                    <td className="p-2.5 font-medium text-slate-800">{item.desc}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-semibold text-[10px] border border-blue-100">
                        {item.module}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#18324d]">
                      {item.defaultQty} pcs
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      <span
                        className={
                          stock > 0
                            ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                            : "text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                        }
                      >
                        {stock} pcs
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#f0f4f9] font-bold text-xs border-t border-[#dfe6ee]">
                <td colSpan={4} className="p-2.5 text-right text-[#18324d]">
                  TOTAL STANDARD QUANTITY:
                </td>
                <td className="p-2.5 text-center font-mono font-extrabold text-[#18324d] text-sm">
                  62 pcs
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* VA Delivery Orders Table & Controls */}
      <div className="bg-white border border-[#dfe6ee] rounded-2xl p-6 shadow-xs space-y-4">
        {/* Table Filter Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#dfe6ee] pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[#42566c] mr-1 flex items-center gap-1">
              <Filter size={13} /> Filter Module:
            </span>
            {["All", "Center Console", "Door Trim", "IP", "Cooling Module"].map((tab) => (
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
                {tab === "All" ? "All Deliveries" : tab}
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
                  dateRangeFilter === "all"
                    ? "bg-white text-[#18324d] shadow-2xs font-bold"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter("today")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  dateRangeFilter === "today"
                    ? "bg-white text-[#18324d] shadow-2xs font-bold"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Today Only
              </button>
              <button
                type="button"
                onClick={() => setDateRangeFilter("7days")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  dateRangeFilter === "7days"
                    ? "bg-white text-[#18324d] shadow-2xs font-bold"
                    : "text-gray-500 hover:text-gray-800"
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
              placeholder="Search by DO No (KBTM-...), Part No, Description, Model, or PIC..."
              className="w-full pl-10 pr-4 py-2.5 border border-[#cfd9e4] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
            />
          </div>

          <div className="text-xs text-[#65768a] shrink-0">
            Showing <strong className="text-[#18324d]">{filteredTransactions.length}</strong>{" "}
            Delivery Order record(s)
          </div>
        </div>

        {/* Table of Records */}
        <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#f7f9fc] text-[#5c6f83] text-xs font-bold border-b border-[#dfe6ee]">
                <th className="p-3">Date / Time</th>
                <th className="p-3">DO Number</th>
                <th className="p-3">Customer (TO)</th>
                <th className="p-3">Items / Modules Included</th>
                <th className="p-3">Model & Variant</th>
                <th className="p-3">Batch</th>
                <th className="p-3 text-center">Total Qty</th>
                <th className="p-3">PIC / Receiver</th>
                <th className="p-3 text-center">Delivery Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9eef3] text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-[#65768a]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Truck size={32} className="text-gray-300" />
                      <p className="font-semibold text-gray-600">No Delivery Orders found.</p>
                      <p className="text-xs text-gray-400">
                        Create a Delivery Order above to log finished goods shipments to PEPS-JV VA.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isMultiItem = tx.doItems && tx.doItems.length > 0;
                  const totalItems = isMultiItem ? tx.doItems!.length : 1;

                  return (
                    <tr key={tx.id} className="hover:bg-[#fcfdfd] transition">
                      <td className="p-3 font-mono text-[#42566c] text-[11px] whitespace-nowrap">
                        {tx.time}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#18324d] whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded">
                          {tx.doNo || tx.ref}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-[#18324d]">
                        <div>PEPS-JV MELAKA SDN. BHD.</div>
                        <div className="text-[10px] text-gray-500 font-normal">
                          Vehicle Assembly (VA)
                        </div>
                      </td>
                      <td className="p-3">
                        {isMultiItem ? (
                          <div>
                            <span className="font-bold text-[#18324d] block">
                              {totalItems} FG Line Items
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {tx
                                .doItems!.slice(0, 3)
                                .map((i) => i.module)
                                .filter(Boolean)
                                .join(", ")}
                              {totalItems > 3 ? "..." : ""}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-[#18324d] font-mono">{tx.code}</div>
                            <div className="text-[10px] text-gray-500 truncate max-w-[180px]">
                              {tx.desc}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-[#18324d]">{tx.model || "WEY G9 HEV"}</span>
                        {tx.variant && (
                          <span className="ml-1.5 px-1.5 py-0.2 bg-gray-100 text-gray-700 text-[10px] font-mono rounded">
                            {tx.variant}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[#18324d] font-semibold">
                        {tx.batchNo || "MYH6003"}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-extrabold text-sm bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">
                          {tx.qty} <span className="text-[10px] font-normal">pcs</span>
                        </span>
                      </td>
                      <td className="p-3 text-[11px]">
                        <div className="font-semibold text-[#18324d]">
                          {tx.pic || tx.receiverName || "AKMAL (017-647 6682)"}
                        </div>
                        <div className="text-gray-400">By: {tx.user}</div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingSlipTx(tx)}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-[#2463a6] border border-[#2463a6]/40 hover:border-[#2463a6] rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                            title="View and print official KB Teknik Delivery Order matching photo"
                          >
                            <FileText size={13} /> View DO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDO(tx)}
                            className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 hover:border-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                            title="Edit this Delivery Order manually"
                          >
                            <Edit size={12} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE DELIVERY ORDER (DO) MODAL — MATCHING THE PHOTO */}
      {isDOModalOpen && (
        <div className="fixed inset-0 bg-[#07182b]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-[#dfe6ee] max-h-[94vh] flex flex-col space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#dfe6ee] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#2463a6]/10 text-[#2463a6] rounded-xl">
                  {editingTxId ? <Edit size={22} className="text-amber-600" /> : <FileText size={22} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#18324d] flex items-center gap-2">
                    <span>
                      {editingTxId
                        ? `Edit Delivery Order (DO) — ${doNo || "Manual Edit"}`
                        : "Create Delivery Order (DO) — KB Teknik (Melaka)"}
                    </span>
                    {editingTxId && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-md uppercase">
                        Editing Mode
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[#65768a]">
                    {editingTxId
                      ? "Modify customer, model, variant, part numbers, description, or quantities manually"
                      : "Prepare official delivery shipment to PEPS-JV Melaka (Vehicle Assembly - VA)"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToPhotoValues}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Reset fields to match photo: KBTM-21/10/2026-0002, WEY G9 HEV M81, Total 62 pcs"
                >
                  <Copy size={13} /> Load Photo Defaults (62 pcs)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDOModalOpen(false);
                    setEditingTxId(null);
                  }}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSubmitDeliveryOrder} className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
              {/* Header Details Grid: Customer & Document Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#f8fafc] border border-gray-200 rounded-xl p-4">
                {/* Left: Recipient (TO) */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-[#18324d] uppercase tracking-wider flex items-center justify-between">
                    <span>1. Customer / Recipient (TO)</span>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-semibold mb-0.5">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="PEPS-JV MELAKA SDN. BHD."
                      className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-bold text-[#18324d] bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-semibold mb-0.5">
                      Delivery Destination & Address *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="VEHICLE ASSEMBLY (VA)..."
                      className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-medium text-[#18324d] bg-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-semibold mb-0.5">
                      Person In Charge (PIC) *
                    </label>
                    <input
                      type="text"
                      required
                      value={picInfo}
                      onChange={(e) => setPicInfo(e.target.value)}
                      placeholder="AKMAL (017-647 6682)"
                      className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-bold text-[#18324d] bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                    />
                  </div>
                </div>

                {/* Right: DO Number, Date, Batch, Model, Variant */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-[#18324d] uppercase tracking-wider flex items-center justify-between">
                    <span>2. Document & Vehicle Platform</span>
                    <button
                      type="button"
                      onClick={handleAutoGenerateDONo}
                      className="text-[10px] text-[#2463a6] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RefreshCw size={10} /> Fresh DO No
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-600 font-semibold mb-0.5">DO Number *</label>
                      <input
                        type="text"
                        required
                        value={doNo}
                        onChange={(e) => setDoNo(e.target.value)}
                        placeholder="KBTM-21/10/2026-0002"
                        className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-mono font-bold text-[#18324d] bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-semibold mb-0.5">Batch / Lot *</label>
                      <input
                        type="text"
                        required
                        value={batchNo}
                        onChange={(e) => setBatchNo(e.target.value)}
                        placeholder="MYH6003"
                        className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-mono font-bold text-[#18324d] bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-600 font-semibold mb-0.5">Date *</label>
                      <input
                        type="text"
                        required
                        value={doDate}
                        onChange={(e) => setDoDate(e.target.value)}
                        placeholder="21/10/2026"
                        className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-mono text-[#18324d] bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-semibold mb-0.5">Time *</label>
                      <input
                        type="text"
                        required
                        value={doTime}
                        onChange={(e) => setDoTime(e.target.value)}
                        placeholder="3.20PM"
                        className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-mono text-[#18324d] bg-white focus:outline-none focus:ring-2 focus:ring-[#2463a6]"
                      />
                    </div>
                  </div>

                  {/* Manual Editable Vehicle Model & Variant */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-gray-600 font-semibold">Vehicle Model *</label>
                        <span className="text-[10px] text-blue-600 font-semibold">Manual Input</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          list="vehicle-model-suggestions"
                          required
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          placeholder="e.g. WEY G9 HEV"
                          className="w-full px-3 py-1.5 border-2 border-blue-200 focus:border-[#2463a6] rounded-lg font-bold text-[#18324d] bg-white focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                        />
                        <datalist id="vehicle-model-suggestions">
                          <option value="WEY G9 HEV" />
                          <option value="HAVAL H6 HEV" />
                          <option value="ORA GOOD CAT" />
                          <option value="TANK 300" />
                          <option value="TANK 500" />
                          <option value="Civic FD" />
                          <option value="Civic FC" />
                          <option value="CR-V Gen 5" />
                          <option value="City GN" />
                          <option value="HR-V" />
                          <option value="Accord" />
                          <option value="Universal" />
                          {Array.from(new Set(items.map((i) => i.model).filter(Boolean))).map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-gray-600 font-semibold">Variant *</label>
                        <span className="text-[10px] text-blue-600 font-semibold">Manual Input</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          list="variant-suggestions"
                          required
                          value={vehicleVariant}
                          onChange={(e) => setVehicleVariant(e.target.value)}
                          placeholder="e.g. M81"
                          className="w-full px-3 py-1.5 border-2 border-blue-200 focus:border-[#2463a6] rounded-lg font-mono font-bold text-[#18324d] bg-white focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                        />
                        <datalist id="variant-suggestions">
                          <option value="M81" />
                          <option value="Standard" />
                          <option value="Premium" />
                          <option value="Ultra" />
                          <option value="Base" />
                          <option value="High Spec" />
                        </datalist>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Line Items Table (Fully Editable Manually: Add, Delete, Edit Part #, Desc, Module, Qty) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-[#18324d] uppercase tracking-wider flex items-center gap-2">
                      <span>3. Delivery Order Line Items ({doItems.length} Assemblies)</span>
                      <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 normal-case">
                        Manual Editing Enabled
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-blue-800 font-bold mr-2">
                      Total Qty: <strong className="font-mono text-sm">{totalDOQuantity} pcs</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-2.5 py-1 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                      title="Add a new line item row to this Delivery Order"
                    >
                      <Plus size={13} /> Add Line Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoItems(PHOTO_DO_ITEMS.map((it) => ({ ...it })))}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      title="Reset rows to standard 7 photo assemblies (62 pcs)"
                    >
                      <RotateCcw size={12} /> Reset 7 Photo Items
                    </button>
                    {doItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllLineItems}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        title="Clear all rows to type custom parts from scratch"
                      >
                        <Trash2 size={12} /> Clear All
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto border border-[#dfe6ee] rounded-xl shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f0f4f9] text-[#18324d] font-bold border-b border-[#dfe6ee]">
                        <th className="p-2.5 text-center w-14">BIL.</th>
                        <th className="p-2.5 w-56">PART NUMBER</th>
                        <th className="p-2.5">DESCRIPTION</th>
                        <th className="p-2.5 w-36">MODULE</th>
                        <th className="p-2.5 text-center w-28">QUANTITY</th>
                        <th className="p-2.5 text-center w-12">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dfe6ee]">
                      {doItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500 bg-gray-50/50">
                            <div className="space-y-2">
                              <p className="font-semibold text-gray-600">No line items in this Delivery Order yet.</p>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleAddLineItem}
                                  className="px-3 py-1.5 bg-[#2463a6] text-white rounded-lg font-semibold hover:bg-[#1d4f85] flex items-center gap-1 text-xs cursor-pointer"
                                >
                                  <Plus size={13} /> Add First Item
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDoItems(PHOTO_DO_ITEMS.map((it) => ({ ...it })))}
                                  className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold hover:bg-amber-200 flex items-center gap-1 text-xs cursor-pointer"
                                >
                                  <RotateCcw size={12} /> Load Photo 7 Items
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        doItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition">
                            {/* BIL (Editable number) */}
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.bil}
                                onChange={(e) => {
                                  const next = [...doItems];
                                  next[idx].bil = Number(e.target.value) || idx + 1;
                                  setDoItems(next);
                                }}
                                className="w-12 px-1 py-1 text-center font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                              />
                            </td>

                            {/* PART NUMBER (Editable input with datalist from catalog) */}
                            <td className="p-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  list={`part-options-${idx}`}
                                  value={item.code}
                                  onChange={(e) => handlePartCodeChange(idx, e.target.value)}
                                  placeholder="e.g. 5305MA170001AZJL"
                                  className="w-full px-2.5 py-1.5 border border-gray-300 focus:border-[#2463a6] rounded font-mono font-bold text-[#18324d] bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                                />
                                <datalist id={`part-options-${idx}`}>
                                  {PHOTO_DO_ITEMS.map((p) => (
                                    <option key={p.code} value={p.code}>
                                      {p.desc} ({p.module})
                                    </option>
                                  ))}
                                  {items.map((it) => (
                                    <option key={it.code} value={it.code}>
                                      {it.desc}
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                            </td>

                            {/* DESCRIPTION (Fully editable) */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.desc}
                                onChange={(e) => {
                                  const next = [...doItems];
                                  next[idx].desc = e.target.value;
                                  setDoItems(next);
                                }}
                                placeholder="e.g. CONSOLE SUB-ASSY (Local)"
                                className="w-full px-2.5 py-1.5 border border-gray-300 focus:border-[#2463a6] rounded text-[#18324d] font-medium bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                              />
                            </td>

                            {/* MODULE (Editable dropdown) */}
                            <td className="p-2">
                              <select
                                value={item.module}
                                onChange={(e) => {
                                  const next = [...doItems];
                                  next[idx].module = e.target.value as FGModuleKey;
                                  setDoItems(next);
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 focus:border-[#2463a6] rounded bg-white font-semibold text-[#18324d] text-xs focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                              >
                                <option value="Center Console">Center Console</option>
                                <option value="Door Trim">Door Trim</option>
                                <option value="IP">IP</option>
                                <option value="Cooling Module">Cooling Module</option>
                                <option value="Custom">Custom / Other</option>
                              </select>
                            </td>

                            {/* QUANTITY (Editable number) */}
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.qty}
                                onChange={(e) => {
                                  const next = [...doItems];
                                  next[idx].qty = e.target.value === "" ? 0 : Number(e.target.value);
                                  setDoItems(next);
                                }}
                                className="w-20 px-2 py-1.5 border-2 border-blue-300 focus:border-blue-600 rounded font-mono font-bold text-center text-[#18324d] bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            {/* ACTION: DELETE ROW */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title={`Remove line item #${item.bil}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {doItems.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#f8fafc] font-bold border-t-2 border-[#18324d]">
                          <td colSpan={2} className="p-2.5">
                            <button
                              type="button"
                              onClick={handleAddLineItem}
                              className="text-xs text-[#2463a6] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={13} /> Add another line item...
                            </button>
                          </td>
                          <td colSpan={2} className="p-2.5 text-right text-[#18324d] uppercase font-mono">
                            TOTAL QUANTITY:
                          </td>
                          <td className="p-2.5 text-center font-mono text-base font-extrabold text-blue-800">
                            {totalDOQuantity}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Dispatcher Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <div>
                  <label className="block text-gray-600 font-semibold mb-0.5">
                    Dispatched / Prepared By (KB Teknik Clerk) *
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatcherName}
                    onChange={(e) => setDispatcherName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#cfd9e4] rounded-lg font-semibold text-[#18324d] bg-white focus:outline-none focus:ring-1 focus:ring-[#2463a6]"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-semibold mb-0.5">
                    Originating Factory / Warehouse *
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="KB TEKNIK (MELAKA) SDN. BHD. - PT 2230 Jalan Hicom Pegoh 7"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 bg-gray-50 text-[11px]"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#dfe6ee] flex items-center justify-between shrink-0">
                <span className="text-gray-500 text-[11px]">
                  Official document: <strong>KB TEKNIK DELIVERY ORDER</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDOModalOpen(false);
                      setEditingTxId(null);
                    }}
                    className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
                  >
                    {editingTxId ? (
                      <>
                        <CheckCircle2 size={15} /> Save Changes ({totalDOQuantity} pcs)
                      </>
                    ) : (
                      <>
                        <Truck size={15} /> Confirm & Dispatch Delivery Order ({totalDOQuantity} pcs)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL DELIVERY ORDER SLIP / DOCUMENT MODAL (1:1 REPLICA OF THE PHOTO) */}
      {viewingSlipTx && (
        <div className="fixed inset-0 bg-[#07182b]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#dfe6ee] my-6 flex flex-col space-y-4">
            {/* Modal Control Header (Hidden when printing) */}
            <div className="flex items-center justify-between border-b border-[#dfe6ee] pb-3 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-[#2463a6]" />
                <h3 className="text-base font-bold text-[#18324d]">
                  Official Delivery Order (KB Teknik → PEPS-JV VA)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingSlipTx;
                    setViewingSlipTx(null);
                    handleOpenEditDO(toEdit);
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Edit this delivery order manually"
                >
                  <Edit size={13} /> Edit DO
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSingleDOXLSX(viewingSlipTx)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileSpreadsheet size={13} /> Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                >
                  <Printer size={13} /> Print DO (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSlipTx(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* THE PRINTABLE DELIVERY ORDER DOCUMENT — EXACT PHOTO REPLICA */}
            <div
              id="kb-delivery-order-print-area"
              className="bg-white border-2 border-black p-8 font-sans text-black max-w-2xl mx-auto shadow-xs print:border-none print:shadow-none print:p-0 print:m-0 w-full"
            >
              {/* Header with Company Logo and Name */}
              <div className="flex justify-between items-start mb-4">
                {/* Logo & Company Info */}
                <div className="flex items-start gap-3">
                  {/* KB Teknik Polygon Logo (as in photo) */}
                  <svg
                    className="w-8 h-8 shrink-0 text-black mt-0.5"
                    viewBox="0 0 100 100"
                    fill="currentColor"
                  >
                    <polygon points="15,20 45,20 75,50 45,80 15,80 45,50" />
                    <polygon points="55,20 85,20 100,35 70,35" />
                  </svg>
                  <div>
                    <h1 className="text-xl font-black tracking-tight leading-none text-black">
                      KB Teknik
                    </h1>
                  </div>
                </div>

                {/* Company Registered Address (Right aligned, exactly like photo) */}
                <div className="text-right text-[10px] leading-tight text-black max-w-[260px]">
                  <div className="font-bold text-[11px]">KB TEKNIK (MELAKA) SDN. BHD.</div>
                  <div>No. 2, Lot. 3684, Jalan Industri 23,</div>
                  <div>Kawasan Perindustrian Kelemak,</div>
                  <div>Mukim Kelemak,</div>
                  <div>78000, Alor Gajah, Melaka</div>
                </div>
              </div>

              {/* DELIVERY ORDER Centered Boxed Title (Exact match to photo) */}
              <div className="text-center my-4">
                <div className="inline-block border border-black px-6 py-1 font-bold tracking-wider text-xs uppercase">
                  DELIVERY ORDER
                </div>
              </div>

              {/* Two-Column Details Header */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                {/* Left Column: TO (Customer) & PIC */}
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="w-12 font-bold shrink-0">TO :</span>
                    <div className="leading-snug">
                      <div className="font-bold">PEPS-JV MELAKA SDN. BHD.</div>
                      <div className="font-bold">VEHICLE ASSEMBLY (VA),</div>
                      <div>JALAN HICOM PEGOH 7,</div>
                      <div>78000 ALOR GAJAH</div>
                      <div>MELAKA</div>
                    </div>
                  </div>

                  <div className="flex items-start pt-1">
                    <span className="w-12 font-bold shrink-0">PIC :</span>
                    <div className="font-bold">{viewingSlipTx.pic || "AKMAL (017-647 6682)"}</div>
                  </div>
                </div>

                {/* Right Column: DO NO, DATE, TIME, BATCH */}
                <div className="flex flex-col items-end">
                  <div className="space-y-1 text-right text-xs">
                    <div className="flex justify-end gap-2">
                      <span className="font-bold">DO NO. :</span>
                      <span className="font-bold font-mono">
                        {viewingSlipTx.doNo || viewingSlipTx.ref}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <span className="font-bold">DATE :</span>
                      <span className="font-mono">{doDate || formatDODate()}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <span className="font-bold">TIME :</span>
                      <span className="font-mono">{doTime || "3.20PM"}</span>
                    </div>
                    <div className="flex justify-end gap-2 pt-3">
                      <span className="font-bold">BATCH :</span>
                      <span className="font-bold font-mono">
                        {viewingSlipTx.batchNo || "MYH6003"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* The Delivery Order Items Table (Exact Photo Columns & Borders) */}
              <div className="border border-black mb-4">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black font-bold">
                      <th className="border-r border-black py-1.5 px-2 text-center w-12">BIL.</th>
                      <th className="border-r border-black py-1.5 px-3 text-center w-48">
                        PART NUMBER
                      </th>
                      <th className="border-r border-black py-1.5 px-3 text-center">DESCRIPTION</th>
                      <th className="py-1.5 px-3 text-center w-20">QTY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingSlipTx.doItems && viewingSlipTx.doItems.length > 0
                      ? viewingSlipTx.doItems
                      : PHOTO_DO_ITEMS
                    ).map((itm) => (
                      <tr key={itm.bil} className="border-b border-black/40">
                        <td className="border-r border-black py-1 px-2 text-center">{itm.bil}</td>
                        <td className="border-r border-black py-1 px-3 font-mono font-medium text-center">
                          {itm.code}
                        </td>
                        <td className="border-r border-black py-1 px-3 uppercase text-center font-medium">
                          {itm.desc}
                        </td>
                        <td className="py-1 px-3 text-center font-mono font-bold">{itm.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* REMARKS Box & TOTAL Row (Exact match to photo) */}
              <div className="flex justify-between items-end mb-6 text-xs">
                {/* Remarks Table: MODEL & VARIANT */}
                <div className="w-64 border border-black text-center">
                  <div className="border-b border-black font-bold py-0.5 uppercase text-[11px]">
                    REMARKS
                  </div>
                  <div className="grid grid-cols-2 border-b border-black/50 py-0.5">
                    <span className="border-r border-black/50 font-bold">MODEL</span>
                    <span className="font-bold">{viewingSlipTx.model || "WEY G9 HEV"}</span>
                  </div>
                  <div className="grid grid-cols-2 py-0.5">
                    <span className="border-r border-black/50 font-bold">VARIANT</span>
                    <span className="font-bold font-mono">
                      {viewingSlipTx.variant || "M81"}
                    </span>
                  </div>
                </div>

                {/* TOTAL */}
                <div className="border border-black px-6 py-1.5 font-bold font-mono text-sm">
                  TOTAL :{" "}
                  <span className="ml-4 font-black">
                    {viewingSlipTx.doItems && viewingSlipTx.doItems.length > 0
                      ? viewingSlipTx.doItems.reduce((s, i) => s + i.qty, 0)
                      : viewingSlipTx.qty || 62}
                  </span>
                </div>
              </div>

              {/* Bottom Footer Company Registration & Signatures */}
              <div className="pt-4 border-t border-black/40 text-[11px] flex justify-between items-end">
                <div>
                  <div className="font-bold">KB Teknik Sdn Bhd (198801001857)</div>
                  <div className="text-[10px] text-gray-700">
                    PT 2230, Jalan Hicom Pegoh 7, 78000 Alor Gajah, Melaka
                  </div>
                </div>

                {/* Signatures / Chop */}
                <div className="flex gap-8 text-center text-[10px]">
                  <div>
                    <div className="h-10 border-b border-black w-28"></div>
                    <div className="mt-1 font-bold">Issued By (KB Teknik)</div>
                  </div>
                  <div>
                    <div className="h-10 border-b border-black w-28"></div>
                    <div className="mt-1 font-bold">Received By (PEPS-JV VA)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-[#dfe6ee] shrink-0 print:hidden">
              <span className="text-xs text-gray-500">
                Official DO Ref: <strong>{viewingSlipTx.doNo || viewingSlipTx.ref}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingSlipTx(null)}
                  className="px-4 py-2 border border-[#cfd9e4] rounded-xl text-xs font-semibold text-[#18324d] hover:bg-[#f7f9fc] transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#2463a6] hover:bg-[#1d4f85] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Print Delivery Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
