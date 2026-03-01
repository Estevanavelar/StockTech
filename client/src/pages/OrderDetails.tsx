import React, { useMemo, useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'

function ProductRatingItem({ item, sellerId, onRate, isSubmitting }: { 
  item: any, 
  sellerId: string, 
  onRate: (rating: number, comment: string) => void,
  isSubmitting: boolean
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="text-sm text-green-600 font-medium py-2">
        ✓ Avaliação enviada
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className={`text-2xl transition-colors ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            ★
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-2">
          {rating > 0 ? `${rating} estrela${rating > 1 ? 's' : ''}` : 'Selecione a nota'}
        </span>
      </div>
      
      {rating > 0 && (
        <div className="space-y-3 animate-fadeIn">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`O que achou de ${item.productName}?`}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
            rows={2}
          />
          <button
            onClick={() => {
              onRate(rating, comment)
              setSubmitted(true)
            }}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function OrderDetails() {
  const [location, setLocation] = useLocation()
  const [activeTab, setActiveTab] = useState<'info' | 'rating'>('info')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [resolvedOrderId, setResolvedOrderId] = useState<number | null>(null)
  const { showToast } = useToast()
  const utils = trpc.useUtils() // Access TRPC utils for manual fetching

  const orderParams = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    const productId = params.get('productId')
    const sellerId = params.get('sellerId')
    const transactionId = params.get('transactionId')
    const tab = params.get('tab')
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const hasDetailsPath = pathParts[0] === 'order-details' && pathParts.length >= 3
    const roleFromPath = hasDetailsPath ? decodeURIComponent(pathParts[1]) : null
    const codeFromPath = hasDetailsPath ? decodeURIComponent(pathParts[2]) : null
    return {
      orderId: id ? Number(id) : null,
      productId: productId ? Number(productId) : null,
      sellerId: sellerId || null,
      transactionId: transactionId ? Number(transactionId) : null,
      tab: tab || null,
      orderCode: codeFromPath || null,
      role: roleFromPath || null,
    }
  }, [location])

  useEffect(() => {
    if (orderParams?.tab === 'rating') {
      setActiveTab('rating')
    }
  }, [orderParams?.tab])

  const meQuery = trpc.auth.me.useQuery()
  const ordersListQuery = trpc.orders.list.useQuery({ limit: 50, offset: 0 })
  const createRatingMutation = trpc.ratings.create.useMutation()
  const returnsQuery = trpc.returns.list.useQuery()

  const formatStatus = (status?: string | null) => {
    switch (status) {
      case 'pending_payment':
        return 'Solicitação pendente'
      case 'paid':
        return 'Pago'
      case 'processing':
        return 'Aceito / Em transporte'
      case 'shipped':
        return 'Em transporte'
      case 'delivered':
        return 'Finalizado'
      case 'awaiting_exchange':
        return 'Aguardando Troca'
      case 'exchange_completed':
        return 'Troca Feita'
      case 'exchange_rejected':
        return 'Troca Recusada'
      case 'cancelled':
        return 'Cancelado'
      default:
        return status || 'Status indisponível'
    }
  }

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'awaiting_exchange':
        return 'bg-orange-100 text-orange-800'
      case 'exchange_completed':
        return 'bg-teal-100 text-teal-800'
      case 'exchange_rejected':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatReturnStatus = (status?: string | null) => {
    switch (status) {
      case 'requested':
        return 'Solicitação enviada'
      case 'approved_replacement':
        return 'Troca aprovada'
      case 'approved_refund':
        return 'Reembolso aprovado'
      case 'rejected':
        return 'Troca recusada'
      case 'completed':
        return 'Troca concluída'
      default:
        return status || 'Status indisponível'
    }
  }

  const formatReturnDate = (value?: string | null) => {
    if (!value) return 'Data indisponível'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Data indisponível'
    return date.toLocaleString('pt-BR')
  }

  const resolveSellerName = (sellerId?: string | null, sellerName?: string | null) => {
    if (sellerName) return sellerName
    if (!sellerId) return 'Vendedor não informado'
    return `Vendedor ${sellerId.slice(0, 6)}`
  }

  const formatSellerAccountAddress = (account?: any | null) => {
    if (!account) return ''
    const line1 = account.address || ''
    const line2 = [account.city, account.state].filter(Boolean).join(' - ')
    const line3 = account.zip_code ? `CEP ${account.zip_code}` : ''
    return [line1, line2, line3].filter(Boolean).join(', ')
  }

  const formatBuyerAddress = (address?: any | null) => {
    if (!address) return ''
    const line1 = [address.street, address.number].filter(Boolean).join(', ')
    const line2 = [address.neighborhood, address.city, address.state].filter(Boolean).join(' - ')
    const line3 = address.zipCode ? `CEP ${address.zipCode}` : ''
    return [line1, line2, line3].filter(Boolean).join(', ')
  }

  const buildMapsRouteUrl = (origin: string, destination: string) => {
    if (!origin || !destination) return ''
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
  }

  useEffect(() => {
    if (orderParams?.orderId && !Number.isNaN(orderParams.orderId)) {
      setResolvedOrderId(orderParams.orderId)
      return
    }

    if (typeof window === 'undefined') return

    try {
      const raw = sessionStorage.getItem('last_checkout_orders')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const last = parsed[parsed.length - 1]
          if (last?.id) {
            setResolvedOrderId(Number(last.id))
            return
          }
        }
      }
    } catch (error) {
      console.warn('Falha ao ler último pedido do sessionStorage', error)
    }

    if (ordersListQuery.data?.orders?.length) {
      if (orderParams?.orderCode) {
        const matchByCode = ordersListQuery.data.orders
          .slice()
          .reverse()
          .find((order) => String(order.orderCode) === String(orderParams.orderCode))
        if (matchByCode?.id) {
          setResolvedOrderId(Number(matchByCode.id))
          return
        }
      }

      if (orderParams?.productId && orderParams.sellerId) {
        const match = ordersListQuery.data.orders
          .slice()
          .reverse()
          .find((order) => {
            try {
              const items = JSON.parse(order.items as string)
              return Array.isArray(items) && items.some((item: any) =>
                Number(item.productId) === orderParams.productId &&
                String(item.sellerId) === String(orderParams.sellerId)
              )
            } catch {
              return false
            }
          })
        if (match?.id) {
          setResolvedOrderId(Number(match.id))
          return
        }
      }

      const last = ordersListQuery.data.orders[ordersListQuery.data.orders.length - 1]
      if (last?.id) {
        setResolvedOrderId(Number(last.id))
      }
    }
  }, [orderParams, ordersListQuery.data])

  const orderQuery = trpc.orders.getById.useQuery(
    { orderId: resolvedOrderId as number },
    { enabled: !!resolvedOrderId }
  )

  const order = orderQuery.data
  const items = Array.isArray(order?.items) ? order!.items : []
  const firstItem = items[0]
  const sellerName = resolveSellerName(order?.sellerId, firstItem?.sellerName)
  const statusLabel = formatStatus(order?.status)
  const reviewAuthor = meQuery.data?.name || meQuery.data?.email || 'Cliente'

  // Agrupamento de sub-pedidos se houver
  const subOrders = useMemo(() => {
    if (order?.isGrouped && order.subOrders) {
      return order.subOrders
    }
    // Se não for agrupado, cria uma lista com o próprio pedido para unificar a renderização
    return order ? [order] : []
  }, [order])

  const returnsForOrder = useMemo(() => {
    if (!returnsQuery.data || !subOrders.length) return []
    const orderIds = new Set(subOrders.map((subOrder: any) => subOrder.id))
    return returnsQuery.data.filter((ret: any) => orderIds.has(ret.orderId))
  }, [returnsQuery.data, subOrders])

  if (!resolvedOrderId && !ordersListQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">Pedido não informado.</p>
          <button
            onClick={() => setLocation('/order-history')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver meus pedidos
          </button>
        </div>
      </div>
    )
  }

  if (orderQuery.isLoading || ordersListQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Carregando pedido...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Pedido não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation('/transactions')}
            className="text-gray-600 hover:text-gray-900 text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Detalhes do Pedido</h1>
            <p className="text-xs text-gray-600">ID: {order.orderCode}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Renderiza um card para cada sub-pedido (ou o pedido único) */}
        {subOrders.map((subOrder: any) => {
          const subItems = Array.isArray(subOrder.items) ? subOrder.items : []
          const subFirstItem = subItems[0]
          const subSellerName = resolveSellerName(subOrder.sellerId, subOrder.sellerStoreName || subFirstItem?.sellerName)
          const subStatusLabel = formatStatus(subOrder.status)

          return (
            <div key={subOrder.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {subOrder.isGrouped ? `Pacote de ${subSellerName}` : (subFirstItem?.productName || 'Pedido')}
                  </h2>
                  <p className="text-xs text-gray-600 mt-1">Vendedor: {subSellerName}</p>
            </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(subOrder.status)}`}>
                  {subStatusLabel}
            </span>
          </div>

              {/* Lista de itens deste sub-pedido */}
              <div className="space-y-3 mb-4">
                 {subItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                       <span className="text-gray-800 font-medium">{item.quantity}x {item.productName}</span>
                       <span className="text-gray-600">R$ {parseFloat(item.price).toLocaleString('pt-BR')}</span>
                    </div>
                 ))}
              </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
                  <p className="text-xs text-gray-600 mb-1">Valor do Pacote</p>
                  <p className="text-xl font-bold text-gray-900">R$ {parseFloat(subOrder.total).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Criado em</p>
                  <p className="text-lg font-bold text-gray-900">{new Date(subOrder.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              
              {/* Informações de rastreio sempre visíveis */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600"><strong>Código de Rastreio:</strong> {subOrder.trackingCode || 'Não informado'}</p>
                <p className="text-sm text-gray-600"><strong>Transportadora:</strong> {subOrder.trackingCarrier || 'Não informado'}</p>
                {(() => {
                  const origin = formatSellerAccountAddress(subOrder.sellerAccount)
                  const destination = formatBuyerAddress(subOrder.address)
                  const mapsUrl = buildMapsRouteUrl(origin, destination)
                  if (!mapsUrl) {
                    return (
                      <p className="text-xs text-gray-500 mt-2">
                        Rota no Google Maps indisponível para este pedido.
                      </p>
                    )
                  }
                  return (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      🗺️ Ver rota no Google Maps
                    </a>
                  )
                })()}
              </div>
            </div>
          )
        })}

        {/* Resumo Total (se for agrupado) */}
        {order?.isGrouped && (
             <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700">Total do Pedido Completo</span>
                    <span className="font-bold text-xl text-blue-600">R$ {parseFloat(order.total).toLocaleString('pt-BR')}</span>
          </div>
        </div>
        )}

        <div className="flex gap-2 bg-white rounded-2xl border border-gray-100 p-2 shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ℹ️ Info
          </button>
          <button
            onClick={() => setActiveTab('rating')}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'rating'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⭐ Avaliação
          </button>
        </div>

        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">📋 Informações Gerais</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID do Pedido Principal:</span>
                  <span className="font-medium text-gray-900">{order.orderCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="font-medium text-gray-900">R$ {parseFloat(order.total).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>

            {returnsForOrder.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">🔄 Informações de Troca</h3>
                <div className="space-y-3 text-sm">
                  {returnsForOrder.map((ret: any) => (
                    <div key={ret.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-gray-900">{ret.productName || 'Produto'}</span>
                        <span className="text-xs text-gray-600">{formatReturnStatus(ret.status)}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-700">
                        <p>Código da Troca: {ret.returnCode}</p>
                        <p>Código do Pedido: {ret.orderCode || '---'}</p>
                        <p>Código do Produto: {ret.productCode || '---'}</p>
                        <p>Quantidade: {ret.quantity}</p>
                        <p>Solicitado em: {formatReturnDate(ret.createdAt)}</p>
                        {ret.rejectionReason && (
                          <p>Motivo da recusa: {ret.rejectionReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rating' && (
          <div className="space-y-4">
            {subOrders.map((subOrder: any) => {
              const subItems = Array.isArray(subOrder.items) ? subOrder.items : []
              const isCancelled = subOrder.status === 'cancelled'
              const canRate = subOrder.status === 'delivered' || subOrder.status === 'paid' // Adjust based on business rule (paid usually enough for digital/fast, delivered for phys)

              return (
                <div key={subOrder.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Avaliar produtos de {resolveSellerName(subOrder.sellerId, subOrder.sellerStoreName)}
                  </h3>
                  
                  {isCancelled ? (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      ❌ Não é possível avaliar produtos de pedidos cancelados.
                    </div>
                  ) : !canRate ? (
                    <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                      Aguarde a conclusão do pedido para avaliar os produtos.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {subItems.map((item: any, idx: number) => (
                        <div key={idx} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-900">{item.productName}</span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-4">
                            <ProductRatingItem 
                              item={item} 
                              sellerId={subOrder.sellerId}
                              onRate={async (rating, comment) => {
                                try {
                                  // Find transaction
                                  const transaction = await utils.transactions.findPurchase.fetch({
                                    productId: Number(item.productId),
                                    sellerId: String(subOrder.sellerId)
                                  })
                                  
                                  if (!transaction) {
                                    showToast('Transação não encontrada ou ainda não concluída.', 'error')
                  return
                }

                  await createRatingMutation.mutateAsync({
                                    transactionId: transaction.id,
                                    productId: Number(item.productId),
                    rating,
                                    comment: comment?.trim(),
                    author: reviewAuthor,
                  })
                  showToast('Avaliação enviada com sucesso!', 'success')
                } catch (error: any) {
                  showToast(error?.message || 'Erro ao enviar avaliação', 'error')
                }
              }}
                              isSubmitting={createRatingMutation.isLoading}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
