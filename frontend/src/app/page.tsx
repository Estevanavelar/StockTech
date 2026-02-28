'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  code: string
  name: string
  price: number
  price_formatted: string
  original_price?: number
  is_on_sale: boolean
  condition: string
  brand: string
  category: string
  image?: string
  view_count: number
}

export default function StockTechHomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    checkAuthAndLoadData()
  }, [])
  
  const checkAuthAndLoadData = () => {
    // Check authentication (AvAdmin token)
    const token = localStorage.getItem('avadmin_token')
    const userData = localStorage.getItem('avadmin_user')
    
    if (!token || !userData) {
      // Not authenticated - redirect to login
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
      return
    }
    
    try {
      const user = JSON.parse(userData)
      setUser(user)
      
      // Check if user has StockTech module enabled
      // For now, mock some products
      loadMockData()
      
    } catch {
      // Invalid token - redirect to login
      window.location.href = '/login'
    }
  }
  
  const loadMockData = async () => {
    // Mock products data (will replace with real API)
    const mockProducts: Product[] = [
      {
        id: '1',
        code: 'ST000001A',
        name: 'iPhone 15 Pro Max 256GB Space Black',
        price: 8500.00,
        price_formatted: 'R$ 8.500,00',
        original_price: 9000.00,
        is_on_sale: true,
        condition: 'NEW',
        brand: 'Apple',
        category: 'Smartphones',
        view_count: 42
      },
      {
        id: '2', 
        code: 'ST000002B',
        name: 'Samsung Galaxy S24 Ultra 512GB',
        price: 7200.00,
        price_formatted: 'R$ 7.200,00',
        is_on_sale: false,
        condition: 'NEW',
        brand: 'Samsung',
        category: 'Smartphones',
        view_count: 28
      },
      {
        id: '3',
        code: 'ST000003C', 
        name: 'Xiaomi 14 Ultra 512GB Black',
        price: 4500.00,
        price_formatted: 'R$ 4.500,00',
        is_on_sale: false,
        condition: 'NEW',
        brand: 'Xiaomi', 
        category: 'Smartphones',
        view_count: 35
      },
      {
        id: '4',
        code: 'ST000004D',
        name: 'Capa iPhone 15 Pro Max Original',
        price: 450.00,
        price_formatted: 'R$ 450,00',
        is_on_sale: false,
        condition: 'NEW',
        brand: 'Apple',
        category: 'Acessórios',
        view_count: 15
      }
    ]
    
    const mockCategories = [
      { id: '1', name: 'Smartphones', count: 3, icon: '📱' },
      { id: '2', name: 'Acessórios', count: 1, icon: '🔌' },
      { id: '3', name: 'Tablets', count: 0, icon: '📱' },
      { id: '4', name: 'Audio', count: 0, icon: '🎧' }
    ]
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    setProducts(mockProducts)
    setCategories(mockCategories)
    setLoading(false)
  }
  
  const handleProductInterest = async (product: Product) => {
    if (!user) return
    
    // Generate WhatsApp link (will be automatic in production)
    const message = `📱 *StockTech*\nOlá! Tenho interesse no produto:\n\n🔥 *${product.name}*\n💰 Preço: ${product.price_formatted}\n📦 Código: ${product.code}\n\nPodemos negociar? 😊`
    
    // For now, show alert (will be automatic WhatsApp)
    toast.info('🤖 WhatsApp automático: mensagem seria enviada ao vendedor.', { duration: 5000 })
    
    // In production: API call to trigger WhatsApp automation
    // await fetch('/api/products/' + product.id + '/interest', { method: 'POST' })
  }
  
  const handleLogout = () => {
    localStorage.removeItem('avadmin_token')
    localStorage.removeItem('avadmin_user')
    window.location.href = '/login'
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header skeleton */}
        <div className="bg-white shadow border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between items-center">
              <div className="skeleton h-8 w-32"></div>
              <div className="skeleton h-8 w-24"></div>
            </div>
          </div>
        </div>
        
        {/* Content skeleton */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="skeleton h-8 w-48 mb-6"></div>
          <div className="products-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card">
                <div className="skeleton h-48 w-full mb-4"></div>
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-4 w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                📱 StockTech
              </h1>
              <span className="ml-4 px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
                Marketplace B2B
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{user.name}</span>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Logout"
                  >
                    <span className="text-lg">🚪</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Catálogo de Produtos 🛍️
          </h2>
          <p className="text-gray-600">
            Marketplace B2B de eletrônicos - Login necessário para visualizar.
          </p>
        </div>
        
        {/* Categories filter */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Categorias</h3>
          <div className="flex flex-wrap gap-2">
            <button className="filter-badge bg-primary-100 text-primary-800">
              📱 Todos os Produtos
            </button>
            {categories.map(category => (
              <button 
                key={category.id}
                className="filter-badge"
              >
                {category.icon} {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
        
        {/* Products Grid */}
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card animate-fade-in">
              {/* Product Image Placeholder */}
              <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-4xl">📱</span>
              </div>
              
              {/* Product Info */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                    {product.name}
                  </h3>
                  <span className="badge-new ml-2">
                    {product.condition === 'NEW' ? 'Novo' : 'Usado'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Código: {product.code}</span>
                  <span className="text-xs text-gray-500">👁️ {product.view_count}</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="price-tag">{product.price_formatted}</span>
                    {product.is_on_sale && product.original_price && (
                      <span className="price-original">R$ {product.original_price.toFixed(2)}</span>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-600">
                    {product.brand} • {product.category}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="pt-3 space-y-2">
                  <button
                    onClick={() => handleProductInterest(product)}
                    className="btn-whatsapp w-full text-sm"
                  >
                    <span className="mr-2">💬</span>
                    Tenho Interesse
                  </button>
                  
                  <div className="flex space-x-2">
                    <button className="flex-1 text-xs btn-secondary py-1">
                      📋 Detalhes
                    </button>
                    <button className="flex-1 text-xs btn-secondary py-1">
                      ❤️ Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>📱 Sistema 100% brasileiro • WhatsApp-first • Catálogo privado</p>
          <p className="mt-1">🔒 Login obrigatório • 🤖 Negociações automáticas via WhatsApp</p>
        </div>
        
      </main>
    </div>
  )
}