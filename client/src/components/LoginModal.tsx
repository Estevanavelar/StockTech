import React from 'react';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LoginModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  message?: string;
  title?: string;
}

// Função para gerar URL de login com redirecionamento
const getLoginUrlWithRedirect = (redirectPath?: string): string => {
  const baseLoginUrl = 'https://app.avelarcompany.com.br/login';

  // Se não tiver caminho de redirecionamento, usar a URL atual
  const currentUrl = typeof window !== 'undefined'
    ? window.location.href
    : 'https://stocktech.avelarcompany.com.br/catalog';

  const redirectUrl = redirectPath
    ? `https://stocktech.avelarcompany.com.br${redirectPath}`
    : currentUrl;

  // Codificar a URL de redirecionamento
  const encodedRedirect = encodeURIComponent(redirectUrl);

  return `${baseLoginUrl}?redirect=${encodedRedirect}`;
};

export default function LoginModal({
  open,
  onOpenChange,
  message = "Você precisa fazer login para continuar",
  title = "Login Necessário"
}: LoginModalProps) {
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    // Usar o parâmetro redirect do AvAdmin para retornar à página atual após login
    const loginUrl = getLoginUrlWithRedirect();
    window.location.href = loginUrl;
  };

  const handleContinue = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
    // Redirecionar para o catálogo se estiver em página protegida
    setLocation('/catalog');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {message}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              Para adicionar produtos ao carrinho e finalizar compras, você precisa estar logado no sistema.
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Fazer Login
            </Button>
            <Button
              variant="outline"
              onClick={handleContinue}
              className="w-full"
            >
              Continuar Navegando
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Você será redirecionado para a página de login e retornará aqui após autenticar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Exportar função para uso em outros componentes
export { getLoginUrlWithRedirect };