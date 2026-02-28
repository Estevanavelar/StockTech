import React, { useEffect, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import LoginModal from './LoginModal';

interface ProtectedRouteProps {
  component: React.ComponentType;
  requireAuth?: boolean;
}

export function ProtectedRoute({
  component: Component,
  requireAuth = true
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth({
    redirectOnUnauthenticated: false
  });
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Verificar se realmente está autenticado (não apenas loading)
  const isLoggedIn = isAuthenticated && !loading && user !== null;

  useEffect(() => {
    if (!loading && !isLoggedIn && requireAuth) {
      setShowLoginModal(true);
    }
  }, [loading, isLoggedIn, requireAuth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (!isLoggedIn && requireAuth) {
    return (
      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />
    );
  }

  return <Component />;
}

export default ProtectedRoute;