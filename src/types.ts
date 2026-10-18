export type Role =
  | "Admin"
  | "Receiving"
  | "Storage"
  | "Forklift"
  | "Kitting"
  | "Manager"
  | "User";

export type Page =
  | "dashboard"
  | "items"
  | "receiving"
  | "unpack"
  | "kitting_case"
  | "issue"
  | "return"
  | "inventory"
  | "history"
  | "reports"
  | "ai_forecast"
  | "settings";

export interface PanelConfig {
  id: Page;
  label: string;
  description: string;
  category: "Operations" | "Inventory" | "Reports & System";
}

export const AVAILABLE_PANELS: PanelConfig[] = [
  { id: "dashboard", label: "Overview & Dashboard", description: "Warehouse KPIs, activity feed and overview metrics", category: "Operations" },
  { id: "items", label: "Item Master / Catalog", description: "Part numbers, descriptions, models and minimum thresholds", category: "Inventory" },
  { id: "receiving", label: "Stock Receiving", description: "New container intake, temporary staged receiving, batch & lot assignment", category: "Operations" },
  { id: "kitting_case", label: "Kitting Case", description: "Forklift batch transfer out from storage to Kitting place with case tracking", category: "Operations" },
  { id: "unpack", label: "Kitting-Unpack", description: "In-transit forklift tracking, kitting batch staging and inspection", category: "Operations" },
  { id: "issue", label: "Send to Production", description: "Issuing parts to production lines, work orders and tracking", category: "Operations" },
  { id: "return", label: "Return from Production", description: "Returning excess or rejected materials back into inventory", category: "Operations" },
  { id: "inventory", label: "Inventory Balance", description: "Stock on hand by part no, location, container and lot timestamp", category: "Inventory" },
  { id: "history", label: "Transaction History", description: "Comprehensive audit trail and material movement logs", category: "Inventory" },
  { id: "reports", label: "Daily Warehouse Reports", description: "Daily incoming container reports, unpack logs and production 1 sheet", category: "Reports & System" },
  { id: "ai_forecast", label: "AI Stock Intelligence", description: "Predictive reorder recommendations and stockout prevention", category: "Reports & System" },
  { id: "settings", label: "User Settings & Access", description: "User credentials, role assignments, and panel access control", category: "Reports & System" },
];

export type RolePermissions = Record<Role, Page[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  Admin: [
    "dashboard",
    "items",
    "receiving",
    "unpack",
    "kitting_case",
    "issue",
    "return",
    "inventory",
    "history",
    "reports",
    "ai_forecast",
    "settings",
  ],
  Receiving: [
    "dashboard",
    "receiving",
    "unpack",
    "kitting_case",
    "inventory",
    "reports",
  ],
  Storage: [
    "dashboard",
    "inventory",
    "items",
    "unpack",
    "kitting_case",
    "return",
    "history",
  ],
  Forklift: [
    "dashboard",
    "unpack",
    "kitting_case",
    "receiving",
    "issue",
    "inventory",
  ],
  Kitting: [
    "dashboard",
    "unpack",
    "kitting_case",
    "issue",
    "return",
    "inventory",
    "reports",
  ],
  Manager: [
    "dashboard",
    "items",
    "receiving",
    "unpack",
    "kitting_case",
    "issue",
    "return",
    "inventory",
    "history",
    "reports",
    "ai_forecast",
  ],
  User: [
    "dashboard",
    "items",
    "receiving",
    "unpack",
    "kitting_case",
    "inventory",
  ],
};

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
  min: number;
  active: boolean;
}

export interface Balance {
  code: string; // Part No
  loc: string;
  qty: number;
  batchNo?: string; // Batch No
  caseNo?: string; // Case No / Packing Case ID
  timestamp?: string; // Last updated timestamp
  updatedAt?: string; // Timestamp
}

export type Transaction = {
  id: string;
  type: 
    | "Receiving" 
    | "Production Issue" 
    | "Stock Return" 
    | "Opening Stock" 
    | "Adjustment" 
    | "Transfer" 
    | "Unpacking" 
    | "Forklift Transfer"
    | "Unpack Log"
    | "Sent to Operation";
  code: string; // Part No
  partName?: string; // Part Name
  desc?: string; // Description
  batchNo?: string; // Batch No / Lot No
  containerNo?: string; // Container No
  caseNo?: string; // Case No
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
  confirmedFromKittingCase?: boolean;
}

export type UnpackStage =
  | "Awaiting Forklift"
  | "Forklift In-Transit"
  | "At Unpacking Bay"
  | "Unpacked & Ready for Operation"
  | "Sent to Operation";

export interface UnpackRecord {
  id: string;
  receivingRef: string;
  code: string;
  desc: string;
  model: string;
  receivedQty: number;
  packagingType: string;
  sourceDock: string;
  unpackBay: string;
  targetOperation: string;
  stage: UnpackStage;
  createdAt: string;
  notes?: string;
  forkliftDriver?: string;
  haulsAt?: string;
  operatorName?: string;
  unpackedQty?: number;
  goodQty?: number;
  damagedQty?: number;
  unpackedAt?: string;
  receiverName?: string;
  carrierMethod?: string;
  sentAt?: string;
  operationDest?: string;
  operationReceiver?: string;
  sentToOperationAt?: string;
}


