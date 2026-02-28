import * as db from "../db";
import { products, sellerProfiles } from "../../drizzle/schema";
import { getStorageKeyFromUrl, storageDeleteByKey, storageList } from "../storage";

type CleanupResult = {
  referencedCount: number;
  storageCount: number;
  orphanCount: number;
  deletedCount: number;
  sampleOrphans: string[];
};

type CleanupOptions = {
  dryRun?: boolean;
  maxDelete?: number;
};

function collectImageKeysFromProductImages(images: unknown, target: Set<string>) {
  if (!images) return;
  let parsed: unknown = images;
  if (typeof images === "string") {
    try {
      parsed = JSON.parse(images);
    } catch {
      return;
    }
  }
  if (!Array.isArray(parsed)) return;
  parsed.forEach((entry) => {
    if (typeof entry !== "string") return;
    const key = getStorageKeyFromUrl(entry);
    if (key) target.add(key);
  });
}

function collectImageKeyFromUrl(url: unknown, target: Set<string>) {
  if (typeof url !== "string") return;
  const key = getStorageKeyFromUrl(url);
  if (key) target.add(key);
}

export async function cleanupOrphanImages(options: CleanupOptions = {}): Promise<CleanupResult> {
  const { dryRun = false, maxDelete = 5000 } = options;
  const database = await db.getDb();
  if (!database) {
    throw new Error("Database not available");
  }

  const referencedKeys = new Set<string>();

  const productRows = await database.select({ images: products.images }).from(products);
  productRows.forEach((row) => collectImageKeysFromProductImages(row.images, referencedKeys));

  const sellerRows = await database.select({
    profilePhoto: sellerProfiles.profilePhoto,
    coverPhoto: sellerProfiles.coverPhoto,
  }).from(sellerProfiles);
  sellerRows.forEach((row) => {
    collectImageKeyFromUrl(row.profilePhoto, referencedKeys);
    collectImageKeyFromUrl(row.coverPhoto, referencedKeys);
  });

  const storageKeys = new Set<string>();
  const productKeys = await storageList("products");
  const sellerKeys = await storageList("sellers");
  productKeys.forEach((key) => storageKeys.add(key));
  sellerKeys.forEach((key) => storageKeys.add(key));

  const orphanKeys = Array.from(storageKeys).filter((key) => !referencedKeys.has(key));
  const limitedOrphans = orphanKeys.slice(0, maxDelete);

  let deletedCount = 0;
  if (!dryRun) {
    for (const key of limitedOrphans) {
      try {
        await storageDeleteByKey(key);
        deletedCount += 1;
      } catch (error) {
        console.error(`Erro ao remover imagem orfa ${key}:`, error);
      }
    }
  }

  return {
    referencedCount: referencedKeys.size,
    storageCount: storageKeys.size,
    orphanCount: orphanKeys.length,
    deletedCount,
    sampleOrphans: orphanKeys.slice(0, 20),
  };
}
