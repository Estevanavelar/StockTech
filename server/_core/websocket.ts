/**
 * ========================================
 * AVELAR SYSTEM - StockTech WebSocket Server
 * ========================================
 * Servidor WebSocket para notificações em tempo real
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { getAvAdminClient } from './avadmin-client';

interface WSClient {
  ws: WebSocket;
  userId: string;
  accountId: string;
  isAlive: boolean;
}

interface NotificationMessage {
  type:
    | 'connection_established'
    | 'order_created'
    | 'payment_confirmed'
    | 'order_updated'
    | 'stock_alert'
    | 'cart_updated'
    | 'product_added'
    | 'product_updated'
    | 'product_deleted'
    | 'transaction_created'
    | 'profile_updated'
    | 'return_requested'
    | 'return_responded'
    | 'replacement_sent'
    | 'defective_received'
    | 'exchange_validated'
    | 'exchange_resolved';
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionCounter = 0;

  /**
   * Inicializar servidor WebSocket
   */
  init(server: any) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Heartbeat para manter conexões vivas
    this.startHeartbeat();

    console.log('WebSocket server initialized');
  }

  /**
   * Lidar com nova conexão WebSocket
   */
  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    try {
      // Extrair token da query string
      const url = new URL(request.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Validar token com AvAdmin
      const avAdminClient = getAvAdminClient();
      const validation = await avAdminClient.validateToken(token);

      if (!validation.valid || !validation.user) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const { user } = validation;
      let { account } = validation;

      if (!account) {
        account = user.role === 'super_admin'
          ? {
              id: '00000000-0000-0000-0000-000000000000',
              company_name: 'Avelar Company',
              cnpj: '',
              whatsapp: user.whatsapp,
              plan_id: 'super_admin',
              status: 'active',
              enabled_modules: ['StockTech', 'AvAdmin', 'Shop', 'Naldo'],
            }
          : null;
      }

      if (!account) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const clientId = `${user.id}-${account.id}-${Date.now()}-${this.connectionCounter++}`;

      // Registrar cliente
      const client: WSClient = {
        ws,
        userId: user.id,
        accountId: account.id,
        isAlive: true
      };

      this.clients.set(clientId, client);

      // Configurar handlers
      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleDisconnection(clientId));
      ws.on('error', (error) => this.handleError(clientId, error));
      ws.on('pong', () => {
        if (this.clients.has(clientId)) {
          this.clients.get(clientId)!.isAlive = true;
        }
      });

      // Enviar confirmação de conexão
      this.sendToClient(clientId, {
        type: 'connection_established',
        title: 'Conectado',
        message: 'Notificações em tempo real ativadas',
        timestamp: new Date().toISOString()
      });

      console.log(`WebSocket client connected: ${clientId}`);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Lidar com mensagens recebidas
   */
  private handleMessage(clientId: string, data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      console.log(`WebSocket message from ${clientId}:`, message);
    } catch (error) {
      console.error('Invalid WebSocket message:', error);
    }
  }

  /**
   * Lidar com desconexão
   */
  private handleDisconnection(clientId: string) {
    console.log(`WebSocket client disconnected: ${clientId}`);
    this.clients.delete(clientId);
  }

  /**
   * Lidar com erros
   */
  private handleError(clientId: string, error: Error) {
    console.error(`WebSocket error for ${clientId}:`, error);
    this.clients.delete(clientId);
  }

  /**
   * Iniciar heartbeat para manter conexões vivas
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 segundos
  }

  /**
   * Enviar mensagem para um cliente específico
   */
  private sendToClient(clientId: string, message: NotificationMessage) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Enviar notificação para um usuário específico
   */
  sendNotificationToUser(userId: string, accountId: string, notification: Omit<NotificationMessage, 'timestamp'>) {
    const message: NotificationMessage = {
      ...notification,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client) => {
      if (client.userId === userId && client.accountId === accountId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(message));
        }
      }
    });
  }

  /**
   * Enviar notificação para múltiplos usuários (broadcast)
   */
  broadcastToUsers(userIds: string[], accountId: string, notification: Omit<NotificationMessage, 'timestamp'>) {
    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, accountId, notification);
    });
  }

  /**
   * Enviar notificação para todos usuários de uma conta
   */
  broadcastToAccount(accountId: string, notification: Omit<NotificationMessage, 'timestamp'>) {
    this.clients.forEach((client) => {
      if (client.accountId === accountId) {
        this.sendNotificationToUser(client.userId, accountId, notification);
      }
    });
  }

  /**
   * Notificar quando um pedido é criado
   */
  notifyOrderCreated(
    buyerId: string,
    sellerId: string,
    buyerAccountId: string,
    sellerAccountId: string,
    orderData: any
  ) {
    // Notificar vendedor
    this.sendNotificationToUser(sellerId, sellerAccountId || buyerAccountId, {
      type: 'order_created',
      title: 'Novo Pedido Recebido!',
      message: `Você recebeu um novo pedido de ${orderData.total} - Aguardando pagamento`,
      data: {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        total: orderData.total,
        items: orderData.items
      }
    });

    // Notificar comprador (confirmação)
    this.sendNotificationToUser(buyerId, buyerAccountId, {
      type: 'order_created',
      title: 'Pedido Realizado',
      message: `Seu pedido ${orderData.orderCode} foi criado com sucesso`,
      data: {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        items: orderData.items
      }
    });
  }

  /**
   * Notificar quando pagamento é confirmado
   */
  notifyPaymentConfirmed(
    buyerId: string,
    sellerId: string,
    buyerAccountId: string,
    sellerAccountId: string,
    orderData: any
  ) {
    // Notificar comprador
    this.sendNotificationToUser(buyerId, buyerAccountId, {
      type: 'payment_confirmed',
      title: 'Pagamento Confirmado!',
      message: `Seu pagamento para o pedido ${orderData.orderCode} foi confirmado`,
      data: {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        items: orderData.items
      }
    });

    // Notificar vendedor
    this.sendNotificationToUser(sellerId, sellerAccountId || buyerAccountId, {
      type: 'payment_confirmed',
      title: 'Pagamento Recebido',
      message: `Pagamento confirmado para o pedido ${orderData.orderCode}`,
      data: {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        items: orderData.items
      }
    });
  }

  /**
   * Notificar quando status do pedido é atualizado
   */
  notifyOrderStatusUpdated(userId: string, accountId: string, orderData: any, newStatus: string) {
    const statusMessages = {
      processing: 'Seu pedido está sendo processado',
      shipped: 'Seu pedido foi enviado',
      delivered: 'Seu pedido foi entregue',
      cancelled: 'Seu pedido foi cancelado'
    };

    const title = newStatus === 'processing' ? 'Pedido em Processamento' :
                 newStatus === 'shipped' ? 'Pedido Enviado' :
                 newStatus === 'delivered' ? 'Pedido Entregue' :
                 newStatus === 'cancelled' ? 'Pedido Cancelado' : 'Status Atualizado';

    this.sendNotificationToUser(userId, accountId, {
      type: 'order_updated',
      title,
      message: `${statusMessages[newStatus as keyof typeof statusMessages] || 'Status do pedido atualizado'}`,
      data: {
        orderId: orderData.id,
        orderCode: orderData.orderCode,
        status: newStatus,
        trackingCode: orderData.trackingCode,
        items: orderData.items
      }
    });
  }

  /**
   * Notificar alerta de estoque crítico
   */
  notifyStockAlert(sellerId: string, accountId: string, productData: any) {
    this.sendNotificationToUser(sellerId, accountId, {
      type: 'stock_alert',
      title: 'Alerta de Estoque!',
      message: `${productData.name} está com estoque crítico (${productData.quantity}/${productData.minQuantity})`,
      data: {
        productId: productData.id,
        productName: productData.name,
        currentStock: productData.quantity,
        minStock: productData.minQuantity
      }
    });
  }

  notifyProductAdded(sellerId: string, accountId: string, productData: any) {
    this.sendNotificationToUser(sellerId, accountId, {
      type: 'product_added',
      title: 'Produto cadastrado',
      message: `${productData.name} foi adicionado ao estoque`,
      data: {
        productId: productData.id,
        productName: productData.name
      }
    });
  }

  notifyProductUpdated(sellerId: string, accountId: string, productData: any) {
    this.sendNotificationToUser(sellerId, accountId, {
      type: 'product_updated',
      title: 'Produto atualizado',
      message: `${productData.name} foi atualizado`,
      data: {
        productId: productData.id,
        productName: productData.name
      }
    });
  }

  notifyProductDeleted(sellerId: string, accountId: string, productData: any) {
    this.sendNotificationToUser(sellerId, accountId, {
      type: 'product_deleted',
      title: 'Produto removido',
      message: `${productData.name} foi removido do estoque`,
      data: {
        productId: productData.id,
        productName: productData.name
      }
    });
  }

  notifyCartUpdated(userId: string, accountId: string, cartData: any) {
    this.sendNotificationToUser(userId, accountId, {
      type: 'cart_updated',
      title: 'Carrinho atualizado',
      message: 'Seu carrinho foi atualizado',
      data: cartData
    });
  }

  notifyTransactionCreated(userId: string, accountId: string, transactionData: any) {
    this.sendNotificationToUser(userId, accountId, {
      type: 'transaction_created',
      title: 'Nova transação',
      message: 'Uma nova transação foi registrada',
      data: transactionData
    });
  }

  notifyProfileUpdated(userId: string, accountId: string, profileData: any) {
    this.sendNotificationToUser(userId, accountId, {
      type: 'profile_updated',
      title: 'Perfil atualizado',
      message: 'Seu perfil foi atualizado',
      data: profileData
    });
  }

  notifyReturnRequested(sellerId: string, accountId: string, returnData: any) {
    this.sendNotificationToUser(sellerId, accountId, {
      type: 'return_requested',
      title: '🔄 Nova Solicitação de Troca',
      message: `Cliente solicitou troca de ${returnData.quantity}x produto`,
      timestamp: new Date().toISOString(),
      data: returnData,
    });
  }

  notifyReplacementSent(buyerId: string, accountId: string, returnData: any) {
    this.sendNotificationToUser(buyerId, accountId, {
      type: 'replacement_sent',
      title: '📦 Peça de Reposição Enviada',
      message: `O vendedor enviou a peça de troca. Aguarde o recebimento da peça defeituosa para conclusão.`,
      timestamp: new Date().toISOString(),
      data: returnData,
    });
  }

  notifyDefectiveReceived(buyerId: string, accountId: string, returnData: any) {
    this.sendNotificationToUser(buyerId, accountId, {
      type: 'defective_received',
      title: '📥 Peça Defeituosa Recebida',
      message: `O vendedor recebeu sua peça defeituosa e está validando os critérios de troca.`,
      timestamp: new Date().toISOString(),
      data: returnData,
    });
  }

  notifyExchangeValidated(buyerId: string, accountId: string, returnData: any) {
    const approved = returnData.status === 'completed_approved';
    this.sendNotificationToUser(buyerId, accountId, {
      type: 'exchange_validated',
      title: approved ? '✅ Troca Aprovada' : '❌ Troca Rejeitada',
      message: approved
        ? 'Sua troca foi concluída com sucesso.'
        : 'A peça não atende aos critérios de troca. Você pode pagar pela peça de reposição ou devolvê-la.',
      timestamp: new Date().toISOString(),
      data: returnData,
    });
  }

  notifyExchangeResolved(sellerId: string, accountId: string, returnData: any) {
    const paid = returnData.status === 'converted_to_sale';
    this.sendNotificationToUser(sellerId, accountId, {
      type: 'exchange_resolved',
      title: paid ? '💰 Cliente Pagou' : '📦 Cliente Devolveu Peça',
      message: paid
        ? 'O cliente optou por pagar pela peça de reposição. Troca convertida em venda.'
        : 'O cliente devolveu a peça de reposição. Estoque atualizado.',
      timestamp: new Date().toISOString(),
      data: returnData,
    });
  }

  notifyReturnResponded(buyerId: string, accountId: string, returnData: any) {
    const title = returnData.status === 'rejected'
      ? '❌ Troca Rejeitada'
      : '✅ Troca Aprovada';
    const message = returnData.status === 'rejected'
      ? 'Sua solicitação de troca foi rejeitada'
      : returnData.sellerDecision === 'replacement'
      ? 'Troca aprovada - produto será reposto'
      : 'Troca aprovada - valor será reembolsado';

    this.sendNotificationToUser(buyerId, accountId, {
      type: 'return_responded',
      title,
      message,
      timestamp: new Date().toISOString(),
      data: returnData,
    });
  }

  /**
   * Obter estatísticas de conexões
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      connectionsByAccount: Array.from(this.clients.values()).reduce((acc, client) => {
        acc[client.accountId] = (acc[client.accountId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Limpar recursos
   */
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.close();
    }

    this.clients.clear();
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

export default wsManager;