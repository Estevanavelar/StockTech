import React, { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Eye,
  RefreshCw,
  ShoppingBag,
  ArrowLeft
} from 'lucide-react'

interface Order {
  id: number
  orderCode: string
  status: 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'awaiting_exchange' | 'exchange_completed' | 'exchange_rejected' | 'cancelled'
  subtotal: string
  freight: string
  total: string
  items: any[]
  buyerId: string
  sellerId: string
  createdAt: string
  updatedAt: string
  trackingCode?: string
  trackingCarrier?: string
}

export default function OrderHistory() {
  const [, setLocation] = useLocation()
  const { showToast } = useToast()
  const utils = trpc.useContext()
  const [activeTab, setActiveTab] = useState<'all' | 'buyer' | 'seller'>('buyer')
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<{
    orderId: number;
    productId: number;
    productName: string;
    quantity: number;
  } | null>(null)
  const [returnReason, setReturnReason] = useState('')

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

  const meQuery = trpc.auth.me.useQuery(undefined, {
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  })

  // Queries para buscar pedidos
  const buyerOrdersQuery = trpc.orders.list.useQuery(
    { status: 'all', limit: 50 },
    {
      enabled: activeTab === 'buyer' || activeTab === 'all',
      refetchOnMount: 'always',
      refetchOnWindowFocus: true
    }
  )

  const sellerOrdersQuery = trpc.orders.list.useQuery(
    { status: 'all', limit: 50 },
    {
      enabled: activeTab === 'seller' || activeTab === 'all',
      refetchOnMount: 'always',
      refetchOnWindowFocus: true
    }
  )

  const requestReturnMutation = trpc.returns.request.useMutation({
    onSuccess: () => {
      showToast('Solicitação de troca enviada ao vendedor!', 'success')
      setReturnModalOpen(false)
      setReturnReason('')
      utils.returns.list.invalidate()
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const updateOrderStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      showToast('Status do pedido atualizado!', 'success')
      utils.orders.list.invalidate()
    },
    onError: (error) => {
      showToast(error.message, 'error')
    },
  })

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (buyerOrdersQuery.data || sellerOrdersQuery.data) {
      const allOrders: Order[] = []

      if (buyerOrdersQuery.data?.orders) {
        allOrders.push(...buyerOrdersQuery.data.orders)
      }

      if (sellerOrdersQuery.data?.orders) {
        allOrders.push(...sellerOrdersQuery.data.orders)
      }

      // Remover duplicatas e ordenar por data
      const uniqueOrders = allOrders.filter((order, index, self) => {
        const key = order.orderCode || String(order.id)
        return index === self.findIndex(o => (o.orderCode || String(o.id)) === key)
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setOrders(uniqueOrders)
      setLoading(false)
    }
  }, [buyerOrdersQuery.data, sellerOrdersQuery.data])

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return {
          icon: Clock,
          label: 'Solicitação pendente',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          bgColor: 'bg-yellow-50'
        }
      case 'paid':
        return {
          icon: CheckCircle,
          label: 'Pago',
          color: 'bg-green-100 text-green-800 border-green-200',
          bgColor: 'bg-green-50'
        }
      case 'processing':
        return {
          icon: Package,
          label: 'Aceito / Em transporte',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          bgColor: 'bg-blue-50'
        }
      case 'shipped':
        return {
          icon: Truck,
          label: 'Em transporte',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          bgColor: 'bg-purple-50'
        }
      case 'delivered':
        return {
          icon: CheckCircle,
          label: 'Finalizado',
          color: 'bg-green-100 text-green-800 border-green-200',
          bgColor: 'bg-green-50'
        }
      case 'awaiting_exchange':
        return {
          icon: RefreshCw,
          label: 'Aguardando Troca',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          bgColor: 'bg-orange-50'
        }
      case 'exchange_completed':
        return {
          icon: CheckCircle,
          label: 'Troca Feita',
          color: 'bg-teal-100 text-teal-800 border-teal-200',
          bgColor: 'bg-teal-50'
        }
      case 'exchange_rejected':
        return {
          icon: XCircle,
          label: 'Troca Recusada',
          color: 'bg-red-100 text-red-800 border-red-200',
          bgColor: 'bg-red-50'
        }
      case 'cancelled':
        return {
          icon: XCircle,
          label: 'Cancelado',
          color: 'bg-red-100 text-red-800 border-red-200',
          bgColor: 'bg-red-50'
        }
      default:
        return {
          icon: Clock,
          label: 'Desconhecido',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          bgColor: 'bg-gray-50'
        }
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

  const getOrdersByRole = (role: 'buyer' | 'seller') => {
    const userId = meQuery.data?.id
    if (!userId) return []
    return orders.filter(order =>
      role === 'buyer' ? order.buyerId === userId : order.sellerId === userId
    )
  }

  const openReturnModal = (order: Order) => {
    const items = Array.isArray(order.items) ? order.items : []
    const warrantyItem = items.find((item: any) => item?.warrantyPeriod && item.warrantyPeriod !== 'NONE')
    const firstItem = warrantyItem || items[0]
    const productId = firstItem?.productId ?? firstItem?.id
    const productName = firstItem?.productName ?? firstItem?.name ?? `Pedido ${order.orderCode}`
    const quantity = Number(firstItem?.quantity ?? 1)
    const resolvedOrderId = firstItem?.orderId ?? order.id

    if (!productId || !resolvedOrderId) {
      showToast('Não foi possível identificar o produto para troca', 'error')
      return
    }

    setSelectedReturn({
      orderId: resolvedOrderId,
      productId,
      productName,
      quantity,
    })
    setReturnReason('')
    setReturnModalOpen(true)
  }

  const finalizeSale = (order: Order) => {
    updateOrderStatusMutation.mutate({
      orderId: order.id,
      status: 'delivered',
    })
  }

  const buyerOrders = getOrdersByRole('buyer')
  const sellerOrders = getOrdersByRole('seller')

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Carregando histórico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className={`bg-white border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/user-profile')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Histórico de Pedidos</h1>
                <p className="text-sm text-gray-600">Acompanhe seus pedidos e vendas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Tabs para alternar entre Compras e Vendas */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="buyer" className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Minhas Compras</span>
              <span className="sm:hidden">Compras</span>
            </TabsTrigger>
            <TabsTrigger value="seller" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Minhas Vendas</span>
              <span className="sm:hidden">Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Todos</span>
              <span className="sm:hidden">Todos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buyer" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5" />
                  <span>Meus Pedidos ({buyerOrders.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {buyerOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Nenhum pedido encontrado</p>
                    <p className="text-sm text-gray-500">Seus pedidos aparecerão aqui</p>
                  </div>
                ) : (
                  <OrderList
                    orders={buyerOrders}
                    isBuyer={true}
                    onRequestReturn={openReturnModal}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seller" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="w-5 h-5" />
                  <span>Pedidos Recebidos ({sellerOrders.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sellerOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Nenhum pedido recebido</p>
                    <p className="text-sm text-gray-500">Pedidos de vendas aparecerão aqui</p>
                  </div>
                ) : (
                  <OrderList
                    orders={sellerOrders}
                    isBuyer={false}
                    onFinalizeSale={finalizeSale}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5" />
                  <span>Todos os Pedidos ({orders.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                  <OrderList
                    orders={orders}
                    isBuyer={true}
                    showRole={true}
                    onRequestReturn={openReturnModal}
                  />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Solicitar Troca */}
        <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔄 Solicitar Troca de Produto</DialogTitle>
              <DialogDescription>
                Informe o motivo da troca para o vendedor analisar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedReturn && (
                <>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium">{selectedReturn.productName}</p>
                    <p className="text-xs text-gray-600">Quantidade: {selectedReturn.quantity}</p>
                  </div>

                  <div>
                    <Label>Motivo da Troca *</Label>
                    <Textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Descreva o defeito ou problema encontrado..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setReturnModalOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selectedReturn || !returnReason.trim() || returnReason.trim().length < 10) {
                          showToast('Informe o motivo da troca (mín. 10 caracteres)', 'error')
                          return
                        }
                        requestReturnMutation.mutate({
                          orderId: selectedReturn.orderId,
                          productId: selectedReturn.productId,
                          quantity: selectedReturn.quantity,
                          reason: returnReason.trim(),
                        })
                      }}
                      className="flex-1"
                    >
                      Enviar Solicitação
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Componente auxiliar para renderizar lista de pedidos
function OrderList({ orders, isBuyer, showRole = false, onRequestReturn, onFinalizeSale }: {
  orders: Order[]
  isBuyer: boolean
  showRole?: boolean
  onRequestReturn?: (order: Order) => void
  onFinalizeSale?: (order: Order) => void
}) {
  const [, setLocation] = useLocation()

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const statusInfo = getStatusInfo(order.status)
        const StatusIcon = statusInfo.icon
        const items = Array.isArray(order.items) ? order.items : []
        const hasWarranty = items.some((item: any) => item?.warrantyPeriod && item.warrantyPeriod !== 'NONE')

        return (
          <div key={order.id} className={`border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors ${statusInfo.bgColor}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <StatusIcon className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                      Pedido {order.orderCode}
                    </h3>
                    {showRole && (
                      <Badge variant="outline" className="text-xs">
                        {isBuyer ? 'Compra' : 'Venda'}
                      </Badge>
                    )}
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {Array.isArray(order.items) ? order.items.length : 0} produto(s) • {formatDate(order.createdAt)}
                  </p>
                  {order.trackingCode && (
                    <p className="text-xs text-gray-500 mt-1">
                      Rastreio: {order.trackingCarrier} - {order.trackingCode}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(order.total)}
                </p>
                <p className="text-xs text-gray-600">Total</p>
              </div>
            </div>

            {/* Status específico para pedidos pendentes */}
            {order.status === 'pending_payment' && (
              <Alert className="mb-3">
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Aguardando pagamento:</strong> Entre em contato com o {isBuyer ? 'vendedor' : 'comprador'} para combinar a forma de pagamento.
                </AlertDescription>
              </Alert>
            )}

            {/* Ações baseadas no status e role */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const role = isBuyer ? 'COMPRA' : 'VENDA'
                  const orderCode = order.orderCode
                  if (orderCode) {
                    setLocation(`/order-details/${role}/${orderCode}`)
                    return
                  }
                  setLocation(`/order-details?id=${order.id}`)
                }}
                className="flex-1 sm:flex-none"
              >
                <Eye className="w-4 h-4 mr-1" />
                Detalhes
              </Button>

              {order.status === 'delivered' && isBuyer && hasWarranty && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRequestReturn?.(order)}
                    className="flex-1 sm:flex-none"
                  >
                    🔄 Solicitar Troca
                  </Button>
                  <Button size="sm" className="flex-1 sm:flex-none">
                    ⭐ Avaliar
                  </Button>
                </>
              )}

              {!isBuyer && ['paid', 'shipped'].includes(order.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onFinalizeSale?.(order)}
                  className="flex-1 sm:flex-none"
                >
                  ✅ Finalizar venda
                </Button>
              )}

              {!isBuyer && ['pending_payment', 'paid', 'processing'].includes(order.status) && (
                <Button
                  size="sm"
                  onClick={() => setLocation('/seller-orders')}
                  className="flex-1 sm:flex-none"
                >
                  <Package className="w-4 h-4 mr-1" />
                  Gerenciar
                </Button>
              )}
            </div>
          </div>
        )
      })}

    </div>
  )
}

// Funções auxiliares
function formatCurrency(value: string) {
  return parseFloat(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusInfo(status: string) {
  switch (status) {
    case 'pending_payment':
      return {
        icon: Clock,
        label: 'Aguardando Pagamento',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        bgColor: 'bg-yellow-50'
      }
    case 'paid':
      return {
        icon: CheckCircle,
        label: 'Pago',
        color: 'bg-green-100 text-green-800 border-green-200',
        bgColor: 'bg-green-50'
      }
    case 'processing':
      return {
        icon: Package,
        label: 'Em Processamento',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        bgColor: 'bg-blue-50'
      }
    case 'shipped':
      return {
        icon: Truck,
        label: 'Enviado',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        bgColor: 'bg-purple-50'
      }
    case 'delivered':
      return {
        icon: CheckCircle,
        label: 'Entregue',
        color: 'bg-green-100 text-green-800 border-green-200',
        bgColor: 'bg-green-50'
      }
    case 'awaiting_exchange':
      return {
        icon: RefreshCw,
        label: 'Aguardando Troca',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        bgColor: 'bg-orange-50'
      }
    case 'exchange_completed':
      return {
        icon: CheckCircle,
        label: 'Troca Feita',
        color: 'bg-teal-100 text-teal-800 border-teal-200',
        bgColor: 'bg-teal-50'
      }
    case 'exchange_rejected':
      return {
        icon: XCircle,
        label: 'Troca Recusada',
        color: 'bg-red-100 text-red-800 border-red-200',
        bgColor: 'bg-red-50'
      }
    case 'cancelled':
      return {
        icon: XCircle,
        label: 'Cancelado',
        color: 'bg-red-100 text-red-800 border-red-200',
        bgColor: 'bg-red-50'
      }
    default:
      return {
        icon: Clock,
        label: 'Desconhecido',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        bgColor: 'bg-gray-50'
      }
  }
}