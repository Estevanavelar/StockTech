import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import { trpc } from '../lib/trpc'

interface NotificationMessage {
  type:
    | 'order_created'
    | 'payment_confirmed'
    | 'order_updated'
    | 'stock_alert'
    | 'connection_established'
    | 'cart_updated'
    | 'product_added'
    | 'product_updated'
    | 'product_deleted'
    | 'transaction_created'
    | 'profile_updated'
  title: string
  message: string
  data?: Record<string, any>
  timestamp: string
}

interface UseWebSocketReturn {
  isConnected: boolean
  lastMessage: NotificationMessage | null
  connectionError: string | null
  reconnect: () => void
}

const WebSocketContext = createContext<UseWebSocketReturn | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<NotificationMessage | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // Obter token do usuário (através do tRPC context)
  const { data: currentUser } = trpc.system.getCurrentUser.useQuery(undefined, {
    enabled: typeof window !== 'undefined',
    retry: false
  })

  const connect = useCallback(() => {
    if (!currentUser?.token || !currentUser?.user?.accountId) {
      console.log('No user account available for WebSocket connection')
      setConnectionError(null)
      return
    }

    try {
      // Fechar conexão existente se houver
      if (wsRef.current) {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          return
        }
        wsRef.current.close()
      }

      // Criar nova conexão WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const baseUrl =
        import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/ws`
      const wsUrl = `${baseUrl}?token=${encodeURIComponent(currentUser.token)}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: NotificationMessage = JSON.parse(event.data)
          console.log('WebSocket message received:', message)
          setLastMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        // Tentar reconectar se não foi um fechamento intencional
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          console.log(`Attempting to reconnect in ${delay}ms...`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError('Falha ao conectar com o servidor de notificações')
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionError('Erro na conexão com o servidor de notificações')
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setConnectionError('Erro ao criar conexão WebSocket')
    }
  }, [currentUser?.token, currentUser?.user?.accountId])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])

  // Conectar quando o componente montar e o usuário estiver disponível
  useEffect(() => {
    if (currentUser?.token && !wsRef.current) {
      connect()
    }

    return () => {
      // Limpar na desmontagem
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close()
        }
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [currentUser?.token, connect])

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, connectionError, reconnect }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket(): UseWebSocketReturn {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket deve ser usado dentro de WebSocketProvider')
  }
  return context
}

// Hook específico para notificações de pedidos
export function useOrderNotifications() {
  const { lastMessage, isConnected } = useWebSocket()
  const [orderNotifications, setOrderNotifications] = useState<NotificationMessage[]>([])

  useEffect(() => {
    if (lastMessage && ['order_created', 'payment_confirmed', 'order_updated'].includes(lastMessage.type)) {
      setOrderNotifications(prev => [lastMessage, ...prev.slice(0, 9)]) // Manter últimas 10
    }
  }, [lastMessage])

  return {
    orderNotifications,
    isConnected,
    hasNewNotifications: orderNotifications.length > 0
  }
}

// Hook para alertas de estoque
export function useStockAlerts() {
  const { lastMessage, isConnected } = useWebSocket()
  const [stockAlerts, setStockAlerts] = useState<NotificationMessage[]>([])

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'stock_alert') {
      setStockAlerts(prev => [lastMessage, ...prev.slice(0, 4)]) // Manter últimas 5
    }
  }, [lastMessage])

  return {
    stockAlerts,
    isConnected,
    hasCriticalStock: stockAlerts.some(alert =>
      alert.data && alert.data.currentStock <= alert.data.minStock
    )
  }
}
