import postgres from 'postgres';

const DATABASE_URL = 'postgresql://neondb_owner:npg_oCKY3pE2ZMrD@ep-flat-flower-ac0rrb6f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

console.log('🔍 DIAGNÓSTICO DE CONECTIVIDADE SSL COM NEON\n');
console.log('=' .repeat(60));

// Análise 1: Testar conexão única vs pool
console.log('\n📊 TESTE 1: Conexão única vs pool de conexões\n');

async function test1() {
  console.log('1.1 - Conexão única (max: 1)');
  try {
    const sql1 = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
    await sql1`SELECT 1 as test`;
    console.log('✅ Sucesso com max: 1');
    await sql1.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n1.2 - Pool de conexões (max: 10)');
  try {
    const sql2 = postgres(DATABASE_URL, { ssl: 'require', max: 10 });
    await sql2`SELECT 1 as test`;
    console.log('✅ Sucesso com max: 10');
    await sql2.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

// Análise 2: Testar idle_timeout
console.log('\n📊 TESTE 2: Impacto do idle_timeout\n');

async function test2() {
  console.log('2.1 - Sem idle_timeout');
  try {
    const sql1 = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
    await sql1`SELECT 1 as test`;
    console.log('✅ Sucesso sem idle_timeout');
    await sql1.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n2.2 - Com idle_timeout: 30s');
  try {
    const sql2 = postgres(DATABASE_URL, { ssl: 'require', max: 1, idle_timeout: 30 });
    await sql2`SELECT 1 as test`;
    console.log('✅ Sucesso com idle_timeout: 30');
    await sql2.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n2.3 - Com idle_timeout: 60s');
  try {
    const sql3 = postgres(DATABASE_URL, { ssl: 'require', max: 1, idle_timeout: 60 });
    await sql3`SELECT 1 as test`;
    console.log('✅ Sucesso com idle_timeout: 60');
    await sql3.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

// Análise 3: Testar conexões persistentes vs efêmeras
console.log('\n📊 TESTE 3: Conexões persistentes vs efêmeras\n');

async function test3() {
  console.log('3.1 - Conexão persistente (reutilizada)');
  try {
    const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
    
    // Fazer múltiplas queries na mesma conexão
    await sql`SELECT 1 as test`;
    console.log('✅ Query 1 OK');
    
    await sql`SELECT 2 as test`;
    console.log('✅ Query 2 OK');
    
    await sql`SELECT 3 as test`;
    console.log('✅ Query 3 OK');
    
    await sql.end();
    console.log('✅ Conexão persistente funcionou');
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n3.2 - Conexões efêmeras (nova a cada query)');
  try {
    for (let i = 1; i <= 3; i++) {
      const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
      await sql`SELECT ${i} as test`;
      console.log(`✅ Query ${i} OK (nova conexão)`);
      await sql.end();
    }
    console.log('✅ Conexões efêmeras funcionaram');
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

// Análise 4: Testar com Drizzle ORM
console.log('\n📊 TESTE 4: Drizzle ORM vs postgres-js direto\n');

async function test4() {
  console.log('4.1 - postgres-js direto');
  try {
    const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
    const result = await sql`SELECT COUNT(*) as count FROM products`;
    console.log('✅ postgres-js direto:', result[0].count, 'produtos');
    await sql.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }

  console.log('\n4.2 - Drizzle ORM');
  try {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
    const db = drizzle(sql);
    
    // Importar schema
    const { products } = await import('./drizzle/schema.ts');
    const result = await db.select().from(products);
    console.log('✅ Drizzle ORM:', result.length, 'produtos');
    await sql.end();
  } catch (error) {
    console.log('❌ Erro:', error.message);
    console.log('Stack:', error.stack);
  }
}

// Análise 5: Verificar variáveis de ambiente
console.log('\n📊 TESTE 5: Variáveis de ambiente\n');

async function test5() {
  console.log('5.1 - DATABASE_URL do processo');
  console.log('Valor:', process.env.DATABASE_URL ? 'Definida' : 'Não definida');
  console.log('Tamanho:', process.env.DATABASE_URL?.length || 0);
  console.log('Primeiros 50 chars:', process.env.DATABASE_URL?.substring(0, 50) || 'N/A');
  
  console.log('\n5.2 - Comparação com URL hardcoded');
  const hardcoded = DATABASE_URL;
  const fromEnv = process.env.DATABASE_URL;
  console.log('URLs são iguais?', hardcoded === fromEnv);
  console.log('Diferença de tamanho:', Math.abs((hardcoded?.length || 0) - (fromEnv?.length || 0)));
}

// Executar todos os testes
async function runAllTests() {
  try {
    await test1();
    console.log('\n' + '='.repeat(60));
    
    await test2();
    console.log('\n' + '='.repeat(60));
    
    await test3();
    console.log('\n' + '='.repeat(60));
    
    await test4();
    console.log('\n' + '='.repeat(60));
    
    await test5();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ DIAGNÓSTICO COMPLETO\n');
    
    console.log('📋 RESUMO:');
    console.log('- Scripts diretos (seed, check-db): ✅ Funcionam');
    console.log('- Servidor Node.js com Drizzle: ❌ Falha SSL');
    console.log('- Possíveis causas:');
    console.log('  1. Pool de conexões com idle_timeout');
    console.log('  2. Drizzle ORM com conexão persistente');
    console.log('  3. Variável DATABASE_URL diferente no servidor');
    console.log('  4. Timeout de conexão no ambiente do servidor');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  }
}

runAllTests();
