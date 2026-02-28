import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateRequest, extractToken, type AuthContext } from "../middleware/auth";
import type { User, Account } from "./avadmin-client";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  account: Account | null;
  token: string | null;
};

function getCookieValue(req: CreateExpressContextOptions["req"], name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[name] || null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let authContext: AuthContext | null = null;

  try {
    // 1. Tentar autenticar via header Authorization (token JWT do AvAdmin)
    const authHeader = opts.req.headers.authorization;
    let token = extractToken(authHeader);

    // 2. Se não houver no header, tentar via cookie (avelar_token ou COOKIE_NAME)
    if (!token) {
      token = getCookieValue(opts.req, "avelar_token") || getCookieValue(opts.req, COOKIE_NAME);
    }

    if (token) {
      authContext = await authenticateRequest(token);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    // Errors will be handled by protected procedures
    authContext = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user: authContext?.user || null,
    account: authContext?.account || null,
    token: authContext?.token || null,
  };
}
