import * as db from "../db";
import { carts } from "../../drizzle/schema";
import { lt } from "drizzle-orm";

/**
 * Remove reservas de carrinho expiradas (> 30 minutos)
 */
export async function cleanExpiredCartReservations() {
  try {
    const database = await db.getDb();
    if (!database) return;

    const now = new Date();

    const expired = await database.select()
      .from(carts)
      .where(lt(carts.reservedUntil, now));

    if (expired.length > 0) {
      await database.delete(carts)
        .where(lt(carts.reservedUntil, now));

      console.log(`[Cart Cleanup] Removed ${expired.length} expired cart reservations`);
    }
  } catch (error) {
    console.error("[Cart Cleanup] Error:", error);
  }
}

// Executar a cada 5 minutos
export function startCartCleanupJob() {
  setInterval(cleanExpiredCartReservations, 5 * 60 * 1000);
  console.log("[Cart Cleanup] Job started - runs every 5 minutes");
}