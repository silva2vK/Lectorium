
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Annotation, DriveFile, SyncQueueItem, AuditRecord, VectorIndex } from "../types";

export const DB_NAME = "pwa-drive-annotator";
export const DB_VERSION = 17;

export interface DocVersion {
  id: string;
  fileId: string;
  timestamp: number;
  author: string;
  content: any;
  name?: string;
}

export interface PdfMetadata {
  fileId: string;
  title: string;
  author: string;
  year: string;
  publisher?: string;
  addedAt: number;
}

export interface OfflineRecord extends DriveFile {
    blob?: Blob;
    storedAt: number;
    lastAccessed: number;
    pinned: boolean;
}

export interface OcrRecord {
    id: string;
    fileId: string;
    page: number;
    words: any[];
    markdown?: string; // Conteúdo semântico da página (Lente/Gemini)
    updatedAt: number;
}

export interface LectoriumDB extends DBSchema {
  annotations: {
    key: string;
    value: Annotation & { fileId: string, userId: string, updatedAt: string };
    indexes: { 'fileId': string };
  };
  recentFiles: {
    key: string;
    value: DriveFile & { lastOpened: Date };
    indexes: { 'lastOpened': Date };
  };
  offlineFiles: {
    key: string;
    value: OfflineRecord;
    indexes: { 'lastAccessed': number, 'pinned': boolean };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'createdAt': number };
  };
  documentCache: {
    key: string;
    value: any;
  };
  active_locks: {
    key: string;
    value: { id: string, timestamp: number };
  };
  ocrCache: {
    key: string;
    value: OcrRecord;
    indexes: { 'fileId': string };
  };
  settings: {
    key: string;
    value: any;
  };
  audit_log: {
    key: string;
    value: AuditRecord;
  };
  vector_store: {
    key: string;
    value: VectorIndex;
  };
  document_versions: {
    key: string;
    value: DocVersion;
    indexes: { 'fileId': string, 'timestamp': number };
  };
  pdfMetadata: {
    key: string;
    value: PdfMetadata;
    indexes: { 'title': string, 'author': string };
  };
}

let dbPromise: Promise<IDBPDatabase<LectoriumDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<LectoriumDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LectoriumDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("annotations")) {
          const store = db.createObjectStore("annotations", { keyPath: "id" });
          store.createIndex("fileId", "fileId", { unique: false });
        }
        if (!db.objectStoreNames.contains("recentFiles")) {
          const store = db.createObjectStore("recentFiles", { keyPath: "id" });
          store.createIndex("lastOpened", "lastOpened");
        }
        if (!db.objectStoreNames.contains("offlineFiles")) {
          const store = db.createObjectStore("offlineFiles", { keyPath: "id" });
          store.createIndex("lastAccessed", "lastAccessed");
          store.createIndex("pinned", "pinned");
        }
        if (!db.objectStoreNames.contains("syncQueue")) {
          const store = db.createObjectStore("syncQueue", { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("documentCache")) {
          db.createObjectStore("documentCache", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("active_locks")) {
          db.createObjectStore("active_locks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("ocrCache")) {
          const store = db.createObjectStore("ocrCache", { keyPath: "id" });
          store.createIndex("fileId", "fileId", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
        if (!db.objectStoreNames.contains("audit_log")) {
          db.createObjectStore("audit_log", { keyPath: "fileId" });
        }
        if (!db.objectStoreNames.contains("vector_store")) {
          db.createObjectStore("vector_store", { keyPath: "fileId" });
        }
        if (!db.objectStoreNames.contains("document_versions")) {
          const store = db.createObjectStore("document_versions", { keyPath: "id" });
          store.createIndex("fileId", "fileId", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
        if (!db.objectStoreNames.contains("pdfMetadata")) {
          const store = db.createObjectStore("pdfMetadata", { keyPath: "fileId" });
          store.createIndex("title", "title", { unique: false });
          store.createIndex("author", "author", { unique: false });
        }
      }
    });
  }
  return dbPromise;
}
