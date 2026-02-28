import { useLocation } from 'wouter'
import { useAuth } from '@/_core/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { trpc } from '@/lib/trpc'
import { getLoginUrlWithRedirect } from '@/components/LoginModal'

const navItems = [
  { label: 'Catálogo', path: '/catalog', icon: '📱' },
  { label: 'Estoque', path: '/stock', icon: '📦' },
  { label: 'Transações', path: '/transactions', icon: '💳' },
]

export default function DesktopTopBar() {
  const [location, setLocation] = useLocation()
  const { isAuthenticated, user, logout, loading } = useAuth({ redirectOnUnauthenticated: false })
  const isLoggedIn = isAuthenticated && !loading && user !== null
  const { data: sellerProfile } = trpc.sellerProfiles.getFullProfile.useQuery(undefined, { enabled: isLoggedIn })
  const { unreadCount } = useNotifications()
  const { data: cartItems = [] } = trpc.cart.list.useQuery(undefined, { enabled: isLoggedIn })
  const cartCount = cartItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)

  const storeName = sellerProfile?.storeName || user?.name || 'Perfil'
  const storeLogo = sellerProfile?.profilePhoto

  const isActive = (path: string) => location === path || (path === '/catalog' && location === '/')

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <button
          onClick={() => setLocation('/catalog')}
          className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <span className="text-2xl">📱</span>
          <span className="text-xl font-bold text-gray-900">StockTech</span>
        </button>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-1.5">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Notificações */}
          <button
            onClick={() => setLocation('/notifications')}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Carrinho */}
          {isLoggedIn && (
            <button
              onClick={() => setLocation('/cart')}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          )}

          {/* User / Login */}
          {isLoggedIn ? (
            <div className="flex items-center gap-3 ml-2">
              <button
                onClick={() => setLocation('/user-profile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive('/user-profile')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {storeLogo && typeof storeLogo === 'string' && storeLogo.startsWith('http') ? (
                  <img src={storeLogo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="text-lg">👤</span>
                )}
                <span className="text-sm font-medium max-w-[120px] truncate">
                  {storeName}
                </span>
              </button>
              <button
                onClick={async () => {
                  await logout()
                  setLocation('/catalog')
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sair"
              >
                <span className="text-lg">🚪</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.location.href = getLoginUrlWithRedirect()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
