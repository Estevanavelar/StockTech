import React, { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { trpc } from '../lib/trpc'
import { useProducts } from '../contexts/ProductContext'
import { ReportGenerator } from '../components/ReportGenerator'
import { useToast } from '../hooks/useToast'
import { useAuth } from '@/_core/hooks/useAuth'
import { useIsDesktop } from '@/hooks/useMobile'
import LoginModal from '@/components/LoginModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import QuickRestockDialog from '../components/QuickRestockDialog'

interface StockItem {
  id: number
  code: string
  name: string
  brand?: string | null
  model?: string | null
  category?: string | null
  quantity: number
  minQuantity: number
  unitPrice: number
  totalValue: number
  lastUpdated: string
  status: 'ok' | 'low' | 'critical'
}

export default function Stock() {
  const [, navigate] = useLocation()
  const { products, deleteProduct } = useProducts()
  const { showToast } = useToast()
  const { isAuthenticated, loading: authLoading, user } = useAuth({ redirectOnUnauthenticated: false })
  const isDesktop = useIsDesktop()
  const isLoggedIn = isAuthenticated && !authLoading && user !== null
  const returnsQuery = trpc.returns.list.useQuery(undefined, { enabled: isLoggedIn })
  const returns = returnsQuery.data || []
  const userIdentifier = (user as any)?.cpf || (user as any)?.id || user?.email
  const reservedForExchange = useMemo(() => {
    if (!userIdentifier) return 0
    return returns
      .filter(r => r.sellerId === userIdentifier && ['replacement_sent', 'defective_received'].includes(r.status))
      .reduce((sum, r) => sum + (r.quantity || 0), 0)
  }, [returns, userIdentifier])
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [pendingRemoveId, setPendingRemoveId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'low' | 'critical'>('all')
  const [showDashboard, setShowDashboard] = useState(true)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [restockProduct, setRestockProduct] = useState<{ id: number; name: string; code: string; quantity: number } | null>(null)

  // Efeito de esconder/mostrar header ao rolar (apenas mobile)
  React.useEffect(() => {
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

  const stockItems: StockItem[] = products.map(product => {
    const unitPrice = Number(product.price ?? 0)
    const status =
      product.quantity <= 0
        ? 'critical'
        : product.quantity <= product.minQuantity
          ? 'low'
          : 'ok'

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      brand: product.brand,
      model: product.model,
      category: product.category,
      quantity: product.quantity,
      minQuantity: product.minQuantity,
      unitPrice,
      totalValue: unitPrice * product.quantity,
      lastUpdated: product.updatedAt,
      status,
    }
  })

  const totalItems = stockItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalValue = stockItems.reduce((sum, item) => sum + item.totalValue, 0)
  const criticalItems = stockItems.filter(item => item.status === 'critical').length
  const lowItems = stockItems.filter(item => item.status === 'low').length

  // Dashboard de Vendedor
  const totalProducts = products.length
  const totalInventoryValue = products.reduce((sum, p) => sum + (Number(p.price ?? 0) * p.quantity), 0)
  const lowStockProducts = products.filter(p => p.quantity <= p.minQuantity).length
  const averagePrice =
    products.length > 0
      ? products.reduce((sum, p) => sum + Number(p.price ?? 0), 0) / products.length
      : 0
  const totalStock = products.reduce((sum, p) => sum + p.quantity, 0)
  const defectiveProducts = useMemo(
    () => products.filter(p => (p.defectiveQuantity || 0) > 0),
    [products]
  )
  const totalDefective = useMemo(
    () => defectiveProducts.reduce((sum, p) => sum + (p.defectiveQuantity || 0), 0),
    [defectiveProducts]
  )

  const filteredItems = stockItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800'
      case 'low':
        return 'bg-yellow-100 text-yellow-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok':
        return '✅ OK'
      case 'low':
        return '⚠️ Baixo'
      case 'critical':
        return '🔴 Crítico'
      default:
        return 'Desconhecido'
    }
  }

  const handleEdit = (item: { id: number; code?: string | null }) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    if (item.code) {
      navigate(`/add-product/edit/${encodeURIComponent(item.code)}`)
      return
    }
    navigate(`/add-product?edit=${item.id}`)
  }

  const handleRemove = (id: number) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    setPendingRemoveId(id)
  }

  const handleRestock = (item: StockItem) => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    setRestockProduct({ id: item.id, name: item.name, code: item.code, quantity: item.quantity })
  }

  const handleAddProduct = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true)
      return
    }
    navigate('/add-product')
  }

  const confirmRemove = async () => {
    if (!pendingRemoveId) return
    try {
      await deleteProduct(pendingRemoveId)
    } catch (error) {
      console.error('Erro ao remover produto:', error)
      showToast('Não foi possível remover o produto.', 'error')
    } finally {
      setPendingRemoveId(null)
    }
  }

  /* ========== DESKTOP LAYOUT ========== */
  if (isDesktop) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-6 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => navigate('/catalog')} className="hover:text-blue-600 transition-colors">Início</button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Estoque</span>
          </nav>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-8">
          {/* Header com tabs */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📦 Estoque</h1>
              <p className="text-sm text-gray-500 mt-0.5">Gestão de inventário</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDashboard(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showDashboard ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setShowDashboard(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !showDashboard ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📋 Lista
              </button>
              <button
                onClick={handleAddProduct}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ➕ Adicionar Produto
              </button>
            </div>
          </div>

          {showDashboard ? (
            /* Dashboard Desktop */
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium uppercase">Produtos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
                </div>
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
                  <p className="text-xs text-blue-700 font-medium uppercase">Estoque Total</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{totalStock}</p>
                </div>
                <div className="bg-green-50 rounded-lg border border-green-200 p-5">
                  <p className="text-xs text-green-700 font-medium uppercase">Valor Total</p>
                  <p className="text-xl font-bold text-green-900 mt-1">R$ {(totalInventoryValue / 1000).toFixed(1)}k</p>
                </div>
                <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-5">
                  <p className="text-xs text-yellow-700 font-medium uppercase">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">{lowStockProducts}</p>
                </div>
                <div className="bg-orange-50 rounded-lg border border-orange-200 p-5">
                  <p className="text-xs text-orange-700 font-medium uppercase">Defeituosas</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {totalDefective}
                  </p>
                </div>
                {reservedForExchange > 0 && (
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-5">
                    <p className="text-xs text-amber-700 font-medium uppercase">Reservadas (Troca)</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">{reservedForExchange}</p>
                  </div>
                )}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {lowStockProducts > 0 && (
                  <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-5">
                    <h3 className="font-semibold text-yellow-900 mb-3">⚠️ Produtos com Estoque Baixo</h3>
                    <div className="space-y-2">
                      {products.filter(p => p.quantity <= p.minQuantity).map(product => (
                        <div key={product.id} className="flex items-center justify-between text-sm py-2 border-b border-yellow-200 last:border-0">
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-600">{product.quantity} / {product.minQuantity} un.</p>
                          </div>
                          <button
                            onClick={() => setRestockProduct({ id: product.id, name: product.name, code: product.code, quantity: product.quantity })}
                            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            Repor
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {defectiveProducts.length > 0 && (
                  <div className="bg-orange-50 rounded-lg border border-orange-200 p-5">
                    <h3 className="font-semibold text-orange-900 mb-3">🧩 Lista de Peças Defeituosas</h3>
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {[...defectiveProducts]
                        .sort((a, b) => (b.defectiveQuantity || 0) - (a.defectiveQuantity || 0))
                        .map(product => (
                          <div key={product.id} className="flex items-center justify-between text-sm py-2 border-b border-orange-200 last:border-0">
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-600">{product.code}</p>
                            </div>
                            <span className="font-bold text-orange-900">{product.defectiveQuantity || 0} un.</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">📈 Estatísticas</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Preço Médio</span>
                      <span className="font-semibold text-gray-900">R$ {averagePrice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Taxa de Ocupação</span>
                      <span className="font-semibold text-gray-900">{((totalStock / Math.max(totalProducts * 50, 1)) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-3">📊 Gerar Relatório</h3>
                    <ReportGenerator />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Lista Desktop - Tabela */
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center gap-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nome, código ou marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  {(['all', 'ok', 'low', 'critical'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'all' ? 'Todos' : getStatusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                {filteredItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-semibold text-gray-900">Produto</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-900">Código</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-900">Qtd</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-900">Mín</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-900">Status</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-900">Valor Unit.</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-900">Valor Total</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-900">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map(item => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.brand || ''}{item.model ? ` • ${item.model}` : ''}{item.category ? ` • ${item.category}` : ''}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{item.code}</td>
                            <td className="px-4 py-3 font-medium">{item.quantity}</td>
                            <td className="px-4 py-3 text-gray-600">{item.minQuantity}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">R$ {Number(item.unitPrice ?? 0).toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">R$ {Number(item.totalValue ?? 0).toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => handleRestock(item)} className="px-2 py-1 text-green-600 hover:bg-green-50 rounded text-xs font-medium">📦 Repor</button>
                                <button onClick={() => handleEdit(item)} className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium">✏️ Editar</button>
                                <button onClick={() => handleRemove(item.id)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs font-medium">🗑️ Remover</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <p className="text-gray-500">Nenhum produto encontrado</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <QuickRestockDialog
          open={restockProduct !== null}
          onOpenChange={(open) => !open && setRestockProduct(null)}
          product={restockProduct}
        />
        <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
        <AlertDialog open={pendingRemoveId !== null} onOpenChange={(open) => !open && setPendingRemoveId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover produto</AlertDialogTitle>
              <AlertDialogDescription>Deseja realmente remover este produto do estoque?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemove}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  /* ========== MOBILE LAYOUT ========== */
  return (
    <div className="min-h-screen bg-gray-50">
      <header className={`bg-white border-b border-gray-200 sticky top-0 z-20 transition-transform duration-300 ${
        headerVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">📦 Estoque</h1>
              <p className="text-xs text-gray-600 mt-1">Gestão de inventário</p>
            </div>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showDashboard
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        
        {/* Dashboard de Vendedor */}
        <div className={showDashboard ? "space-y-4" : "hidden"}>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-600 font-medium">Produtos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
                <p className="text-xs text-gray-500 mt-2">Cadastrados</p>
              </div>
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                <p className="text-xs text-blue-700 font-medium">Estoque Total</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{totalStock}</p>
                <p className="text-xs text-blue-600 mt-2">Unidades</p>
              </div>
              <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                <p className="text-xs text-green-700 font-medium">Valor Total</p>
                <p className="text-lg font-bold text-green-900 mt-1">R$ {(totalInventoryValue / 1000).toFixed(1)}k</p>
                <p className="text-xs text-green-600 mt-2">Em inventário</p>
              </div>
              <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                <p className="text-xs text-red-700 font-medium">Estoque Baixo</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{lowStockProducts}</p>
                <p className="text-xs text-red-600 mt-2">Produtos</p>
              </div>
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                <p className="text-xs text-orange-700 font-medium">Peças Defeituosas</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {totalDefective}
                </p>
                <p className="text-xs text-orange-600 mt-2">Em separado</p>
              </div>
              {reservedForExchange > 0 && (
                <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                  <p className="text-xs text-amber-700 font-medium">Reservadas para Troca</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">{reservedForExchange}</p>
                  <p className="text-xs text-amber-600 mt-2">Aguardando validação</p>
                </div>
              )}
            </div>

            {/* Produtos com Estoque Baixo */}
            {lowStockProducts > 0 && (
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                <h3 className="font-semibold text-yellow-900 mb-3">⚠️ Produtos com Estoque Baixo</h3>
                <div className="space-y-2">
                  {products.filter(p => p.quantity <= p.minQuantity).map(product => (
                    <div key={product.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-600">{product.quantity} / {product.minQuantity} un.</p>
                      </div>
                      <button
                        onClick={() => setRestockProduct({ id: product.id, name: product.name, code: product.code, quantity: product.quantity })}
                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        Repor
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {defectiveProducts.length > 0 && (
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                <h3 className="font-semibold text-orange-900 mb-3">🧩 Lista de Peças Defeituosas</h3>
                <div className="space-y-2">
                  {[...defectiveProducts]
                    .sort((a, b) => (b.defectiveQuantity || 0) - (a.defectiveQuantity || 0))
                    .map(product => (
                      <div key={product.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-600">{product.code}</p>
                        </div>
                        <span className="font-bold text-orange-900">{product.defectiveQuantity || 0} un.</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Estatísticas */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">📈 Estatísticas</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Preço Médio</span>
                  <span className="font-semibold text-gray-900">R$ {averagePrice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Taxa de Ocupação</span>
                  <span className="font-semibold text-gray-900">{((totalStock / (totalProducts * 50)) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Botão para Adicionar Produto */}
            <button
              onClick={handleAddProduct}
              className="relative w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              ➕ Adicionar Novo Produto
              {!isLoggedIn && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                  title="Login necessário"
                >
                  !
                </span>
              )}
            </button>

            {/* Gerar Relatório */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">📊 Gerar Relatório</h3>
              <ReportGenerator />
            </div>
          </div>

        {/* Estoque */}
        <div className={!showDashboard ? "space-y-4" : "hidden"}>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-600 mb-1">Total de Itens</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-600 mb-1">Valor Total</p>
                <p className="text-lg font-bold text-gray-900">R$ {(totalValue / 1000).toFixed(1)}k</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-600 mb-1">Itens Críticos</p>
                <p className="text-2xl font-bold text-red-600">{criticalItems}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-600 mb-1">Estoque Baixo</p>
                <p className="text-2xl font-bold text-yellow-600">{lowItems}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <input
                type="text"
                placeholder="🔍 Buscar por nome, código ou marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                {(['all', 'ok', 'low', 'critical'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      filterStatus === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {status === 'all' ? 'Todos' : getStatusLabel(status)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddProduct}
              className="relative w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              ➕ Adicionar Produto
              {!isLoggedIn && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                  title="Login necessário"
                >
                  !
                </span>
              )}
            </button>

            <div className="space-y-3">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                        <p className="text-xs text-gray-600">
                          {item.code}
                          {item.brand ? ` • ${item.brand}` : ''}
                          {item.model ? ` • ${item.model}` : ''}
                          {item.category ? ` • ${item.category}` : ''}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Quantidade</span>
                        <span className="text-sm font-bold text-gray-900">{item.quantity} unid.</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            item.status === 'critical'
                              ? 'bg-red-600'
                              : item.status === 'low'
                              ? 'bg-yellow-600'
                              : 'bg-green-600'
                          }`}
                          style={{
                            width: `${Math.min((item.quantity / (item.minQuantity * 3)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">Mínimo: {item.minQuantity} unid.</p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-600">Valor Unitário</p>
                        <p className="text-sm font-semibold text-gray-900">
                          R$ {Number(item.unitPrice ?? 0).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Valor Total</p>
                        <p className="text-sm font-semibold text-blue-600">
                          R$ {Number(item.totalValue ?? 0).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleRestock(item)}
                        className="relative flex-1 px-3 py-2 bg-green-50 border border-green-300 hover:bg-green-100 text-green-700 text-xs font-medium rounded transition-colors"
                      >
                        📦 Repor
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="relative flex-1 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded transition-colors"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="relative flex-1 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded transition-colors"
                      >
                        🗑️ Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <p className="text-gray-600 text-sm">Nenhum produto encontrado</p>
                </div>
              )}
            </div>
          </div>

      </main>

      <QuickRestockDialog
        open={restockProduct !== null}
        onOpenChange={(open) => !open && setRestockProduct(null)}
        product={restockProduct}
      />
      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />

      <AlertDialog open={pendingRemoveId !== null} onOpenChange={(open) => !open && setPendingRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente remover este produto do estoque?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
