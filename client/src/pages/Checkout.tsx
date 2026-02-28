import React, { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAddresses } from '../contexts/AddressContext'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Separator } from '../components/ui/separator'
import { AlertCircle, Truck, MapPin, CreditCard, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useNotifications } from '../contexts/NotificationContext'

interface CartItem {
  id: number
  productId: number
  name: string
  price: number
  quantity: number
  sellerId: string
}

interface OrderItem {
  productId: number
  productName: string
  price: string
  quantity: number
  sellerId: string
  sellerName?: string
  warrantyPeriod?: 'NONE' | 'DAYS_7' | 'DAYS_30' | 'DAYS_90' | 'MONTHS_6'
}

export default function Checkout() {
  const [, setLocation] = useLocation()
  const { addresses, defaultAddress, refreshAddresses } = useAddresses()
  const { showToast } = useToast()
  const { addNotification } = useNotifications()
  const utils = trpc.useUtils()

  const cartQuery = trpc.cart.list.useQuery()
  const productsQuery = trpc.products.listMarketplace.useQuery()

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Mutation para criar pedido
  const createOrderMutation = trpc.orders.create.useMutation({
    onMutate: async (variables) => {
      await utils.transactions.list.cancel()
      const previous = utils.transactions.list.getData() || []
      const now = new Date().toISOString()
      const optimisticTransactions = (variables.items || []).map((item, index) => {
        const amount = (Number(item.price) * Number(item.quantity || 0)).toFixed(2)
        return {
          id: -Date.now() - index,
          createdAt: now,
          date: now,
          type: 'purchase',
          productId: item.productId,
          productName: item.productName,
          counterparty: item.sellerName || 'Vendedor',
          counterpartyRole: 'seller',
          amount,
          quantity: item.quantity,
          status: 'pending',
          sellerId: item.sellerId,
        }
      })
      utils.transactions.list.setData(undefined, [...optimisticTransactions, ...previous])

      addNotification({
        type: 'order',
        title: 'Pedido enviado',
        message: 'Seu pedido foi criado e está pendente de pagamento',
      })

      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.transactions.list.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.transactions.list.invalidate()
    },
  })
  const clearCartMutation = trpc.cart.clear.useMutation({
    onMutate: async () => {
      await utils.cart.list.cancel()
      const previous = utils.cart.list.getData() || []
      utils.cart.list.setData(undefined, [])
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        utils.cart.list.setData(undefined, context.previous)
      }
    },
    onSettled: () => {
      void utils.cart.list.invalidate()
    },
  })

  useEffect(() => {
    refreshAddresses()
    // Selecionar endereço padrão
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id)
    }
  }, [refreshAddresses, defaultAddress])

  const cartItems = (cartQuery.data || []).map((item: any) => {
    const product = (productsQuery.data || []).find((p: any) => p.id === item.productId)
    const price = parseFloat(product?.price || '0')
    return {
      id: item.id,
      productId: item.productId,
      name: product?.name || 'Produto',
      price,
      quantity: item.quantity,
      seller: product?.createdByUserId || '',
      sellerId: product?.createdByUserId || '',
      sellerName: product?.sellerStoreName || 'Loja não informada',
    }
  })

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const freightQuery = trpc.orders.estimateFreight.useQuery(
    {
      addressId: selectedAddressId as number,
      items: cartItems
        .filter(item => item.sellerId)
        .map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          sellerId: item.sellerId,
        })),
    },
    {
      enabled: Boolean(selectedAddressId && cartItems.length > 0),
      staleTime: 60_000,
    }
  )

  const freightTotal = freightQuery.data?.totalFreight ?? 0
  const total = subtotal

  const handleAddressChange = (addressId: string) => {
    setSelectedAddressId(parseInt(addressId))
  }

  const handleCreateOrder = async () => {
    if (!selectedAddressId) {
      showToast('Selecione um endereço de entrega', 'error')
      return
    }

    setIsLoading(true)

    try {
      // Converter itens do carrinho para formato do pedido
      const orderItems: OrderItem[] = cartItems.map(item => ({
        productId: item.productId,
        productName: item.name,
        price: item.price.toString(),
        quantity: item.quantity,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        warrantyPeriod: item.warrantyPeriod,
      }))

      const result = await createOrderMutation.mutateAsync({
        items: orderItems,
        addressId: selectedAddressId,
        freightOption: 'delivery',
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        showToast('Pedido criado com sucesso!', 'success')
        try {
          sessionStorage.setItem('last_checkout_orders', JSON.stringify(result.orders || []))
        } catch (storageError) {
          console.warn('Falha ao salvar dados do pedido no sessionStorage', storageError)
        }
        try {
          await clearCartMutation.mutateAsync()
        } catch (clearError) {
          console.warn('Falha ao limpar carrinho após checkout', clearError)
        }
        setLocation('/checkout/success')
      } else {
        showToast('Erro ao criar pedido', 'error')
      }

    } catch (error: any) {
      console.error('Error creating order:', error)
      showToast(error.message || 'Erro ao criar pedido', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Carrinho vazio</h2>
            <p className="text-gray-600 mb-4">Adicione produtos ao carrinho para continuar</p>
            <Button onClick={() => setLocation('/catalog')} className="w-full">
              Continuar comprando
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-32">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/cart')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Voltar ao carrinho
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Finalizar Pedido</h1>
                <p className="text-sm text-gray-600">{totalItems} produto{totalItems !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Coluna da Esquerda - Dados do Pedido */}
          <div className="space-y-6">

            {/* Endereço de Entrega */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Endereço de Entrega</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedAddressId?.toString() || ''}
                  onValueChange={handleAddressChange}
                  className="space-y-3"
                >
                  {addresses.map((address) => (
                    <div key={address.id} className="flex items-start space-x-3">
                      <RadioGroupItem value={address.id.toString()} id={`address-${address.id}`} />
                      <Label
                        htmlFor={`address-${address.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {address.street}, {address.number}
                              {address.complement && ` - ${address.complement}`}
                            </span>
                            {address.isDefault === 1 && (
                              <Badge variant="secondary" className="text-xs">Padrão</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {address.neighborhood}, {address.city} - {address.state}
                          </p>
                          <p className="text-sm text-gray-600">CEP: {address.zipCode}</p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {addresses.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você não tem endereços cadastrados.
                      <Button
                        variant="link"
                        className="p-0 h-auto ml-1"
                        onClick={() => setLocation('/address-management')}
                      >
                        Cadastrar endereço
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Frete */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Truck className="h-5 w-5" />
                  <span>Frete</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {freightQuery.isLoading ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Calculando frete...</AlertDescription>
                  </Alert>
                ) : freightQuery.data ? (
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      Frete estimado: <strong>R$ {freightTotal.toFixed(2)}</strong>
                    </p>
                    <p className="text-xs text-gray-500">
                      Valor mostrado para referência. O total do pedido não inclui o frete.
                    </p>
                    {freightQuery.data.breakdown?.length ? (
                      <div className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        {freightQuery.data.breakdown.map((item) => {
                          const hasDistance = Number.isFinite(item.distanceKm) && item.distanceKm > 0
                          return (
                          <div key={item.sellerId} className="flex justify-between">
                            <span>{item.storeName}</span>
                            <span>
                              {hasDistance ? `${item.distanceKm.toFixed(1)} km` : 'Distância indisponível'} • R$ {item.freight.toFixed(2)}
                            </span>
                          </div>
                        )
                        })}
                        {freightQuery.data.breakdown.some((item) => !Number.isFinite(item.distanceKm) || item.distanceKm === 0) ? (
                          <p className="pt-1 text-[11px] text-gray-500">
                            Verifique se os CEPs do vendedor e do comprador estão corretos para o cálculo exato.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Selecione um endereço para calcular o frete.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Observações */}
            <Card>
              <CardHeader>
                <CardTitle>Observações (opcional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Alguma observação para o pedido?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

          </div>

          {/* Coluna da Direita - Resumo */}
          <div className="space-y-6">

            {/* Resumo do Pedido */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Itens */}
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          {item.quantity}x • Vendedor: {item.sellerName}
                        </p>
                      </div>
                      <span className="font-semibold">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Totais */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal ({totalItems} itens)</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frete</span>
                    <span>R$ {freightTotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-green-600">R$ {total.toFixed(2)}</span>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Informações de Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Pagamento</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Pagamento externo:</strong> Você pagará diretamente ao vendedor após confirmar o pedido.
                    As instruções de pagamento serão enviadas por email e estarão disponíveis no painel de pedidos.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Botão de Finalizar */}
            <Button
              onClick={handleCreateOrder}
              disabled={isLoading || !selectedAddressId}
              className="w-full h-12 text-lg font-semibold"
              size="lg"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Criando pedido...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Confirmar Pedido - R$ {total.toFixed(2)}</span>
                </div>
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Ao confirmar, você concorda com nossos termos de uso e política de privacidade.
            </p>

          </div>

        </div>
      </div>
    </div>
  )
}