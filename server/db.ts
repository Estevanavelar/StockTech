import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { products, transactions, ratings, addresses, sellerProfiles, carts, users } from "../drizzle/schema";
// Usuários vêm do AvAdmin - armazenamos cache local para sessão

let _db: ReturnType<typeof drizzle> | null = null;
let _client: postgres.Sql | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
function withSearchPath(databaseUrl: string): string {
  if (databaseUrl.includes("search_path=avelar_stocktech")) {
    return databaseUrl;
  }
  const separator = databaseUrl.includes("?") ? "&" : "?";
  return `${databaseUrl}${separator}options=-c%20search_path=avelar_stocktech,public`;
}

export async function getDb() {
  const envDbUrl = process.env.STOCKTECH_DATABASE_URL || process.env.DATABASE_URL;
  if (!_db && envDbUrl) {
    try {
      console.log('[Database] Connecting...');
      const databaseUrl = withSearchPath(envDbUrl);
      // SSL condicional - apenas para produção com banco remoto
      const sslConfig = databaseUrl.includes('neon.tech') || 
                        databaseUrl.includes('supabase.co')
        ? { ssl: 'require' as const }
        : {};
      _client = postgres(databaseUrl, {
        ...sslConfig,
        max: 1,
      });
      await _client`SET search_path TO avelar_stocktech, public`;
      _db = drizzle(_client);
      console.log('[Database] Connected successfully');
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _client = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============
// Nota: Sincronização de users agora é feita via syncUserFromAvAdmin em _core/sync.ts
// Os users são sincronizados a partir de AvAdmin.accounts no primeiro login

export async function getUserById(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

// ============ PRODUCT QUERIES ============

export async function getAllProducts() {
  console.log('[getAllProducts] Starting...');
  const db = await getDb();
  console.log('[getAllProducts] DB instance:', db ? 'connected' : 'null');
  if (!db) {
    console.warn('[getAllProducts] No database connection');
    return [];
  }
  try {
    const result = await db.select().from(products);
    console.log('[getAllProducts] Found', result.length, 'products');
    return result;
  } catch (error) {
    console.error('[getAllProducts] Error:', error);
    return [];
  }
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data).returning();
  return result[0];
}

export async function updateProduct(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(products).set(data).where(eq(products.id, id)).returning();
  return result[0];
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(products).where(eq(products.id, id));
}

// ============ TRANSACTION QUERIES ============

export async function getAllTransactions() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(transactions);
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTransaction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(data).returning();
  return result[0];
}

// ============ RATING QUERIES ============

export async function getAllRatings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ratings);
}

export async function getRatingsByProductId(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ratings).where(eq(ratings.productId, productId));
}

export async function createRating(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ratings).values(data).returning();
  return result[0];
}

// ============ CART QUERIES ============

export async function getCartByUserId(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(carts).where(eq(carts.userId, userId));
}

export async function addToCart(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(carts).values(data).returning();
  return result[0];
}

export async function removeFromCart(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(carts).where(eq(carts.id, id));
}

// ============ ADDRESS QUERIES ============

export async function getAddressesByUserId(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(addresses).where(eq(addresses.userId, userId));
}

export async function createAddress(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(addresses).values(data).returning();
  return result[0];
}

// ============ SELLER PROFILE QUERIES ============

export async function getSellerProfile(userId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSellerProfile(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sellerProfiles).values(data).returning();
  return result[0];
}

export async function updateSellerProfile(sellerId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(sellerProfiles).set(data).where(eq(sellerProfiles.id, sellerId)).returning();
  return result[0];
}
