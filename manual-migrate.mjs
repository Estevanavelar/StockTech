import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = 'postgresql://neondb_owner:npg_oCKY3pE2ZMrD@ep-flat-flower-ac0rrb6f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = postgres(DATABASE_URL);

async function migrate() {
  try {
    console.log('📦 Executando migrations...');

    // Ler arquivo SQL
    const sqlFile = fs.readFileSync(path.join(process.cwd(), 'drizzle/0000_clean_demogoblin.sql'), 'utf-8');
    
    // Dividir por statement-breakpoint
    const statements = sqlFile.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s);

    console.log(`📋 Encontrados ${statements.length} statements`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        console.log(`⏳ Executando statement ${i + 1}/${statements.length}...`);
        await sql.unsafe(statement);
        console.log(`✅ Statement ${i + 1} executado com sucesso`);
      } catch (error) {
        // Ignorar erros de "already exists"
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  Statement ${i + 1} já existe, ignorando...`);
        } else {
          console.error(`❌ Erro no statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('🎉 Migrations executadas com sucesso!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await sql.end();
    process.exit(1);
  }
}

migrate();
