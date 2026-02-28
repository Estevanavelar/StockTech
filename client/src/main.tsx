import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

function syncTokenFromQuery() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);

  const authParam = params.get("auth");
  let token = params.get("token");
  let userJson: string | null = null;

  if (authParam) {
    try {
      const decodedAuth = decodeURIComponent(authParam);
      const authParams = new URLSearchParams(decodedAuth);
      token = authParams.get("token") || token;
      const userBase64 = authParams.get("user");
      if (userBase64) {
        userJson = atob(userBase64);
      }
    } catch {
      // ignore malformed auth param
    }
  }

  if (!token) {
    // Se não houver token na URL, verificar se já temos no localStorage ou cookie
    const existingToken = getCookieValue("avelar_token") || localStorage.getItem("avelar_token");
    if (existingToken) {
      console.log('[Auth] Token já existente encontrado');
    }
    return;
  }

  console.log('[Auth] Novo token encontrado na URL, processando...');

  // Salvar o token localmente e no cookie para autenticação via header
  localStorage.setItem("avelar_token", token);
  if (userJson) {
    localStorage.setItem("avelar_user", userJson);
  }
  
  // Definir cookie para persistência e compatibilidade
  document.cookie = `avelar_token=${token}; domain=.avelarcompany.com.br; path=/; secure; samesite=none; max-age=31536000`; // 1 ano

  // Chamar o backend apenas para sincronizar dados do usuário se necessário (opcional)
  const redirect = window.location.pathname;
  fetch(`/api/auth/callback?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`, {
    method: 'GET',
    credentials: 'include',
  })
    .then(response => {
      if (response.ok) {
        console.log('[Auth] Sincronização com backend concluída');
        // Redirecionar para a URL limpa após criar a sessão
        params.delete("auth");
        params.delete("token");
        params.delete("user");
        const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.location.replace(cleanUrl);
      } else {
        // Se falhar a sincronização, ainda podemos continuar pois o token está no localStorage/cookie
        console.warn('[Auth] Backend sync failed, continuing with local token');
        params.delete("auth");
        params.delete("token");
        params.delete("user");
        const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", cleanUrl);
        // Forçar um reload se não estivermos no path limpo
        if (window.location.search.includes('token=') || window.location.search.includes('auth=')) {
          window.location.replace(cleanUrl);
        }
      }
    })
    .catch(error => {
      console.error('[Auth] Error syncing with backend:', error);
      params.delete("auth");
      params.delete("token");
      params.delete("user");
      const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", cleanUrl);
    });
}

syncTokenFromQuery();

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = `; ${document.cookie}`;
  const parts = cookie.split(`; ${name}=`);
  if (parts.length < 2) return null;
  const value = parts.pop()?.split(";").shift();
  return value ? decodeURIComponent(value) : null;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Tentar obter token do cookie ou do localStorage
        const token = getCookieValue("avelar_token") || localStorage.getItem("avelar_token");
        const headers = new Headers(init?.headers);
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
