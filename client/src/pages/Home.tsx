'use client'
import React from 'react'
import { trpc } from '../lib/trpc'
import { useToast } from '../hooks/useToast'

interface Product {
  id: number
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

export default function Home() {
  const meQuery = trpc.auth.me.useQuery()
  const productsQuery = trpc.products.listMarketplace.useQuery()
  const { showToast } = useToast()

  const userData = meQuery.data
  const products: Product[] = (productsQuery.data || []).map((p: any) => {
    const price = parseFloat(p.price || '0')
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      price,
      price_formatted: price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      is_on_sale: false,
      condition: p.condition,
      brand: p.brand || 'Marca não informada',
      category: p.category || 'Categoria não informada',
      view_count: 0,
    }
  })

  const handleProductInterest = (product: Product) => {
    showToast(`Interesse registrado em ${product.name}!`, 'success')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg overflow-hidden p-2"
                style={{ 
                  backgroundImage: 'url(/logo-dark.png)', 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center' 
                }}
              >
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                StockTech
              </h1>
              <span className="ml-4 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                Marketplace B2B
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {userData && (
                <>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{userData.name}</span>
                  </div>
                  <button
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Catálogo de Produtos 🛍️
          </h2>
          <p className="text-gray-600">
            Marketplace B2B de eletrônicos - Acesso direto ao catálogo.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <span className="text-6xl">📱</span>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{product.code}</span>
                  <span className="text-xs text-green-600">{product.condition}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{product.brand} • {product.category}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-600">{product.price_formatted}</span>
                  <button
                    onClick={() => handleProductInterest(product)}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full hover:bg-blue-200 transition-colors"
                  >
                    Tenho interesse
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
