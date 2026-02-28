import { useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { useWebSocket } from './useWebSocket.tsx'

export function useRealtimeData() {
  const utils = trpc.useUtils()
  const { lastMessage } = useWebSocket()

  useEffect(() => {
    if (!lastMessage) return

    switch (lastMessage.type) {
      case 'product_added':
      case 'product_updated':
      case 'product_deleted':
        void utils.products.list.invalidate()
        void utils.products.listMarketplace.invalidate()
        break
      case 'cart_updated':
        void utils.cart.list.invalidate()
        break
      case 'transaction_created':
        void utils.transactions.list.invalidate()
        break
      case 'profile_updated':
        void utils.sellerProfiles.getFullProfile.invalidate()
        break
      case 'order_created':
      case 'order_updated':
      case 'payment_confirmed':
        void utils.orders.list.invalidate()
        void utils.transactions.list.invalidate()
        break
      default:
        break
    }
  }, [lastMessage, utils])
}
