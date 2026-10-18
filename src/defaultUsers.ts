import { UserAccount } from "./types";

export const defaultUsers: UserAccount[] = [
  { id: "usr_1", username: "admin", password: "password123", name: "System Administrator", role: "Admin" },
  { id: "usr_2", username: "receiving", password: "password123", name: "Azlan (Receiving Dock)", role: "Receiving" },
  { id: "usr_3", username: "storage", password: "password123", name: "Farhan (Storage & Racking)", role: "Storage" },
  { id: "usr_4", username: "forklift", password: "password123", name: "Hazim (Forklift Fleet #2)", role: "Forklift" },
  { id: "usr_5", username: "kitting", password: "password123", name: "Siti (Kitting Marshall)", role: "Kitting" },
  { id: "usr_6", username: "manager", password: "password123", name: "Warehouse Manager", role: "Manager" },
  { id: "usr_7", username: "operator", password: "password123", name: "Floor Operator (WH001)", role: "User" }
];
