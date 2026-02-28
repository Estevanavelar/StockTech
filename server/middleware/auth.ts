/**
 * ========================================
 * AVELAR SYSTEM - StockTech Auth Middleware
 * ========================================
 * Middleware de autenticação JWT para o StockTech
 * Valida tokens e verifica permissões de acesso ao módulo
 */

import { TRPCError } from '@trpc/server';
import { getAvAdminClient, type User, type Account } from '../_core/avadmin-client';
import { syncUserFromAvAdmin } from '../_core/sync';

/**
 * Contexto autenticado do tRPC
 */
export interface AuthContext {
  user: User;
  account: Account;
  token: string;
}

/**
 * Extrai token JWT do header Authorization
 * @param authHeader - Header Authorization
 * @returns Token JWT ou null
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  // Formato esperado: "Bearer TOKEN"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Middleware de autenticação para tRPC
 * Valida token JWT e verifica acesso ao módulo StockTech
 * 
 * @param token - JWT token
 * @returns Contexto autenticado com user e account
 * @throws TRPCError se token inválido ou sem acesso
 */
export async function authenticateRequest(token: string): Promise<AuthContext> {
  const avAdminClient = getAvAdminClient();

  try {
    // 1. Validar token no AvAdmin
    const validation = await avAdminClient.validateToken(token);

    if (!validation.valid || !validation.user || !validation.account) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: validation.error || 'Token inválido ou expirado',
      });
    }

    const { user, account } = validation;

    // 2. VALIDACAO: Rejeitar cliente_final no StockTech
    if (user.client_type === 'cliente_final') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Clientes finais não têm acesso ao StockTech'
      });
    }

    // 3. Verificar se usuário está ativo
    if (!user.is_active) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Usuário inativo',
      });
    }

    // 3. Super admin bypass
    if (user.role === 'super_admin') {
      const superAdminAccountId = '00000000-0000-0000-0000-000000000000';
      return {
        user,
        account: account || {
          id: superAdminAccountId,
          company_name: 'Avelar Company',
          document: '',
          document_type: 'cnpj',
          is_individual: false,
          owner_cpf: user.cpf || '',
          whatsapp: user.whatsapp,
          plan_id: 'super_admin',
          status: 'active',
          enabled_modules: ['StockTech', 'AvAdmin', 'Shop', 'Naldo']
        },
        token,
      };
    }

    // 4. Verificar se conta está ativa
    if (account.status !== 'active' && account.status !== 'trial') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Conta ${account.status}. Entre em contato com o suporte.`,
      });
    }

    // 5. Verificar se conta tem acesso ao módulo StockTech
    const moduleAccess = await avAdminClient.checkModuleAccess(
      account.id,
      'StockTech'
    );

    if (!moduleAccess.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: moduleAccess.reason || 'Sem acesso ao módulo StockTech',
      });
    }

    // 6. Sincronizar account para tabela users (apenas se autorizado)
    if (account) {
      await syncUserFromAvAdmin(account, user.client_type);
    }

    // Retornar contexto autenticado
    return {
      user,
      account,
      token,
    };
  } catch (error) {
    // Se já é um TRPCError, propagar
    if (error instanceof TRPCError) {
      throw error;
    }

    // Erro genérico de comunicação com AvAdmin
    console.error('Erro ao autenticar:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro ao validar autenticação',
    });
  }
}

/**
 * Middleware helper para verificar permissões
 * @param user - Usuário autenticado
 * @param requiredRole - Role mínimo requerido
 * @throws TRPCError se usuário não tem permissão
 */
export function requireRole(user: User, requiredRole: string): void {
  const roleHierarchy: Record<string, number> = {
    super_admin: 5,
    admin: 4,
    manager: 3,
    user: 2,
    viewer: 1,
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  if (userLevel < requiredLevel) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Permissão insuficiente. Requer role: ${requiredRole}`,
    });
  }
}

/**
 * Verifica se usuário é admin ou manager
 * @param user - Usuário autenticado
 * @returns true se usuário é admin ou manager
 */
export function isAdminOrManager(user: User): boolean {
  return ['super_admin', 'admin', 'manager'].includes(user.role);
}

/**
 * Verifica se usuário pode acessar recurso de outra conta
 * @param user - Usuário autenticado
 * @param resourceAccountId - ID da conta dona do recurso
 * @returns true se usuário pode acessar
 */
export function canAccessResource(user: User, resourceAccountId: string): boolean {
  // Super admin pode tudo
  if (user.role === 'super_admin') {
    return true;
  }

  // Usuários só podem acessar recursos da própria conta
  return user.account_id === resourceAccountId;
}

export default authenticateRequest;

