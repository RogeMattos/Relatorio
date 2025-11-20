import { Trip, Expense } from "../types";

const DB_NAME = "VoyageExpenseDB";
const DB_VERSION = 1;
const TRIPS_STORE = "trips";
const EXPENSES_STORE = "expenses";

// Helper to open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TRIPS_STORE)) {
        db.createObjectStore(TRIPS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
        const expenseStore = db.createObjectStore(EXPENSES_STORE, { keyPath: "id" });
        expenseStore.createIndex("tripId", "tripId", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Generic transaction helper
const performTransaction = <T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest | void
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      
      let request: IDBRequest | void;
      
      try {
          request = callback(store);
      } catch (err) {
          reject(err);
          return;
      }

      transaction.oncomplete = () => {
        if (request) {
            resolve(request.result as T);
        } else {
            resolve(undefined as unknown as T);
        }
      };

      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
};

// --- Trips Operations ---

export const getTrips = async (): Promise<Trip[]> => {
  return performTransaction<Trip[]>(TRIPS_STORE, "readonly", (store) => store.getAll());
};

export const saveTrip = async (trip: Trip): Promise<string> => {
  return performTransaction<string>(TRIPS_STORE, "readwrite", (store) => store.put(trip));
};

// --- Expenses Operations ---

export const getExpenses = async (tripId: string): Promise<Expense[]> => {
  return new Promise(async (resolve, reject) => {
    try {
        const db = await openDB();
        const transaction = db.transaction(EXPENSES_STORE, "readonly");
        const store = transaction.objectStore(EXPENSES_STORE);
        const index = store.index("tripId");
        const request = index.getAll(tripId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

export const saveExpense = async (expense: Expense): Promise<string> => {
  return performTransaction<string>(EXPENSES_STORE, "readwrite", (store) => store.put(expense));
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  return performTransaction<void>(EXPENSES_STORE, "readwrite", (store) => store.delete(expenseId));
};

export const formatMoney = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};