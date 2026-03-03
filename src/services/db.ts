import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentMeta {
  id: string;
  title: string;
  author: string;
  year: number;
  methodology: string;
  socialImpact: string;
  fileData?: ArrayBuffer; // For storing the actual PDF
  createdAt: number;
  updatedAt: number;
}

export interface Annotation {
  id: string;
  docId: string;
  pageNumber: number;
  content: string;
  createdAt: number;
}

export interface Synthesis {
  id: string;
  content: string; // HTML from Tiptap
  createdAt: number;
  updatedAt: number;
}

interface LectoriumDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentMeta;
    indexes: { 'by-year': number; 'by-author': string };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-doc': string };
  };
  syntheses: {
    key: string;
    value: Synthesis;
  };
}

let dbPromise: Promise<IDBPDatabase<LectoriumDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<LectoriumDB>('lectorium-db', 1, {
      upgrade(db) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('by-year', 'year');
        docStore.createIndex('by-author', 'author');

        const annStore = db.createObjectStore('annotations', { keyPath: 'id' });
        annStore.createIndex('by-doc', 'docId');

        db.createObjectStore('syntheses', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export const dbService = {
  async addDocument(doc: Omit<DocumentMeta, 'id' | 'createdAt' | 'updatedAt'>) {
    const db = await initDB();
    const id = uuidv4();
    const now = Date.now();
    const newDoc = { ...doc, id, createdAt: now, updatedAt: now };
    await db.put('documents', newDoc);
    return newDoc;
  },
  async getDocuments() {
    const db = await initDB();
    return db.getAll('documents');
  },
  async getDocument(id: string) {
    const db = await initDB();
    return db.get('documents', id);
  },
  async saveSynthesis(content: string, id = 'main') {
    const db = await initDB();
    const now = Date.now();
    const existing = await db.get('syntheses', id);
    const synthesis = {
      id,
      content,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await db.put('syntheses', synthesis);
    return synthesis;
  },
  async getSynthesis(id = 'main') {
    const db = await initDB();
    return db.get('syntheses', id);
  }
};
