import { useMemo } from 'react'

interface Transaction {
  id: number
  date: string
  type: 'sale' | 'purchase'
  productId: number
  quantity: number
  sellerId?: string | null
  [key: string]: any
}

interface OrderForMapping {
  id: number
  orderCode: string
  createdAt: string
  buyerId: string
  sellerId: string
  parsedItems: Array<{ productId: number; quantity: number; [key: string]: any }>
  [key: string]: any
}

/**
 * Mapeia transações aos seus pedidos correspondentes usando
 * proximidade temporal + exclusão de pedidos já usados.
 *
 * Regras:
 *  1. Filtra pedidos pelo papel do usuário (buyer/seller) e pela contraparte.
 *  2. Filtra por productId + quantity nos itens do pedido.
 *  3. Ordena candidatos pela menor diferença de timestamp em relação à transação.
 *  4. Cada pedido só pode ser associado a UMA transação (Set de exclusão).
 */
export function useOrderTransactionMapping(
  transactions: Transaction[],
  orders: OrderForMapping[],
  userId: string | undefined | null,
) {
  return useMemo(() => {
    const map = new Map<number, OrderForMapping>()
    if (!userId || orders.length === 0 || transactions.length === 0) return map

    const usedOrderIds = new Set<number>()

    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )

    sorted.forEach((tx) => {
      const txTime = new Date(tx.date).getTime()

      const candidates = orders
        .filter((order) => {
          if (usedOrderIds.has(order.id)) return false
          if (tx.type === 'sale') return order.sellerId === userId
          return order.buyerId === userId && order.sellerId === tx.sellerId
        })
        .filter((order) =>
          order.parsedItems?.some(
            (item) =>
              Number(item.productId) === Number(tx.productId) &&
              Number(item.quantity) === Number(tx.quantity),
          ),
        )
        .map((order) => ({
          ...order,
          _timeDiff: Math.abs(new Date(order.createdAt).getTime() - txTime),
        }))
        .sort((a, b) => a._timeDiff - b._timeDiff)

      if (candidates[0]) {
        map.set(tx.id, candidates[0])
        usedOrderIds.add(candidates[0].id)
      }
    })

    return map
  }, [transactions, orders, userId])
}

export function parseOrderItems(items: any): any[] {
  if (Array.isArray(items)) return items
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}
