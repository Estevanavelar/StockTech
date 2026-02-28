import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { getAvAdminClient } from "./avadmin-client";
import { syncUserFromAvAdmin } from "./sync";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Rota para callback do AppPortal com token
  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    const token = getQueryParam(req, "token");
    const redirect = getQueryParam(req, "redirect");

    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    try {
      // Validar token com AvAdmin
      const avAdminClient = getAvAdminClient();
      const validation = await avAdminClient.validateToken(token);

      if (!validation.valid || !validation.user) {
        res.status(401).json({ error: "Token inválido ou expirado" });
        return;
      }

      const user = validation.user;
      const account = validation.account;

      // Verificar acesso ao módulo StockTech
      if (user.account_id) {
        const moduleAccess = await avAdminClient.checkModuleAccess(
          user.account_id,
          "StockTech"
        );

        if (!moduleAccess.hasAccess) {
          res.status(403).json({ 
            error: "Acesso negado ao módulo StockTech",
            reason: moduleAccess.reason 
          });
          return;
        }
      }

      // Sincronizar usuário do AvAdmin para tabela users do StockTech
      if (account) {
        await syncUserFromAvAdmin(account, user.client_type || 'lojista');
      }

      // Criar endereco padrao no StockTech para novos usuarios
      try {
        const database = await db.getDb();
        if (database) {
          const { addresses } = await import("../../drizzle/schema");
          const accountId = account?.id || user.account_id;
          if (accountId) {
            const existing = await database
              .select()
              .from(addresses)
              .where(and(eq(addresses.userId, user.id), eq(addresses.accountId, accountId)))
              .limit(1);

            if (!existing.length) {
              const street = user.address_street || account?.address || "";
              const number = user.address_number || "s/n";
              const complement = user.complement || account?.complement || "";
              const neighborhood = user.address_neighborhood || "Nao informado";
              const city = user.address_city || account?.city || "";
              const state = user.address_state || account?.state || "";
              const zipCode = user.zip_code || account?.zip_code || "";

              if (street && city && state && zipCode) {
                await database.insert(addresses).values({
                  accountId,
                  userId: user.id,
                  street,
                  number,
                  complement,
                  neighborhood,
                  city,
                  state,
                  zipCode,
                  country: "Brasil",
                  isDefault: 1,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn("[Auth] Falha ao sincronizar endereco inicial:", error);
      }

      // Salvar o token do AvAdmin como o token de sessão do StockTech
      const cookieOptions = getSessionCookieOptions(req);
      
      // Usar avelar_token para compatibilidade com o frontend
      // NOTA: Removido httpOnly para permitir que o frontend leia o token se necessário
      res.cookie("avelar_token", token, { 
        ...cookieOptions, 
        httpOnly: false,
        maxAge: ONE_YEAR_MS,
        domain: ".avelarcompany.com.br"
      });
      
      // Também manter o COOKIE_NAME padrão
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirecionar para a URL especificada ou para a raiz
      const redirectUrl = redirect && redirect.startsWith("/") ? redirect : "/";
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("[Auth] Callback failed", error);
      res.status(500).json({ error: "Auth callback failed" });
    }
  });
}
