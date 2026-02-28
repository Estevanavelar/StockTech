import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAvAdminClient } from "../_core/avadmin-client";
import * as db from "../db";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { orders, products, transactions } from "../../drizzle/schema";
import { nanoid } from "nanoid";
import wsManager from "../_core/websocket";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const cep = require("cep-promise");

interface CEPData {
  latitude?: string;
  longitude?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
}

async function fetchCepData(cleanCep: string): Promise<CEPData> {
  try {
    return (await cep(cleanCep, { providers: ["brasilapi"] })) as CEPData;
  } catch (error) {
    console.warn("Falha ao consultar brasilapi, tentando fallback.", error);
    return (await cep(cleanCep)) as CEPData;
  }
}

async function calcularDistanciaEntreCeps(
  cepVendedor: string,
  cepComprador: string
): Promise<number> {
  try {
    const vendedorClean = cepVendedor.replace(/\D/g, "");
    const compradorClean = cepComprador.replace(/\D/g, "");

    if (vendedorClean.length !== 8 || compradorClean.length !== 8) {
      throw new Error("CEP inválido");
    }

    const vendedorData = await fetchCepData(vendedorClean);
    const compradorData = await fetchCepData(compradorClean);

    const lat1 = parseFloat(vendedorData.latitude || "0");
    const lon1 = parseFloat(vendedorData.longitude || "0");
    const lat2 = parseFloat(compradorData.latitude || "0");
    const lon2 = parseFloat(compradorData.longitude || "0");

    if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2) || lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) {
      console.warn("Coordenadas inválidas para cálculo de distância");
      return 0;
    }

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distancia = R * c;

    return Math.round(distancia * 10) / 10;
  } catch (error) {
    console.error("Erro ao calcular distância entre CEPs:", {
      cepVendedor,
      cepComprador,
      erro: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

function calcularFrete(distanciaKm: number): number {
  if (distanciaKm <= 3) {
    return 3.0;
  }

  const kmExcedente = distanciaKm - 3;
  const freteCalculado = 3.0 + kmExcedente * 1.5;
  return Math.round(freteCalculado * 100) / 100;
}

/**
 * ========================================
 * AVELAR SYSTEM - StockTech Orders Router
 * ========================================
 * Router de pedidos com confirmação manual de pagamento
 */

// Tipos para os itens do pedido
export const orderItemSchema = z.object({
  productId: z.number(),
  productName: z.string(),
  price: z.string(),
  quantity: z.number(),
  sellerId: z.string(), // UUID do vendedor
  sellerName: z.string().optional(),
  warrantyPeriod: z.enum(["NONE", "DAYS_7", "DAYS_30", "DAYS_90", "MONTHS_6"]).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema),
  addressId: z.number(),
  freightOption: z.string(),
  notes: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.number(),
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
  trackingCode: z.string().optional(),
  trackingCarrier: z.string().optional(),
});

const estimateFreightSchema = z.object({
  addressId: z.number(),
  items: z.array(
    z.object({
      productId: z.number(),
      quantity: z.number(),
      sellerId: z.string(),
    })
  ),
});

export const ordersRouter = router({
  /**
   * Estimar frete do pedido
   */
  estimateFreight: protectedProcedure
    .input(estimateFreightSchema)
    .query(async ({ input, ctx }) => {
      const database = await db.getDb();
      if (!database) throw new Error("Database not available");

      const { addresses, sellerProfiles } = await import("../../drizzle/schema");
      const userAddress = await database.select()
        .from(addresses)
        .where(and(
          eq(addresses.id, input.addressId),
          eq(addresses.userId, ctx.user!.id),
          eq(addresses.accountId, ctx.account!.id)
        ))
        .limit(1);

      if (!userAddress.length) {
        throw new Error("Endereço não encontrado ou não pertence ao usuário");
      }

      const itemsBySeller = input.items.reduce((acc, item) => {
        if (!acc[item.sellerId]) {
          acc[item.sellerId] = [];
        }
        acc[item.sellerId].push(item);
        return acc;
      }, {} as Record<string, typeof input.items>);

      const buyerZip = userAddress[0]?.zipCode || "28000000";
      let totalFreight = 0;
      const breakdown: Array<{ sellerId: string; sellerZip: string; buyerZip: string; distanceKm: number; freight: number; storeName: string }> = [];

      for (const [sellerId] of Object.entries(itemsBySeller)) {
        const sellerProfile = await database
          .select()
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, sellerId as any))
          .limit(1);

        const sellerZip = sellerProfile[0]?.zipCode || "28000000";
        const storeName = sellerProfile[0]?.storeName || `Vendedor ${String(sellerId).slice(0, 6)}`;
        const distanceKm = await calcularDistanciaEntreCeps(sellerZip, buyerZip);
        const freight = calcularFrete(distanceKm);

        totalFreight += freight;
        breakdown.push({ sellerId, sellerZip, buyerZip, distanceKm, freight, storeName });
      }

      return {
        totalFreight,
        breakdown,
      };
    }),
  /**
   * Criar novo pedido
   * - Agrupa itens por vendedor
   * - Gera código único do pedido
   * - Define status inicial como "pending_payment"
   */
  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        // Validar que o endereço pertence ao usuário
        const { addresses } = await import("../../drizzle/schema");
        const userAddress = await database.select()
          .from(addresses)
          .where(and(
            eq(addresses.id, input.addressId),
            eq(addresses.userId, ctx.user!.id),
            eq(addresses.accountId, ctx.account!.id)
          ))
          .limit(1);

        if (!userAddress.length) {
          throw new Error("Endereço não encontrado ou não pertence ao usuário");
        }

        // ANTES de criar os pedidos, dar baixa definitiva no estoque
        const { products } = await import("../../drizzle/schema");
        for (const item of input.items) {
          const product = await database.select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          if (!product[0]) {
            throw new Error(`Produto ${item.productName} não encontrado`);
          }

          const currentStock = product[0].quantity ?? 0;
          if (currentStock < item.quantity) {
            throw new Error(`Estoque insuficiente para ${item.productName}`);
          }

          // Dar baixa definitiva
          await database.update(products)
            .set({
              quantity: currentStock - item.quantity,
              updatedAt: new Date()
            })
            .where(eq(products.id, item.productId));
        }

        // Agrupar itens por vendedor
        const itemsBySeller = input.items.reduce((acc, item) => {
          if (!acc[item.sellerId]) {
            acc[item.sellerId] = [];
          }
          acc[item.sellerId].push(item);
          return acc;
        }, {} as Record<string, typeof input.items>);

        // Calcular valores e criar pedidos por vendedor
        const createdOrders = [];
        let totalOrderValue = 0;
        const avAdminClient = getAvAdminClient();
        const parentOrderCode = `ORD-${nanoid(8).toUpperCase()}`; // Código único para o pedido do comprador

        for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
          let sellerAccountId = ctx.account!.id;
          let sellerOwnerCpf = ctx.account!.owner_cpf;
          const firstProduct = await database.select({ accountId: products.accountId, ownerCpf: products.ownerCpf })
            .from(products)
            .where(eq(products.id, sellerItems[0].productId))
            .limit(1);
          try {
            const sellerUser = await avAdminClient.getUserById(String(sellerId));
            if (sellerUser?.account_id) {
              sellerAccountId = sellerUser.account_id;
            } else if (firstProduct[0]?.accountId) {
              sellerAccountId = firstProduct[0].accountId;
            }
            sellerOwnerCpf = firstProduct[0]?.ownerCpf ?? sellerOwnerCpf;
            const sellerAccount = await avAdminClient.getAccountById(String(sellerAccountId));
            if (sellerAccount?.owner_cpf) sellerOwnerCpf = sellerAccount.owner_cpf;
          } catch (error) {
            if (firstProduct[0]?.accountId) {
              sellerAccountId = firstProduct[0].accountId;
              sellerOwnerCpf = firstProduct[0].ownerCpf;
            } else {
              console.warn("Nao foi possivel resolver account_id do vendedor. Usando account_id do comprador.", error);
            }
          }
          // Calcular subtotal do vendedor
          const subtotal = sellerItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
          }, 0);

          const { sellerProfiles } = await import("../../drizzle/schema");
          const sellerProfile = await database
            .select()
            .from(sellerProfiles)
            .where(eq(sellerProfiles.userId, sellerId as any))
            .limit(1);

          const cepVendedor = sellerProfile[0]?.zipCode || "28000000";
          const cepComprador = userAddress[0]?.zipCode || "28000000";
          const distancia = await calcularDistanciaEntreCeps(cepVendedor, cepComprador);
          const freightPreview = calcularFrete(distancia);

          console.log(
            `Frete estimado (nao aplicado) | vendedor: ${cepVendedor} comprador: ${cepComprador} distancia: ${distancia}km frete: R$ ${freightPreview.toFixed(2)}`
          );

          const orderData = {
            accountId: ctx.account!.id,
            ownerCpf: ctx.account!.owner_cpf,
            buyerAccountId: ctx.account!.id,
            sellerAccountId,
            buyerId: ctx.user!.id,
            sellerId: sellerId as any, // UUID
            orderCode: `ORD-${nanoid(8).toUpperCase()}`,
            parentOrderCode, // Vincula ao pedido principal
            status: "pending_payment" as const,
            subtotal: subtotal.toString(),
            freight: "0",
            total: subtotal.toString(),
            addressId: input.addressId,
            items: JSON.stringify(sellerItems),
            paymentNotes: "Pagamento via PIX ou transferência bancária. Entre em contato com o vendedor para obter os dados de pagamento.",
            notes: input.notes,
          };

          const result = await database.insert(orders).values(orderData).returning();
          createdOrders.push(result[0]);
          totalOrderValue += subtotal;

          const buyerName = ctx.user?.full_name || ctx.user?.cpf || 'Comprador';

          for (const item of sellerItems) {
            const itemTotal = (parseFloat(item.price) * item.quantity).toFixed(2);
            const sellerName = item.sellerName || `Vendedor ${String(sellerId).slice(0, 6)}`;

            await database.insert(transactions).values([
              {
                accountId: ctx.account!.id,
                ownerCpf: ctx.account!.owner_cpf,
                buyerId: ctx.user!.id,
                sellerId: sellerId as any,
                transactionCode: `TRX-${nanoid(8).toUpperCase()}`,
                type: "purchase",
                productId: item.productId,
                productName: item.productName,
                counterparty: sellerName,
                counterpartyRole: "seller",
                amount: itemTotal,
                quantity: item.quantity,
                status: "pending",
              },
              {
                accountId: sellerAccountId,
                ownerCpf: sellerOwnerCpf,
                buyerId: ctx.user!.id,
                sellerId: sellerId as any,
                transactionCode: `TRX-${nanoid(8).toUpperCase()}`,
                type: "sale",
                productId: item.productId,
                productName: item.productName,
                counterparty: buyerName,
                counterpartyRole: "buyer",
                amount: itemTotal,
                quantity: item.quantity,
                status: "pending",
              },
            ]);
          }

          // Incrementar uso no AvAdmin
          await avAdminClient.incrementUsage(ctx.account!.id, 'order_created');
        }

        // Enviar notificações WebSocket
        createdOrders.forEach(order => {
          wsManager.notifyOrderCreated(
            order.buyerId,
            order.sellerId,
            order.buyerAccountId || ctx.account!.id,
            order.sellerAccountId || ctx.account!.id,
            order
          );
        });

        // APÓS criar pedido com sucesso, limpar carrinho
        const { carts } = await import("../../drizzle/schema");
        await database.delete(carts)
          .where(and(
            eq(carts.userId, ctx.user!.id),
            eq(carts.accountId, ctx.account!.id)
          ));

        return {
          success: true,
          orders: createdOrders,
          totalValue: totalOrderValue,
          message: "Pedido criado com sucesso! Aguarde o vendedor aceitar a venda."
        };

      } catch (error: any) {
        console.error("Error creating order:", error);
        throw new Error(`Erro ao criar pedido: ${error.message}`);
      }
    }),

  /**
   * Confirmar pagamento (apenas vendedor do pedido)
   */
  confirmPayment: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        // Buscar pedido verificando se a conta participa (comprador ou vendedor)
        const order = await database.select()
          .from(orders)
          .where(and(
            eq(orders.id, input.orderId),
            or(
              eq(orders.accountId, ctx.account!.id),
              eq(orders.buyerAccountId, ctx.account!.id),
              eq(orders.sellerAccountId, ctx.account!.id)
            )
          ))
          .limit(1);

        if (!order.length) {
          throw new Error("Pedido não encontrado");
        }

        const pedido = order[0];

        // Verificar se o usuário é o vendedor do pedido
        if (pedido.sellerId !== ctx.user!.id) {
          throw new Error("Acesso negado: você não é o vendedor deste pedido");
        }

        // Verificar se o pedido está no estágio de aceite/pagamento
        if (!["pending_payment", "processing"].includes(pedido.status)) {
          throw new Error("Este pedido não está disponível para confirmação de pagamento");
        }

        // Atualizar pedido
        await database.update(orders)
          .set({
            status: "paid",
            paymentConfirmedAt: new Date(),
            paymentConfirmedBy: ctx.user!.id,
            updatedAt: new Date()
          })
          .where(eq(orders.id, input.orderId));

        // Atualizar transacoes relacionadas ao pedido
        const rawItems = pedido.items as any;
        let parsedItems: any[] = [];
        if (Array.isArray(rawItems)) {
          parsedItems = rawItems;
        } else if (typeof rawItems === 'string') {
          try {
            parsedItems = JSON.parse(rawItems);
          } catch {
            parsedItems = [];
          }
        }

        if (parsedItems.length > 0) {
          for (const item of parsedItems) {
            await database.update(transactions)
              .set({ status: "completed", updatedAt: new Date() })
              .where(and(
                eq(transactions.buyerId, pedido.buyerId),
                eq(transactions.sellerId, pedido.sellerId),
                eq(transactions.productId, Number(item.productId)),
                eq(transactions.quantity, Number(item.quantity)),
                eq(transactions.type, "purchase")
              ));

            await database.update(transactions)
              .set({ status: "completed", updatedAt: new Date() })
              .where(and(
                eq(transactions.buyerId, pedido.buyerId),
                eq(transactions.sellerId, pedido.sellerId),
                eq(transactions.productId, Number(item.productId)),
                eq(transactions.quantity, Number(item.quantity)),
                eq(transactions.type, "sale")
              ));
          }
        }

        // Enviar notificações WebSocket
        wsManager.notifyPaymentConfirmed(
          pedido.buyerId,
          pedido.sellerId,
          pedido.buyerAccountId || ctx.account!.id,
          pedido.sellerAccountId || ctx.account!.id,
          pedido
        );

        return {
          success: true,
          message: "Pagamento confirmado com sucesso!"
        };

      } catch (error: any) {
        console.error("Error confirming payment:", error);
        throw new Error(`Erro ao confirmar pagamento: ${error.message}`);
      }
    }),

  /**
   * Atualizar status do pedido (apenas vendedor)
   */
  updateStatus: protectedProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        // Buscar pedido verificando se a conta participa (comprador ou vendedor)
        const order = await database.select()
          .from(orders)
          .where(and(
            eq(orders.id, input.orderId),
            or(
              eq(orders.accountId, ctx.account!.id),
              eq(orders.buyerAccountId, ctx.account!.id),
              eq(orders.sellerAccountId, ctx.account!.id)
            )
          ))
          .limit(1);

        if (!order.length) {
          throw new Error("Pedido não encontrado");
        }

        const pedido = order[0];

        // Verificar se o usuário é o vendedor do pedido
        if (pedido.sellerId !== ctx.user!.id) {
          throw new Error("Acesso negado: você não é o vendedor deste pedido");
        }

        // Validar transição de status
        const validTransitions: Record<string, string[]> = {
          pending_payment: ["processing", "cancelled"], // vendedor aceita ou rejeita
          processing: ["paid", "shipped", "cancelled"], // marcar pago ou enviar
          paid: ["delivered", "shipped"],               // finalizar venda ou enviar
          shipped: ["delivered"],
          delivered: [], // Estado final
          cancelled: []  // Estado final
        };

        if (!validTransitions[pedido.status]?.includes(input.status)) {
          throw new Error(`Transição de status inválida: ${pedido.status} → ${input.status}`);
        }

        // Atualizar pedido
        const updateData: any = {
          status: input.status,
          updatedAt: new Date()
        };

        if (input.trackingCode) updateData.trackingCode = input.trackingCode;
        if (input.trackingCarrier) updateData.trackingCarrier = input.trackingCarrier;

        await database.update(orders)
          .set(updateData)
          .where(eq(orders.id, input.orderId));

        // Enviar notificações WebSocket
        if (['processing', 'paid', 'shipped', 'delivered'].includes(input.status)) {
          // Notificar o comprador sobre atualização de status
          wsManager.notifyOrderStatusUpdated(
            pedido.buyerId,
            pedido.buyerAccountId || ctx.account!.id,
            pedido,
            input.status
          );
        }

        return {
          success: true,
          message: `Status atualizado para ${input.status}`
        };

      } catch (error: any) {
        console.error("Error updating order status:", error);
        throw new Error(`Erro ao atualizar status: ${error.message}`);
      }
    }),

  /**
   * Listar pedidos do usuário (como comprador E vendedor)
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["all", "pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }).optional())
    .query(async ({ input, ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return { orders: [], total: 0 };

        const limit = input?.limit ?? 20;
        const offset = input?.offset ?? 0;

        // Buscar pedidos da conta (comprador ou vendedor da empresa)
        let whereCondition = or(
          eq(orders.accountId, ctx.account!.id),
          eq(orders.buyerAccountId, ctx.account!.id),
          eq(orders.sellerAccountId, ctx.account!.id)
        );

        // Filtrar por status se especificado
        if (input?.status && input.status !== "all") {
          whereCondition = and(whereCondition, eq(orders.status, input.status));
        }

        // Também filtrar por conta (ja incluido acima)

        const result = await database.select()
          .from(orders)
          .where(whereCondition)
          .orderBy(desc(orders.createdAt))
          .limit(limit)
          .offset(offset);

        // Contar total
        const totalResult = await database.$count(orders, whereCondition);
        const total = Array.isArray(totalResult) ? totalResult.length : totalResult;

        // Parsear itens e injetar garantia a partir dos produtos
        const parsedOrders = result.map((order) => {
          let items: any[] = [];
          try {
            items = JSON.parse(order.items as any) || [];
          } catch {
            items = [];
          }
          return { ...order, items };
        });

        const productIds = Array.from(
          new Set(
            parsedOrders.flatMap((order) =>
              Array.isArray(order.items)
                ? order.items
                    .map((item: any) => Number(item.productId))
                    .filter((id) => Number.isFinite(id))
                : []
            )
          )
        );

        if (productIds.length > 0) {
          const productRows = await database
            .select({ id: products.id, warrantyPeriod: products.warrantyPeriod })
            .from(products)
            .where(inArray(products.id, productIds));

          const warrantyById = new Map(
            productRows.map((row) => [row.id, row.warrantyPeriod])
          );

          parsedOrders.forEach((order) => {
            if (!Array.isArray(order.items)) return;
            order.items = order.items.map((item: any) => ({
              ...item,
              warrantyPeriod:
                item.warrantyPeriod ?? warrantyById.get(Number(item.productId)) ?? 'NONE',
            }));
          });
        }

        return {
          orders: parsedOrders,
          total,
          hasMore: (offset + limit) < total
        };

      } catch (error: any) {
        console.error("Error listing orders:", error);
        return { orders: [], total: 0 };
      }
    }),

  /**
   * Obter detalhes de um pedido específico
   * Se o pedido fizer parte de um grupo (parentOrderCode), retorna todos os sub-pedidos se o solicitante for o comprador.
   * Se for o vendedor, retorna apenas o pedido dele.
   */
  getById: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input, ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return null;

        const { addresses, sellerProfiles } = await import("../../drizzle/schema");
        const avAdminClient = getAvAdminClient();
        const accountCache = new Map<string, any>();
        const getAccount = async (accountId?: string | null) => {
          if (!accountId) return null;
          if (accountCache.has(accountId)) return accountCache.get(accountId);
          try {
            const account = await avAdminClient.getAccountById(accountId);
            accountCache.set(accountId, account);
            return account;
          } catch (error) {
            console.warn("Falha ao buscar conta no AvAdmin:", error);
            accountCache.set(accountId, null);
            return null;
          }
        };

        // Primeiro busca o pedido solicitado para verificar permissões e parentOrderCode
        const initialResult = await database.select()
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .limit(1);

        if (!initialResult.length) return null;
        const initialOrder = initialResult[0];

        // Verificação básica de permissão
        if (
          initialOrder.accountId !== ctx.account!.id &&
          initialOrder.buyerAccountId !== ctx.account!.id &&
          initialOrder.sellerAccountId !== ctx.account!.id &&
          initialOrder.buyerId !== ctx.user!.id &&
          initialOrder.sellerId !== ctx.user!.id
        ) {
          return null;
        }

        // Se for o COMPRADOR e existir parentOrderCode, buscar todos os pedidos irmãos
        const isBuyer = initialOrder.buyerId === ctx.user!.id;
        let relatedOrders = [initialOrder];

        if (isBuyer && initialOrder.parentOrderCode) {
          relatedOrders = await database.select()
            .from(orders)
            .where(eq(orders.parentOrderCode, initialOrder.parentOrderCode))
            .orderBy(desc(orders.createdAt));
        }

        // Processar os pedidos (parse JSON, buscar nomes de loja)
        const processedOrders = await Promise.all(relatedOrders.map(async (order) => {
          try {
            (order as any).items = JSON.parse(order.items as string);
          } catch (e) {
            (order as any).items = [];
          }

          if (order.addressId) {
            try {
              const address = await database.select()
                .from(addresses)
                .where(eq(addresses.id, order.addressId))
                .limit(1);
              if (address[0]) {
                (order as any).address = address[0];
              }
            } catch (error) {
              console.error("Error loading order address:", error);
            }
          }

          const buyerAccount = await getAccount(order.buyerAccountId || order.accountId);
          const sellerAccount = await getAccount(order.sellerAccountId || order.accountId);
          if (buyerAccount) (order as any).buyerAccount = buyerAccount;
          if (sellerAccount) (order as any).sellerAccount = sellerAccount;

          // Resolver nome da loja do vendedor
          if (order.sellerId) {
            const sellerProfile = await database.select({ storeName: sellerProfiles.storeName })
              .from(sellerProfiles)
              .where(eq(sellerProfiles.userId, order.sellerId))
              .limit(1);

            if (sellerProfile[0]?.storeName) {
              (order as any).sellerStoreName = sellerProfile[0].storeName;
            }
          }

          return order;
        }));

        // Se for comprador e houver múltiplos pedidos, retorna uma estrutura unificada ou lista
        // Para manter compatibilidade com o frontend atual que espera um objeto unico,
        // vamos retornar o "pedido pai" virtual se houver multiplos, ou o pedido unico.
        // O frontend precisará ser ajustado para lidar com 'subOrders'

        if (processedOrders.length > 1 && isBuyer) {
          // Criar um objeto "pai" virtual agregando os valores
          const parentOrder = {
            ...processedOrders[0],
            id: 0, // ID virtual
            orderCode: processedOrders[0].parentOrderCode!, // Mostra o código pai
            subtotal: processedOrders.reduce((sum, o) => sum + parseFloat(o.subtotal), 0).toFixed(2),
            freight: processedOrders.reduce((sum, o) => sum + parseFloat(o.freight), 0).toFixed(2),
            total: processedOrders.reduce((sum, o) => sum + parseFloat(o.total), 0).toFixed(2),
            // items: agora contém todos os itens de todos os pedidos
            items: processedOrders.flatMap(o => ((o as any).items as any[]).map(item => ({
              ...item,
              sellerId: o.sellerId,
              orderId: o.id, // Referência ao pedido original
              orderStatus: o.status, // Status específico deste sub-pedido
              trackingCode: o.trackingCode,
              trackingCarrier: o.trackingCarrier,
              sellerStoreName: (o as any).sellerStoreName
            }))),
            // Campo novo para o frontend saber que é um pedido agrupado
            isGrouped: true,
            subOrders: processedOrders
          };
          return parentOrder;
        }

        // Retorno padrão (único pedido ou vendedor vendo sua parte)
        return {
          ...processedOrders[0],
          isGrouped: false,
          sellerStoreName: (processedOrders[0] as any).sellerStoreName
        };

      } catch (error: any) {
        console.error("Error getting order:", error);
        return null;
      }
    }),

  /**
   * Cancelar pedido (comprador ou vendedor)
   */
  cancel: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      reason: z.string().min(10).max(500)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        // Buscar pedido verificando se a conta participa (comprador ou vendedor)
        const order = await database.select()
          .from(orders)
          .where(and(
            eq(orders.id, input.orderId),
            or(
              eq(orders.accountId, ctx.account!.id),
              eq(orders.buyerAccountId, ctx.account!.id),
              eq(orders.sellerAccountId, ctx.account!.id)
            )
          ))
          .limit(1);

        if (!order.length) {
          throw new Error("Pedido não encontrado");
        }

        const pedido = order[0];

        // Verificar se usuário pode cancelar (comprador ou vendedor)
        const isBuyer = pedido.buyerId === ctx.user!.id;
        const isSeller = pedido.sellerId === ctx.user!.id;

        if (!isBuyer && !isSeller) {
          throw new Error("Acesso negado");
        }

        // Verificar se pode cancelar baseado no status
        const cancellableStatuses = ["pending_payment", "paid", "processing"];
        if (!cancellableStatuses.includes(pedido.status)) {
          throw new Error("Este pedido não pode mais ser cancelado");
        }

        // Atualizar pedido
        await database.update(orders)
          .set({
            status: "cancelled",
            notes: (pedido.notes || "") + `\n\nCANCELADO: ${input.reason}`,
            updatedAt: new Date()
          })
          .where(eq(orders.id, input.orderId));

        // Devolver itens ao estoque
        const rawItems = pedido.items as any;
        let parsedItems: any[] = [];
        if (Array.isArray(rawItems)) {
          parsedItems = rawItems;
        } else if (typeof rawItems === 'string') {
          try {
            parsedItems = JSON.parse(rawItems);
          } catch {
            parsedItems = [];
          }
        }

        for (const item of parsedItems) {
          const product = await database.select()
            .from(products)
            .where(eq(products.id, Number(item.productId)))
            .limit(1);

          if (product[0]) {
            const currentStock = product[0].quantity ?? 0;
            await database.update(products)
              .set({
                quantity: currentStock + Number(item.quantity),
                updatedAt: new Date()
              })
              .where(eq(products.id, Number(item.productId)));
          }
        }
        // TODO: Notificar a outra parte
        wsManager.notifyOrderStatusUpdated(
          pedido.buyerId,
          pedido.buyerAccountId || ctx.account!.id,
          pedido,
          "cancelled"
        );

        wsManager.notifyOrderStatusUpdated(
          pedido.sellerId,
          pedido.sellerAccountId || ctx.account!.id,
          pedido,
          "cancelled"
        );

        return {
          success: true,
          message: "Pedido cancelado com sucesso"
        };

      } catch (error: any) {
        console.error("Error cancelling order:", error);
        throw new Error(`Erro ao cancelar pedido: ${error.message}`);
      }
    }),
});

export default ordersRouter;