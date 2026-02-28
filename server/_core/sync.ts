/**
 * ========================================
 * AVELAR SYSTEM - StockTech Sync Functions
 * ========================================
 * Funções para sincronização de dados do AvAdmin para StockTech
 */

import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { Account } from './avadmin-client';

/**
 * Sincroniza account do AvAdmin para tabela users do StockTech
 * Apenas lojistas e distribuidores chegam até aqui (validação no middleware)
 *
 * @param account - Dados da account do AvAdmin
 * @param clientType - Tipo de cliente (lojista/distribuidor)
 */
export async function syncUserFromAvAdmin(
  account: Account,
  clientType: string
) {
  const db = await getDb();
  if (!db) {
    console.error('[Sync] Database not available');
    return;
  }

  try {
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, account.id))
      .limit(1);

    const userData = {
      id: account.id,
      documentType: (account.document_type || 'cnpj') as 'cpf' | 'cnpj',
      document: account.document || account.id,
      businessName: account.business_name || account.company_name,
      ownerCpf: account.owner_cpf || '',
      isIndividual: account.is_individual || false,
      whatsapp: account.whatsapp,
      status: account.status,
      enabledModules: JSON.stringify(account.enabled_modules || []),
      previousDocument: account.previous_document,
      planId: account.plan_id,
      clientType: clientType as 'lojista' | 'distribuidor' | 'cliente_final',
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      await db.insert(users).values({
        ...userData,
        createdAt: new Date(),
      });
      console.log(`[Sync] Account ${account.id} criada no StockTech`);
    } else {
      await db.update(users)
        .set(userData)
        .where(eq(users.id, account.id));
      console.log(`[Sync] Account ${account.id} atualizada no StockTech`);
    }
  } catch (error) {
    console.error('[Sync] Erro ao sincronizar account:', error);
    // Não lança erro para não bloquear o acesso
  }
}