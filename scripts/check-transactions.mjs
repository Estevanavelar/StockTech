#!/usr/bin/env node
import postgres from 'postgres';
import 'dotenv/config';

const url = process.env.STOCKTECH_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('STOCKTECH_DATABASE_URL ou DATABASE_URL não definido');
  process.exit(1);
}

const sql = postgres(url);

async function main() {
  try {
    // Tentar schema avelar_stocktech
    const withSchema = url + (url.includes('?') ? '&' : '?') + 'options=-c%20search_path%3Davelar_stocktech,public';
    const db = postgres(withSchema);

    const rows = await db`
      SELECT id, transaction_code, type, product_id, quantity, buyer_id, seller_id, status, owner_cpf
      FROM transactions
      ORDER BY id DESC
      LIMIT 25
    `;
    console.log('Transações (últimas 25):');
    console.table(rows);
    console.log('\nTotal de transações:', (await db`SELECT COUNT(*) as c FROM transactions`)[0]?.c);
    await db.end();
  } catch (e) {
    // Fallback: tentar public
    try {
      const rows = await sql`
        SELECT id, transaction_code, type, product_id, quantity, buyer_id, seller_id, status
        FROM avelar_stocktech.transactions
        ORDER BY id DESC
        LIMIT 25
      `;
      console.log('Transações (schema avelar_stocktech):');
      console.table(rows);
    } catch (e2) {
      console.error('Erro:', e2.message);
    }
    await sql.end();
  }
}
main();
