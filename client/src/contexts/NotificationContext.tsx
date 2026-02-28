import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket.tsx'

export interface Notification {
  id: string
  type: 'order' | 'message' | 'offer' | 'delivery' | 'system'
  title: string
  message: string
  timestamp: Date
  read: boolean
  data?: Record<string, any>
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
  isConnected: boolean
  connectionError: string | null
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)
const STORAGE_KEY = 'stocktech.notifications'

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { lastMessage, isConnected, connectionError } = useWebSocket()

  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Notification[]
      if (Array.isArray(parsed)) {
        setNotifications(parsed.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })))
      }
    } catch {
      // Ignora cache inválido
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      if (!event.newValue) {
        setNotifications([])
        return
      }
      try {
        const parsed = JSON.parse(event.newValue) as Notification[]
        if (Array.isArray(parsed)) {
          setNotifications(parsed.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp),
          })))
        }
      } catch {
        // Ignora payload inválido
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications])

  // Processar mensagens WebSocket e converter para notificações
  useEffect(() => {
    if (lastMessage) {
      const notificationType = mapWebSocketTypeToNotificationType(lastMessage.type)

      if (notificationType) {
        const newNotification: Notification = {
          id: `ws-${Date.now()}-${Math.random()}`,
          type: notificationType,
          title: lastMessage.title,
          message: lastMessage.message,
          timestamp: new Date(lastMessage.timestamp),
          read: false,
          data: lastMessage.data
        }

        setNotifications(prev => [newNotification, ...prev])
      }
    }
  }, [lastMessage])

  // Mapeia tipos WebSocket para tipos de notificação
  const mapWebSocketTypeToNotificationType = (wsType: string): Notification['type'] | null => {
    switch (wsType) {
      case 'order_created':
      case 'payment_confirmed':
      case 'order_updated':
        return 'order'
      case 'stock_alert':
        return 'system'
      case 'connection_established':
        return null
      default:
        return null
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    }
    setNotifications(prev => [newNotification, ...prev])
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        isConnected,
        connectionError,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de NotificationProvider')
  }
  return context
}
