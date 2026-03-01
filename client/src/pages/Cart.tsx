import React, { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAddresses } from '../contexts/AddressContext'
import { trpc } from '../lib/trpc'
import { ScrollingText } from '@/components/ui/scrolling-text'

export default function Cart({ isModal }: { isModal?: boolean }) {
  const [, setLocation] = useLocation()
  const { defaultAddress } = useAddresses()
  const utils = trpc.useUtils()
  const cartQuery = trpc.cart.list.useQuery()
  const productsQuery = trpc.products.listMarketplace.useQuery()
  const updateMutation = trpc.cart.updateQuantity.useMutation({
    onMutate: async ({ cartId, quantity }) => {
      await utils.cart.list.cancel()
      const previous = utils.cart.list.getData() || []
      const next = previous.map((item: any) =>
        item.id === cartId ? { ...item, quantity } : item
      )
      utils.cart.list.setData(undefined, next)
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
  const removeMutation = trpc.cart.removeItem.useMutation({
    onMutate: async ({ cartId }) => {
      await utils.cart.list.cancel()
      const previous = utils.cart.list.getData() || []
      const next = previous.filter((item: any) => item.id !== cartId)
      utils.cart.list.setData(undefined, next)
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

  const cartItems = (cartQuery.data || []).map((item: any) => {
    const product = (productsQuery.data || []).find((p: any) => p.id === item.productId)
    const price = parseFloat(product?.price || '0')
    return {
      id: item.id,
      productId: item.productId,
      name: product?.name || 'Produto',
      price,
      quantity: item.quantity,
      sellerId: product?.createdByUserId || '',
      sellerName: product?.sellerStoreName || 'Loja não informada',
      warrantyPeriod: product?.warrantyPeriod || 'NONE',
      reservedUntil: item.reservedUntil,
    }
  })

  const [timeRemaining, setTimeRemaining] = useState<Record<number, number>>({})

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newTimeRemaining: Record<number, number> = {}

      cartItems.forEach(item => {
        if (item.reservedUntil) {
          const expiresAt = new Date(item.reservedUntil).getTime()
          const remaining = Math.max(0, expiresAt - now)
          newTimeRemaining[item.id] = remaining
        }
      })

      setTimeRemaining(newTimeRemaining)
    }, 1000)

    return () => clearInterval(interval)
  }, [cartItems])

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal

  const itemsBySeller = cartItems.reduce((acc, item) => {
    const sellerKey = item.sellerId || 'vendedor'
    if (!acc[sellerKey]) {
      acc[sellerKey] = { sellerName: item.sellerName, items: [] as typeof cartItems }
    }
    acc[sellerKey].items.push(item)
    return acc
  }, {} as Record<string, { sellerName: string; items: typeof cartItems }>)

  const handleUpdateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(id)
    } else {
      updateMutation.mutate({ cartId: id, quantity: newQuantity })
    }
  }

  const handleRemoveItem = (id: number) => {
    removeMutation.mutate({ cartId: id })
  }

  const handleCheckout = () => {
    setLocation('/checkout')
  }

  return (
    <div className={`${isModal ? 'h-full flex flex-col' : 'min-h-screen'} bg-gradient-to-b from-gray-50 to-white`}>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          {!isModal && (
            <button
              onClick={() => setLocation('/catalog')}
              className="text-gray-600 hover:text-gray-900 text-xl"
            >
              ←
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">🛒 Carrinho</h1>
            <p className="text-xs text-gray-600">{totalItems} item(ns)</p>
          </div>
        </div>
      </header>

      <main className={`${isModal ? 'flex-1 overflow-y-auto' : 'max-w-2xl mx-auto'} px-4 py-6 space-y-6 no-scrollbar`}>
        {cartItems.length > 0 ? (
          <>
            <div className="space-y-6">
              {Object.entries(itemsBySeller).map(([sellerId, group]) => {
                const sellerSubtotal = group.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

                return (
                  <div key={sellerId} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
                    <div className="pb-4 border-b border-gray-100 overflow-hidden">
                      <ScrollingText 
                        text={`Vendedor: ${group.sellerName}`}
                        className="font-semibold text-gray-900 text-sm"
                      />
                    </div>

                    <div className="space-y-3">
                      {group.items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 overflow-hidden">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <ScrollingText
                              text={item.name}
                              className="font-medium text-gray-900 text-sm"
                            />
                            {timeRemaining[item.id] !== undefined && timeRemaining[item.id] > 0 && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`font-medium ${
                                  timeRemaining[item.id] < 5 * 60 * 1000 ? 'text-red-600' : 'text-orange-600'
                                }`}>
                                  ⏱️ Reservado por {formatTimeRemaining(timeRemaining[item.id])}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-gray-600 mt-1">R$ {item.price.toLocaleString('pt-BR')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="px-2 py-1 border border-gray-300 hover:bg-gray-50 rounded text-sm"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-1 border border-gray-300 hover:bg-gray-50 rounded text-sm"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="px-2 py-1 text-red-600 hover:text-red-700 text-sm ml-2"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-600">Frete será calculado no checkout.</p>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-600">Subtotal do Vendedor</span>
                      <span className="font-semibold text-gray-900">R$ {sellerSubtotal.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm">Resumo do Pedido</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">R$ {subtotal.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>R$ {total.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Finalizar Compra
              </button>
              {!defaultAddress && (
                <p className="text-xs text-gray-500 text-center">Cadastre um endereço para continuar.</p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Seu carrinho está vazio</h3>
            <p className="text-gray-600 mb-6">Adicione produtos ao carrinho para continuar</p>
            <button
              onClick={() => isModal ? document.querySelector('[data-slot="dialog-close"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true})) : setLocation('/catalog')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              {isModal ? 'Fechar' : 'Voltar ao Catálogo'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
