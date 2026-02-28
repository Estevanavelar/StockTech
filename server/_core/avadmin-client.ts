/**
 * ========================================
 * AVELAR SYSTEM - AvAdmin HTTP Client
 * ========================================
 * Cliente HTTP para comunicação do StockTech com o AvAdmin
 * Responsável por validar tokens JWT e buscar dados de usuários/contas
 */

import axios, { AxiosInstance } from 'axios';

// Types
export interface User {
  id: string;
  cpf: string;
  full_name: string;
  whatsapp: string;
  role: string;
  account_id: string;
  is_active: boolean;
  whatsapp_verified: boolean;
  client_type: string;
  zip_code?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  complement?: string | null;
  reference_point?: string | null;
  store_name?: string | null;
}

export interface Account {
  id: string;
  company_name: string;
  document: string;
  document_type: string;
  is_individual: boolean;
  business_name?: string;
  owner_cpf: string;
  previous_document?: string;
  whatsapp: string;
  plan_id: string;
  status: string;
  enabled_modules: string[];
  address?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  // Mantido para compatibilidade com respostas legadas
  cnpj?: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  user?: User;
  account?: Account;
  error?: string;
}

export interface ModuleAccessResponse {
  hasAccess: boolean;
  module: string;
  reason?: string;
}

/**
 * Client HTTP para comunicação com AvAdmin
 */
export class AvAdminClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.AVADMIN_API_URL || 'http://localhost:8010';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('AvAdmin API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Valida um token JWT no AvAdmin
   * @param token - JWT token
   * @returns Dados do usuário e conta se válido
   */
  async validateToken(token: string): Promise<TokenValidationResponse> {
    try {
      const response = await this.client.post<TokenValidationResponse>(
        '/api/internal/validate-token',
        { token }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        return {
          valid: false,
          error: 'Token inválido ou expirado',
        };
      }

      throw new Error(`Erro ao validar token: ${error.message}`);
    }
  }

  /**
   * Busca dados de um usuário por ID
   * @param userId - ID do usuário
   * @returns Dados do usuário
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const response = await this.client.get<User>(
        `/api/internal/user/${userId}`
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }

      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }
  }

  /**
   * Busca dados de uma conta por ID
   * @param accountId - ID da conta
   * @returns Dados da conta
   */
  async getAccountById(accountId: string): Promise<Account | null> {
    try {
      const response = await this.client.get<Account>(
        `/api/internal/account/${accountId}`
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }

      throw new Error(`Erro ao buscar conta: ${error.message}`);
    }
  }

  /**
   * Verifica se uma conta tem acesso a um módulo específico
   * @param accountId - ID da conta
   * @param module - Nome do módulo (ex: 'StockTech')
   * @returns Se a conta tem acesso ao módulo
   */
  async checkModuleAccess(
    accountId: string,
    module: string
  ): Promise<ModuleAccessResponse> {
    try {
      const response = await this.client.post<ModuleAccessResponse>(
        '/api/internal/check-module-access',
        { account_id: accountId, module }
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        return {
          hasAccess: false,
          module,
          reason: 'Módulo não habilitado para esta conta',
        };
      }

      throw new Error(`Erro ao verificar acesso ao módulo: ${error.message}`);
    }
  }

  /**
   * Incrementa contador de uso de um recurso
   * @param accountId - ID da conta
   * @param type - Tipo de uso (ex: 'product_created', 'transaction_created')
   * @param amount - Quantidade a incrementar (default: 1)
   */
  async incrementUsage(
    accountId: string,
    type: string,
    amount: number = 1
  ): Promise<void> {
    try {
      await this.client.post('/api/internal/increment-usage', {
        account_id: accountId,
        usage_type: type,
        amount,
      });
    } catch (error: any) {
      console.error('Erro ao incrementar uso:', error.message);
      // Não lança erro para não bloquear operações
    }
  }

  /**
   * Health check do AvAdmin
   * @returns Se o AvAdmin está disponível
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let avAdminClient: AvAdminClient | null = null;

/**
 * Obtém instância singleton do AvAdmin client
 */
export function getAvAdminClient(): AvAdminClient {
  if (!avAdminClient) {
    avAdminClient = new AvAdminClient();
  }
  return avAdminClient;
}

export default AvAdminClient;

