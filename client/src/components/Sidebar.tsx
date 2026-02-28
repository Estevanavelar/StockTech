import React from 'react'
import { useLocation } from 'wouter'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [, setLocation] = useLocation()

  const menuItems = [
    { id: 'catalog', label: '📱 Catálogo', icon: '📱', path: '/catalog' },
    { id: 'stock', label: '📦 Estoque', icon: '📦', path: '/stock' },
    { id: 'products', label: '🏷️ Produtos', icon: '🏷️', path: '/products' },
    { id: 'transactions', label: '💳 Transações', icon: '💳', path: '/transactions' },
  ]

  const handleNavigation = (path: string) => {
    setLocation(path)
    if (onClose) onClose()
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <div 
              className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg overflow-hidden p-2"
              style={{ 
                backgroundImage: 'url(/logo-dark.png)', 
                backgroundSize: 'cover', 
                backgroundPosition: 'center' 
              }}
            >
            </div>
            <h2 className="text-xl font-bold text-gray-900">StockTech</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">Marketplace B2B</p>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors group"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            <p className="font-semibold">Avelar Company</p>
            <p className="text-gray-500">StockTech System</p>
          </div>
        </div>
      </aside>

      {/* Main content spacer for desktop */}
      <div className="hidden lg:block w-64" />
    </>
  )
}
