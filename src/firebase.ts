import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, setLogLevel, disableNetwork, enableNetwork } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Mute internal Firestore SDK retry and backoff spam
try {
  setLogLevel("error");
} catch {}

if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const msg = args
      .map((a) => (typeof a === "object" && a !== null ? JSON.stringify(a) : String(a || "")))
      .join(" ");
    if (
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("Using maximum backoff delay") ||
      msg.includes("Free daily write units")
    ) {
      console.warn("Firestore write quota reached. Operating seamlessly in Local Storage mode.");
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener("error", (event) => {
    const msg = String(event.message || event.error || "");
    if (
      msg.includes("FIRESTORE") ||
      msg.includes("INTERNAL ASSERTION FAILED") ||
      msg.includes("missing stream token") ||
      msg.includes("Unexpected state") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Quota limit exceeded")
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(event.reason?.message || event.reason || "");
    if (
      msg.includes("FIRESTORE") ||
      msg.includes("INTERNAL ASSERTION FAILED") ||
      msg.includes("missing stream token") ||
      msg.includes("Unexpected state") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Quota limit exceeded")
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export async function disableFirestoreNetwork() {
  try {
    await disableNetwork(db);
  } catch {}
}

export async function enableFirestoreNetwork() {
  try {
    await enableNetwork(db);
  } catch {}
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota =
    errMsg.includes("Quota exceeded") ||
    errMsg.includes("resource-exhausted") ||
    (error as any)?.code === "resource-exhausted";

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuota) {
    console.warn("Firestore usage quota reached for operation:", operationType, "path:", path);
  } else {
    console.error("Firestore Error: ", JSON.stringify(errInfo));
  }
  return errInfo;
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("the client is offline")) {
        console.warn("Firestore connection check: client offline.");
      } else if (error.message.includes("Quota exceeded") || (error as any)?.code === "resource-exhausted") {
        console.warn("Firestore connection check: daily quota limit reached. Local storage mode active.");
      }
    }
  }
}
