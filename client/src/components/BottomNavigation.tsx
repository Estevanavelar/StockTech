import React, { useState, useEffect } from 'react'
import { useLocation } from 'wouter'

interface NavItem {
  id: string
  label: string
  icon: string
  path: string
}

export default function BottomNavigation() {
  const [location, setLocation] = useLocation()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const container = document.getElementById('main-scroll-container')
    if (!container) return

    const handleScroll = () => {
      const currentScrollY = container.scrollTop
      
      // Se rolar para baixo > 10px, esconde. Se rolar para cima, mostra.
      if (currentScrollY > lastScrollY && currentScrollY > 10) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const navItems: NavItem[] = [
    { id: 'catalog', label: 'Catálogo', icon: '📱', path: '/catalog' },
    { id: 'stock', label: 'Estoque', icon: '📦', path: '/stock' },
    { id: 'transactions', label: 'Transações', icon: '💳', path: '/transactions' },
    { id: 'profile', label: 'Perfil', icon: '👤', path: '/user-profile' },
  ]

  const isActive = (path: string) => location === path

  return (
    <nav
      className={`absolute bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-4 mb-2.5 mt-2.5 bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden">
        <div className="flex justify-start items-center h-16">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              className={`flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative min-h-[44px] ${
                isActive(item.path)
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium text-center">{item.label}</span>
              {isActive(item.path) && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
