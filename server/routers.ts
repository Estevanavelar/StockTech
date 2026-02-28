import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { systemRouter } from "./_core/systemRouter";
import { normalizeStockTechRole } from "./_core/role";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getAvAdminClient } from "./_core/avadmin-client";
import wsManager from "./_core/websocket";
import * as db from "./db";
import { eq, sql, and, or, desc, inArray, gt, ilike } from "drizzle-orm";
import { ordersRouter } from "./routers/orders";
import { getStorageKeyFromUrl, storageDeleteByKey, storagePut } from "./storage";

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "loja";

export const appRouter = router({
  system: systemRouter,
  orders: ordersRouter,

  uploadImage: publicProcedure
    .input(
      z.object({
        base64: z.string(),
        fileName: z.string(),
        type: z.enum(['profile', 'cover']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const base64Data = input.base64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const contentType = input.base64.match(/data:(.*?);/)?.[1] || 'image/jpeg';
        const timestamp = Date.now();
        const type = input.type || 'image';
        const key = `sellers/${type}/${timestamp}-${input.fileName}`;
        const result = await storagePut(key, buffer, contentType);
        return result;
      } catch (error: any) {
        console.error('Error uploading image:', error);
        throw new Error('Failed to upload image: ' + error.message);
      }
    }),

  debug: router({
    testDb: publicProcedure.query(async () => {
      try {
        const products = await db.getAllProducts();
        return { status: 'success', count: products.length };
      } catch (error: any) {
        return { status: 'error', message: error?.message || 'Unknown error' };
      }
    }),
  }),

  productOptions: router({
    list: publicProcedure.query(async () => {
      try {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { brands, productTypes, productParts, productConditions } = await import("../drizzle/schema");

        // Buscar todas as opções ativas, ordenadas por display_order
        const [brandsData, typesData, partsData, conditionsData] = await Promise.all([
          database.select({
            id: brands.id,
            name: brands.name,
            slug: brands.slug,
          })
            .from(brands)
            .where(eq(brands.isActive, true))
            .orderBy(brands.displayOrder, brands.name),

          database.select({
            id: productTypes.id,
            name: productTypes.name,
            slug: productTypes.slug,
          })
            .from(productTypes)
            .where(eq(productTypes.isActive, true))
            .orderBy(productTypes.displayOrder, productTypes.name),

          database.select({
            id: productParts.id,
            name: productParts.name,
            slug: productParts.slug,
          })
            .from(productParts)
            .where(eq(productParts.isActive, true))
            .orderBy(productParts.displayOrder, productParts.name),

          database.select({
            id: productConditions.id,
            value: productConditions.value,
            label: productConditions.label,
          })
            .from(productConditions)
            .where(eq(productConditions.isActive, true))
            .orderBy(productConditions.displayOrder),
        ]);

        return {
          brands: brandsData,
          productTypes: typesData,
          productParts: partsData,
          conditions: conditionsData,
        };
      } catch (error) {
        console.error("Error fetching product options:", error);
        throw error;
      }
    }),
  }),

  auth: router({
    me: protectedProcedure.query(({ ctx }) => {
      return {
        id: ctx.user!.id,
        name: ctx.user!.full_name,
        email: ctx.user!.cpf,
        role: normalizeStockTechRole(ctx.user!.role),
        accountId: ctx.user!.account_id,
        whatsapp: ctx.user!.whatsapp,
        token: ctx.token,
      };
    }),
    logout: protectedProcedure.mutation(() => {
      return { success: true };
    }),
  }),

  // Auth removido - autenticação agora é feita pelo AvAdmin
  // Use o token JWT do AvAdmin no header Authorization

  // ============ STORAGE ROUTER ============
  storage: router({
    uploadImage: protectedProcedure
      .input(z.object({ base64: z.string(), fileName: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const base64Data = input.base64.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const contentType = input.base64.match(/data:(.*?);/)?.[1] || 'image/jpeg';
          const timestamp = Date.now();
          const key = `products/${timestamp}-${input.fileName}`;
          const result = await storagePut(key, buffer, contentType);
          return result;
        } catch (error: any) {
          console.error('Error uploading image:', error);
          throw new Error('Failed to upload image: ' + error.message);
        }
      }),
    deleteImage: protectedProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        try {
          const key = getStorageKeyFromUrl(input.url);
          if (!key) {
            console.warn('[Storage] URL not in bucket:', input.url);
            return { success: false, reason: 'url_not_in_bucket' };
          }
          return await storageDeleteByKey(key);
        } catch (error: any) {
          console.error('Error deleting image:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete image: ' + error.message,
            cause: error,
          });
        }
      }),
    cleanupOrphanImages: protectedProcedure
      .input(z.object({ dryRun: z.boolean().optional(), maxDelete: z.number().min(1).max(10000).optional() }).optional())
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user || !['admin', 'super_admin'].includes(ctx.user.role)) {
            throw new Error('Acesso negado');
          }
          const { cleanupOrphanImages } = await import('./_core/orphanCleanup');
          return await cleanupOrphanImages({
            dryRun: input?.dryRun ?? false,
            maxDelete: input?.maxDelete ?? 5000,
          });
        } catch (error: any) {
          console.error('Error cleaning orphan images:', error);
          throw new Error('Failed to cleanup orphan images: ' + error.message);
        }
      }),
  }),

  // ============ PRODUCTS ROUTER ============
  products: router({
    // Listar produtos da conta
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return [];

        const { products } = await import("../drizzle/schema");

        // Filtrar por owner_cpf (multi-tenancy)
        const result = await database.select().from(products)
          .where(eq(products.ownerCpf, ctx.account!.owner_cpf));

        return result;
      } catch (error) {
        console.error("Error fetching products:", error);
        return [];
      }
    }),

    // Listar produtos do marketplace (todas as contas)
    listMarketplace: publicProcedure.query(async () => {
      try {
        const database = await db.getDb();
        if (!database) return [];

        const { products, sellerProfiles } = await import("../drizzle/schema");
        const rows = await database
          .select({
            id: products.id,
            accountId: products.accountId,
            createdByUserId: products.createdByUserId,
            code: products.code,
            name: products.name,
            brand: products.brand,
            model: products.model,
            category: products.category,
            description: products.description,
            price: products.price,
            quantity: products.quantity,
            minQuantity: products.minQuantity,
            condition: products.condition,
            warrantyPeriod: products.warrantyPeriod,
            images: products.images,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
            sellerStoreName: sellerProfiles.storeName,
            sellerUserId: sellerProfiles.userId,
          })
          .from(products)
          .leftJoin(sellerProfiles, eq(products.createdByUserId, sellerProfiles.userId))
          .where(gt(products.quantity, 0))
          .orderBy(desc(products.createdAt));
        if (rows.length === 0) return [];

        const accountIds = Array.from(
          new Set(rows.map((row) => row.accountId).filter(Boolean))
        );
        const userIds = Array.from(
          new Set(rows.map((row) => row.createdByUserId).filter(Boolean))
        );

        const avAdminClient = getAvAdminClient();
        const accountMap = new Map<string, string>();
        const userActiveMap = new Map<string, boolean>();

        await Promise.all(
          accountIds.map(async (accountId) => {
            try {
              const account = await avAdminClient.getAccountById(accountId);
              if (account?.status) {
                accountMap.set(accountId, account.status);
              }
            } catch {
              // ignore lookup failures
            }
          })
        );

        await Promise.all(
          userIds.map(async (userId) => {
            if (!userId) return;
            try {
              const user = await avAdminClient.getUserById(userId);
              if (user) {
                userActiveMap.set(userId, Boolean(user.is_active));
              }
            } catch {
              // ignore lookup failures
            }
          })
        );

        const isAccountAllowed = (status?: string) =>
          !status || status === "active" || status === "trial";

        return rows.filter((row) => {
          const accountStatus = accountMap.get(row.accountId);
          if (!isAccountAllowed(accountStatus)) return false;
          if (row.createdByUserId) {
            const userActive = userActiveMap.get(row.createdByUserId);
            if (userActive === false) return false;
          }
          return true;
        });
      } catch (error) {
        console.error("Error fetching marketplace products:", error);
        return [];
      }
    }),

    /**
     * Pesquisar catálogo por modelo, nome, código ou marca.
     * Público - para integração com sistemas externos (compra rápida do logista).
     */
    searchCatalog: publicProcedure
      .input(
        z.object({
          model: z.string().optional(),
          name: z.string().optional(),
          code: z.string().optional(),
          brand: z.string().optional(),
          query: z.string().optional(), // Busca geral em model, name, code, brand
        }).optional()
      )
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return [];

          const { products, sellerProfiles } = await import("../drizzle/schema");

          const conditions = [gt(products.quantity, 0)];

          if (input?.query && input.query.trim()) {
            const term = `%${input.query.trim()}%`;
            conditions.push(
              or(
                ilike(products.model, term),
                ilike(products.name, term),
                ilike(products.code, term),
                ilike(products.brand, term)
              )!
            );
          } else {
            if (input?.model?.trim()) {
              conditions.push(ilike(products.model, `%${input.model.trim()}%`));
            }
            if (input?.name?.trim()) {
              conditions.push(ilike(products.name, `%${input.name.trim()}%`));
            }
            if (input?.code?.trim()) {
              conditions.push(ilike(products.code, `%${input.code.trim()}%`));
            }
            if (input?.brand?.trim()) {
              conditions.push(ilike(products.brand, `%${input.brand.trim()}%`));
            }
          }

          const rows = await database
            .select({
              id: products.id,
              accountId: products.accountId,
              createdByUserId: products.createdByUserId,
              code: products.code,
              name: products.name,
              brand: products.brand,
              model: products.model,
              category: products.category,
              description: products.description,
              price: products.price,
              quantity: products.quantity,
              minQuantity: products.minQuantity,
              condition: products.condition,
              warrantyPeriod: products.warrantyPeriod,
              images: products.images,
              createdAt: products.createdAt,
              updatedAt: products.updatedAt,
              sellerStoreName: sellerProfiles.storeName,
              sellerUserId: sellerProfiles.userId,
            })
            .from(products)
            .leftJoin(sellerProfiles, eq(products.createdByUserId, sellerProfiles.userId))
            .where(and(...conditions))
            .orderBy(desc(products.createdAt));
          if (rows.length === 0) return [];

          const accountIds = Array.from(new Set(rows.map((r) => r.accountId).filter(Boolean)));
          const userIds = Array.from(new Set(rows.map((r) => r.createdByUserId).filter(Boolean)));
          const avAdminClient = getAvAdminClient();
          const accountMap = new Map<string, string>();
          const userActiveMap = new Map<string, boolean>();

          await Promise.all(
            accountIds.map(async (accountId) => {
              try {
                const account = await avAdminClient.getAccountById(accountId);
                if (account?.status) accountMap.set(accountId, account.status);
              } catch { /* ignore */ }
            })
          );
          await Promise.all(
            userIds.map(async (userId) => {
              if (!userId) return;
              try {
                const user = await avAdminClient.getUserById(userId);
                if (user) userActiveMap.set(userId, Boolean(user.is_active));
              } catch { /* ignore */ }
            })
          );

          const isAccountAllowed = (status?: string) =>
            !status || status === "active" || status === "trial";

          return rows.filter((row) => {
            const accountStatus = accountMap.get(row.accountId);
            if (!isAccountAllowed(accountStatus)) return false;
            if (row.createdByUserId) {
              const userActive = userActiveMap.get(row.createdByUserId);
              if (userActive === false) return false;
            }
            return true;
          });
        } catch (error) {
          console.error("Error searching catalog:", error);
          return [];
        }
      }),

    getMarketplaceById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;

          const { products, sellerProfiles } = await import("../drizzle/schema");
          const rows = await database
            .select({
              id: products.id,
              accountId: products.accountId,
              createdByUserId: products.createdByUserId,
              code: products.code,
              name: products.name,
              brand: products.brand,
              model: products.model,
              category: products.category,
              description: products.description,
              price: products.price,
              quantity: products.quantity,
              minQuantity: products.minQuantity,
              condition: products.condition,
              warrantyPeriod: products.warrantyPeriod,
              images: products.images,
              createdAt: products.createdAt,
              updatedAt: products.updatedAt,
              sellerStoreName: sellerProfiles.storeName,
              sellerUserId: sellerProfiles.userId,
            })
            .from(products)
            .leftJoin(sellerProfiles, eq(products.createdByUserId, sellerProfiles.userId))
            .where(and(eq(products.id, input.id), gt(products.quantity, 0)))
            .limit(1);
          const product = rows[0];
          if (!product) return null;

          const avAdminClient = getAvAdminClient();
          try {
            const [account, user] = await Promise.all([
              avAdminClient.getAccountById(product.accountId),
              product.createdByUserId
                ? avAdminClient.getUserById(product.createdByUserId)
                : Promise.resolve(null),
            ]);

            if (account?.status && !["active", "trial"].includes(account.status)) {
              return null;
            }
            if (user && !user.is_active) {
              return null;
            }
          } catch {
            // ignore lookup failures
          }

          return product;
        } catch (error) {
          console.error("Error fetching marketplace product by id:", error);
          return null;
        }
      }),

    getMarketplaceByCode: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;

          const { products, sellerProfiles } = await import("../drizzle/schema");
          const rows = await database
            .select({
              id: products.id,
              accountId: products.accountId,
              createdByUserId: products.createdByUserId,
              code: products.code,
              name: products.name,
              brand: products.brand,
              model: products.model,
              category: products.category,
              description: products.description,
              price: products.price,
              quantity: products.quantity,
              minQuantity: products.minQuantity,
              condition: products.condition,
              warrantyPeriod: products.warrantyPeriod,
              images: products.images,
              createdAt: products.createdAt,
              updatedAt: products.updatedAt,
              sellerStoreName: sellerProfiles.storeName,
              sellerUserId: sellerProfiles.userId,
            })
            .from(products)
            .leftJoin(sellerProfiles, eq(products.createdByUserId, sellerProfiles.userId))
            .where(and(eq(products.code, input.code), gt(products.quantity, 0)))
            .limit(1);
          const product = rows[0];
          if (!product) return null;

          const avAdminClient = getAvAdminClient();
          try {
            const [account, user] = await Promise.all([
              avAdminClient.getAccountById(product.accountId),
              product.createdByUserId
                ? avAdminClient.getUserById(product.createdByUserId)
                : Promise.resolve(null),
            ]);

            if (account?.status && !["active", "trial"].includes(account.status)) {
              return null;
            }
            if (user && !user.is_active) {
              return null;
            }
          } catch {
            // ignore lookup failures
          }

          return product;
        } catch (error) {
          console.error("Error fetching marketplace product by code:", error);
          return null;
        }
      }),

    // Obter produto por ID (com verificação de account_id)
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;

          const { products } = await import("../drizzle/schema");

          const result = await database.select().from(products)
            .where(eq(products.id, input.id))
            .limit(1);

          const product = result[0];
          if (!product) return null;

          // Verificar se pertence à conta (multi-tenancy via ownerCpf)
          if (product.ownerCpf && product.ownerCpf !== ctx.account!.owner_cpf) {
            throw new Error("Acesso negado");
          }

          return product;
        } catch (error) {
          console.error("Error fetching product:", error);
          return null;
        }
      }),

    // Obter produto por código (com verificação de ownerCpf)
    getByCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;

          const { products } = await import("../drizzle/schema");

          const result = await database.select().from(products)
            .where(eq(products.code, input.code))
            .limit(1);

          const product = result[0];
          if (!product) return null;

          if (product.ownerCpf && product.ownerCpf !== ctx.account!.owner_cpf) {
            throw new Error("Acesso negado");
          }

          return product;
        } catch (error) {
          console.error("Error fetching product by code:", error);
          return null;
        }
      }),

    // Criar novo produto
    create: protectedProcedure
      .input(
        z.object({
          code: z.string(),
          name: z.string(),
          brand: z.string().optional(),
          model: z.string().optional(),
          productType: z.string().optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          price: z.string(),
          quantity: z.number().default(0),
          minQuantity: z.number().default(5),
          condition: z.enum(["NEW", "USED", "REFURBISHED", "ORIGINAL_RETIRADA"]).default("NEW"),
          warrantyPeriod: z.enum(["NONE", "DAYS_7", "DAYS_30", "DAYS_90", "MONTHS_6"]).default("NONE"),
          images: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { products } = await import("../drizzle/schema");

          // Adicionar account_id, owner_cpf e created_by_user_id
          const productData = {
            ...input,
            accountId: ctx.account!.id,
            ownerCpf: ctx.account!.owner_cpf,
            createdByUserId: ctx.user!.id,
            sellerId: null,
          };

          const result = await database.insert(products).values(productData).returning();
          const createdProduct = result[0];

          // Incrementar contador de uso
          const avAdminClient = getAvAdminClient();
          await avAdminClient.incrementUsage(ctx.account!.id, 'product_created');

          wsManager.notifyProductAdded(ctx.user!.id, ctx.account!.id, createdProduct);

          return createdProduct;
        } catch (error) {
          console.error("Error creating product:", error);
          throw error;
        }
      }),

    // Atualizar produto
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          brand: z.string().optional(),
          model: z.string().optional(),
          productType: z.string().optional(),
          category: z.string().optional(),
          condition: z.enum(["NEW", "USED", "REFURBISHED", "ORIGINAL_RETIRADA"]).optional(),
          warrantyPeriod: z.enum(["NONE", "DAYS_7", "DAYS_30", "DAYS_90", "MONTHS_6"]).optional(),
          minQuantity: z.number().optional(),
          price: z.string().optional(),
          quantity: z.number().optional(),
          description: z.string().optional(),
          images: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { products } = await import("../drizzle/schema");

          // Verificar se produto pertence à conta (usar owner_cpf)
          const existing = await database.select().from(products)
            .where(eq(products.id, id))
            .limit(1);

          if (!existing[0] || existing[0].ownerCpf !== ctx.account!.owner_cpf) {
            throw new Error("Acesso negado");
          }

          const result = await database.update(products)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(products.id, id))
            .returning();
          const updatedProduct = result[0];

          wsManager.notifyProductUpdated(ctx.user!.id, ctx.account!.id, updatedProduct);

          return updatedProduct;
        } catch (error) {
          console.error("Error updating product:", error);
          throw error;
        }
      }),

    // Deletar produto
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { products } = await import("../drizzle/schema");

          // Verificar se produto pertence à conta
          const existing = await database.select().from(products)
            .where(eq(products.id, input.id))
            .limit(1);

          if (!existing[0] || (existing[0].ownerCpf && existing[0].ownerCpf !== ctx.account!.owner_cpf)) {
            throw new Error("Acesso negado");
          }

          const imagesRaw = existing[0]?.images;
          let imageUrls: string[] = [];
          if (typeof imagesRaw === "string") {
            try {
              const parsed = JSON.parse(imagesRaw);
              if (Array.isArray(parsed)) {
                imageUrls = parsed.filter((img) => typeof img === "string");
              }
            } catch {
              imageUrls = [];
            }
          } else if (Array.isArray(imagesRaw)) {
            imageUrls = (imagesRaw as any[]).filter((img) => typeof img === "string");
          }

          for (const url of imageUrls) {
            const key = getStorageKeyFromUrl(url);
            if (!key) continue;
            try {
              await storageDeleteByKey(key);
            } catch (error) {
              console.error("Erro ao excluir imagem do produto:", error);
            }
          }

          await database.delete(products).where(eq(products.id, input.id));

          wsManager.notifyProductDeleted(ctx.user!.id, ctx.account!.id, existing[0]);
          return { success: true };
        } catch (error) {
          console.error("Error deleting product:", error);
          throw error;
        }
      }),

    quickRestock: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          newQuantity: z.number().min(0),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { products, stockMovements } = await import("../drizzle/schema");

        const existing = await database.select().from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        if (!existing[0] || existing[0].ownerCpf !== ctx.account!.owner_cpf) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }

        const product = existing[0];
        const previousQuantity = product.quantity;
        const delta = input.newQuantity - previousQuantity;

        if (delta === 0) {
          return { product, movement: null, message: "Quantidade não alterada" };
        }

        const movementType = delta > 0 ? "IN" : delta < 0 ? "OUT" : "ADJUST";

        const [updatedProduct] = await database.update(products)
          .set({ quantity: input.newQuantity, updatedAt: new Date() })
          .where(eq(products.id, input.productId))
          .returning();

        const [movement] = await database.insert(stockMovements)
          .values({
            accountId: ctx.account!.id,
            ownerCpf: ctx.account!.owner_cpf,
            userId: ctx.user!.id,
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            type: movementType,
            previousQuantity,
            newQuantity: input.newQuantity,
            delta,
            notes: input.notes || null,
          })
          .returning();

        wsManager.notifyProductUpdated(ctx.user!.id, ctx.account!.id, updatedProduct);

        return {
          product: updatedProduct,
          movement,
          message: delta > 0
            ? `+${delta} unidades adicionadas`
            : `${delta} unidades removidas`,
        };
      }),

    stockMovements: protectedProcedure
      .input(
        z.object({
          productId: z.number().optional(),
          limit: z.number().min(1).max(100).default(50),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) return [];

        const { stockMovements } = await import("../drizzle/schema");

        let query = database.select().from(stockMovements)
          .where(eq(stockMovements.ownerCpf, ctx.account!.owner_cpf))
          .orderBy(desc(stockMovements.createdAt))
          .limit(input?.limit ?? 50);

        if (input?.productId) {
          query = database.select().from(stockMovements)
            .where(and(
              eq(stockMovements.ownerCpf, ctx.account!.owner_cpf),
              eq(stockMovements.productId, input.productId),
            ))
            .orderBy(desc(stockMovements.createdAt))
            .limit(input.limit ?? 50);
        }

        return query;
      }),
  }),

  // ============ TRANSACTIONS ROUTER ============
  transactions: router({
    // Listar transações da conta
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return [];

        const { transactions, sellerProfiles } = await import("../drizzle/schema");

        const result = await database.select().from(transactions)
          .where(and(
            eq(transactions.ownerCpf, ctx.account!.owner_cpf),
            or(
              and(
                eq(transactions.buyerId, ctx.user!.id),
                eq(transactions.type, "purchase")
              ),
              and(
                eq(transactions.sellerId, ctx.user!.id),
                eq(transactions.type, "sale")
              )
            )
          ))
          .orderBy(desc(transactions.date));

        if (result.length === 0) return [];

        // Collect user IDs to fetch store names
        const userIds = new Set<string>();
        result.forEach(t => {
          if (t.type === "purchase" && t.sellerId) userIds.add(t.sellerId);
          if (t.type === "sale" && t.buyerId) userIds.add(t.buyerId);
        });

        if (userIds.size > 0) {
          const profiles = await database.select({
            userId: sellerProfiles.userId,
            storeName: sellerProfiles.storeName
          })
            .from(sellerProfiles)
            .where(inArray(sellerProfiles.userId, Array.from(userIds)));

          const storeMap = new Map(profiles.map(p => [p.userId, p.storeName]));

          return result.map(t => {
            let counterpartyName = t.counterparty;
            if (t.type === "purchase" && t.sellerId) {
              const store = storeMap.get(t.sellerId);
              if (store) counterpartyName = store;
            } else if (t.type === "sale" && t.buyerId) {
              const store = storeMap.get(t.buyerId);
              if (store) counterpartyName = store;
            }
            return { ...t, counterparty: counterpartyName };
          });
        }

        return result;
      } catch (error) {
        console.error("Error fetching transactions:", error);
        return [];
      }
    }),

    // Obter transação por ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;

          const { transactions } = await import("../drizzle/schema");

          const result = await database.select().from(transactions)
            .where(eq(transactions.id, input.id))
            .limit(1);

          const transaction = result[0];
          if (!transaction || (transaction.ownerCpf && transaction.ownerCpf !== ctx.account!.owner_cpf)) {
            return null;
          }

          return transaction;
        } catch (error) {
          console.error("Error fetching transaction:", error);
          return null;
        }
      }),

    // Criar nova transação
    create: protectedProcedure
      .input(
        z.object({
          transactionCode: z.string(),
          type: z.enum(["sale", "purchase"]),
          productId: z.number(),
          productName: z.string(),
          counterparty: z.string(),
          counterpartyRole: z.enum(["buyer", "seller"]),
          amount: z.string(),
          quantity: z.number(),
          status: z.enum(["completed", "pending", "cancelled"]).default("pending"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { transactions } = await import("../drizzle/schema");

          const transactionData = {
            ...input,
            accountId: ctx.account!.id,
            ownerCpf: ctx.account!.owner_cpf,
            buyerId: ctx.user!.id,
            sellerId: ctx.user!.id,
          };

          const result = await database.insert(transactions).values(transactionData).returning();
          const createdTransaction = result[0];

          const avAdminClient = getAvAdminClient();
          await avAdminClient.incrementUsage(ctx.account!.id, 'transaction_created');

          wsManager.notifyTransactionCreated(ctx.user!.id, ctx.account!.id, createdTransaction);

          return createdTransaction;
        } catch (error) {
          console.error("Error creating transaction:", error);
          throw error;
        }
      }),

    // Encontrar transação de compra para avaliação
    findPurchase: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          sellerId: z.string(),
        })
      )
      .query(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;

          const { transactions } = await import("../drizzle/schema");

          const result = await database.select()
            .from(transactions)
            .where(and(
              eq(transactions.buyerId, ctx.user!.id),
              eq(transactions.sellerId, input.sellerId as any),
              eq(transactions.productId, input.productId),
              eq(transactions.type, "purchase"),
              eq(transactions.status, "completed")
            ))
            .orderBy(desc(transactions.createdAt))
            .limit(1);

          return result[0] || null;
        } catch (error) {
          console.error("Error finding purchase transaction:", error);
          return null;
        }
      }),

    // Atualizar transação (não implementado)
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["completed", "pending", "cancelled"]).optional(),
          amount: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        throw new Error('Update transaction not implemented');
      }),
  }),

  // ============ RATINGS ROUTER ============
  ratings: router({
    // Listar avaliações de um produto
    getByProductId: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return [];

          const { ratings, sellerProfiles } = await import("../drizzle/schema");

          const result = await database.select().from(ratings)
            .where(eq(ratings.productId, input.productId));

          // REMOVIDO: const accountRatings = result.filter(r => r.accountId === ctx.account!.id);
          // Usar todas as avaliações do produto

          if (result.length === 0) return [];

          // Collect reviewer IDs to fetch store names
          const reviewerIds = new Set(result.map(r => r.reviewerId));

          if (reviewerIds.size > 0) {
            const profiles = await database.select({
              userId: sellerProfiles.userId,
              storeName: sellerProfiles.storeName
            })
              .from(sellerProfiles)
              .where(inArray(sellerProfiles.userId, Array.from(reviewerIds)));

            const storeMap = new Map(profiles.map(p => [p.userId, p.storeName]));

            return result.map(r => {
              const storeName = storeMap.get(r.reviewerId);
              return {
                ...r,
                author: storeName || r.author
              };
            });
          }

          return result;
        } catch (error) {
          console.error("Error fetching ratings:", error);
          return [];
        }
      }),

    // Listar avaliacoes recentes de um vendedor
    getRecentBySellerId: publicProcedure
      .input(z.object({ sellerId: z.string(), limit: z.number().min(1).max(50).optional() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return [];

          const { ratings, products } = await import("../drizzle/schema");
          const limit = input.limit ?? 10;

          const result = await database
            .select({
              id: ratings.id,
              rating: ratings.rating,
              comment: ratings.comment,
              author: ratings.author,
              createdAt: ratings.createdAt,
              productId: ratings.productId,
              productName: products.name,
            })
            .from(ratings)
            .leftJoin(products, eq(ratings.productId, products.id))
            .where(and(
              eq(products.createdByUserId, input.sellerId as any)
            ))
            .orderBy(desc(ratings.createdAt))
            .limit(limit);

          return result;
        } catch (error) {
          console.error("Error fetching recent ratings:", error);
          return [];
        }
      }),

    // Listar compras elegiveis para avaliacao de um vendedor
    getEligiblePurchasesBySeller: protectedProcedure
      .input(z.object({ sellerId: z.string() }))
      .query(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) return [];

          const { transactions, products } = await import("../drizzle/schema");

          const result = await database
            .select({
              transactionId: transactions.id,
              productId: transactions.productId,
              productName: products.name,
              amount: transactions.amount,
              date: transactions.date,
            })
            .from(transactions)
            .leftJoin(products, eq(transactions.productId, products.id))
            .where(and(
              eq(transactions.accountId, ctx.account!.id),
              eq(transactions.buyerId, ctx.user!.id),
              eq(transactions.sellerId, input.sellerId as any),
              eq(transactions.type, "purchase"),
              eq(transactions.status, "completed")
            ))
            .orderBy(desc(transactions.date));

          return result;
        } catch (error) {
          console.error("Error fetching eligible purchases:", error);
          return [];
        }
      }),

    // Obter média de avaliação
    getAverageRating: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return 0;

          const { ratings } = await import("../drizzle/schema");

          const result = await database.select().from(ratings)
            .where(eq(ratings.productId, input.productId));

          // REMOVIDO: const filtered = result.filter(r => r.accountId === ctx.account!.id);
          // Usar todas as avaliações
          if (result.length === 0) return 0;

          const sum = result.reduce((acc, r) => acc + r.rating, 0);
          return sum / result.length;
        } catch (error) {
          console.error("Error calculating average rating:", error);
          return 0;
        }
      }),

    // Criar nova avaliação (somente para compras)
    create: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          transactionId: z.number(),
          rating: z.number().min(1).max(5),
          comment: z.string().optional(),
          author: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { ratings, transactions } = await import("../drizzle/schema");

          const transaction = await database.select().from(transactions)
            .where(eq(transactions.id, input.transactionId))
            .limit(1);

          const purchase = transaction[0];
          if (!purchase) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Transação não encontrada",
            });
          }

          if ((purchase.ownerCpf && purchase.ownerCpf !== ctx.account!.owner_cpf) || purchase.buyerId !== ctx.user!.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Acesso negado: transação não pertence ao comprador",
            });
          }

          if (purchase.type !== "purchase") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Avaliações só podem ser feitas em compras",
            });
          }

          if (purchase.productId !== input.productId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Produto da avaliação não corresponde à transação",
            });
          }

          if (purchase.status !== "completed") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "A compra precisa estar concluída para avaliar",
            });
          }

          const existing = await database.select().from(ratings)
            .where(and(
              eq(ratings.transactionId, input.transactionId),
              eq(ratings.reviewerId, ctx.user!.id)
            ))
            .limit(1);

          if (existing.length > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Você já avaliou esta compra",
            });
          }

          const ratingData = {
            ...input,
            accountId: ctx.account!.id,
            reviewerId: ctx.user!.id,
          };

          const result = await database.insert(ratings).values(ratingData).returning();
          return result[0];
        } catch (error) {
          console.error("Error creating rating:", error);
          throw error;
        }
      }),
  }),

  // ============ RETURNS ROUTER ============
  returns: router({
    // Listar devoluções (comprador e vendedor)
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return [];

        const { productReturns, products, orders } = await import("../drizzle/schema");

        const userId = ctx.user!.id;
        const userCpf = ctx.user!.cpf;

        const result = await database.select({
          id: productReturns.id,
          accountId: productReturns.accountId,
          buyerId: productReturns.buyerId,
          sellerId: productReturns.sellerId,
          orderId: productReturns.orderId,
          productId: productReturns.productId,
          transactionId: productReturns.transactionId,
          returnCode: productReturns.returnCode,
          reason: productReturns.reason,
          quantity: productReturns.quantity,
          status: productReturns.status,
          sellerDecision: productReturns.sellerDecision,
          sellerNotes: productReturns.sellerNotes,
          approvedAt: productReturns.approvedAt,
          approvedBy: productReturns.approvedBy,
          completedAt: productReturns.completedAt,
          rejectedAt: productReturns.rejectedAt,
          rejectionReason: productReturns.rejectionReason,
          replacementSentAt: productReturns.replacementSentAt,
          defectiveReceivedAt: productReturns.defectiveReceivedAt,
          defectiveValidatedAt: productReturns.defectiveValidatedAt,
          validationNotes: productReturns.validationNotes,
          convertedToSaleAt: productReturns.convertedToSaleAt,
          reservedQuantity: productReturns.reservedQuantity,
          isWithinWarranty: productReturns.isWithinWarranty,
          warrantyExpiresAt: productReturns.warrantyExpiresAt,
          createdAt: productReturns.createdAt,
          updatedAt: productReturns.updatedAt,
          productName: products.name,
          productCode: products.code,
          orderCode: orders.orderCode,
        })
          .from(productReturns)
          .leftJoin(products, eq(productReturns.productId, products.id))
          .leftJoin(orders, eq(productReturns.orderId, orders.id))
          .where(or(
            eq(productReturns.buyerId, userId),
            eq(productReturns.buyerId, userCpf),
            eq(productReturns.sellerId, userId),
            eq(productReturns.sellerId, userCpf)
          ))
          .orderBy(desc(productReturns.createdAt));

        return result;
      } catch (error) {
        console.error("Error listing returns:", error);
        return [];
      }
    }),

    // Solicitar devolução (comprador)
    request: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        productId: z.number(),
        quantity: z.number().min(1).default(1),
        reason: z.string().min(10).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { orders, productReturns, products, transactions } = await import("../drizzle/schema");

          const parseOrderItems = (value: unknown): any[] => {
            if (Array.isArray(value)) return value;
            if (typeof value === "string") {
              try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            }
            return [];
          };

          // Buscar pedido e validar
          const order = await database.select()
            .from(orders)
            .where(eq(orders.id, input.orderId))
            .limit(1);

        const allowedBuyerIds = [ctx.user!.id, ctx.user!.cpf];
        if (!order[0] || !allowedBuyerIds.includes(order[0].buyerId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Pedido não encontrado" });
          }

          // Validar que o produto pertence ao pedido
          const orderItems = parseOrderItems(order[0].items);
          const productInOrder = orderItems.some((item: any) =>
            Number(item.productId ?? item.id) === Number(input.productId)
          );
          if (!productInOrder) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Produto não pertence a este pedido"
            });
          }

          // Buscar produto e verificar garantia
          const product = await database.select()
            .from(products)
            .where(eq(products.id, input.productId))
            .limit(1);

          if (!product[0]) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
          }

          // Calcular data de expiração da garantia
          const orderDate = order[0].createdAt;
          if (!orderDate) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Data do pedido inválida"
            });
          }

          let warrantyExpiresAt: Date | null = null;
          let isWithinWarranty = false;

          const warrantyPeriod = product[0].warrantyPeriod ?? "NONE";
          if (warrantyPeriod !== 'NONE') {
            const daysToAdd =
              warrantyPeriod === 'DAYS_7' ? 7 :
              warrantyPeriod === 'DAYS_30' ? 30 :
              warrantyPeriod === 'DAYS_90' ? 90 :
              warrantyPeriod === 'MONTHS_6' ? 180 : 0;

            warrantyExpiresAt = new Date(orderDate);
            warrantyExpiresAt.setDate(warrantyExpiresAt.getDate() + daysToAdd);
            isWithinWarranty = new Date() <= warrantyExpiresAt;
          } else {
            // Se não há garantia definida, permitir devolução (isWithinWarranty = true)
            isWithinWarranty = true;
          }

          if (!isWithinWarranty) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Produto fora do período de garantia"
            });
          }

          // Buscar transação relacionada
          const relatedTransaction = await database.select()
            .from(transactions)
            .where(and(
              eq(transactions.productId, input.productId),
              eq(transactions.buyerId, ctx.user!.id),
              eq(transactions.sellerId, order[0].sellerId),
              eq(transactions.type, "purchase")
            ))
            .orderBy(desc(transactions.createdAt))
            .limit(1);

          // Criar devolução
          const returnData = {
            accountId: ctx.account!.id,
            ownerCpf: ctx.user!.cpf || ctx.user!.id,
            buyerId: order[0].buyerId,
            sellerId: order[0].sellerId,
            orderId: input.orderId,
            productId: input.productId,
            transactionId: relatedTransaction[0]?.id,
            returnCode: `RET-${nanoid(8).toUpperCase()}`,
            reason: input.reason,
            quantity: input.quantity,
            status: "requested" as const,
            isWithinWarranty,
            warrantyExpiresAt,
          };

          const result = await database.insert(productReturns)
            .values(returnData)
            .returning();

        await database.update(orders)
          .set({ status: "awaiting_exchange", updatedAt: new Date() })
          .where(eq(orders.id, input.orderId));

          // Notificar vendedor
          wsManager.notifyReturnRequested(
            order[0].sellerId,
            order[0].sellerAccountId || ctx.account!.id,
            result[0]
          );

          return result[0];
        } catch (error: any) {
          console.error("Error requesting return:", error);
          console.error("Error details:", {
            message: error?.message,
            stack: error?.stack,
            cause: error?.cause,
            input,
            userId: ctx.user?.id,
            accountId: ctx.account?.id,
          });
          if (error instanceof TRPCError) {
            throw error;
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error?.message || "Falha ao solicitar troca. Verifique as migracoes do banco.",
            cause: error,
          });
        }
      }),

    // Responder devolução (vendedor)
    respond: protectedProcedure
      .input(z.object({
        returnId: z.number(),
        decision: z.enum(["approve_replacement", "approve_refund", "reject"]),
        notes: z.string().optional(),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { productReturns, products, orders, stockMovements } = await import("../drizzle/schema");

        // Buscar devolução
        const returnRecord = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        const allowedSellerIds = [ctx.user!.id, ctx.user!.cpf];
        if (!returnRecord[0] || !allowedSellerIds.includes(returnRecord[0].sellerId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (returnRecord[0].status !== 'requested') {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Devolução já foi respondida"
          });
        }

        let newStatus: string;
        let orderStatus: string;
        const updateData: any = {
          approvedBy: returnRecord[0].sellerId,
          approvedAt: new Date(),
          sellerNotes: input.notes,
          updatedAt: new Date(),
        };

        if (input.decision === 'reject') {
          newStatus = 'rejected';
          orderStatus = 'exchange_rejected';
          updateData.rejectedAt = new Date();
          updateData.rejectionReason = input.rejectionReason || 'Sem justificativa';
          updateData.approvedAt = null;
          updateData.approvedBy = null;
        } else if (input.decision === 'approve_replacement') {
          newStatus = 'replacement_sent';
          orderStatus = 'awaiting_exchange';
          updateData.sellerDecision = 'replacement';
          updateData.replacementSentAt = new Date();
          updateData.reservedQuantity = returnRecord[0].quantity;

          // Reservar peça: decrementar estoque e registrar movimentação
          const product = await database.select()
            .from(products)
            .where(eq(products.id, returnRecord[0].productId))
            .limit(1);

          if (product[0]) {
            const currentStock = product[0].quantity ?? 0;
            const qty = returnRecord[0].quantity;
            if (currentStock < qty) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Estoque insuficiente para reservar a peça de reposição",
              });
            }
            await database.update(products)
              .set({ quantity: currentStock - qty, updatedAt: new Date() })
              .where(eq(products.id, returnRecord[0].productId));

            await database.insert(stockMovements).values({
              accountId: returnRecord[0].accountId,
              ownerCpf: product[0].ownerCpf,
              userId: ctx.user!.id,
              productId: product[0].id,
              productCode: product[0].code,
              productName: product[0].name,
              type: "OUT",
              previousQuantity: currentStock,
              newQuantity: currentStock - qty,
              delta: -qty,
              notes: `Reserva para troca ${returnRecord[0].returnCode}`,
            });
          }
        } else {
          newStatus = 'approved_refund';
          orderStatus = 'exchange_completed';
          updateData.sellerDecision = 'refund';
        }

        updateData.status = newStatus;

        await database.update(productReturns)
          .set(updateData)
          .where(eq(productReturns.id, input.returnId));

        await database.update(orders)
          .set({ status: orderStatus, updatedAt: new Date() })
          .where(eq(orders.id, returnRecord[0].orderId));

        // Notificar comprador
        const updatedReturn = { ...returnRecord[0], ...updateData };
        if (newStatus === 'replacement_sent') {
          wsManager.notifyReplacementSent(
            returnRecord[0].buyerId,
            returnRecord[0].accountId,
            updatedReturn
          );
        } else {
          wsManager.notifyReturnResponded(
            returnRecord[0].buyerId,
            returnRecord[0].accountId,
            updatedReturn
          );
        }

        return { success: true, status: newStatus };
      }),

    // Marcar devolução como concluída (vendedor)
    complete: protectedProcedure
      .input(z.object({ returnId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { productReturns } = await import("../drizzle/schema");

        const returnRecord = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        const allowedSellerIds = [ctx.user!.id, ctx.user!.cpf];
        if (!returnRecord[0] || !allowedSellerIds.includes(returnRecord[0].sellerId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (!['approved_replacement', 'approved_refund'].includes(returnRecord[0].status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Devolução não está aprovada"
          });
        }

        await database.update(productReturns)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(productReturns.id, input.returnId));

        return { success: true };
      }),

    // Confirmar recebimento da peça defeituosa (vendedor)
    confirmDefectiveReceived: protectedProcedure
      .input(z.object({ returnId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { productReturns } = await import("../drizzle/schema");

        const returnRecord = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        const allowedSellerIds = [ctx.user!.id, ctx.user!.cpf];
        if (!returnRecord[0] || !allowedSellerIds.includes(returnRecord[0].sellerId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (returnRecord[0].status !== 'replacement_sent') {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Apenas trocas com peça enviada podem ter o recebimento confirmado",
          });
        }

        await database.update(productReturns)
          .set({
            status: 'defective_received',
            defectiveReceivedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(productReturns.id, input.returnId));

        const updated = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        wsManager.notifyDefectiveReceived(
          returnRecord[0].buyerId,
          returnRecord[0].accountId,
          updated[0]
        );

        return { success: true, status: 'defective_received' };
      }),

    // Validar troca após recebimento (vendedor aprova ou rejeita critérios)
    validateExchange: protectedProcedure
      .input(z.object({
        returnId: z.number(),
        approved: z.boolean(),
        validationNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { productReturns, products, orders, stockMovements } = await import("../drizzle/schema");

        const returnRecord = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        const allowedSellerIds = [ctx.user!.id, ctx.user!.cpf];
        if (!returnRecord[0] || !allowedSellerIds.includes(returnRecord[0].sellerId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (returnRecord[0].status !== 'defective_received') {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Apenas trocas com peça defeituosa recebida podem ser validadas",
          });
        }

        const updateData: any = {
          defectiveValidatedAt: new Date(),
          validationNotes: input.validationNotes,
          updatedAt: new Date(),
        };

        if (input.approved) {
          updateData.status = 'completed_approved';
          updateData.completedAt = new Date();

          const product = await database.select()
            .from(products)
            .where(eq(products.id, returnRecord[0].productId))
            .limit(1);

          if (product[0]) {
            const currentDefective = product[0].defectiveQuantity ?? 0;
            const qty = returnRecord[0].quantity;
            await database.update(products)
              .set({
                defectiveQuantity: currentDefective + qty,
                updatedAt: new Date(),
              })
              .where(eq(products.id, returnRecord[0].productId));

            await database.insert(stockMovements).values({
              accountId: returnRecord[0].accountId,
              ownerCpf: product[0].ownerCpf,
              userId: ctx.user!.id,
              productId: product[0].id,
              productCode: product[0].code,
              productName: product[0].name,
              type: "IN",
              previousQuantity: currentDefective,
              newQuantity: currentDefective + qty,
              delta: qty,
              notes: `Peça defeituosa recebida - troca ${returnRecord[0].returnCode}`,
            });
          }

          await database.update(orders)
            .set({ status: 'exchange_completed', updatedAt: new Date() })
            .where(eq(orders.id, returnRecord[0].orderId));
        } else {
          updateData.status = 'completed_rejected_by_vendor';
          updateData.rejectionReason = input.validationNotes || 'Critérios de troca não atendidos';

          await database.update(orders)
            .set({ status: 'exchange_rejected', updatedAt: new Date() })
            .where(eq(orders.id, returnRecord[0].orderId));
        }

        await database.update(productReturns)
          .set(updateData)
          .where(eq(productReturns.id, input.returnId));

        const updated = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        wsManager.notifyExchangeValidated(
          returnRecord[0].buyerId,
          returnRecord[0].accountId,
          updated[0]
        );

        return { success: true, status: updateData.status };
      }),

    // Resolver troca rejeitada (cliente paga ou devolve peça)
    resolveRejectedExchange: protectedProcedure
      .input(z.object({
        returnId: z.number(),
        resolution: z.enum(["pay", "return_product"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { productReturns, products, stockMovements, transactions } = await import("../drizzle/schema");

        const returnRecord = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        const allowedBuyerIds = [ctx.user!.id, ctx.user!.cpf];
        if (!returnRecord[0] || !allowedBuyerIds.includes(returnRecord[0].buyerId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (returnRecord[0].status !== 'completed_rejected_by_vendor') {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Apenas trocas rejeitadas pelo vendedor podem ser resolvidas",
          });
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.resolution === 'pay') {
          updateData.status = 'converted_to_sale';
          updateData.convertedToSaleAt = new Date();
          updateData.completedAt = new Date();

          const product = await database.select()
            .from(products)
            .where(eq(products.id, returnRecord[0].productId))
            .limit(1);

          if (product[0]) {
            const amount = String(Number(product[0].price) * returnRecord[0].quantity);

            // A conversão para compra precisa gerar os dois lados da transação:
            // - purchase na conta do comprador
            // - sale na conta do vendedor
            await database.insert(transactions).values([
              {
                accountId: ctx.account!.id,
                ownerCpf: ctx.account!.owner_cpf,
                buyerId: returnRecord[0].buyerId,
                sellerId: returnRecord[0].sellerId,
                transactionCode: `TRX-${nanoid(8).toUpperCase()}`,
                type: 'purchase',
                productId: returnRecord[0].productId,
                productName: product[0].name,
                counterparty: returnRecord[0].sellerId,
                counterpartyRole: 'seller',
                amount,
                quantity: returnRecord[0].quantity,
                status: 'completed',
              },
              {
                accountId: returnRecord[0].accountId,
                ownerCpf: product[0].ownerCpf,
                buyerId: returnRecord[0].buyerId,
                sellerId: returnRecord[0].sellerId,
                transactionCode: `TRX-${nanoid(8).toUpperCase()}`,
                type: 'sale',
                productId: returnRecord[0].productId,
                productName: product[0].name,
                counterparty: returnRecord[0].buyerId,
                counterpartyRole: 'buyer',
                amount,
                quantity: returnRecord[0].quantity,
                status: 'completed',
              },
            ]);
          }
        } else {
          updateData.status = 'returned_to_stock';

          const product = await database.select()
            .from(products)
            .where(eq(products.id, returnRecord[0].productId))
            .limit(1);

          if (product[0]) {
            const currentStock = product[0].quantity ?? 0;
            const qty = returnRecord[0].quantity;
            await database.update(products)
              .set({ quantity: currentStock + qty, updatedAt: new Date() })
              .where(eq(products.id, returnRecord[0].productId));

            await database.insert(stockMovements).values({
              accountId: returnRecord[0].accountId,
              ownerCpf: product[0].ownerCpf,
              userId: ctx.user!.id,
              productId: product[0].id,
              productCode: product[0].code,
              productName: product[0].name,
              type: "IN",
              previousQuantity: currentStock,
              newQuantity: currentStock + qty,
              delta: qty,
              notes: `Devolução de peça - troca rejeitada ${returnRecord[0].returnCode}`,
            });
          }
        }

        await database.update(productReturns)
          .set(updateData)
          .where(eq(productReturns.id, input.returnId));

        const updated = await database.select()
          .from(productReturns)
          .where(eq(productReturns.id, input.returnId))
          .limit(1);

        wsManager.notifyExchangeResolved(
          returnRecord[0].sellerId,
          returnRecord[0].accountId,
          updated[0]
        );

        return { success: true, status: updateData.status };
      }),
  }),

  // ============ ADDRESSES ROUTER ============
  addresses: router({
    // Listar endereços do usuário
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return [];

        const { addresses } = await import("../drizzle/schema");

        const result = await database.select().from(addresses)
          .where(eq(addresses.userId, ctx.user!.id));

        return result;
      } catch (error) {
        console.error("Error fetching addresses:", error);
        return [];
      }
    }),

    // Criar novo endereço
    create: protectedProcedure
      .input(
        z.object({
          street: z.string(),
          number: z.string(),
          complement: z.string().optional(),
          neighborhood: z.string(),
          city: z.string(),
          state: z.string(),
          zipCode: z.string(),
          country: z.string().default("Brasil"),
          isDefault: z.number().default(0),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { addresses } = await import("../drizzle/schema");

          const addressData = {
            ...input,
            accountId: ctx.account!.id,
            userId: ctx.user!.id,
          };

          const result = await database.insert(addresses).values(addressData).returning();
          return result[0];
        } catch (error) {
          console.error("Error creating address:", error);
          throw error;
        }
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          street: z.string().optional(),
          number: z.string().optional(),
          complement: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipCode: z.string().optional(),
          country: z.string().optional(),
          isDefault: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");
          const { addresses } = await import("../drizzle/schema");
          const existing = await database.select().from(addresses)
            .where(eq(addresses.id, id))
            .limit(1);
          if (!existing[0] || existing[0].userId !== ctx.user!.id) {
            throw new Error("Acesso negado");
          }
          const result = await database.update(addresses)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(addresses.id, id))
            .returning();
          return result[0];
        } catch (error) {
          console.error("Error updating address:", error);
          throw error;
        }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");
          const { addresses } = await import("../drizzle/schema");
          const existing = await database.select().from(addresses)
            .where(eq(addresses.id, input.id))
            .limit(1);
          if (!existing[0] || existing[0].userId !== ctx.user!.id) {
            throw new Error("Acesso negado");
          }
          await database.delete(addresses).where(eq(addresses.id, input.id));
          return { success: true };
        } catch (error) {
          console.error("Error deleting address:", error);
          throw error;
        }
      }),
    setDefault: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");
          const { addresses } = await import("../drizzle/schema");
          await database.update(addresses)
            .set({ isDefault: 0 })
            .where(eq(addresses.userId, ctx.user!.id));
          const result = await database.update(addresses)
            .set({ isDefault: 1, updatedAt: new Date() })
            .where(eq(addresses.id, input.id))
            .returning();
          return result[0];
        } catch (error) {
          console.error("Error setting default address:", error);
          throw error;
        }
      }),
  }),

  // ============ SELLER PROFILES ROUTER ============
  sellerProfiles: router({
    // Obter perfil do vendedor atual
    me: protectedProcedure.query(async ({ ctx }) => {
      try {
        const buildFallbackProfile = () => {
          const now = new Date();
          return {
            id: 0,
            accountId: ctx.account!.id,
            userId: ctx.user!.id,
            storeName: ctx.user?.full_name || "Minha Loja",
            email: ctx.user?.cpf ?? null,
            phone: ctx.user?.whatsapp ?? null,
            city: null,
            state: null,
            profilePhoto: null,
            coverPhoto: null,
            description: null,
            rating: 0,
            totalSales: 0,
            totalSalesAmount: 0,
            totalProducts: 0,
            totalReviews: 0,
            followers: 0,
            responseTime: null,
            street: null,
            number: null,
            neighborhood: null,
            zipCode: null,
            latitude: null,
            longitude: null,
            createdAt: now,
            updatedAt: now,
          };
        };

        const database = await db.getDb();
        if (!database) {
          return buildFallbackProfile();
        }

        const { sellerProfiles } = await import("../drizzle/schema");

        const result = await database.select().from(sellerProfiles)
          .where(eq(sellerProfiles.userId, ctx.user!.id))
          .limit(1);

        return result[0] || null;
      } catch (error) {
        console.error("Error fetching seller profile:", error);
        return null;
      }
    }),

    // Criar perfil de vendedor
    create: protectedProcedure
      .input(
        z.object({
          storeName: z.string(),
          description: z.string().optional(),
          rating: z.string().default("0"),
          totalSales: z.number().default(0),
          responseTime: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { sellerProfiles } = await import("../drizzle/schema");

          const profileData = {
            ...input,
            accountId: ctx.account!.id,
            userId: ctx.user!.id,
          };

          const result = await database.insert(sellerProfiles).values(profileData).returning();
          return result[0];
        } catch (error) {
          console.error("Error creating seller profile:", error);
          throw error;
        }
      }),

    // Obter dados completos do vendedor
    getFullProfile: protectedProcedure.query(async ({ ctx }) => {
      const buildFallbackProfile = () => {
        const now = new Date();
        return {
          id: 0,
          accountId: ctx.account!.id,
          userId: ctx.user!.id,
          storeName: ctx.user?.full_name || "Minha Loja",
          email: ctx.user?.cpf ?? null,
          phone: ctx.user?.whatsapp ?? null,
          city: ctx.user?.address_city ?? null,
          state: ctx.user?.address_state ?? null,
          profilePhoto: null,
          coverPhoto: null,
          description: null,
          rating: 0,
          totalSales: 0,
          totalSalesAmount: 0,
          totalProducts: 0,
          totalReviews: 0,
          followers: 0,
          responseTime: null,
          street: ctx.user?.address_street ?? null,
          number: ctx.user?.address_number ?? null,
          neighborhood: ctx.user?.address_neighborhood ?? null,
          zipCode: ctx.user?.zip_code ?? null,
          latitude: null,
          longitude: null,
          createdAt: now,
          updatedAt: now,
        };
      };

      try {
        const database = await db.getDb();
        if (!database) return buildFallbackProfile();

        const { sellerProfiles, products, transactions, ratings, addresses, sellerFollowers } = await import("../drizzle/schema");

        let profileRows = await database
          .select()
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, ctx.user!.id))
          .limit(1);

        if (!profileRows[0]) {
          if (!ctx.account) {
            return null;
          }
          const storeName = ctx.user?.full_name || "Minha Loja";
          const created = await database
            .insert(sellerProfiles)
            .values({
              accountId: ctx.account!.id,
              userId: ctx.user!.id,
              storeName,
              phone: ctx.user?.whatsapp ?? null,
              city: ctx.user?.address_city ?? null,
              state: ctx.user?.address_state ?? null,
              street: ctx.user?.address_street ?? null,
              number: ctx.user?.address_number ?? null,
              neighborhood: ctx.user?.address_neighborhood ?? null,
              zipCode: ctx.user?.zip_code ?? null,
            })
            .returning();
          profileRows = created;
        }

        const baseProfile = profileRows[0];
        if (!baseProfile) return null;

        // Sincronização automática de endereço se estiver vazio no perfil
        if (!baseProfile.street || !baseProfile.city) {
          const defaultAddr = await database
            .select()
            .from(addresses)
            .where(and(eq(addresses.userId, ctx.user!.id), eq(addresses.isDefault, 1)))
            .limit(1);

          if (defaultAddr[0]) {
            baseProfile.street = baseProfile.street || defaultAddr[0].street;
            baseProfile.number = baseProfile.number || defaultAddr[0].number;
            baseProfile.neighborhood = baseProfile.neighborhood || defaultAddr[0].neighborhood;
            baseProfile.city = baseProfile.city || defaultAddr[0].city;
            baseProfile.state = baseProfile.state || defaultAddr[0].state;
            baseProfile.zipCode = baseProfile.zipCode || defaultAddr[0].zipCode;
          } else if (ctx.user?.address_street) {
            // Fallback para endereço do AvAdmin
            baseProfile.street = baseProfile.street || ctx.user.address_street;
            baseProfile.number = baseProfile.number || ctx.user.address_number || null;
            baseProfile.neighborhood = baseProfile.neighborhood || ctx.user.address_neighborhood || null;
            baseProfile.city = baseProfile.city || ctx.user.address_city || null;
            baseProfile.state = baseProfile.state || ctx.user.address_state || null;
            baseProfile.zipCode = baseProfile.zipCode || ctx.user.zip_code || null;
          }
        }

        if (!ctx.account) {
          return {
            ...baseProfile,
            totalSalesAmount: 0,
            totalSalesQuantity: 0,
            totalSales: baseProfile.totalSales ?? 0,
            totalProducts: 0,
            rating: baseProfile.rating ?? 0,
            totalReviews: 0,
            followers: baseProfile.followers ?? 0,
            responseTime: baseProfile.responseTime ?? null,
          };
        }

        let totalSalesAmount = 0;
        let totalSalesQuantity = 0;
        let totalProducts = 0;
        let totalReviews = 0;
        let rating = Number(baseProfile.rating ?? 0);

        try {
          const userProducts = await database
            .select()
            .from(products)
            .where(eq(products.accountId, ctx.account!.id));

          const userTransactions = await database
            .select()
            .from(transactions)
            .where(eq(transactions.accountId, ctx.account!.id));

          const userRatings = await database
            .select()
            .from(ratings)
            .where(eq(ratings.accountId, ctx.account!.id));

          const salesTransactions = userTransactions.filter(
            (t) => t.type === "sale"
          );

          totalSalesQuantity = salesTransactions.length;
          totalSalesAmount = salesTransactions.reduce(
            (sum, t) => sum + parseFloat(t.amount || "0"),
            0
          );
          totalProducts = userProducts.length;
          totalReviews = userRatings.length;
          rating =
            userRatings.length > 0
              ? userRatings.reduce((sum, r) => sum + r.rating, 0) /
              userRatings.length
              : 0;
        } catch (metricsError) {
          console.error("Error fetching seller profile metrics:", metricsError);
        }

        const followersCountRow = await database
          .select({ total: sql<number>`count(*)` })
          .from(sellerFollowers)
          .where(eq(sellerFollowers.sellerUserId, baseProfile.userId))
          .limit(1);
        const followersCount = Number(followersCountRow[0]?.total ?? 0);

        return {
          ...baseProfile,
          totalSalesAmount,
          totalSalesQuantity,
          totalSales: totalSalesQuantity,
          totalProducts,
          rating,
          totalReviews,
          followers: followersCount,
          responseTime: baseProfile.responseTime ?? null,
        };
      } catch (error) {
        console.error("Error fetching full seller profile:", error);
        return buildFallbackProfile();
      }
    }),
    getByUserId: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;
          const { sellerProfiles } = await import("../drizzle/schema");
          const result = await database.select().from(sellerProfiles)
            .where(eq(sellerProfiles.userId, input.userId as any))
            .limit(1);
          const profile = result[0];
          if (!profile || (profile.ownerCpf && profile.ownerCpf !== ctx.account!.owner_cpf)) return null;
          return profile;
        } catch (error) {
          console.error("Error fetching seller profile by userId:", error);
          return null;
        }
      }),

    // Perfil público (sem restrição por conta)
    getPublicByUserId: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;
          const { sellerProfiles, products, transactions, ratings, addresses, sellerFollowers } = await import("../drizzle/schema");
          const result = await database
            .select()
            .from(sellerProfiles)
            .where(eq(sellerProfiles.userId, input.userId as any))
            .limit(1);
          const profile = result[0];
          if (!profile) return null;

          // Sincronização automática de endereço
          if (!profile.street || !profile.city) {
            const defaultAddr = await database
              .select()
              .from(addresses)
              .where(and(eq(addresses.userId, profile.userId), eq(addresses.isDefault, 1)))
              .limit(1);

            if (defaultAddr[0]) {
              profile.street = profile.street || defaultAddr[0].street;
              profile.number = profile.number || defaultAddr[0].number;
              profile.neighborhood = profile.neighborhood || defaultAddr[0].neighborhood;
              profile.city = profile.city || defaultAddr[0].city;
              profile.state = profile.state || defaultAddr[0].state;
              profile.zipCode = profile.zipCode || defaultAddr[0].zipCode;
            }
          }

          const sellerProducts = await database.select().from(products)
            .where(eq(products.createdByUserId, profile.userId));
          const sellerTransactions = await database.select().from(transactions)
            .where(and(
              eq(transactions.sellerId, profile.userId),
              eq(transactions.type, "sale")
            ));
          const sellerRatings = await database
            .select({ rating: ratings.rating })
            .from(ratings)
            .leftJoin(products, eq(ratings.productId, products.id))
            .where(eq(products.createdByUserId, profile.userId));

          const totalSalesAmount = sellerTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
          const averageRating = sellerRatings.length > 0
            ? sellerRatings.reduce((sum, r) => sum + r.rating, 0) / sellerRatings.length
            : 0;

          const followersCountRow = await database
            .select({ total: sql<number>`count(*)` })
            .from(sellerFollowers)
            .where(eq(sellerFollowers.sellerUserId, profile.userId))
            .limit(1);
          const followersCount = Number(followersCountRow[0]?.total ?? 0);

          return {
            ...profile,
            totalSalesAmount,
            totalSalesQuantity: sellerTransactions.length,
            totalSales: sellerTransactions.length,
            totalProducts: sellerProducts.length,
            rating: averageRating,
            totalReviews: sellerRatings.length,
            followers: followersCount,
          };
        } catch (error) {
          console.error("Error fetching public seller profile:", error);
          return null;
        }
      }),

    getPublicByStoreSlug: publicProcedure
      .input(z.object({ storeSlug: z.string() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;
          const { sellerProfiles, products, transactions, ratings, addresses, sellerFollowers } = await import("../drizzle/schema");
          const rows = await database.select().from(sellerProfiles);
          const match = rows.find(
            (profile) => profile.storeName && toSlug(profile.storeName) === input.storeSlug
          );
          if (!match) return null;

          // Sincronização automática de endereço
          if (!match.street || !match.city) {
            const defaultAddr = await database
              .select()
              .from(addresses)
              .where(and(eq(addresses.userId, match.userId), eq(addresses.isDefault, 1)))
              .limit(1);

            if (defaultAddr[0]) {
              match.street = match.street || defaultAddr[0].street;
              match.number = match.number || defaultAddr[0].number;
              match.neighborhood = match.neighborhood || defaultAddr[0].neighborhood;
              match.city = match.city || defaultAddr[0].city;
              match.state = match.state || defaultAddr[0].state;
              match.zipCode = match.zipCode || defaultAddr[0].zipCode;
            }
          }

          const sellerProducts = await database.select().from(products)
            .where(eq(products.createdByUserId, match.userId));
          const sellerTransactions = await database.select().from(transactions)
            .where(and(
              eq(transactions.sellerId, match.userId),
              eq(transactions.type, "sale")
            ));
          const sellerRatings = await database
            .select({ rating: ratings.rating })
            .from(ratings)
            .leftJoin(products, eq(ratings.productId, products.id))
            .where(eq(products.createdByUserId, match.userId));

          const totalSalesAmount = sellerTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
          const averageRating = sellerRatings.length > 0
            ? sellerRatings.reduce((sum, r) => sum + r.rating, 0) / sellerRatings.length
            : 0;

          const followersCountRow = await database
            .select({ total: sql<number>`count(*)` })
            .from(sellerFollowers)
            .where(eq(sellerFollowers.sellerUserId, match.userId))
            .limit(1);
          const followersCount = Number(followersCountRow[0]?.total ?? 0);

          return {
            ...match,
            totalSalesAmount,
            totalSalesQuantity: sellerTransactions.length,
            totalSales: sellerTransactions.length,
            totalProducts: sellerProducts.length,
            rating: averageRating,
            totalReviews: sellerRatings.length,
            followers: followersCount,
          };
        } catch (error) {
          console.error("Error fetching public seller profile by slug:", error);
          return null;
        }
      }),

    getFollowStateByStoreSlug: protectedProcedure
      .input(z.object({ storeSlug: z.string() }))
      .query(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) return { isFollowing: false, followers: 0 };
        const { sellerProfiles, sellerFollowers } = await import("../drizzle/schema");

        const allProfiles = await database.select().from(sellerProfiles);
        const seller = allProfiles.find(
          (profile) => profile.storeName && toSlug(profile.storeName) === input.storeSlug
        );
        if (!seller) return { isFollowing: false, followers: 0 };

        const relation = await database
          .select({ id: sellerFollowers.id })
          .from(sellerFollowers)
          .where(
            and(
              eq(sellerFollowers.followerUserId, ctx.user!.id),
              eq(sellerFollowers.sellerUserId, seller.userId)
            )
          )
          .limit(1);

        const followersCountRow = await database
          .select({ total: sql<number>`count(*)` })
          .from(sellerFollowers)
          .where(eq(sellerFollowers.sellerUserId, seller.userId))
          .limit(1);

        return {
          isFollowing: Boolean(relation[0]),
          followers: Number(followersCountRow[0]?.total ?? 0),
        };
      }),

    toggleFollowByStoreSlug: protectedProcedure
      .input(z.object({ storeSlug: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");
        const { sellerProfiles, sellerFollowers } = await import("../drizzle/schema");

        const allProfiles = await database.select().from(sellerProfiles);
        const seller = allProfiles.find(
          (profile) => profile.storeName && toSlug(profile.storeName) === input.storeSlug
        );
        if (!seller) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
        }

        if (String(seller.userId) === String(ctx.user!.id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode seguir sua própria loja." });
        }

        const existing = await database
          .select({ id: sellerFollowers.id })
          .from(sellerFollowers)
          .where(
            and(
              eq(sellerFollowers.followerUserId, ctx.user!.id),
              eq(sellerFollowers.sellerUserId, seller.userId)
            )
          )
          .limit(1);

        let isFollowing = false;
        if (existing[0]) {
          await database.delete(sellerFollowers).where(eq(sellerFollowers.id, existing[0].id));
          isFollowing = false;
        } else {
          await database.insert(sellerFollowers).values({
            accountId: seller.accountId,
            followerUserId: ctx.user!.id,
            sellerUserId: seller.userId,
          });
          isFollowing = true;
        }

        const followersCountRow = await database
          .select({ total: sql<number>`count(*)` })
          .from(sellerFollowers)
          .where(eq(sellerFollowers.sellerUserId, seller.userId))
          .limit(1);
        const followers = Number(followersCountRow[0]?.total ?? 0);

        await database
          .update(sellerProfiles)
          .set({ followers, updatedAt: new Date() })
          .where(eq(sellerProfiles.userId, seller.userId));

        return { isFollowing, followers };
      }),

    listMyFollowedStoreSlugs: protectedProcedure
      .query(async ({ ctx }) => {
        const database = await db.getDb();
        if (!database) return [] as string[];
        const { sellerProfiles, sellerFollowers } = await import("../drizzle/schema");

        const follows = await database
          .select({ sellerUserId: sellerFollowers.sellerUserId })
          .from(sellerFollowers)
          .where(eq(sellerFollowers.followerUserId, ctx.user!.id));

        const sellerIds = follows.map((f) => f.sellerUserId).filter(Boolean);
        if (sellerIds.length === 0) return [] as string[];

        const profiles = await database
          .select({ storeName: sellerProfiles.storeName, userId: sellerProfiles.userId })
          .from(sellerProfiles)
          .where(inArray(sellerProfiles.userId, sellerIds as string[]));

        return profiles
          .map((p) => toSlug(p.storeName || p.userId || "loja"))
          .filter(Boolean);
      }),

    // Atualizar perfil
    updateProfile: protectedProcedure
      .input(
        z.object({
          data: z.object({
            storeName: z.string().nullish(),
            email: z.string().nullish(),
            phone: z.string().nullish(),
            city: z.string().nullish(),
            state: z.string().nullish(),
            profilePhoto: z.string().nullish(),
            coverPhoto: z.string().nullish(),
            description: z.string().nullish(),
            street: z.string().nullish(),
            number: z.string().nullish(),
            neighborhood: z.string().nullish(),
            zipCode: z.string().nullish(),
            latitude: z.number().nullish(),
            longitude: z.number().nullish(),
          })
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { sellerProfiles } = await import("../drizzle/schema");
          if (input.data.storeName?.trim()) {
            const duplicate = await database
              .select({ id: sellerProfiles.id })
              .from(sellerProfiles)
              .where(
                sql`lower(${sellerProfiles.storeName}) = lower(${input.data.storeName}) and ${sellerProfiles.userId} <> ${ctx.user!.id}`
              )
              .limit(1);

            if (duplicate.length > 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Nome de loja já está em uso.",
              });
            }
          }
          const updateData = Object.fromEntries(
            Object.entries(input.data).filter(
              ([, value]) => value !== null && value !== undefined
            )
          );

          const result = await database.update(sellerProfiles)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(sellerProfiles.userId, ctx.user!.id))
            .returning();
          const updatedProfile = result[0];
          wsManager.notifyProfileUpdated(ctx.user!.id, ctx.account!.id, updatedProfile);
          return updatedProfile;
        } catch (error) {
          console.error("Error updating seller profile:", error);
          throw error;
        }
      }),
  }),

  // ============ PREFERENCES ROUTER ============
  preferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return null;
        const { userPreferences } = await import("../drizzle/schema");
        const result = await database.select().from(userPreferences)
          .where(eq(userPreferences.userId, ctx.user!.id))
          .limit(1);
        if (!result[0]) {
          return {
            emailNotifications: true,
            marketingOffers: true,
            dataSharing: false,
          };
        }
        return result[0];
      } catch (error) {
        console.error("Error fetching preferences:", error);
        return null;
      }
    }),
    update: protectedProcedure
      .input(z.object({
        emailNotifications: z.boolean(),
        marketingOffers: z.boolean(),
        dataSharing: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");
          const { userPreferences } = await import("../drizzle/schema");
          const now = new Date();
          const result = await database.insert(userPreferences)
            .values({
              accountId: ctx.account!.id,
              userId: ctx.user!.id,
              ...input,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [userPreferences.accountId, userPreferences.userId],
              set: { ...input, updatedAt: now },
            })
            .returning();
          return result[0];
        } catch (error) {
          console.error("Error updating preferences:", error);
          throw error;
        }
      }),
  }),

  // ============ CART ROUTER ============
  cart: router({
    // Listar carrinho do usuário
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        const database = await db.getDb();
        if (!database) return [];

        const { carts } = await import("../drizzle/schema");

        const result = await database.select().from(carts)
          .where(eq(carts.userId, ctx.user!.id));

        return result;
      } catch (error) {
        console.error("Error fetching cart:", error);
        return [];
      }
    }),

    // Adicionar ao carrinho
    addItem: protectedProcedure
      .input(z.object({ productId: z.number(), quantity: z.number().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { carts, products } = await import("../drizzle/schema");

        // Verificar estoque disponível (incluindo reservas ativas)
        const product = await database.select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        if (!product[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
        }

        const currentStock = product[0].quantity ?? 0;

        // Calcular estoque disponível (descontando reservas ativas)
        const activeReservations = await database.select()
          .from(carts)
          .where(and(
            eq(carts.productId, input.productId),
            gt(carts.reservedUntil, new Date()) // Reservas ainda válidas
          ));

        const reservedQuantity = activeReservations.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const availableStock = currentStock - reservedQuantity;

        if (availableStock <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Produto esgotado" });
        }
        if (availableStock < input.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Apenas ${availableStock} unidade(s) disponível(is)`
          });
        }

        // Verificar se já existe no carrinho
        const existing = await database.select()
          .from(carts)
          .where(and(
            eq(carts.userId, ctx.user!.id),
            eq(carts.productId, input.productId)
          ))
          .limit(1);

        const reservedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

        if (existing[0]) {
          // Atualizar quantidade e renovar reserva
          const newQty = (existing[0].quantity || 0) + input.quantity;
          const result = await database
            .update(carts)
            .set({
              quantity: newQty,
              reservedUntil,
              reservedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(carts.id, existing[0].id))
            .returning();

          return result[0];
        }

        // Criar novo item no carrinho com reserva
        const cartData = {
          accountId: ctx.account!.id,
          userId: ctx.user!.id,
          productId: input.productId,
          quantity: input.quantity,
          reservedUntil,
          reservedAt: new Date(),
        };

        const result = await database.insert(carts).values(cartData).returning();
        return result[0];
      }),
    updateQuantity: protectedProcedure
      .input(z.object({ cartId: z.number(), quantity: z.number().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { carts, products } = await import("../drizzle/schema");

        const existing = await database.select()
          .from(carts)
          .where(eq(carts.id, input.cartId))
          .limit(1);

        if (!existing[0] || existing[0].userId !== ctx.user!.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Verificar disponibilidade
        const product = await database.select()
          .from(products)
          .where(eq(products.id, existing[0].productId))
          .limit(1);

        if (!product[0]) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const currentStock = product[0].quantity ?? 0;
        const activeReservations = await database.select()
          .from(carts)
          .where(and(
            eq(carts.productId, existing[0].productId),
            gt(carts.reservedUntil, new Date()),
            ne(carts.id, input.cartId) // Excluir este carrinho do cálculo
          ));

        const reservedByOthers = activeReservations.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const availableStock = currentStock - reservedByOthers;

        if (availableStock < input.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Apenas ${availableStock} unidade(s) disponível(is)`
          });
        }

        // Atualizar e renovar reserva
        const reservedUntil = new Date(Date.now() + 30 * 60 * 1000);
        const result = await database.update(carts)
          .set({
            quantity: input.quantity,
            reservedUntil,
            reservedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(carts.id, input.cartId))
          .returning();

        return result[0];
      }),

    // Remover do carrinho
    removeItem: protectedProcedure
      .input(z.object({ cartId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (!database) throw new Error("Database not available");

        const { carts } = await import("../drizzle/schema");

        const existing = await database.select()
          .from(carts)
          .where(eq(carts.id, input.cartId))
          .limit(1);

        if (!existing[0] || existing[0].userId !== ctx.user!.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // REMOVER lógica de devolução de estoque (era nas linhas 1930-1942)
        // Apenas deletar do carrinho - reserva expira automaticamente

        await database.delete(carts).where(eq(carts.id, input.cartId));

        wsManager.notifyCartUpdated(ctx.user!.id, ctx.account!.id, {
          action: 'remove',
          cartId: input.cartId,
          productId: existing[0].productId,
        });

        return { success: true };
      }),

    // Limpar carrinho do usuário
    clear: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          const database = await db.getDb();
          if (!database) throw new Error("Database not available");

          const { carts } = await import("../drizzle/schema");

          await database.delete(carts).where(and(
            eq(carts.userId, ctx.user!.id),
            eq(carts.accountId, ctx.account!.id)
          ));

          wsManager.notifyCartUpdated(ctx.user!.id, ctx.account!.id, {
            action: 'clear',
          });

          return { success: true };
        } catch (error) {
          console.error("Error clearing cart:", error);
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

