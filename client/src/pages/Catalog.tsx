import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '@/lib/trpc'
import { useNotifications } from '@/contexts/NotificationContext'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/_core/hooks/useAuth'
import { useIsDesktop } from '@/hooks/useMobile'
import LoginModal, { getLoginUrlWithRedirect } from '@/components/LoginModal'
import CatalogFilters from '@/components/CatalogFilters'
import Cart from './Cart'
import Notifications from './Notifications'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollingText } from "@/components/ui/scrolling-text"

interface Product {
  id: number
  code: string
  name: string
  price: string
  quantity: number
  condition: string
  brand: string | null
  model?: string | null
  category: string | null
  description: string | null
  images: string | null
  sellerId: number | null
  sellerStoreName?: string | null
  createdByUserId?: string | null
  createdAt: Date
  updatedAt: Date
}

type SortBy = 'relevance' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest'

function ProductImage({ images, alt, onClick }: { images: string[]; alt: string; onClick?: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { 
        rootMargin: '200px',
        threshold: 0.01 
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (images.length <= 1 || !isVisible) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [images.length, isVisible])

  const currentImage = images[currentIndex]
  const isLoaded = loaded[currentIndex]
  const isFailed = failed[currentIndex]
  const showPlaceholder = !currentImage || isFailed || !isLoaded

  return (
    <div 
      ref={containerRef}
      className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative cursor-pointer"
      onClick={onClick}
    >
      {showPlaceholder && <span className="text-4xl">📱</span>}
      
      {isVisible && currentImage && !isFailed && (
        <img
          src={currentImage}
          alt={`${alt} - Imagem ${currentIndex + 1}`}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(prev => ({ ...prev, [currentIndex]: true }))}
          onError={() => setFailed(prev => ({ ...prev, [currentIndex]: true }))}
          loading="lazy"
        />
      )}
      
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentIndex ? 'bg-white w-3' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const formatPrice = (price: string) => {
  const num = parseFloat(price)
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

function parseProductImages(images: string | null): string[] {
  try {
    const parsed = JSON.parse(images || '[]')
    return Array.isArray(parsed) ? parsed.filter(img => typeof img === 'string') : []
  } catch {
    return []
  }
}

function ProductCard({
  product,
  isLoggedIn,
  onInterest,
  onViewDetails,
}: {
  product: Product
  isLoggedIn: boolean
  onInterest: (p: Product) => void
  onViewDetails: (p: Product) => void
}) {
  const images = parseProductImages(product.images)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <ProductImage images={images} alt={product.name} onClick={() => onViewDetails(product)} />

      <div className="px-[15px] py-[5px] space-y-2 bg-white">
        <div className="flex items-start justify-between gap-2 overflow-hidden">
          <ScrollingText 
            text={product.name}
            className="font-semibold text-gray-900 text-sm"
            containerClassName="flex-1"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Código: {product.code}</span>
          {isLoggedIn && <span>📦 {product.quantity}</span>}
        </div>

        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-blue-600">{formatPrice(product.price)}</span>
          </div>
          <ScrollingText
            text={`${product.brand || ''}${product.brand && product.model ? ' • ' : ''}${product.model || ''}${(product.brand || product.model) && product.category ? ' • ' : ''}${product.category || ''}`}
            className="text-xs text-gray-600"
          />
          {isLoggedIn && (
            <ScrollingText
              text={product.sellerStoreName || 'Loja não informada'}
              className="text-xs text-gray-600"
              containerClassName="min-w-0"
            />
          )}
          <div className="flex items-center justify-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 text-[10px] font-medium rounded whitespace-nowrap">
              {getConditionLabel(product.condition)}
            </span>
            {product.warrantyPeriod && product.warrantyPeriod !== 'NONE' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-medium rounded whitespace-nowrap">
                🛡️ {getWarrantyLabel(product.warrantyPeriod)}
              </span>
            )}
          </div>
        </div>

        <div className="pt-3">
          <button
            onClick={() => onInterest(product)}
            className="relative w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
          >
            <span>🛒</span>
            <span>Adquirir</span>
            {!isLoggedIn && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                title="Login necessário"
              >
                !
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Catalog() {
  const [, setLocation] = useLocation()
  const { showToast } = useToast()
  const utils = trpc.useUtils()
  const isDesktop = useIsDesktop()
  const [searchTerm, setSearchTerm] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('relevance')
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  const { isAuthenticated, loading: authLoading, user } = useAuth({
    redirectOnUnauthenticated: false
  })
  const isLoggedIn = isAuthenticated && !authLoading && user !== null

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [pendingProductId, setPendingProductId] = useState<number | null>(null)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [followedStoreSlugs, setFollowedStoreSlugs] = useState<string[]>([])
  const [showFollowedOnly, setShowFollowedOnly] = useState(false)
  const { data: followedStoreSlugsFromDb = [] } = trpc.sellerProfiles.listMyFollowedStoreSlugs.useQuery(undefined, {
    enabled: isLoggedIn,
  })
  
  useEffect(() => {
    if (isDesktop) return
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
  }, [lastScrollY, isDesktop])

  const { data: cartItems = [] } = trpc.cart.list.useQuery(undefined, {
    enabled: isLoggedIn,
  })
  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
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
    onSettled: () => { void utils.cart.list.invalidate() },
  })
  
  const { unreadCount: notificationCount } = useNotifications()
  const { data: products = [], isLoading } = trpc.products.listMarketplace.useQuery()

  const handleProductInterest = async (product: Product) => {
    if (!isLoggedIn) {
      setPendingProductId(product.id)
      setShowLoginModal(true)
      return
    }
    try {
      await addToCartMutation.mutateAsync({ productId: product.id, quantity: 1 })
      showToast('Produto adicionado ao carrinho!', 'success')
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho:', error)
      showToast('Não foi possível adicionar ao carrinho.', 'error')
    }
  }

  useEffect(() => {
    if (isLoggedIn && pendingProductId !== null) {
      const productId = pendingProductId
      setPendingProductId(null)
      const executePending = async () => {
        try {
          await addToCartMutation.mutateAsync({ productId, quantity: 1 })
          showToast('Produto adicionado ao carrinho!', 'success')
        } catch (error) {
          console.error('Erro ao adicionar ao carrinho:', error)
          showToast('Não foi possível adicionar ao carrinho.', 'error')
        }
      }
      executePending()
    }
  }, [isLoggedIn, pendingProductId])

  const toSlug = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'loja'

  useEffect(() => {
    if (!isLoggedIn) {
      setFollowedStoreSlugs([])
      return
    }
    setFollowedStoreSlugs(followedStoreSlugsFromDb)
  }, [isLoggedIn, followedStoreSlugsFromDb])

  const handleViewDetails = (product: Product) => {
    if (!isLoggedIn) {
      setLocation(`/p/${product.code}`)
      return
    }
    const storeSlug = toSlug(product.sellerStoreName || product.brand || 'loja')
    const productNameSlug = toSlug(product.name)
    setLocation(`/${storeSlug}/${product.code}/${productNameSlug}`)
  }

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesBrand = !selectedBrand || product.brand === selectedBrand
      const matchesCategory = !selectedCategory || product.category === selectedCategory
      const matchesCondition = !selectedCondition || product.condition === selectedCondition
      const matchesSearch = !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (product.model?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (product.sellerStoreName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      const matchesModelSearch = !modelSearch ||
        (product.model?.toLowerCase().includes(modelSearch.toLowerCase()) ?? false)
      return matchesBrand && matchesCategory && matchesCondition && matchesSearch && matchesModelSearch
    })
  }, [products, selectedBrand, selectedCategory, selectedCondition, searchTerm, modelSearch])

  const sortedProducts = useMemo(() => {
    const baseProducts = showFollowedOnly
      ? filteredProducts.filter((product) => {
          const slug = toSlug(product.sellerStoreName || product.brand || 'loja')
          return followedStoreSlugs.includes(slug)
        })
      : [...filteredProducts]

    const sorted = [...baseProducts]
    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        break
      case 'price_desc':
        sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        break
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      default:
        break
    }

    if (!showFollowedOnly && isLoggedIn && followedStoreSlugs.length > 0) {
      sorted.sort((a, b) => {
        const aSlug = toSlug(a.sellerStoreName || a.brand || 'loja')
        const bSlug = toSlug(b.sellerStoreName || b.brand || 'loja')
        const aFollowed = followedStoreSlugs.includes(aSlug) ? 1 : 0
        const bFollowed = followedStoreSlugs.includes(bSlug) ? 1 : 0
        return bFollowed - aFollowed
      })
    }

    return sorted
  }, [filteredProducts, sortBy, showFollowedOnly, isLoggedIn, followedStoreSlugs])

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products])
  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products])
  const conditions = useMemo(() => Array.from(new Set(products.map(p => p.condition))), [products])

  const activeFilterCount = [selectedBrand, selectedCategory, selectedCondition, modelSearch].filter(Boolean).length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="text-center">
          <p className="text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    )
  }

  /* ============================================
   *  DESKTOP LAYOUT (>= 1024px)
   * ============================================ */
  if (isDesktop) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-64px)]">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-6 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => setLocation('/catalog')} className="hover:text-blue-600 transition-colors">Início</button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Catálogo</span>
            {selectedBrand && (
              <>
                <span>/</span>
                <span className="text-gray-900 font-medium">{selectedBrand}</span>
              </>
            )}
          </nav>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-8 flex gap-6">
          {/* Sidebar de filtros (colapsável) */}
          <aside
            className={`flex-shrink-0 transition-all duration-300 ${
              filtersCollapsed ? 'w-12' : 'w-64'
            }`}
          >
            <div className="bg-white rounded-lg border border-gray-200 sticky top-20 overflow-hidden">
              {filtersCollapsed ? (
                <button
                  onClick={() => setFiltersCollapsed(false)}
                  className="w-full min-h-[100px] flex flex-col items-center justify-center gap-2 p-2 text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                  title="Expandir filtros"
                >
                  <span className="text-xl">🔍</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                  <span className="text-gray-400 text-xs">▶</span>
                </button>
              ) : (
                <div className="p-5 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      🔍 Filtros
                      {activeFilterCount > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {activeFilterCount}
                        </span>
                      )}
                    </h2>
                    <button
                      onClick={() => setFiltersCollapsed(true)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Recolher filtros"
                    >
                      ◀
                    </button>
                  </div>
                  <CatalogFilters
                modelSearch={modelSearch}
                onModelSearchChange={setModelSearch}
                selectedBrand={selectedBrand}
                onBrandChange={setSelectedBrand}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedCondition={selectedCondition}
                onConditionChange={setSelectedCondition}
                brands={brands}
                categories={categories}
                conditions={conditions}
                products={products}
                variant="sidebar"
              />
                </div>
              )}
            </div>
          </aside>

          {/* Área principal */}
          <main className="flex-1 min-w-0">
            {/* Cabeçalho da listagem */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">📱 Catálogo</h1>
                <p className="text-sm text-gray-500 mt-0.5">{sortedProducts.length} produto(s) encontrado(s)</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Busca */}
                <input
                  type="text"
                  placeholder="🔍 Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {/* Ordenar */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  <option value="relevance">Relevância</option>
                  <option value="newest">Lançamentos</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="name_asc">Nome A–Z</option>
                  <option value="name_desc">Nome Z–A</option>
                </select>
                {isLoggedIn && (
                  <button
                    onClick={() => setShowFollowedOnly(prev => !prev)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      showFollowedOnly
                        ? 'bg-pink-100 text-pink-700 border border-pink-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {showFollowedOnly ? '❤️ Seguidos: ON' : '🤍 Seguidos: OFF'}
                  </button>
                )}
              </div>
            </div>

            {/* Grid de produtos */}
            {sortedProducts.length > 0 ? (
              <div className="grid grid-cols-4 gap-4">
                {sortedProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isLoggedIn={isLoggedIn}
                    onInterest={handleProductInterest}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Nenhum produto encontrado com os filtros selecionados</p>
              </div>
            )}
          </main>
        </div>

        <LoginModal
          open={showLoginModal}
          onOpenChange={setShowLoginModal}
          message="Para adicionar produtos ao carrinho, você precisa fazer login"
        />
      </div>
    )
  }

  /* ============================================
   *  MOBILE LAYOUT (< 1024px) — INALTERADO
   * ============================================ */
  return (
    <div className="bg-gray-50">
      {/* Header */}
      <header className={`bg-white border-b border-gray-200 sticky top-0 z-20 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900">📱 Catálogo</h1>
              <p className="text-xs text-gray-600 mt-1">{sortedProducts.length} produto(s)</p>
            </div>
            <div className="flex items-center gap-2 w-auto ml-auto justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex-none px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded transition-colors">
                    🔍 Filtros
                    {activeFilterCount > 0 && (
                      <span className="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>🔍 Filtros de Busca</DialogTitle>
                    <DialogDescription className="sr-only">
                      Selecione os filtros para refinar sua busca por produtos
                    </DialogDescription>
                  </DialogHeader>
                  <CatalogFilters
                    modelSearch={modelSearch}
                    onModelSearchChange={setModelSearch}
                    selectedBrand={selectedBrand}
                    onBrandChange={setSelectedBrand}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    selectedCondition={selectedCondition}
                    onConditionChange={setSelectedCondition}
                    brands={brands}
                    categories={categories}
                    conditions={conditions}
                    variant="dialog"
                  />
                  <DialogClose asChild>
                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                      🔍 Pesquisar
                    </Button>
                  </DialogClose>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="relative flex-none p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-center">
                    <span className="text-xl">🔔</span>
                    {notificationCount > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {notificationCount}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-[420px] p-0 overflow-hidden h-[80vh]">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Notificações</DialogTitle>
                    <DialogDescription>Visualize suas notificações recentes</DialogDescription>
                  </DialogHeader>
                  <Notifications isModal />
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="relative flex-none p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-center">
                    <span className="text-xl">🛒</span>
                    {cartCount > 0 && (
                      <span className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-[420px] p-0 overflow-hidden h-[80vh]">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Carrinho de Compras</DialogTitle>
                    <DialogDescription>Gerencie os itens adicionados ao seu carrinho</DialogDescription>
                  </DialogHeader>
                  <Cart isModal />
                </DialogContent>
              </Dialog>

              {!isLoggedIn && !authLoading && (
                <button
                  onClick={() => window.location.href = getLoginUrlWithRedirect()}
                  className="flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={`sticky z-10 bg-white border-b border-gray-200 px-4 py-3 transition-all duration-300 ${
        headerVisible ? 'top-[80px]' : 'top-0'
      }`}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="🔍 Buscar por modelo, peça, condição ou loja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {isLoggedIn && (
              <button
                onClick={() => setShowFollowedOnly(prev => !prev)}
                className={`p-2 rounded-lg border transition-colors ${
                  showFollowedOnly
                    ? 'bg-pink-100 text-pink-600 border-pink-200'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
                title="Ver apenas lojas seguidas"
              >
                {showFollowedOnly ? '❤️' : '🤍'}
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
            >
              <option value="relevance">Ordenar</option>
              <option value="newest">Recentes</option>
              <option value="price_asc">↑ Preço</option>
              <option value="price_desc">↓ Preço</option>
              <option value="name_asc">A–Z</option>
              <option value="name_desc">Z–A</option>
            </select>
          </div>
        </div>
      </div>

      <main className="px-4 py-4 space-y-4">
        {sortedProducts.length > 0 ? sortedProducts.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            isLoggedIn={isLoggedIn}
            onInterest={handleProductInterest}
            onViewDetails={handleViewDetails}
          />
        )) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600 text-sm">Nenhum produto encontrado com os filtros selecionados</p>
          </div>
        )}
      </main>

      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        message="Para adicionar produtos ao carrinho, você precisa fazer login"
      />
    </div>
  )
}
