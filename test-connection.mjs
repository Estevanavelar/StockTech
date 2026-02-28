import postgres from 'postgres';

const DATABASE_URL = 'postgresql://neondb_owner:npg_oCKY3pE2ZMrD@ep-flat-flower-ac0rrb6f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function testConnections() {
  console.log('🔍 Testando diferentes configurações de conexão...\n');

  // Test 1: Com rejectUnauthorized false
  console.log('Test 1: SSL com rejectUnauthorized: false');
  try {
    const sql1 = postgres(DATABASE_URL, {
      ssl: { rejectUnauthorized: false },
      connect_timeout: 5,
    });
    const result = await sql1`SELECT 1 as test`;
    console.log('✅ Sucesso:', result);
    await sql1.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n---\n');

  // Test 2: Com ssl true
  console.log('Test 2: SSL com ssl: true');
  try {
    const sql2 = postgres(DATABASE_URL, {
      ssl: true,
      connect_timeout: 5,
    });
    const result = await sql2`SELECT 1 as test`;
    console.log('✅ Sucesso:', result);
    await sql2.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n---\n');

  // Test 3: Sem SSL (remover sslmode da URL)
  console.log('Test 3: Sem SSL (removendo sslmode)');
  try {
    const urlNoSSL = DATABASE_URL.replace('?sslmode=require&channel_binding=require', '');
    const sql3 = postgres(urlNoSSL, {
      connect_timeout: 5,
    });
    const result = await sql3`SELECT 1 as test`;
    console.log('✅ Sucesso:', result);
    await sql3.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n---\n');

  // Test 4: Com sslmode=prefer
  console.log('Test 4: Com sslmode=prefer');
  try {
    const urlPrefer = DATABASE_URL.replace('sslmode=require&channel_binding=require', 'sslmode=prefer');
    const sql4 = postgres(urlPrefer, {
      connect_timeout: 5,
    });
    const result = await sql4`SELECT 1 as test`;
    console.log('✅ Sucesso:', result);
    await sql4.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n✅ Testes concluídos');
  process.exit(0);
}

testConnections().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
