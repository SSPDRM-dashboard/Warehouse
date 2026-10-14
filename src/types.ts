export type Role = "Admin" | "Manager" | "User";

export type Page =
  | "dashboard"
  | "items"
  | "receiving"
  | "unpack"
  | "issue"
  | "return"
  | "inventory"
  | "history"
  | "reports"
  | "ai_forecast"
  | "settings";

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
}

export interface Item {
  model: string;
  code: string; // Part No
  partName?: string; // Part Name
  desc: string; // Part Name / Description
  category: string;
  uom: string;
  min: number;
  active: boolean;
}

export interface Balance {
  code: string; // Part No
  loc: string;
  qty: number;
  batchNo?: string; // Batch No
}

export interface Transaction {
  id: string;
  type: "Receiving" | "Production Issue" | "Stock Return" | "Opening Stock" | "Adjustment" | "Transfer" | "Unpacking";
  code: string; // Part No
  partName?: string; // Part Name
  desc?: string; // Description
  batchNo?: string; // Batch No / Lot No
  qty: number;
  source: string;
  dest: string;
  ref: string;
  user: string;
  receiverName?: string; // Person/Operator name who received the goods
  unpackedByName?: string; // Person/Operator who unpacked the shipment
  unpacked?: boolean; // Whether goods have been unpacked & verified
  unpackDate?: string; // Date of unpacking
  time: string;
  status: "Posted" | "Pending" | "Cancelled";
}
