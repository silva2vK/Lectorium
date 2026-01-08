import { getDb } from "../services/db";
import { VectorIndex } from "../types";

export async function saveVectorIndex(index: VectorIndex): Promise<void> {
  const db = await getDb();
  await db.put("vector_store", index);
}

export async function getVectorIndex(fileId: string): Promise<VectorIndex | undefined> {
  const db = await getDb();
  return await db.get("vector_store", fileId);
}

export async function deleteVectorIndex(fileId: string): Promise<void> {
  const db = await getDb();
  await db.delete("vector_store", fileId);
}