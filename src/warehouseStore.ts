import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, testConnection } from "./firebase";
import { Item, Balance, Transaction, UserAccount } from "./types";
import { seedItems, initialBalances, initialTransactions } from "./mockData";
import { defaultUsers } from "./defaultUsers";

const STATE_COLLECTION = "warehouse";
const STATE_DOC = "state";

export interface WarehouseStateData {
  items: Item[];
  balances: Balance[];
  transactions: Transaction[];
  users: UserAccount[];
  updatedAt: string;
  sourceDevice?: string;
  version: number;
}

// Device detection helper
export function getDeviceInfo(): string {
  if (typeof window === "undefined" || !window.navigator) return "Unknown Device";
  const ua = window.navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (isMobile) {
    if (/iPhone|iPad|iPod/i.test(ua)) return "Mobile (iPhone)";
    if (/Android/i.test(ua)) return "Mobile (Android Handphone)";
    return "Mobile Handphone";
  }
  return "Desktop / Workstation";
}

// Subscribes to real-time warehouse data changes from Firestore
export function subscribeToWarehouseState(
  onData: (data: WarehouseStateData) => void,
  onError?: (err: unknown) => void
): () => void {
  const docRef = doc(db, STATE_COLLECTION, STATE_DOC);

  // Test connection on startup
  testConnection();

  const unsubscribe = onSnapshot(
    docRef,
    async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<WarehouseStateData>;
          const cleanData: WarehouseStateData = {
            items: Array.isArray(data.items) ? data.items : seedItems,
            balances: Array.isArray(data.balances) ? data.balances : initialBalances,
            transactions: Array.isArray(data.transactions) ? data.transactions : initialTransactions,
            users: Array.isArray(data.users) && data.users.length ? data.users : defaultUsers,
            updatedAt: data.updatedAt || new Date().toISOString(),
            sourceDevice: data.sourceDevice || "Cloud",
            version: typeof data.version === "number" ? data.version : 1,
          };

          // Save local backup
          try {
            localStorage.setItem("wh_items", JSON.stringify(cleanData.items));
            localStorage.setItem("wh_balances", JSON.stringify(cleanData.balances));
            localStorage.setItem("wh_transactions", JSON.stringify(cleanData.transactions));
            localStorage.setItem("wh_users", JSON.stringify(cleanData.users));
          } catch (e) {
            console.warn("Could not save to localStorage", e);
          }

          onData(cleanData);
        } else {
          // Document does not exist yet: initialize with seed data
          console.log("Initializing Cloud Firestore warehouse database...");
          const initialData: WarehouseStateData = {
            items: seedItems,
            balances: initialBalances,
            transactions: initialTransactions,
            users: defaultUsers,
            updatedAt: new Date().toISOString(),
            sourceDevice: getDeviceInfo(),
            version: 1,
          };

          await setDoc(docRef, initialData);
          onData(initialData);
        }
      } catch (err) {
        console.error("Error processing warehouse snapshot:", err);
        if (onError) onError(err);
      }
    },
    (error) => {
      console.error("Firestore onSnapshot error:", error);
      handleFirestoreError(error, OperationType.GET, `${STATE_COLLECTION}/${STATE_DOC}`);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

// Saves warehouse state to Firestore so all handphones and computers sync immediately
export async function pushWarehouseStateToCloud(
  items: Item[],
  balances: Balance[],
  transactions: Transaction[],
  users: UserAccount[]
): Promise<void> {
  const docRef = doc(db, STATE_COLLECTION, STATE_DOC);
  const payload: WarehouseStateData = {
    items,
    balances,
    transactions,
    users,
    updatedAt: new Date().toISOString(),
    sourceDevice: getDeviceInfo(),
    version: Date.now(),
  };

  // Always save to localStorage first so local operations are never blocked
  try {
    localStorage.setItem("wh_items", JSON.stringify(items));
    localStorage.setItem("wh_balances", JSON.stringify(balances));
    localStorage.setItem("wh_transactions", JSON.stringify(transactions));
    localStorage.setItem("wh_users", JSON.stringify(users));
  } catch {
    // ignore quota issues
  }

  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${STATE_COLLECTION}/${STATE_DOC}`);
  }
}
