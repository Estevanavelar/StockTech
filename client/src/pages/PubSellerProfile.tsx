import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/_core/hooks/useAuth'
import LoginModal from '@/components/LoginModal'

interface Review {
  id: string
  buyer: string
  rating: number
  comment: string
  date: string
  product: string
}

interface SellerProfileData {
  id: number
  userId: string
  storeName: string
  email?: string
  phone?: string
  city?: string
  state?: string
  profilePhoto?: string
  coverPhoto?: string
  description?: string
  rating: number
  totalSales: number
  totalSalesAmount: number
  totalProducts: number
  totalReviews: number
  followers: number
  responseTime?: number | string
  street?: string
  number?: string
  neighborhood?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  createdAt: Date
  updatedAt: Date
}

interface MarketplaceProduct {
  id: number
  code: string
  name: string
  price: string
  quantity: number
  brand?: string | null
  category?: string | null
  model?: string | null
  condition?: string | null
  warrantyPeriod?: string | null
  images?: string | null
  createdByUserId?: string | null
}

const parseProductImages = (images?: string | null): string[] => {
  try {
    const parsed = JSON.parse(images || '[]')
    return Array.isArray(parsed) ? parsed.filter((img) => typeof img === 'string') : []
  } catch {
    return []
  }
}

const formatPrice = (price: string) => {
  const num = parseFloat(price || '0')
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const getConditionLabel = (condition?: string | null) => {
  switch (condition) {
    case 'NEW': return 'Novo'
    case 'USED': return 'Usado'
    case 'REFURBISHED': return 'Recondicionado'
    case 'ORIGINAL_RETIRADA': return 'Original Retirada'
    default: return condition || 'Condição não informada'
  }
}

const getWarrantyLabel = (warrantyPeriod?: string | null) => {
  switch (warrantyPeriod) {
    case 'DAYS_7': return '7 dias'
    case 'DAYS_30': return '30 dias'
    case 'DAYS_90': return '90 dias'
    case 'MONTHS_6': return '6 meses'
    case 'NONE':
    default: return 'Sem garantia'
  }
}

export default function PubSellerProfile() {
  const [location, setLocation] = useLocation()
  const utils = trpc.useUtils()
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [seller, setSeller] = useState<SellerProfileData | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [sellerSearch, setSellerSearch] = useState('')
  const [sellerConditionFilter, setSellerConditionFilter] = useState<string>('all')
  const [sellerWarrantyFilter, setSellerWarrantyFilter] = useState<string>('all')
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [selectedPurchase, setSelectedPurchase] = useState<string>('')
  const [reviewsPage, setReviewsPage] = useState(1)
  const sellerCarouselRef = useRef<HTMLDivElement | null>(null)
  const { showToast } = useToast()
  const { isAuthenticated, loading: authLoading, user } = useAuth({ redirectOnUnauthenticated: false })
  const isLoggedIn = isAuthenticated && !authLoading && user !== null
  
  const storeSlug = useMemo(() => {
    if (typeof window === 'undefined') return null
    const slug = location.split('?')[0].replace('/', '')
    return slug || null
  }, [location])

  const { data: sellerData, isLoading } = storeSlug
    ? trpc.sellerProfiles.getPublicByStoreSlug.useQuery({ storeSlug })
    : trpc.sellerProfiles.getFullProfile.useQuery()
  const { data: followState, refetch: refetchFollowState } = trpc.sellerProfiles.getFollowStateByStoreSlug.useQuery(
    { storeSlug: storeSlug || '' },
    { enabled: Boolean(storeSlug && isLoggedIn) }
  )
  const toggleFollowMutation = trpc.sellerProfiles.toggleFollowByStoreSlug.useMutation()
  const { data: marketplaceProducts = [] } = trpc.products.listMarketplace.useQuery()
  const sellerId = String(sellerData?.userId || seller?.userId || '')
  const { data: sellerReviews = [] } = trpc.ratings.getRecentBySellerId.useQuery(
    { sellerId, limit: 10 },
    { enabled: Boolean(sellerId) }
  )
  const { data: eligiblePurchases = [] } = trpc.ratings.getEligiblePurchasesBySeller.useQuery(
    { sellerId },
    { enabled: Boolean(sellerId) }
  )
  const createRatingMutation = trpc.ratings.create.useMutation()
  const addToCartMutation = trpc.cart.addItem.useMutation({
    onMutate: async ({ productId, quantity }) => {
      await utils.cart.list.cancel()
      const previous = utils.cart.list.getData() || []
      const next = [...previous]
      const existing = next.find((item: any) => item.productId === productId)
      if (existing) {
        existing.quantity = (existing.quantity || 0) + quantity
      } else {
        next.push({ id: -Date.now(), productId, quantity })
      }
      utils.cart.list.setData(undefined, next)
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) utils.cart.list.setData(undefined, context.previous)
    },
    onSettled: () => {
      void utils.cart.list.invalidate()
    },
  })

  useEffect(() => {
    if (sellerData) {
      const data = {
        ...sellerData,
        responseTime: typeof sellerData.responseTime === 'string' ? sellerData.responseTime : `${sellerData.responseTime || 0} minutos`,
        totalSalesAmount: Number(sellerData.totalSalesAmount ?? 0),
        totalSales: Number(sellerData.totalSales ?? 0),
        totalProducts: Number(sellerData.totalProducts ?? 0),
        followers: Number(sellerData.followers ?? 0),
      } as SellerProfileData
      setSeller(data)
    }
  }, [sellerData])

  const sellerProductsCount = useMemo(() => {
    if (!seller?.userId) return 0
    return marketplaceProducts.filter(
      (product: any) => product?.createdByUserId === String(seller.userId)
    ).length
  }, [marketplaceProducts, seller?.userId])

  const sellerProducts = useMemo(() => {
    if (!seller?.userId) return []
    return (marketplaceProducts as MarketplaceProduct[])
      .filter((product) => String(product?.createdByUserId || '') === String(seller.userId))
      .sort((a, b) => b.id - a.id)
  }, [marketplaceProducts, seller?.userId])

  const sellerConditionOptions = useMemo(() => {
    return Array.from(new Set(sellerProducts.map(p => p.condition).filter(Boolean))) as string[]
  }, [sellerProducts])

  const filteredSellerProducts = useMemo(() => {
    const search = sellerSearch.trim().toLowerCase()
    return sellerProducts.filter((product) => {
      const matchesSearch = !search ||
        (product.model || '').toLowerCase().includes(search)

      const matchesCondition =
        sellerConditionFilter === 'all' || (product.condition || '') === sellerConditionFilter

      const warrantyLabel = getWarrantyLabel(product.warrantyPeriod)
      const matchesWarranty =
        sellerWarrantyFilter === 'all' ||
        (sellerWarrantyFilter === 'with' && warrantyLabel !== 'Sem garantia') ||
        (sellerWarrantyFilter === 'without' && warrantyLabel === 'Sem garantia')

      return matchesSearch && matchesCondition && matchesWarranty
    })
  }, [sellerProducts, sellerSearch, sellerConditionFilter, sellerWarrantyFilter])
  const handleSellerCarouselWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = sellerCarouselRef.current
    if (!el) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  useEffect(() => {
    if (!isLoggedIn) {
      setIsFollowing(false)
      return
    }
    if (followState) {
      setIsFollowing(Boolean(followState.isFollowing))
    }
  }, [isLoggedIn, followState])

  const reviews: Review[] = useMemo(() => {
    return (sellerReviews || []).map((review: any) => ({
      id: String(review.id),
      buyer: review.author || 'Cliente',
      rating: Number(review.rating || 0),
      comment: review.comment || '',
      date: review.createdAt,
      product: review.productName || 'Produto'
    }))
  }, [sellerReviews])

  const reviewsPerPage = 3
  const totalReviewPages = Math.max(1, Math.ceil(reviews.length / reviewsPerPage))
  const pagedReviews = useMemo(() => {
    const start = (reviewsPage - 1) * reviewsPerPage
    return reviews.slice(start, start + reviewsPerPage)
  }, [reviews, reviewsPage])

  const ratingDistribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  }

  reviews.forEach((review) => {
    const stars = Math.max(1, Math.min(5, Math.floor(review.rating))) as 1 | 2 | 3 | 4 | 5
    ratingDistribution[stars] += 1
  })

  const getRatingPercentage = (count: number) => {
    return ((count / (reviews.length || 1)) * 100).toFixed(0)
  }

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : Number(seller?.rating ?? 0)

  const renderStars = (rating: number, size: string = 'text-sm') => {
    return (
      <div className={`flex gap-0.5 ${size}`}>
        {[...Array(5)].map((_, i) => (
          <span key={i} className={i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}>
            ★
          </span>
        ))}
      </div>
    )
  }

  const handleToggleFollow = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    if (!storeSlug) return
    try {
      const result = await toggleFollowMutation.mutateAsync({ storeSlug })
      setIsFollowing(result.isFollowing)
      setSeller((prev) => (prev ? { ...prev, followers: result.followers } : prev))
      await refetchFollowState()
    } catch {
      showToast('Não foi possível atualizar seguidores agora.', 'error')
    }
  }

  const handleAddToCart = async (productId: number) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    try {
      await addToCartMutation.mutateAsync({ productId, quantity: 1 })
      showToast('Produto adicionado ao carrinho!', 'success')
    } catch {
      showToast('Não foi possível adicionar ao carrinho.', 'error')
    }
  }

  const handleContact = () => {
    const rawPhone = seller?.phone || ''
    let phone = rawPhone.replace(/\D/g, '')
    if (phone) {
      if (!phone.startsWith('55') && phone.length <= 11) {
        phone = `55${phone}`
      }
      const text = encodeURIComponent(`Olá! Tenho interesse na loja ${seller?.storeName || ''}.`)
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer')
      return
    }
    if (seller?.email) {
      window.location.href = `mailto:${seller.email}`
      return
    }
    const el = document.getElementById('store-contact')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTimeOnPlatform = (createdAt?: Date) => {
    if (!createdAt) return 'Tempo nao informado'
    const created = new Date(createdAt).getTime()
    if (Number.isNaN(created)) return 'Tempo nao informado'
    const diffMs = Date.now() - created
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days < 1) return 'Menos de 1 dia'
    if (days < 30) return `${days} dia(s)`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} mes(es)`
    const years = Math.floor(months / 12)
    return `${years} ano(s)`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando perfil da loja...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation('/catalog')}
            className="text-gray-600 hover:text-gray-900 text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Perfil da Loja</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="px-4 sm:px-6 py-6">
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-100 rounded-full border border-gray-200 flex items-center justify-center text-4xl overflow-hidden shadow-sm">
                {seller?.profilePhoto && typeof seller.profilePhoto === 'string' && seller.profilePhoto.startsWith('http') ? (
                  <img src={seller.profilePhoto} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  '👨‍💼'
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">
                  {seller?.storeName || 'Loja'}
                </h2>
                
                <div className="text-sm text-gray-600 font-medium break-all">
                  {seller?.city || 'Cidade'}{seller?.state ? `, ${seller.state}` : ''}
                </div>

                {seller?.description && (
                  <div className="text-sm text-gray-700 max-w-md mx-auto break-all whitespace-pre-wrap">
                    {seller.description}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="text-center bg-green-50 rounded-lg p-2">
                <p className="text-lg sm:text-2xl font-bold text-green-700">R$ {((seller?.totalSalesAmount || 0) / 1000).toFixed(1)}k</p>
                <p className="text-[10px] sm:text-xs text-green-600 mt-1">Vendas</p>
              </div>
              <div className="text-center bg-blue-50 rounded-lg p-2">
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{seller?.totalSales || 0}</p>
                <p className="text-[10px] sm:text-xs text-blue-600 mt-1">Qtd. Vendas</p>
              </div>
              <div className="text-center bg-purple-50 rounded-lg p-2">
                <p className="text-lg sm:text-2xl font-bold text-purple-700">{sellerProductsCount}</p>
                <p className="text-[10px] sm:text-xs text-purple-600 mt-1">Produtos</p>
              </div>
              <div className="text-center bg-orange-50 rounded-lg p-2">
                <p className="text-lg sm:text-2xl font-bold text-orange-700">
                  {seller?.followers ?? 0}
                </p>
                <p className="text-[10px] sm:text-xs text-orange-600 mt-1">Seguidores</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleContact}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
              >
                💬 Contatar
              </button>
              <button
                onClick={handleToggleFollow}
                disabled={toggleFollowMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors text-sm"
              >
                {toggleFollowMutation.isPending ? '⏳...' : isFollowing ? '✅ Seguindo' : '❤️ Seguir'}
              </button>
            </div>
          </div>
        </div>

        <div id="store-contact" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">⭐ Avaliações</h3>
          
          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-gray-900">
                {averageRating.toFixed(1)}
              </p>
              <div className="flex justify-center mt-2">
                {renderStars(averageRating || 0, 'text-xl')}
              </div>
              <p className="text-xs text-gray-600 mt-2">{reviews.length} avaliações</p>
            </div>

            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map(stars => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-6">{stars}★</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400"
                      style={{ width: `${getRatingPercentage(ratingDistribution[stars as keyof typeof ratingDistribution] || 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{ratingDistribution[stars as keyof typeof ratingDistribution] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="w-full px-4 py-2 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
          >
            ✍️ Deixar Avaliação
          </button>

          {showReviewForm && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-4">Sua Avaliação</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">Compra</label>
                  <select
                    value={selectedPurchase}
                    onChange={(e) => setSelectedPurchase(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Selecione uma compra concluída</option>
                    {eligiblePurchases.map((purchase: any) => (
                      <option key={purchase.transactionId} value={`${purchase.transactionId}:${purchase.productId}`}>
                        {purchase.productName || 'Produto'} • {new Date(purchase.date).toLocaleDateString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">Classificação</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className={`text-3xl hover:scale-110 transition-transform ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">Comentário</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Compartilhe sua experiência..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
                    disabled={createRatingMutation.isLoading}
                    onClick={async () => {
                      if (!selectedPurchase) {
                        showToast('Selecione uma compra concluída', 'error')
                        return
                      }
                      if (reviewRating < 1) {
                        showToast('Selecione uma nota', 'error')
                        return
                      }
                      const [transactionId, productId] = selectedPurchase.split(':')
                      try {
                        await createRatingMutation.mutateAsync({
                          transactionId: Number(transactionId),
                          productId: Number(productId),
                          rating: reviewRating,
                          comment: reviewComment.trim() || undefined,
                          author: 'Cliente',
                        })
                        showToast('Avaliação enviada com sucesso!', 'success')
                        setReviewRating(0)
                        setReviewComment('')
                        setSelectedPurchase('')
                        setShowReviewForm(false)
                      } catch (error: any) {
                        showToast(error?.message || 'Erro ao enviar avaliação', 'error')
                      }
                    }}
                  >
                    Enviar
                  </button>
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 Avaliações Recentes</h3>
          <div className="space-y-4">
            {reviews.length === 0 && (
              <p className="text-sm text-gray-600">Nenhuma avaliação encontrada.</p>
            )}
            {pagedReviews.map(review => (
              <div key={review.id} className="pb-4 border-b border-gray-200 last:border-b-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{review.buyer}</p>
                    <p className="text-xs text-gray-600">{review.product}</p>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(review.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {renderStars(review.rating)}
                </div>
                <p className="text-sm text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
          {reviews.length > reviewsPerPage && (
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setReviewsPage((page) => Math.max(1, page - 1))}
                className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-600">
                Página {reviewsPage} de {totalReviewPages}
              </span>
              <button
                onClick={() => setReviewsPage((page) => Math.min(totalReviewPages, page + 1))}
                className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Próxima
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🧩 Produtos da Loja</h3>
          {sellerProducts.length === 0 ? (
            <p className="text-sm text-gray-600">Esta loja ainda não possui produtos publicados.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                  placeholder="🔍 Buscar por modelo..."
                  className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sellerConditionFilter}
                    onChange={(e) => setSellerConditionFilter(e.target.value)}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Condição</option>
                    {sellerConditionOptions.map((condition) => (
                      <option key={condition} value={condition}>
                        {getConditionLabel(condition)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sellerWarrantyFilter}
                    onChange={(e) => setSellerWarrantyFilter(e.target.value)}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Garantia</option>
                    <option value="with">Com</option>
                    <option value="without">Sem</option>
                  </select>
                </div>
              </div>

              {filteredSellerProducts.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum produto encontrado com esses filtros.</p>
              ) : (
                <div
                  ref={sellerCarouselRef}
                  className="overflow-x-auto pb-2 touch-pan-x no-scrollbar"
                  onWheel={handleSellerCarouselWheel}
                >
                  <div className="flex gap-3 w-max pr-3">
                    {filteredSellerProducts.map((product) => {
                      const images = parseProductImages(product.images)
                      const firstImage = images[0]
                      return (
                        <div
                          key={product.id}
                          className="w-[165px] sm:w-[190px] border border-gray-200 rounded-lg overflow-hidden bg-white shrink-0"
                        >
                          <button
                            onClick={() => setLocation(`/p/${product.code}`)}
                            className="w-full h-28 bg-gray-100 flex items-center justify-center"
                          >
                            {firstImage ? (
                              <img src={firstImage} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-2xl">📱</span>
                            )}
                          </button>
                          <div className="p-2 space-y-1">
                            <p className="text-xs font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                            <p className="text-xs text-gray-600">📦 {product.quantity}</p>
                            <p className="text-xs font-bold text-blue-600">{formatPrice(product.price)}</p>
                            <p className="text-[10px] text-gray-600">{getConditionLabel(product.condition)}</p>
                            <p className="text-[10px] text-gray-600">🛡️ {getWarrantyLabel(product.warrantyPeriod)}</p>
                            <button
                              onClick={() => handleAddToCart(product.id)}
                              className="w-full mt-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                            >
                              🛒 Adicionar
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ℹ️ Informações da Loja</h3>
          <div className="space-y-4">
            {seller?.phone && (
              <div className="flex items-center gap-3">
                <span className="text-gray-600">📱</span>
                <div>
                  <p className="text-xs text-gray-600">Telefone</p>
                  <p className="text-sm font-medium text-gray-900">{seller.phone}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-gray-600">⏱️</span>
              <div>
                <p className="text-xs text-gray-600">Tempo na Plataforma</p>
                <p className="text-sm font-medium text-gray-900">{formatTimeOnPlatform(seller?.createdAt)}</p>
              </div>
            </div>
            {(seller?.street || seller?.number || seller?.neighborhood || seller?.city || seller?.state || seller?.zipCode) && (
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-xl">📍</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Endereço</p>
                  <p className="text-sm font-medium text-gray-900">
                    {seller?.street || 'Rua não informada'}
                    {seller?.number ? `, ${seller.number}` : ''}
                    {seller?.neighborhood ? ` - ${seller.neighborhood}` : ''}
                  </p>
                  <p className="text-xs text-gray-600">
                    {seller?.city || 'Cidade'}{seller?.state ? `, ${seller.state}` : ''} {seller?.zipCode || ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const address = [
                      seller?.street,
                      seller?.number,
                      seller?.neighborhood,
                      seller?.city,
                      seller?.state,
                      seller?.zipCode
                    ].filter(Boolean).join(', ')
                    if (address) {
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                >
                  🗺️ Ver Rota
                </button>
              </div>
            )}
          </div>
        </div>

      </main>
      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </div>
  )
}
