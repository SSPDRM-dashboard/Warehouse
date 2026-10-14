import { UserAccount } from "./types";

export const defaultUsers: UserAccount[] = [
  { id: "usr_1", username: "admin", password: "password123", name: "System Administrator", role: "Admin" },
  { id: "usr_2", username: "manager", password: "password123", name: "Warehouse Manager", role: "Manager" },
  { id: "usr_3", username: "operator", password: "password123", name: "Floor Operator (WH001)", role: "User" }
];
