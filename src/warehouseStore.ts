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

/**
 * Recursively strips all `undefined` values from an object or array.
 * Firestore rejects documents containing `undefined` as a field value.
 */
export function cleanForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }

  // 1. Convert undefined values in objects/arrays cleanly via JSON serialization
  const jsonString = JSON.stringify(data, (_key, val) => {
    if (typeof val === "undefined") {
      return undefined; // in objects this omits the property
    }
    return val;
  });

  if (!jsonString) return null;
  const parsed = JSON.parse(jsonString);

  // 2. Deep clean arrays and objects to purge any remaining nulls or undefined values in arrays
  function removeUndefined(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
      return obj
        .filter((item) => item !== undefined)
        .map((item) => removeUndefined(item));
    }
    if (typeof obj === "object") {
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
          res[k] = removeUndefined(v);
        }
      }
      return res;
    }
    return obj;
  }

  return removeUndefined(parsed);
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

          await setDoc(docRef, cleanForFirestore(initialData));
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
    const firestoreData = cleanForFirestore(payload);
    await setDoc(docRef, firestoreData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${STATE_COLLECTION}/${STATE_DOC}`);
  }
}
