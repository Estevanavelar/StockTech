#!/usr/bin/env node

/**
 * Script para conceder permissões na tabela product_returns
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.STOCKTECH_DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL ou STOCKTECH_DATABASE_URL não encontrado');
    process.exit(1);
  }

  console.log('🔌 Conectando ao banco de dados...');
  
  const sql = postgres(databaseUrl, {
    max: 1,
  });

  try {
    // Ler o arquivo SQL
    const migrationPath = join(__dirname, '..', 'migrations', '011_grant_product_returns_privileges.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executando migração de permissões...');
    
    // Executar a migração
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Permissões concedidas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
