import React, { useState } from 'react'
import { useLocation } from 'wouter'
import { useNotifications } from '../contexts/NotificationContext'

export default function Notifications({ isModal }: { isModal?: boolean }) {
  const [, setLocation] = useLocation()
  const { notifications, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications

  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === 'order') {
        const status = notification.data?.status
        const title = notification.title.toLowerCase()
        
        if (status === 'cancelled' || title.includes('cancelado') || title.includes('rejeita')) return '❌'
        if (status === 'delivered' || title.includes('entregue')) return '🎁'
        if (status === 'shipped' || title.includes('enviado') || title.includes('transporte')) return '🚚'
        if (status === 'processing' || title.includes('processamento')) return '⚙️'
        if (status === 'paid' || title.includes('pagamento') || title.includes('pago')) return '💰'
        return '📦'
    }
    
    switch (notification.type) {
      case 'message':
        return '💬'
      case 'offer':
        return '🎁'
      case 'delivery':
        return '✅'
      default:
        return '🔔'
    }
  }

  const getOrderContext = (data?: any) => {
    if (!data || !data.items) return null
    try {
      const items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items
      if (Array.isArray(items) && items.length > 0) {
        const firstItem = items[0]
        const count = items.length
        const productName = firstItem.productName || firstItem.name || 'Produto'
        const productText = count > 1 ? `${productName} + ${count - 1} outros` : productName
        
        // Try to get seller name from item or notification data
        const sellerName = firstItem.sellerName || 'Vendedor'
        
        return { productText, sellerName }
      }
    } catch {
      return null
    }
    return null
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order':
        return 'border-blue-200 bg-blue-50'
      case 'message':
        return 'border-purple-200 bg-purple-50'
      case 'offer':
        return 'border-green-200 bg-green-50'
      case 'delivery':
        return 'border-emerald-200 bg-emerald-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}m atrás`
    if (hours < 24) return `${hours}h atrás`
    if (days < 7) return `${days}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

  return (
    <div className={`${isModal ? 'h-full flex flex-col' : 'min-h-screen'} bg-gradient-to-b from-gray-50 to-white`}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">🔔 Notificações</h1>
            <p className="text-xs text-gray-600 mt-1">{filteredNotifications.length} notificação(ões)</p>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Marcar tudo como lido
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-4 flex gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Não Lidas ({notifications.filter(n => !n.read).length})
          </button>
        </div>
      </header>

      <main className={`${isModal ? 'flex-1 overflow-y-auto' : 'max-w-2xl mx-auto'} px-4 py-6 space-y-3 no-scrollbar`}>
        {filteredNotifications.length > 0 ? (
          <>
            {filteredNotifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => !notification.read && markAsRead(notification.id)}
                className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                  getNotificationColor(notification.type)
                } ${!notification.read ? 'shadow-md' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{getNotificationIcon(notification)}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{notification.title}</h3>
                        <p className="text-xs text-gray-600 mt-0.5">{formatTime(notification.timestamp)}</p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-2">
                      {notification.message}
                      {(() => {
                        const ctx = getOrderContext(notification.data)
                        if (ctx) {
                            return (
                                <span className="block mt-2 text-xs text-gray-600 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                                    <span className="block font-medium text-gray-900 mb-0.5">📦 {ctx.productText}</span>
                                    <span className="block">🏪 {ctx.sellerName}</span>
                                </span>
                            )
                        }
                        return null
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeNotification(notification.id)
                    }}
                    className="text-gray-400 hover:text-red-600 text-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Action Buttons */}
                {notification.type === 'order' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const rawOrderId =
                          notification.data?.orderId ??
                          notification.data?.order_id ??
                          notification.data?.id
                        const orderCode = notification.data?.orderCode
                        const roleHint = (() => {
                          const title = notification.title?.toLowerCase() || ''
                          if (title.includes('recebido')) return 'VENDA'
                          if (title.includes('realizado')) return 'COMPRA'
                          if (title.includes('enviado')) return 'COMPRA'
                          if (title.includes('entregue')) return 'COMPRA'
                          return 'COMPRA'
                        })()
                        const parsedOrderId =
                          typeof rawOrderId === 'string'
                            ? Number(rawOrderId)
                            : rawOrderId

                        if (orderCode) {
                          setLocation(`/order-details/${roleHint}/${orderCode}`)
                          return
                        }

                        if (parsedOrderId && !Number.isNaN(parsedOrderId)) {
                          setLocation(`/order-details?id=${parsedOrderId}`)
                          return
                        }

                        setLocation('/order-history')
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Ver Pedido
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeNotification(notification.id)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                )}

                {notification.type === 'message' && (
                  <div className="mt-3">
                    <button className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors">
                      Responder
                    </button>
                  </div>
                )}

                {notification.type === 'delivery' && (
                  <div className="mt-3">
                    <button className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors">
                      Rastrear Entrega
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredNotifications.length > 0 && (
              <div className="text-center pt-4">
                <button
                  onClick={clearAll}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Limpar todas as notificações
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <p className="text-4xl mb-4">🔔</p>
            <p className="text-gray-600 mb-4">Nenhuma notificação</p>
            <button
              onClick={() => isModal ? document.querySelector('[data-slot="dialog-close"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true})) : setLocation('/catalog')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {isModal ? 'Fechar' : 'Voltar ao Catálogo'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
