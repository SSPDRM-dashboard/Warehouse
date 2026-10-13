import { Item, Balance, Transaction } from "./types";

export const seedItems: Item[] = [
  { model: "Civic FD 2.0", code: "PN-1001", desc: "Engine Mounting Bracket", category: "Automotive Parts", uom: "PCS", min: 50, active: true },
  { model: "Universal", code: "PN-1002", desc: "Returnable Plastic Case", category: "Packaging", uom: "UNIT", min: 20, active: true },
  { model: "Line-A Assembly", code: "PN-1003", desc: "Steel Component Tray", category: "Packaging", uom: "PCS", min: 30, active: true },
  { model: "Civic FC 1.5T", code: "PN-1004", desc: "Protective Cover", category: "Automotive Parts", uom: "PCS", min: 25, active: false },
  { model: "CR-V Gen 5", code: "PN-1005", desc: "Precision Bearing Assembly", category: "Spare Parts", uom: "SET", min: 15, active: true },
  { model: "Workshop General", code: "PN-1006", desc: "Hydraulic Fluid (20L)", category: "Consumables", uom: "LITRE", min: 40, active: true }
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
    id: "RCV-20261013-001",
    type: "Receiving",
    code: "PN-1001",
    desc: "Engine Mounting Bracket",
    qty: 50,
    source: "Supplier",
    dest: "A-01-01",
    ref: "DO-8021",
    user: "WH001",
    time: "2026-10-13 09:20",
    status: "Posted"
  },
  {
    id: "ISS-20261013-002",
    type: "Production Issue",
    code: "PN-1002",
    desc: "Returnable Plastic Case",
    qty: 10,
    source: "B-02-01",
    dest: "Production Line 1",
    ref: "PROD-2401",
    user: "ADMIN-DEMO",
    time: "2026-10-13 10:15",
    status: "Posted"
  }
];
