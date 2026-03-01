import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'
import { useAuth } from '@/_core/hooks/useAuth'
import LoginModal from '@/components/LoginModal'
import { ScrollingText } from '@/components/ui/scrolling-text'

interface ProductReview {
  id: number
  author: string
  rating: number
  comment: string
  date: string
}

export default function ProductDetails() {
  const [location, setLocation] = useLocation()
  const [quantity, setQuantity] = useState(1)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Adicionar hook de autenticação
  const { isAuthenticated, loading: authLoading, user } = useAuth({
    redirectOnUnauthenticated: false
  })

  // Verificar autenticação real
  const isLoggedIn = isAuthenticated && !authLoading && user !== null

  // Estado do modal de login
  const [showLoginModal, setShowLoginModal] = useState(false)

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

  const { showToast } = useToast()
  const utils = trpc.useUtils()
  const { productId, productCode } = useMemo(() => {
    if (typeof window === 'undefined') return { productId: null, productCode: null }

    // Formato /p/:productCode (sem nome da loja - para não logados)
    const pMatch = location.match(/^\/p\/([^/?#]+)/)
    if (pMatch?.[1]) {
      return { productId: null, productCode: pMatch[1] }
    }

    // Formato /:storeSlug/:productCode/:productName?
    const pathMatch = location.match(/^\/([^/]+)\/([^/]+)(?:\/([^/?#]+))?/)
    if (pathMatch?.[2]) {
      return { productId: null, productCode: pathMatch[2] }
    }

    // Fallback para query param (compatibilidade)
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    return {
      productId: id ? Number(id) : null,
      productCode: null
    }
  }, [location])

  // Redirecionar não logados de /:storeSlug/:productCode para /p/:productCode (ocultar nome da loja na URL)
  useEffect(() => {
    if (isLoggedIn || !productCode) return
    const pathMatch = location.match(/^\/([^/]+)\/([^/]+)(?:\/([^/?#]+))?/)
    if (pathMatch?.[1] && pathMatch[1] !== 'p') {
      setLocation(`/p/${productCode}`)
    }
  }, [isLoggedIn, productCode, location, setLocation])

  const productQuery = productCode
    ? trpc.products.getMarketplaceByCode.useQuery(
        { code: productCode },
        { enabled: !!productCode }
      )
    : trpc.products.getMarketplaceById.useQuery(
        { id: productId as number },
        { enabled: !!productId }
      )
  const ratingsQuery = trpc.ratings.getByProductId.useQuery(
    { productId: (productQuery.data as any)?.id as number },
    { enabled: Boolean((productQuery.data as any)?.id) }
  )
  const avgRatingQuery = trpc.ratings.getAverageRating.useQuery(
    { productId: (productQuery.data as any)?.id as number },
    { enabled: Boolean((productQuery.data as any)?.id) }
  )
  const addToCartMutation = trpc.cart.addItem.useMutation({
    onMutate: async ({ productId, quantity }) => {
      await utils.cart.list.cancel()
      const previous = utils.cart.list.getData() || []
      const next = [...previous]
      const existing = next.find((item: any) => item.productId === productId)
      if (existing) {
        existing.quantity = (existing.quantity || 0) + quantity
      } else {
        next.push({
          id: -Date.now(),
          productId,
          quantity,
        })
      }
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

  const product = productQuery.data as any
  const averageRating = avgRatingQuery.data || 0
  const reviews: ProductReview[] = (ratingsQuery.data || []).map((r: any) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    comment: r.comment || '',
    date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : '',
  }))

  const images = useMemo(() => {
    if (!product?.images) return []
    try {
      return JSON.parse(product.images)
    } catch {
      return []
    }
  }, [product?.images])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isZoomOpen, setIsZoomOpen] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPanRef = useRef({ x: 0, y: 0 })
  const lastTouchDistanceRef = useRef<number | null>(null)
  const zoomImageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (images.length > 0) {
      setSelectedImage(images[0])
    } else {
      setSelectedImage(null)
    }
  }, [images])

  useEffect(() => {
    if (isZoomOpen) {
      setZoomScale(1)
      setZoomPosition({ x: 0, y: 0 })
      setIsPanning(false)
      lastPanRef.current = { x: 0, y: 0 }
      lastTouchDistanceRef.current = null
    }
  }, [isZoomOpen])

  useEffect(() => {
    const image = zoomImageRef.current
    if (!image || !isZoomOpen) return
    const onWheel = (event: WheelEvent) => handleWheelZoom(event)
    image.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      image.removeEventListener('wheel', onWheel)
    }
  }, [isZoomOpen])

  const clampScale = (value: number) => Math.min(4, Math.max(1, value))

  const handleWheelZoom = (event: WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.1 : 0.1
    setZoomScale((prev) => clampScale(prev + delta))
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLImageElement>) => {
    if (zoomScale <= 1) return
    setIsPanning(true)
    lastPanRef.current = { x: event.clientX - zoomPosition.x, y: event.clientY - zoomPosition.y }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!isPanning || zoomScale <= 1) return
    setZoomPosition({
      x: event.clientX - lastPanRef.current.x,
      y: event.clientY - lastPanRef.current.y,
    })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const getTouchDistance = (touches: TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLImageElement>) => {
    if (event.touches.length === 2) {
      lastTouchDistanceRef.current = getTouchDistance(event.touches)
      setIsPanning(false)
    } else if (event.touches.length === 1 && zoomScale > 1) {
      const touch = event.touches[0]
      lastPanRef.current = { x: touch.clientX - zoomPosition.x, y: touch.clientY - zoomPosition.y }
      setIsPanning(true)
    }
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLImageElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault()
      const distance = getTouchDistance(event.touches)
      const lastDistance = lastTouchDistanceRef.current
      if (lastDistance) {
        const scaleDelta = (distance - lastDistance) / 200
        setZoomScale((prev) => clampScale(prev + scaleDelta))
      }
      lastTouchDistanceRef.current = distance
      return
    }
    if (event.touches.length === 1 && isPanning && zoomScale > 1) {
      const touch = event.touches[0]
      setZoomPosition({
        x: touch.clientX - lastPanRef.current.x,
        y: touch.clientY - lastPanRef.current.y,
      })
    }
  }

  const handleTouchEnd = () => {
    setIsPanning(false)
    lastTouchDistanceRef.current = null
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < Math.floor(rating) ? 'text-yellow-400 text-sm' : 'text-gray-300 text-sm'}>
          ★
        </span>
      ))}
    </div>
  )

  const getConditionLabel = (condition?: string) => {
    switch (condition) {
      case 'NEW':
        return 'Novo'
      case 'USED':
        return 'Usado'
      case 'REFURBISHED':
        return 'Recondicionado'
      case 'ORIGINAL_RETIRADA':
        return 'Original Retirada'
      default:
        return condition || 'Condição não informada'
    }
  }

  const getWarrantyLabel = (warrantyPeriod?: string | null) => {
    switch (warrantyPeriod) {
      case 'DAYS_7':
        return '7 dias'
      case 'DAYS_30':
        return '30 dias'
      case 'DAYS_90':
        return '90 dias'
      case 'MONTHS_6':
        return '6 meses'
      case 'NONE':
      default:
        return 'Sem garantia'
    }
  }

  const handleAddToCart = async () => {
    const resolvedId = (productQuery.data as any)?.id as number | undefined
    if (!resolvedId) return

    // Verificar autenticação
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }

    try {
      await addToCartMutation.mutateAsync({ productId: resolvedId, quantity })
      showToast('Produto adicionado ao carrinho!', 'success')
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho:', error)
      showToast('Não foi possível adicionar ao carrinho.', 'error')
    }
  }

  const handleViewSellerProfile = () => {
    const slugSource = product?.sellerStoreName || product?.brand || 'loja'
    const slug = slugSource
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'loja'
    setLocation(`/${slug}`)
  }

  if (!productId && !productCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Produto não informado.</p>
      </div>
    )
  }

  if (productQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Carregando produto...</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Produto não encontrado.</p>
      </div>
    )
  }

  const price = parseFloat(product.price || '0')
  const availableStock = product.quantity || 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className={`bg-white border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation('/catalog')}
            className="text-gray-600 hover:text-gray-900 text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900">Detalhes do Produto</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="w-full h-48 sm:h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.name}
                onClick={() => setIsZoomOpen(true)}
                className="w-full h-full object-contain cursor-zoom-in"
                onError={() => setSelectedImage(null)}
              />
            ) : (
              <span className="text-6xl sm:text-8xl">📱</span>
            )}
          </div>
          {images.length > 0 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {images.map((img: string, i: number) => (
                <img
                  key={`${img}-${i}`}
                  src={img}
                  alt={`Produto ${i + 1}`}
                  onClick={() => setSelectedImage(img)}
                  className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover cursor-pointer ${
                    selectedImage === img ? 'ring-2 ring-blue-500' : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {isZoomOpen && selectedImage && (
          <div
            onClick={() => setIsZoomOpen(false)}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4"
          >
            <img
              src={selectedImage}
              alt={product.name}
              onClick={(event) => event.stopPropagation()}
              ref={zoomImageRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale})`,
                cursor: zoomScale > 1 ? 'grab' : 'zoom-out',
                touchAction: 'none',
              }}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
          </div>
        )}

        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden">
              <ScrollingText 
                text={product.name}
                className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight"
              />
              <ScrollingText
                text={`${product.brand || 'Marca não informada'}${product.model ? ` • ${product.model}` : ''} • ${product.category || 'Categoria não informada'}`}
                className="text-sm text-gray-600 mt-1"
                containerClassName="mt-1 mb-3"
              />
              {isLoggedIn && product?.sellerStoreName && (
                <button
                  onClick={handleViewSellerProfile}
                  className="block w-full text-left overflow-hidden mt-1"
                >
                  <ScrollingText
                    text={`Ver perfil da loja ${product.sellerStoreName}`}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  />
                </button>
              )}
              <div className="flex items-center gap-2 mb-2">
                {renderStars(averageRating)}
                <span className="text-xs text-gray-600">{averageRating.toFixed(1)} ({reviews.length} avaliações)</span>
              </div>
            </div>
            <span className="px-2 py-1 sm:px-3 bg-green-100 text-green-800 text-xs font-medium rounded-full flex-shrink-0 ml-2">
              {getConditionLabel(product.condition)}
            </span>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-2xl sm:text-3xl font-bold text-blue-600">
                R$ {price.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          {isLoggedIn && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-green-600 font-medium text-sm">✓ {availableStock} em estoque</span>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Quantidade:</label>
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  −
                </button>
                <span className="px-4 py-2 text-center min-w-[3rem] font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                  className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          )}

          <div className="border-t border-gray-100 pt-4 space-y-3">
            {isLoggedIn ? (
              <button
                onClick={handleAddToCart}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm sm:text-base"
              >
                🛒 Adicionar ao Carrinho
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm sm:text-base"
              >
                🔐 Faça login para ver estoque e comprar
              </button>
            )}
          </div>
        </div>

        {product.description && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Descrição</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Garantia */}
        {product.warrantyPeriod && product.warrantyPeriod !== 'NONE' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🛡️</span>
              <h3 className="font-semibold text-blue-900">Garantia Incluída</h3>
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">
              Este produto possui garantia de <strong>{getWarrantyLabel(product.warrantyPeriod)}</strong> contra defeitos de fabricação.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Período conta a partir da data de entrega do pedido.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Avaliações</h3>
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma avaliação ainda.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 last:border-none last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">{review.author}</p>
                    <span className="text-xs text-gray-500">{review.date}</span>
                  </div>
                  {renderStars(review.rating)}
                  {review.comment && (
                    <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Login */}
      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        message="Faça login para ver estoque, informações da loja e comprar"
      />
    </div>
  )
}
