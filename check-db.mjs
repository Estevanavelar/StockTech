import postgres from 'postgres';

const DATABASE_URL = 'postgresql://neondb_owner:npg_oCKY3pE2ZMrD@ep-flat-flower-ac0rrb6f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = postgres(DATABASE_URL);

async function checkDb() {
  try {
    console.log('🔍 Verificando banco de dados...');

    // Verificar tabelas
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('📋 Tabelas:', tables.map(t => t.table_name));

    // Contar produtos
    const productCount = await sql`SELECT COUNT(*) as count FROM products`;
    console.log('📦 Produtos:', productCount[0].count);

    // Listar produtos
    const products = await sql`SELECT id, code, name, price, quantity FROM products LIMIT 5`;
    console.log('🛍️ Primeiros 5 produtos:');
    products.forEach(p => {
      console.log(`  - ${p.code}: ${p.name} (R$ ${p.price}, ${p.quantity} em estoque)`);
    });

    // Contar transações
    const txCount = await sql`SELECT COUNT(*) as count FROM transactions`;
    console.log('💳 Transações:', txCount[0].count);

    // Contar avaliações
    const ratingCount = await sql`SELECT COUNT(*) as count FROM ratings`;
    console.log('⭐ Avaliações:', ratingCount[0].count);

    await sql.end();
    console.log('✅ Verificação concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await sql.end();
    process.exit(1);
  }
}

checkDb();
