import { z } from "zod";
import { notifyOwner } from "./notification";
import { normalizeStockTechRole } from "./role";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  getCurrentUser: protectedProcedure.query(({ ctx }) => {
    return {
      token: ctx.token,
      user: {
        id: ctx.user!.id,
        name: ctx.user!.full_name,
        cpf: ctx.user!.cpf,
        whatsapp: ctx.user!.whatsapp,
        role: normalizeStockTechRole(ctx.user!.role),
        accountId: ctx.user!.account_id,
        whatsappVerified: ctx.user!.whatsapp_verified,
      },
      account: {
        id: ctx.account!.id,
        companyName: ctx.account!.company_name,
        cnpj: ctx.account!.cnpj,
        whatsapp: ctx.account!.whatsapp,
        planId: ctx.account!.plan_id,
        status: ctx.account!.status,
        enabledModules: ctx.account!.enabled_modules,
      },
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
