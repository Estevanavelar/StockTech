import React, { useMemo } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { CheckCircle, Clock, CreditCard, Truck, Home } from 'lucide-react'

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation()

  const ordersQuery = trpc.orders.list.useQuery({ limit: 10, offset: 0 })
  const storedOrders = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('last_checkout_orders')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('Falha ao ler pedidos do sessionStorage', error)
      return []
    }
  }, [])

  const rawOrders = storedOrders.length > 0 ? storedOrders : (ordersQuery.data?.orders || [])
  const orders = useMemo(() => {
    return rawOrders.map((order: any) => {
      let parsedItems = order.items
      if (typeof order.items === 'string') {
        try {
          parsedItems = JSON.parse(order.items)
        } catch {
          parsedItems = []
        }
      }
      return {
        ...order,
        items: Array.isArray(parsedItems) ? parsedItems : []
      }
    })
  }, [rawOrders])

  const totalValue = useMemo(() => {
    return orders.reduce((sum: number, order: any) => {
      const value = parseFloat(order.total || '0')
      return sum + (Number.isNaN(value) ? 0 : value)
    }, 0)
  }, [orders])

  const orderCodes = useMemo(() => {
    return orders.map((order: any) => order.orderCode).filter(Boolean).join(', ')
  }, [orders])

  const allItems = useMemo(() => {
    return orders.flatMap((order: any) =>
      (order.items || []).map((item: any) => ({
        ...item,
        orderCode: order.orderCode
      }))
    )
  }, [orders])

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return {
          icon: Clock,
          label: 'Solicitação pendente',
          color: 'bg-yellow-100 text-yellow-800',
          description: 'Seu pedido foi criado e está aguardando o vendedor aceitar.'
        }
      case 'paid':
        return {
          icon: CheckCircle,
          label: 'Pago',
          color: 'bg-green-100 text-green-800',
          description: 'Pagamento confirmado. Seu pedido será preparado em breve.'
        }
      case 'processing':
        return {
          icon: Truck,
          label: 'Aceito / Em transporte',
          color: 'bg-blue-100 text-blue-800',
          description: 'Seu pedido foi aceito pelo vendedor e está em transporte.'
        }
      default:
        return {
          icon: Clock,
          label: 'Processando',
          color: 'bg-gray-100 text-gray-800',
          description: 'Seu pedido está sendo processado.'
        }
    }
  }

  const statusInfo = getStatusInfo(orders[0]?.status || 'pending_payment')
  const StatusIcon = statusInfo.icon

  if (ordersQuery.isLoading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Carregando pedido...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-sm text-gray-600">
              Não foi possível localizar os dados do pedido.
            </p>
            <Button onClick={() => setLocation('/order-history')} className="w-full">
              Ver meus pedidos
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">

        {/* Card Principal de Sucesso */}
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Pedido Realizado com Sucesso!
                </h1>
                <p className="text-gray-600">
                  Seu pedido {orders.length > 1 ? 'foi criado' : 'foi criado'} e está sendo processado.
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2">
                <Badge className={statusInfo.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status do Pedido */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <StatusIcon className="w-5 h-5" />
              <span>Status do Pedido</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{statusInfo.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Código do Pedido</span>
                </div>
                <p className="text-lg font-mono font-semibold">{orderCodes}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Valor Total</span>
                </div>
                <p className="text-xl font-bold text-green-600">
                  R$ {totalValue.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximos Passos */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {orders[0]?.status === 'pending_payment' && (
              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  <strong>Aguardando Pagamento:</strong> Entre em contato com os vendedores para obter as instruções de pagamento (PIX, transferência bancária, etc.).
                  Assim que você efetuar o pagamento, os vendedores confirmarão no sistema e seu pedido seguirá para preparação.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">1</span>
                </div>
                <div>
                  <p className="font-medium">Pagamento</p>
                  <p className="text-sm text-gray-600">
                    Efetue o pagamento diretamente aos vendedores conforme as instruções recebidas.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">2</span>
                </div>
                <div>
                  <p className="font-medium">Confirmação</p>
                  <p className="text-sm text-gray-600">
                    Aguarde os vendedores confirmarem o recebimento do pagamento no sistema.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">3</span>
                </div>
                <div>
                  <p className="font-medium">Preparação e Envio</p>
                  <p className="text-sm text-gray-600">
                    Seu pedido será preparado e enviado. Você receberá atualizações por email e no painel.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">4</span>
                </div>
                <div>
                  <p className="font-medium">Entrega</p>
                  <p className="text-sm text-gray-600">
                    Receba seu pedido e aproveite suas compras!
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Itens do Pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allItems.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium">{item.productName || item.name}</p>
                    <p className="text-sm text-gray-600">
                      Quantidade: {item.quantity} • Vendedor: {item.sellerName || item.seller || 'Vendedor'}
                      {item.orderCode ? ` • Pedido: ${item.orderCode}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {item.quantity}x
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => {
              if (orders.length === 1 && orders[0].id) {
                const orderCode = orders[0].orderCode
                if (orderCode) {
                  setLocation(`/order-details/COMPRA/${orderCode}`)
                  return
                }
                setLocation(`/order-details?id=${orders[0].id}`)
              } else {
                // Se tiver múltiplos pedidos, vai para o histórico
                setLocation('/order-history')
              }
            }}
            className="flex-1"
            variant="default"
          >
            <Truck className="w-4 h-4 mr-2" />
            Acompanhar Pedidos
          </Button>

          <Button
            onClick={() => setLocation('/catalog')}
            variant="outline"
            className="flex-1"
          >
            <Home className="w-4 h-4 mr-2" />
            Continuar Comprando
          </Button>
        </div>

        {/* Nota */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Dúvidas? Entre em contato conosco ou consulte nosso
            <button
              onClick={() => setLocation('/help')}
              className="text-blue-600 hover:text-blue-800 ml-1 underline"
            >
              centro de ajuda
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}