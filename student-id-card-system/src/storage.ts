import type { AppSettings, Student, StoredState } from "./types";
import { DEFAULT_CARD_SETTINGS } from "./types";

const DB_NAME = "student-id-cards";
const LEGACY_DB_NAME = "gms-yug-id-cards";
const STORE = "app-state";
const KEY = "main";

function openDb(name: string = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<StoredState> {
  let db = await openDb(DB_NAME);
  let saved: any = await new Promise((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  // Fallback to legacy database if new DB is empty
  if (!saved) {
    try {
      const legacyDb = await openDb(LEGACY_DB_NAME);
      saved = await new Promise((resolve) => {
        const request = legacyDb.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
      legacyDb.close();
    } catch {
      // Ignore legacy db errors
    }
  }

  db.close();

  if (!saved) {
    return {
      students: [],
      settings: {
        issueYear: String(new Date().getFullYear()),
        card: { ...DEFAULT_CARD_SETTINGS }
      }
    };
  }

  const rawInst = saved.settings?.card?.institutionName;
  const institutionName =
    !rawInst || rawInst === "GOVERNMENT MIDDLE SCHOOL YUG"
      ? DEFAULT_CARD_SETTINGS.institutionName
      : rawInst;

  const rawSub = saved.settings?.card?.subHeader;
  const subHeader =
    !rawSub || rawSub === "ZONE JIB, UDHAMPUR"
      ? DEFAULT_CARD_SETTINGS.subHeader
      : rawSub;

  const settings: AppSettings = {
    issueYear: saved.settings?.issueYear ?? String(new Date().getFullYear()),
    card: {
      ...DEFAULT_CARD_SETTINGS,
      ...(saved.settings?.card ?? {}),
      institutionName,
      subHeader
    }
  };

  return {
    students: saved.students ?? [],
    settings
  };
}

export async function saveState(students: Student[], settings: AppSettings): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ students, settings }, KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearState(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
