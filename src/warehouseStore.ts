import { doc, onSnapshot, setDoc, getDoc, getDocFromServer } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, testConnection, disableFirestoreNetwork, enableFirestoreNetwork } from "./firebase";
import { Item, Balance, Transaction, UserAccount, BatchType } from "./types";
import { seedItems, initialBalances, initialTransactions } from "./mockData";
import { defaultUsers } from "./defaultUsers";

const STATE_COLLECTION = "warehouse";
const STATE_DOC = "state";

export interface WarehouseStateData {
  items: Item[];
  balances: Balance[];
  transactions: Transaction[];
  users: UserAccount[];
  batchQuantities?: Record<string, number>;
  batchTypes?: Record<string, BatchType>;
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

const QUOTA_STORAGE_KEY = "wh_firestore_quota_date";
let _firestoreQuotaExceeded = false;

export function isFirestoreQuotaExceeded(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(QUOTA_STORAGE_KEY) === today || _firestoreQuotaExceeded;
  } catch {
    return _firestoreQuotaExceeded;
  }
}

export function setFirestoreQuotaExceeded(val: boolean) {
  _firestoreQuotaExceeded = val;
  try {
    if (val) {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(QUOTA_STORAGE_KEY, today);
    } else {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  } catch {}
}

export function resetQuotaCache() {
  _firestoreQuotaExceeded = false;
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {}
}

export const PENDING_SYNC_KEY = "wh_pending_cloud_sync";
export const LOCAL_MODIFIED_KEY = "wh_local_last_modified";

export function hasPendingCloudSync(): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPendingCloudSync(pending: boolean) {
  try {
    if (pending) {
      localStorage.setItem(PENDING_SYNC_KEY, "true");
      localStorage.setItem(LOCAL_MODIFIED_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(PENDING_SYNC_KEY);
    }
  } catch {}
}

// Subscribes to real-time warehouse data changes from Firestore
export function subscribeToWarehouseState(
  onData: (data: WarehouseStateData) => void,
  onError?: (err: unknown) => void
): () => void {
  // First, immediately provide fast local cached state so UI is never blank
  try {
    const localItems = localStorage.getItem("wh_items");
    const localBalances = localStorage.getItem("wh_balances");
    const localTransactions = localStorage.getItem("wh_transactions");
    const localUsers = localStorage.getItem("wh_users");
    const localBatchQuantities = localStorage.getItem("wh_batch_quantities");
    const localBatchTypes = localStorage.getItem("wh_batch_types");
    if (localItems && localBalances && localTransactions) {
      onData({
        items: JSON.parse(localItems),
        balances: JSON.parse(localBalances),
        transactions: JSON.parse(localTransactions),
        users: localUsers ? JSON.parse(localUsers) : defaultUsers,
        batchQuantities: localBatchQuantities ? JSON.parse(localBatchQuantities) : {},
        batchTypes: localBatchTypes ? JSON.parse(localBatchTypes) : {},
        updatedAt: new Date().toISOString(),
        sourceDevice: "Local Storage Mode",
        version: 1,
      });
    }
  } catch (e) {
    console.warn("Could not load initial local cached state:", e);
  }

  const docRef = doc(db, STATE_COLLECTION, STATE_DOC);

  // Test connection on startup
  testConnection();

  let activeUnsubscribe: (() => void) | null = null;

  activeUnsubscribe = onSnapshot(
    docRef,
    async (snapshot) => {
      try {
        // If snapshot succeeded, billing is active and quota is NOT exceeded!
        setFirestoreQuotaExceeded(false);

        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<WarehouseStateData>;
          const cleanData: WarehouseStateData = {
            items: Array.isArray(data.items) ? data.items : seedItems,
            balances: Array.isArray(data.balances) ? data.balances : initialBalances,
            transactions: Array.isArray(data.transactions) ? data.transactions : initialTransactions,
            users: Array.isArray(data.users) && data.users.length ? data.users : defaultUsers,
            batchQuantities: data.batchQuantities && typeof data.batchQuantities === "object" ? data.batchQuantities : {},
            batchTypes: data.batchTypes && typeof data.batchTypes === "object" ? data.batchTypes : {},
            updatedAt: data.updatedAt || new Date().toISOString(),
            sourceDevice: data.sourceDevice || "Cloud",
            version: typeof data.version === "number" ? data.version : 1,
          };

          // Save local backup and update UI with live Cloud Firestore data
          try {
            localStorage.setItem("wh_items", JSON.stringify(cleanData.items));
            localStorage.setItem("wh_balances", JSON.stringify(cleanData.balances));
            localStorage.setItem("wh_transactions", JSON.stringify(cleanData.transactions));
            localStorage.setItem("wh_users", JSON.stringify(cleanData.users));
            if (cleanData.batchQuantities) {
              localStorage.setItem("wh_batch_quantities", JSON.stringify(cleanData.batchQuantities));
            }
            if (cleanData.batchTypes) {
              localStorage.setItem("wh_batch_types", JSON.stringify(cleanData.batchTypes));
            }
            setPendingCloudSync(false);
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
            batchQuantities: {},
            batchTypes: {},
            updatedAt: new Date().toISOString(),
            sourceDevice: getDeviceInfo(),
            version: 1,
          };

          await setDoc(docRef, cleanForFirestore(initialData));
          onData(initialData);
        }
      } catch (err) {
        console.warn("Error processing warehouse snapshot:", err);
        if (onError) onError(err);
      }
    },
    (error) => {
      const isQuota =
        error instanceof Error &&
        (error.message.includes("Quota exceeded") || (error as any).code === "resource-exhausted");

      if (isQuota) {
        setFirestoreQuotaExceeded(true);
        console.info("Firestore usage quota reached. Unsubscribing listener to prevent retry backoff spam.");

        // Detach listener immediately so Firebase SDK stops attempting background retries
        if (activeUnsubscribe) {
          try {
            activeUnsubscribe();
          } catch {}
        }

        // Fallback: load latest local backup immediately so the UI is fully populated
        try {
          const localItems = localStorage.getItem("wh_items");
          const localBalances = localStorage.getItem("wh_balances");
          const localTransactions = localStorage.getItem("wh_transactions");
          const localUsers = localStorage.getItem("wh_users");
          onData({
            items: localItems ? JSON.parse(localItems) : seedItems,
            balances: localBalances ? JSON.parse(localBalances) : initialBalances,
            transactions: localTransactions ? JSON.parse(localTransactions) : initialTransactions,
            users: localUsers ? JSON.parse(localUsers) : defaultUsers,
            updatedAt: new Date().toISOString(),
            sourceDevice: "Local Storage Mode",
            version: 1,
          });
        } catch (e) {
          console.warn("Failed reading offline localStorage backup:", e);
        }
      } else {
        console.error("Firestore onSnapshot error:", error);
        handleFirestoreError(error, OperationType.GET, `${STATE_COLLECTION}/${STATE_DOC}`);
        if (onError) onError(error);
      }
    }
  );

  return () => {
    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch {}
    }
  };
}

// Saves warehouse state to Firestore so all handphones and computers sync immediately
export async function pushWarehouseStateToCloud(
  items: Item[],
  balances: Balance[],
  transactions: Transaction[],
  users: UserAccount[],
  batchQuantities?: Record<string, number>,
  batchTypes?: Record<string, BatchType>
): Promise<{ success: boolean; isQuota?: boolean; error?: string }> {
  // Read current batch config from storage if not provided
  let bQty = batchQuantities;
  let bTyp = batchTypes;
  if (!bQty) {
    try {
      const saved = localStorage.getItem("wh_batch_quantities");
      if (saved) bQty = JSON.parse(saved);
    } catch {}
  }
  if (!bTyp) {
    try {
      const saved = localStorage.getItem("wh_batch_types");
      if (saved) bTyp = JSON.parse(saved);
    } catch {}
  }

  // Always save to localStorage first so local operations are never blocked
  try {
    localStorage.setItem("wh_items", JSON.stringify(items));
    localStorage.setItem("wh_balances", JSON.stringify(balances));
    localStorage.setItem("wh_transactions", JSON.stringify(transactions));
    localStorage.setItem("wh_users", JSON.stringify(users));
    if (bQty) localStorage.setItem("wh_batch_quantities", JSON.stringify(bQty));
    if (bTyp) localStorage.setItem("wh_batch_types", JSON.stringify(bTyp));
    localStorage.setItem(LOCAL_MODIFIED_KEY, Date.now().toString());
  } catch {
    // ignore quota issues
  }

  // Direct server memory backup route
  try {
    fetch("/api/sync-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, balances, transactions, users, batchQuantities: bQty || {}, batchTypes: bTyp || {} }),
    }).catch(() => {});
  } catch {}

  const docRef = doc(db, STATE_COLLECTION, STATE_DOC);
  const payload: WarehouseStateData = {
    items,
    balances,
    transactions,
    users,
    batchQuantities: bQty || {},
    batchTypes: bTyp || {},
    updatedAt: new Date().toISOString(),
    sourceDevice: getDeviceInfo(),
    version: Date.now(),
  };

  try {
    const firestoreData = cleanForFirestore(payload);
    await setDoc(docRef, firestoreData);
    // Direct Cloud Write Succeeded! Clear any quota or pending flags
    setFirestoreQuotaExceeded(false);
    setPendingCloudSync(false);
    return { success: true };
  } catch (error) {
    const isQuota =
      error instanceof Error &&
      (error.message.includes("Quota exceeded") || (error as any).code === "resource-exhausted");

    if (isQuota) {
      setFirestoreQuotaExceeded(true);
      setPendingCloudSync(true);
      console.warn("Firestore write quota reached. Local copy preserved safely in Local Storage with pending sync flagged.");
      return { success: false, isQuota: true };
    } else {
      handleFirestoreError(error, OperationType.WRITE, `${STATE_COLLECTION}/${STATE_DOC}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// Manually trigger a retry to push local pending state to cloud (e.g. after quota refresh or Blaze upgrade)
export async function retryPendingCloudSync(): Promise<{ success: boolean; message: string }> {
  try {
    resetQuotaCache();
    await enableFirestoreNetwork();
    const rawItems = localStorage.getItem("wh_items");
    const rawBalances = localStorage.getItem("wh_balances");
    const rawTransactions = localStorage.getItem("wh_transactions");
    const rawUsers = localStorage.getItem("wh_users");
    const rawBatchQuantities = localStorage.getItem("wh_batch_quantities");
    const rawBatchTypes = localStorage.getItem("wh_batch_types");

    if (!rawItems || !rawBalances || !rawTransactions) {
      return { success: false, message: "No local warehouse data found to sync." };
    }

    const items = JSON.parse(rawItems);
    const balances = JSON.parse(rawBalances);
    const transactions = JSON.parse(rawTransactions);
    const users = rawUsers ? JSON.parse(rawUsers) : defaultUsers;
    const batchQuantities = rawBatchQuantities ? JSON.parse(rawBatchQuantities) : {};
    const batchTypes = rawBatchTypes ? JSON.parse(rawBatchTypes) : {};

    const docRef = doc(db, STATE_COLLECTION, STATE_DOC);
    const payload: WarehouseStateData = {
      items,
      balances,
      transactions,
      users,
      batchQuantities,
      batchTypes,
      updatedAt: new Date().toISOString(),
      sourceDevice: getDeviceInfo() + " (Manual Retry)",
      version: Date.now(),
    };

    await setDoc(docRef, cleanForFirestore(payload));
    setPendingCloudSync(false);
    setFirestoreQuotaExceeded(false);
    return { success: true, message: "All local changes successfully uploaded to Cloud Firestore!" };
  } catch (err) {
    const isQuota =
      err instanceof Error &&
      (err.message.includes("Quota exceeded") || (err as any)?.code === "resource-exhausted");
    if (isQuota) {
      setFirestoreQuotaExceeded(true);
      setPendingCloudSync(true);
      return {
        success: false,
        message: "Quota is still exceeded on Firebase. Local changes are safe in browser storage and will retry later.",
      };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : "Cloud sync failed.",
    };
  }
}

// Force a direct fetch of the latest cloud database state directly from Firestore server or server bridge
export async function pullLatestFromCloud(): Promise<WarehouseStateData> {
  resetQuotaCache();
  await enableFirestoreNetwork();

  let serverData: Partial<WarehouseStateData> | null = null;

  try {
    const res = await fetch("/api/sync-state");
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        serverData = json.data;
      }
    }
  } catch {}

  let data: Partial<WarehouseStateData> = {};

  try {
    const docRef = doc(db, STATE_COLLECTION, STATE_DOC);
    const snap = await getDocFromServer(docRef);
    if (snap.exists()) {
      data = snap.data() as Partial<WarehouseStateData>;
    }
  } catch (err) {
    if (serverData) {
      data = serverData;
    } else {
      throw err;
    }
  }

  // Use whichever source has data (prefer server memory if version is newer)
  if (serverData && serverData.version && typeof data.version === "number") {
    if (serverData.version > data.version) {
      data = serverData;
    }
  } else if (serverData && (!data.items || !data.items.length)) {
    data = serverData;
  }

  const cleanData: WarehouseStateData = {
    items: Array.isArray(data.items) ? data.items : seedItems,
    balances: Array.isArray(data.balances) ? data.balances : initialBalances,
    transactions: Array.isArray(data.transactions) ? data.transactions : initialTransactions,
    users: Array.isArray(data.users) && data.users.length ? data.users : defaultUsers,
    batchQuantities: data.batchQuantities && typeof data.batchQuantities === "object" ? data.batchQuantities : {},
    batchTypes: data.batchTypes && typeof data.batchTypes === "object" ? data.batchTypes : {},
    updatedAt: data.updatedAt || new Date().toISOString(),
    sourceDevice: data.sourceDevice || "Cloud",
    version: typeof data.version === "number" ? data.version : Date.now(),
  };

  try {
    localStorage.setItem("wh_items", JSON.stringify(cleanData.items));
    localStorage.setItem("wh_balances", JSON.stringify(cleanData.balances));
    localStorage.setItem("wh_transactions", JSON.stringify(cleanData.transactions));
    localStorage.setItem("wh_users", JSON.stringify(cleanData.users));
    if (cleanData.batchQuantities) {
      localStorage.setItem("wh_batch_quantities", JSON.stringify(cleanData.batchQuantities));
    }
    if (cleanData.batchTypes) {
      localStorage.setItem("wh_batch_types", JSON.stringify(cleanData.batchTypes));
    }
    setPendingCloudSync(false);
    setFirestoreQuotaExceeded(false);
  } catch (e) {
    console.warn("Could not save to localStorage", e);
  }

  return cleanData;
}
