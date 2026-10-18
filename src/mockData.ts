import { Item, Balance, Transaction } from "./types";

const getTodayDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const curToday = getTodayDateString();

export const seedItems: Item[] = [
  { model: "Civic FD 2.0", code: "PN-1001", desc: "Engine Mounting Bracket", min: 50, active: true },
  { model: "Universal", code: "PN-1002", desc: "Returnable Plastic Case", min: 20, active: true },
  { model: "Line-A Assembly", code: "PN-1003", desc: "Steel Component Tray", min: 30, active: true },
  { model: "Civic FC 1.5T", code: "PN-1004", desc: "Protective Cover", min: 25, active: false },
  { model: "CR-V Gen 5", code: "PN-1005", desc: "Precision Bearing Assembly", min: 15, active: true },
  { model: "Workshop General", code: "PN-1006", desc: "Hydraulic Fluid (20L)", min: 40, active: true }
];

export const initialBalances: Balance[] = [
  { code: "PN-1001", loc: "A-01-01", qty: 240, timestamp: `${curToday} 08:30:00`, batchNo: "BATCH-202610-16A", caseNo: "CASE-01" },
  { code: "PN-1002", loc: "B-02-01", qty: 186, timestamp: `${curToday} 09:15:00`, batchNo: "BATCH-202610-16A", caseNo: "CASE-02" },
  { code: "PN-1003", loc: "C-01-02", qty: 150, timestamp: `${curToday} 10:40:00`, batchNo: "BATCH-202610-16B", caseNo: "CASE-03" },
  { code: "PN-1005", loc: "A-03-01", qty: 12, timestamp: "2026-10-14 11:20:00", batchNo: "BATCH-202610-01", caseNo: "CASE-04" },
  { code: "PN-1006", loc: "D-01-01", qty: 120, timestamp: "2026-10-14 13:45:00", batchNo: "LOT-2026-09B", caseNo: "CASE-05" }
];

export const initialTransactions: Transaction[] = [
  // Today's incoming shipments
  {
    id: `RCV-${curToday.replace(/-/g, "")}-001`,
    type: "Receiving",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
    containerNo: "CONT-88219",
    batchNo: "BATCH-202610-16A",
    caseNo: "CASE-01",
    qty: 80,
    source: "Supplier (Honda Auto Components)",
    dest: "KITTING-STATION",
    ref: "DO-MY-88910",
    user: "receiving",
    receiverName: "Azlan (Receiving Dock)",
    unpacked: false,
    confirmedFromKittingCase: true,
    time: `${curToday} 08:30:00`,
    status: "Posted"
  },
  {
    id: `RCV-${curToday.replace(/-/g, "")}-002`,
    type: "Receiving",
    code: "PN-1002",
    partName: "Returnable Plastic Case",
    desc: "Returnable Plastic Case",
    containerNo: "CONT-88219",
    batchNo: "BATCH-202610-16A",
    caseNo: "CASE-02",
    qty: 120,
    source: "Supplier (Sanwa Logistics)",
    dest: "KITTING-STATION",
    ref: "DO-MY-88910",
    user: "receiving",
    receiverName: "Azlan (Receiving Dock)",
    unpacked: false,
    confirmedFromKittingCase: true,
    time: `${curToday} 09:15:00`,
    status: "Posted"
  },
  {
    id: `RCV-${curToday.replace(/-/g, "")}-003`,
    type: "Receiving",
    code: "PN-1003",
    partName: "Steel Component Tray",
    desc: "Steel Component Tray",
    containerNo: "CONT-90432",
    batchNo: "BATCH-202610-16B",
    qty: 150,
    source: "Supplier (Precision Metal Parts)",
    dest: "C-01-02",
    ref: "DO-SUP-9941",
    user: "admin",
    receiverName: "System Administrator",
    unpacked: false,
    time: `${curToday} 10:40:00`,
    status: "Posted"
  },

  // Previous days' shipments
  {
    id: "RCV-20261014-001",
    type: "Receiving",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
    containerNo: "CONT-76102",
    batchNo: "BATCH-202610-01",
    qty: 60,
    source: "Supplier (Honda Auto)",
    dest: "A-01-01",
    ref: "DO-9055",
    user: "WH001",
    receiverName: "Ahmad Zaki",
    unpacked: true,
    unpackedByName: "Tan Wei Lun",
    unpackDate: "2026-10-14",
    time: "2026-10-14 08:30:00",
    status: "Posted"
  },
  {
    id: "ISS-20261014-002",
    type: "Production Issue",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
    batchNo: "BATCH-202610-01",
    qty: 24,
    source: "A-01-01",
    dest: "Production Line 1",
    ref: "WO-20261014-01",
    user: "MGR-DEMO",
    receiverName: "Line 1 Supervisor (K. Lee)",
    time: "2026-10-14 09:45:00",
    status: "Posted"
  },
  {
    id: "RET-20261014-003",
    type: "Stock Return",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
    batchNo: "BATCH-202610-01",
    qty: 4,
    source: "Production Line 1",
    dest: "A-01-01",
    ref: "RET-2401",
    user: "WH001",
    receiverName: "Ahmad Zaki",
    time: "2026-10-14 11:10:00",
    status: "Posted"
  },
  {
    id: "RCV-20261013-001",
    type: "Receiving",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
    containerNo: "CONT-65401",
    batchNo: "BATCH-202610-A0",
    qty: 50,
    source: "Supplier",
    dest: "A-01-01",
    ref: "DO-8021",
    user: "WH001",
    receiverName: "Siti Rahmah",
    unpacked: true,
    unpackedByName: "Ahmad Zaki",
    unpackDate: "2026-10-13",
    time: "2026-10-13 09:20:00",
    status: "Posted"
  },
  {
    id: "ISS-20261013-002",
    type: "Production Issue",
    code: "PN-1002",
    partName: "Returnable Plastic Case",
    desc: "Returnable Plastic Case",
    batchNo: "LOT-2026-09B",
    qty: 10,
    source: "B-02-01",
    dest: "Production Line 1",
    ref: "PROD-2401",
    user: "ADMIN-DEMO",
    receiverName: "Line 1 Leader",
    time: "2026-10-13 10:15:00",
    status: "Posted"
  }
];
