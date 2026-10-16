import { Item, Balance, Transaction } from "./types";

export const seedItems: Item[] = [
  { model: "Civic FD 2.0", code: "PN-1001", desc: "Engine Mounting Bracket", min: 50, active: true },
  { model: "Universal", code: "PN-1002", desc: "Returnable Plastic Case", min: 20, active: true },
  { model: "Line-A Assembly", code: "PN-1003", desc: "Steel Component Tray", min: 30, active: true },
  { model: "Civic FC 1.5T", code: "PN-1004", desc: "Protective Cover", min: 25, active: false },
  { model: "CR-V Gen 5", code: "PN-1005", desc: "Precision Bearing Assembly", min: 15, active: true },
  { model: "Workshop General", code: "PN-1006", desc: "Hydraulic Fluid (20L)", min: 40, active: true }
];

export const initialBalances: Balance[] = [
  { code: "PN-1001", loc: "A-01-01", qty: 240 },
  { code: "PN-1002", loc: "B-02-01", qty: 86 },
  { code: "PN-1003", loc: "C-01-02", qty: 18 },
  { code: "PN-1005", loc: "A-03-01", qty: 12 },
  { code: "PN-1006", loc: "D-01-01", qty: 120 }
];

export const initialTransactions: Transaction[] = [
  {
    id: "RCV-20261014-001",
    type: "Receiving",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
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
    time: "2026-10-14 08:30",
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
    time: "2026-10-14 09:45",
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
    time: "2026-10-14 11:10",
    status: "Posted"
  },
  {
    id: "RCV-20261013-001",
    type: "Receiving",
    code: "PN-1001",
    partName: "Engine Mounting Bracket",
    desc: "Engine Mounting Bracket",
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
    time: "2026-10-13 09:20",
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
    time: "2026-10-13 10:15",
    status: "Posted"
  }
];
