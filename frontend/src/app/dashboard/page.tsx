'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface User {
  name: string
  role: string
  cpf: string
}

interface DashboardStats {
  my_products: number
  total_views: number
  contacts_received: number
  sales_this_month: number
}

export default function StockTechDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    checkAuthAndLoadData()
  }, [])
  
  const checkAuthAndLoadData = async () => {
    // Check authentication
    const token = localStorage.getItem('avadmin_token')
    const userData = localStorage.getItem('avadmin_user')
    
    if (!token || !userData) {
      router.replace('/login?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    
    try {
      const user = JSON.parse(userData)
      setUser(user)
      
      // Load dashboard stats (mock for now)
      await loadDashboardStats(token)
      
    } catch {
      router.replace('/login')
    }
  }
  
  const loadDashboardStats = async (token: string) => {
    try {
      // Mock data (will replace with real API)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setStats({
        my_products: 4,
        total_views: 120,
        contacts_received: 8,
        sales_this_month: 2
      })
      
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleLogout = () => {
    localStorage.removeItem('avadmin_token')
    localStorage.removeItem('avadmin_user')
    router.replace('/login')
  }
  
  const navigateToSection = (section: string) => {
    // For now, just show alert (will implement proper routing)
    toast.info(
      `🚧 Seção "${section}" será implementada em breve!`,
      { duration: 5000 }
    )
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return null
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
                Dashboard Vendedor
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
              >
                🛍️ Ver Catálogo
              </button>
              
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
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard Vendedor 🏪
          </h2>
          <p className="text-gray-600">
            Gerencie seus produtos e acompanhe suas vendas no marketplace.
          </p>
        </div>
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="stat-card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Meus Produtos</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.my_products}</p>
                </div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">👁️</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Visualizações</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total_views}</p>
                </div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📱</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Contatos WhatsApp</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.contacts_received}</p>
                </div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Vendas Este Mês</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.sales_this_month}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 mb-8">
          
          {/* Add Product */}
          <div className="card hover:shadow-lg transition-shadow cursor-pointer"
               onClick={() => navigateToSection('Adicionar Produto')}>
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">➕</span>
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Produto</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Adicione novos produtos ao seu catálogo.
            </p>
            <button className="btn-primary w-full">
              Novo Produto
            </button>
          </div>
          
          {/* My Products */}
          <div className="card hover:shadow-lg transition-shadow cursor-pointer"
               onClick={() => navigateToSection('Meus Produtos')}>
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">📦</span>
              <h3 className="text-lg font-semibold text-gray-900">Meus Produtos</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Gerencie seu estoque e preços.
            </p>
            <button className="btn-primary w-full">
              Ver Produtos
            </button>
          </div>
          
          {/* Sales History */}
          <div className="card hover:shadow-lg transition-shadow cursor-pointer"
               onClick={() => navigateToSection('Histórico de Vendas')}>
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">📊</span>
              <h3 className="text-lg font-semibold text-gray-900">Vendas</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Acompanhe suas vendas e negociações.
            </p>
            <button className="btn-primary w-full">
              Ver Vendas
            </button>
          </div>
          
        </div>
        
        {/* Navigation Links */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🧭 Navegação Rápida</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-lg mr-3">🛍️</span>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Catálogo Público</p>
                <p className="text-xs text-gray-500">Ver todos os produtos</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigateToSection('Configurações')}
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-lg mr-3">⚙️</span>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Configurações</p>
                <p className="text-xs text-gray-500">Perfil e preferências</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigateToSection('Suporte')}
              className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-lg mr-3">❓</span>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Suporte</p>
                <p className="text-xs text-gray-500">Ajuda e contato</p>
              </div>
            </button>
          </div>
        </div>
        
      </main>
    </div>
  )
}