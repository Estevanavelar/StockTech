import React, { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Alert, AlertDescription } from '../components/ui/alert'
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Eye,
  CreditCard,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

interface Order {
  id: number
  orderCode: string
  status: 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  subtotal: string
  freight: string
  total: string
  items: any[]
  buyerId: string
  sellerId: string
  createdAt: string
  paymentNotes?: string
  trackingCode?: string
  trackingCarrier?: string
}

export default function SellerOrders() {
  const [, setLocation] = useLocation()
  const { showToast } = useToast()
  const meQuery = trpc.auth.me.useQuery()
  const utils = trpc.useUtils()

  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Efeito de esconder/mostrar header ao rolar
  useEffect(() => {
    const container = document.getElementById('main-scroll-container')
    if (!container) return

    const handleScroll = () => {
      const currentScrollY = container.scrollTop
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setHeaderVisible(false)
      } else {
        setHeaderVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [trackingCarrier, setTrackingCarrier] = useState('')

  // Queries e mutations
  const ordersQuery = trpc.orders.list.useQuery(
    { status: 'all', limit: 100, offset: 0 },
    {
      onError: (error) => {
        console.error('Error fetching orders:', error)
        showToast('Erro ao carregar pedidos', 'error')
      }
    }
  )

  useEffect(() => {
    const userId = meQuery.data?.id
    const allOrders = ordersQuery.data?.orders || []
    if (!userId) {
      setOrders([])
      return
    }
    const sellerOrders = allOrders.filter((order: Order) => order.sellerId === userId)
    setOrders(sellerOrders)
  }, [meQuery.data?.id, ordersQuery.data?.orders])

  const confirmPaymentMutation = trpc.orders.confirmPayment.useMutation({
    onMutate: async ({ orderId }) => {
      await utils.orders.list.cancel()
      const previousOrders = utils.orders.list.getData({ status: 'all', limit: 100, offset: 0 })
      if (previousOrders?.orders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          {
            ...previousOrders,
            orders: previousOrders.orders.map((order: Order) =>
              order.id === orderId ? { ...order, status: 'paid' } : order
            ),
          }
        )
      }
      return { previousOrders }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData({ status: 'all', limit: 100, offset: 0 }, context.previousOrders)
      }
    },
    onSettled: () => {
      void utils.orders.list.invalidate()
    },
  })
  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onMutate: async ({ orderId, status }) => {
      await utils.orders.list.cancel()
      const previousOrders = utils.orders.list.getData({ status: 'all', limit: 100, offset: 0 })
      if (previousOrders?.orders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          {
            ...previousOrders,
            orders: previousOrders.orders.map((order: Order) =>
              order.id === orderId ? { ...order, status } : order
            ),
          }
        )
      }
      return { previousOrders }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData({ status: 'all', limit: 100, offset: 0 }, context.previousOrders)
      }
    },
    onSettled: () => {
      void utils.orders.list.invalidate()
    },
  })
  const cancelOrderMutation = trpc.orders.cancel.useMutation({
    onMutate: async ({ orderId }) => {
      await utils.orders.list.cancel()
      const previousOrders = utils.orders.list.getData({ status: 'all', limit: 100, offset: 0 })
      if (previousOrders?.orders) {
        utils.orders.list.setData(
          { status: 'all', limit: 100, offset: 0 },
          {
            ...previousOrders,
            orders: previousOrders.orders.map((order: Order) =>
              order.id === orderId ? { ...order, status: 'cancelled' } : order
            ),
          }
        )
      }
      return { previousOrders }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData({ status: 'all', limit: 100, offset: 0 }, context.previousOrders)
      }
    },
    onSettled: () => {
      void utils.orders.list.invalidate()
    },
  })

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return {
          icon: Clock,
          label: 'Solicitação pendente',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          actions: ['accept', 'reject']
        }
      case 'paid':
        return {
          icon: CheckCircle,
          label: 'Pago',
          color: 'bg-green-100 text-green-800 border-green-200',
          actions: ['finalize']
        }
      case 'processing':
        return {
          icon: Package,
          label: 'Aceito / Em transporte',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          actions: ['mark_paid', 'cancel']
        }
      case 'shipped':
        return {
          icon: Truck,
          label: 'Enviado',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          actions: ['deliver']
        }
      case 'delivered':
        return {
          icon: CheckCircle,
          label: 'Venda finalizada',
          color: 'bg-green-100 text-green-800 border-green-200',
          actions: []
        }
      case 'cancelled':
        return {
          icon: XCircle,
          label: 'Cancelado',
          color: 'bg-red-100 text-red-800 border-red-200',
          actions: []
        }
      default:
        return {
          icon: Clock,
          label: 'Desconhecido',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          actions: []
        }
    }
  }

  const handleConfirmPayment = async (orderId: number) => {
    try {
      await confirmPaymentMutation.mutateAsync({ orderId })
      showToast('Pagamento confirmado com sucesso!', 'success')
      ordersQuery.refetch()
    } catch (error: any) {
      showToast(error.message || 'Erro ao confirmar pagamento', 'error')
    }
  }

  const handleUpdateStatus = async (orderId: number, status: string, trackingData?: any) => {
    try {
      const data: any = { orderId, status }
      if (trackingData) {
        data.trackingCode = trackingData.code
        data.trackingCarrier = trackingData.carrier
      }

      await updateStatusMutation.mutateAsync(data)
      showToast(`Status atualizado para ${getStatusInfo(status).label}`, 'success')
      ordersQuery.refetch()
      setSelectedOrder(null)
      setTrackingCode('')
      setTrackingCarrier('')
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar status', 'error')
    }
  }

  const handleCancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim()) {
      showToast('Digite o motivo do cancelamento', 'error')
      return
    }

    try {
      await cancelOrderMutation.mutateAsync({
        orderId: selectedOrder.id,
        reason: cancelReason
      })
      showToast('Pedido cancelado com sucesso', 'success')
      ordersQuery.refetch()
      setSelectedOrder(null)
      setCancelReason('')
    } catch (error: any) {
      showToast(error.message || 'Erro ao cancelar pedido', 'error')
    }
  }

  const formatCurrency = (value: string) => {
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (meQuery.isLoading || ordersQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Agrupar pedidos por status
  const ordersByStatus = orders.reduce((acc, order) => {
    if (!acc[order.status]) {
      acc[order.status] = []
    }
    acc[order.status].push(order)
    return acc
  }, {} as Record<string, Order[]>)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className={`bg-white border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Gerenciar Pedidos</h1>
              <p className="text-sm text-gray-600">Acompanhe e gerencie seus pedidos de venda</p>
            </div>
            <Button
              onClick={() => ordersQuery.refetch()}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{ordersByStatus.pending_payment?.length || 0}</p>
                  <p className="text-xs text-gray-600">Solicitações</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{ordersByStatus.paid?.length || 0}</p>
                  <p className="text-xs text-gray-600">Pagos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{ordersByStatus.shipped?.length || 0}</p>
                  <p className="text-xs text-gray-600">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{ordersByStatus.delivered?.length || 0}</p>
                  <p className="text-xs text-gray-600">Finalizados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Seus Pedidos</CardTitle>
          </CardHeader>
          <CardContent>

            {orders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const statusInfo = getStatusInfo(order.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <StatusIcon className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="font-semibold">{order.orderCode}</p>
                            <p className="text-sm text-gray-600">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Valor Total</p>
                          <p className="font-semibold">{formatCurrency(order.total)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Itens</p>
                          <p className="font-semibold">
                            {Array.isArray(order.items) ? order.items.length : 0} produto(s)
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Comprador</p>
                          <p className="font-semibold">ID: {order.buyerId.slice(0, 8)}...</p>
                        </div>
                      </div>

                      {/* Ações baseadas no status */}
                      <div className="flex flex-wrap gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Detalhes
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Pedido {order.orderCode}</DialogTitle>
                              <DialogDescription className="sr-only">
                                Detalhes do pedido selecionado
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="font-medium">Status</p>
                                  <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                                </div>
                                <div>
                                  <p className="font-medium">Data</p>
                                  <p>{formatDate(order.createdAt)}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Subtotal</p>
                                  <p>{formatCurrency(order.subtotal)}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Frete</p>
                                  <p>{formatCurrency(order.freight)}</p>
                                </div>
                              </div>

                              {order.trackingCode && (
                                <div>
                                  <p className="font-medium mb-1">Rastreamento</p>
                                  <p className="text-sm">
                                    {order.trackingCarrier}: {order.trackingCode}
                                  </p>
                                </div>
                              )}

                              <div>
                                <p className="font-medium mb-2">Itens</p>
                                <div className="space-y-2">
                                  {Array.isArray(order.items) && order.items.map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between text-sm border-b pb-1">
                                      <span>{item.productName}</span>
                                      <span>{item.quantity}x • {formatCurrency(item.price)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {order.status === 'pending_payment' && (
                                <Alert>
                                  <CreditCard className="h-4 w-4" />
                                  <AlertDescription>
                                    <strong>Instruções de Pagamento:</strong> {order.paymentNotes || 'Entre em contato com o comprador para combinar a forma de pagamento.'}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {statusInfo.actions.includes('accept') && (
                          <Button
                            onClick={() => handleUpdateStatus(order.id, 'processing')}
                            disabled={updateStatusMutation.isLoading}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aceitar Venda
                          </Button>
                        )}

                        {statusInfo.actions.includes('mark_paid') && (
                          <Button
                            onClick={() => handleConfirmPayment(order.id)}
                            disabled={confirmPaymentMutation.isLoading}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Marcar como Pago
                          </Button>
                        )}

                        {statusInfo.actions.includes('ship') && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm">
                                <Truck className="w-4 h-4 mr-1" />
                                Enviar Pedido
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Enviar Pedido {order.orderCode}</DialogTitle>
                                <DialogDescription className="sr-only">
                                  Informe os dados de rastreamento do pedido
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Transportadora
                                  </label>
                                  <select
                                    value={trackingCarrier}
                                    onChange={(e) => setTrackingCarrier(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                  >
                                    <option value="">Selecione...</option>
                                    <option value="Correios">Correios</option>
                                    <option value="Jadlog">Jadlog</option>
                                    <option value="Transportadora Própria">Transportadora Própria</option>
                                    <option value="Outro">Outro</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Código de Rastreamento
                                  </label>
                                  <input
                                    type="text"
                                    value={trackingCode}
                                    onChange={(e) => setTrackingCode(e.target.value)}
                                    placeholder="Digite o código de rastreamento"
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                  />
                                </div>

                                <div className="flex space-x-2">
                                  <Button
                                    onClick={() => handleUpdateStatus(order.id, 'shipped', {
                                      code: trackingCode,
                                      carrier: trackingCarrier
                                    })}
                                    disabled={!trackingCode.trim() || !trackingCarrier}
                                    className="flex-1"
                                  >
                                    Confirmar Envio
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {statusInfo.actions.includes('finalize') && (
                          <Button
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            disabled={updateStatusMutation.isLoading}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Finalizar Venda
                          </Button>
                        )}

                        {statusInfo.actions.includes('deliver') && (
                          <Button
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            disabled={updateStatusMutation.isLoading}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Marcar como Entregue
                          </Button>
                        )}

                        {(statusInfo.actions.includes('cancel') || statusInfo.actions.includes('reject')) && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <XCircle className="w-4 h-4 mr-1" />
                                {statusInfo.actions.includes('reject') ? 'Rejeitar' : 'Cancelar'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {statusInfo.actions.includes('reject') ? 'Rejeitar' : 'Cancelar'} Pedido {order.orderCode}
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                  Confirmação para rejeitar ou cancelar o pedido
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                <Alert>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Esta ação não pode ser desfeita. O pedido será cancelado e o comprador será notificado.
                                  </AlertDescription>
                                </Alert>

                                <div>
                                  <label className="block text-sm font-medium mb-2">
                                    Motivo do Cancelamento *
                                  </label>
                                  <Textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Explique o motivo do cancelamento..."
                                    rows={3}
                                  />
                                </div>

                                <div className="flex space-x-2">
                                  <Button
                                    onClick={handleCancelOrder}
                                    disabled={!cancelReason.trim() || cancelOrderMutation.isLoading}
                                    variant="destructive"
                                    className="flex-1"
                                  >
                                    Confirmar Cancelamento
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  )
}