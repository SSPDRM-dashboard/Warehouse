export type Role = "Admin" | "Manager" | "User";

export type Page = "dashboard" | "items" | "receiving" | "issue" | "return" | "inventory" | "history" | "ai_forecast" | "settings";

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
  desc: string;
  category: string;
  uom: string;
  min: number;
  active: boolean;
}

export interface Balance {
  code: string; // Part No
  loc: string;
  qty: number;
}

export interface Transaction {
  id: string;
  type: "Receiving" | "Production Issue" | "Stock Return" | "Opening Stock" | "Adjustment" | "Transfer";
  code: string; // Part No
  desc?: string;
  qty: number;
  source: string;
  dest: string;
  ref: string;
  user: string;
  time: string;
  status: "Posted" | "Pending" | "Cancelled";
}
