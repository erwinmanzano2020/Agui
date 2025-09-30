// Local database for offline storage
import { openDB } from "idb";

const DB_NAME = "agui-payroll";
const DB_VERSION = 1;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create stores (like database tables)
      if (!db.objectStoreNames.contains("franchisees")) {
        db.createObjectStore("franchisees", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("employees")) {
        db.createObjectStore("employees", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("dtr_entries")) {
        db.createObjectStore("dtr_entries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    },
  });
}

// Helper function to add data
export async function addData(storeName, data) {
  const db = await initDB();
  return db.add(storeName, data);
}

// Helper function to get all data
export async function getAllData(storeName) {
  const db = await initDB();
  return db.getAll(storeName);
}

// Helper function to delete data
export async function deleteData(storeName, id) {
  const db = await initDB();
  return db.delete(storeName, id);
}

// Helper function to update data
export async function updateData(storeName, data) {
  const db = await initDB();
  return db.put(storeName, data);
}
