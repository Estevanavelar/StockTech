import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const hasToken = useMemo(() => {
    if (typeof window === "undefined") return false;
    const storedToken = localStorage.getItem("avelar_token");
    const hasCookie = document.cookie.includes("avelar_token=");
    return Boolean(storedToken || hasCookie);
  }, []);
  
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: typeof window !== "undefined" && hasToken,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const clearTokenFromBrowser = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("avelar_token");
    localStorage.removeItem("avelar_user");
    localStorage.removeItem("avelar_account");
    localStorage.removeItem("stocktech-user-info");
    document.cookie = "avelar_token=; domain=.avelarcompany.com.br; path=/; secure; samesite=none; max-age=0";
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Token já inválido, continuar com a limpeza
      } else {
        throw error;
      }
    } finally {
      clearTokenFromBrowser();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils, clearTokenFromBrowser]);

  const state = useMemo(() => {
    localStorage.setItem(
      "stocktech-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    
    // Não redirecionar se há um token na URL sendo processado
    const params = new URLSearchParams(window.location.search);
    if (params.has("token") || params.has("auth")) {
      return;
    }
    
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
    state.loading,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
