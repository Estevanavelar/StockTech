import { Route, Switch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from "./components/ErrorBoundary";
import BottomNavigation from "./components/BottomNavigation";
import DesktopTopBar from "./components/DesktopTopBar";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AddressProvider } from "./contexts/AddressContext";
import { SellerProvider } from "./contexts/SellerContext";
import { ProductProvider } from "./contexts/ProductContext";
import { RatingProvider } from "./contexts/RatingContext";
import { Toaster } from "./components/ui/sonner";
import CookieConsent from "./components/CookieConsent";
import { useAuthPersistence } from "./hooks/useAuthPersistence";
import { useRealtimeData } from "./hooks/useRealtimeData";
import { WebSocketProvider } from "./hooks/useWebSocket.tsx";
import { useIsDesktop } from "./hooks/useMobile";
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import Stock from './pages/Stock'
import Transactions from './pages/Transactions'
import UserProfile from './pages/UserProfile'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import CheckoutSuccess from './pages/CheckoutSuccess'
import SellerOrders from './pages/SellerOrders'
import OrderHistory from './pages/OrderHistory'
import Notifications from './pages/Notifications'
import AddressManagement from './pages/AddressManagement'
import PubSellerProfile from './pages/PubSellerProfile'
import OrderDetails from './pages/OrderDetails'
import AddProduct from './pages/AddProduct'
import NotFound from "./pages/NotFound";

// Criar componentes wrapper FORA do Router para evitar recriação
const ProtectedStock = () => <ProtectedRoute component={Stock} />;
const ProtectedTransactions = () => <ProtectedRoute component={Transactions} />;
const ProtectedUserProfile = () => <ProtectedRoute component={UserProfile} />;
const ProtectedCart = () => <ProtectedRoute component={Cart} />;
const ProtectedCheckout = () => <ProtectedRoute component={Checkout} />;
const ProtectedCheckoutSuccess = () => <ProtectedRoute component={CheckoutSuccess} />;
const ProtectedSellerOrders = () => <ProtectedRoute component={SellerOrders} />;
const ProtectedOrderHistory = () => <ProtectedRoute component={OrderHistory} />;
const ProtectedNotifications = () => <ProtectedRoute component={Notifications} />;
const ProtectedAddressManagement = () => <ProtectedRoute component={AddressManagement} />;
const ProtectedOrderDetails = () => <ProtectedRoute component={OrderDetails} />;
const ProtectedAddProduct = () => <ProtectedRoute component={AddProduct} />;

function Router() {
  // Chamada do hook de dados em tempo real movida para dentro do provedor WebSocket
  useRealtimeData();

  return (
    <Switch>
      {/* ========== ROTAS PÚBLICAS ========== */}
      <Route path="/" component={Catalog} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/404" component={NotFound} />

      {/* ========== ROTAS COM AUTENTICAÇÃO CONDICIONAL ========== */}
      <Route path="/stock" component={Stock} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/user-profile" component={UserProfile} />

      {/* ========== ROTAS PROTEGIDAS ========== */}
      <Route path="/cart" component={ProtectedCart} />
      <Route path="/checkout" component={ProtectedCheckout} />
      <Route path="/checkout/success" component={ProtectedCheckoutSuccess} />
      <Route path="/seller-orders" component={ProtectedSellerOrders} />
      <Route path="/order-history" component={ProtectedOrderHistory} />
      <Route path="/notifications" component={ProtectedNotifications} />
      <Route path="/address-management" component={ProtectedAddressManagement} />
      <Route path="/order-details/:role/:orderCode" component={ProtectedOrderDetails} />
      <Route path="/order-details" component={ProtectedOrderDetails} />
      <Route path="/add-product/edit/:code" component={ProtectedAddProduct} />
      <Route path="/add-product" component={ProtectedAddProduct} />

      {/* ========== ROTAS DINÂMICAS (DEVEM VIR POR ÚLTIMO) ========== */}
      {/* Produto por código (sem nome da loja - para usuários não logados) */}
      <Route path="/p/:productCode" component={ProductDetails} />
      {/* Produto com URL amigável (productName opcional para compatibilidade) */}
      <Route path="/:storeSlug/:productCode/:productName?" component={ProductDetails} />

      {/* Perfil público do vendedor (DEVE vir DEPOIS de TODAS as rotas específicas) */}
      <Route path="/:storeSlug" component={PubSellerProfile} />

      {/* ========== FALLBACK ========== */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useAuth({ redirectOnUnauthenticated: false });
  useAuthPersistence();
  const isDesktop = useIsDesktop();

  return (
    <ErrorBoundary>
      <WebSocketProvider>
        <NotificationProvider>
          <AddressProvider>
            <SellerProvider>
              <ProductProvider>
                <RatingProvider>
                  <ThemeProvider defaultTheme="light">
                    <CookieConsent />
                    {isDesktop ? (
                      <div className="min-h-screen bg-gray-50">
                        <DesktopTopBar />
                        <div id="main-scroll-container" className="flex-1">
                          <Router />
                        </div>
                      </div>
                    ) : (
                      <div className="h-[100dvh] md:h-screen md:bg-zinc-900/70 md:flex md:justify-center md:items-center md:py-[7px] pt-safe-area">
                        <div className="flex flex-col w-full h-full md:max-w-[420px] md:h-[calc(100vh-14px)] bg-gray-50 md:rounded-[30px] md:shadow-2xl overflow-hidden relative md:border md:border-white/10 overscroll-none">
                          <div id="main-scroll-container" className="flex-1 overflow-y-auto no-scrollbar pb-mobile-nav">
                            <Router />
                          </div>
                          <BottomNavigation />
                        </div>
                      </div>
                    )}
                    <Toaster duration={5000} closeButton={false} />
                  </ThemeProvider>
                </RatingProvider>
              </ProductProvider>
            </SellerProvider>
          </AddressProvider>
        </NotificationProvider>
      </WebSocketProvider>
    </ErrorBoundary>
  );
}

export default App;
