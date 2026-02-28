import { boolean, decimal, integer, pgEnum, pgTable, serial, text, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Enums
 */
export const documentTypeEnum = pgEnum("document_type", ["cpf", "cnpj"]);
export const clientTypeEnum = pgEnum("client_type", ["lojista", "distribuidor", "cliente_final"]);

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["sale", "purchase"]);
export const counterpartyRoleEnum = pgEnum("counterparty_role", ["buyer", "seller"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["completed", "pending", "cancelled"]);
export const productConditionEnum = pgEnum("product_condition", ["NEW", "USED", "REFURBISHED", "ORIGINAL_RETIRADA"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",  // Aguardando pagamento
  "paid",             // Pago (confirmado pelo vendedor)
  "processing",       // Em processamento
  "shipped",          // Enviado
  "delivered",        // Entregue
  "awaiting_exchange", // Aguardando troca
  "exchange_completed", // Troca feita
  "exchange_rejected",  // Troca recusada
  "cancelled"         // Cancelado
]);

// Novos enums para garantia e devoluções
export const warrantyPeriodEnum = pgEnum("warranty_period", [
  "NONE",
  "DAYS_7",
  "DAYS_30",
  "DAYS_90",
  "MONTHS_6"
]);

export const returnStatusEnum = pgEnum("return_status", [
  "requested",
  "approved_replacement",
  "approved_refund",
  "rejected",
  "completed",
  "replacement_sent",
  "defective_received",
  "completed_approved",
  "completed_rejected_by_vendor",
  "converted_to_sale",
  "returned_to_stock",
]);

/**
 * Tabela de usuários (Sincroniza TUDO de AvAdmin.accounts)
 * Representa empresas/lojas sincronizadas do AvAdmin
 * Apenas lojistas e distribuidores têm acesso ao StockTech
 */
export const users = pgTable("users", {
  // Identidade (de accounts.id)
  id: varchar("id", { length: 14 }).primaryKey(),  // CPF ou CNPJ
  documentType: documentTypeEnum("document_type"),
  document: varchar("document", { length: 14 }),

  // Informações da Empresa
  businessName: varchar("business_name", { length: 255 }),

  // Multi-Tenancy
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),
  isIndividual: boolean("is_individual"),

  // Contato
  whatsapp: varchar("whatsapp", { length: 20 }),

  // Status
  status: varchar("status", { length: 50 }),
  enabledModules: text("enabled_modules"),  // JSON

  // Histórico
  previousDocument: varchar("previous_document", { length: 14 }),
  planId: varchar("plan_id", { length: 36 }),  // UUID

  // Controle
  clientType: clientTypeEnum("client_type"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  ownerCpfIdx: index("users_owner_cpf_idx").on(table.ownerCpf),
  documentIdx: index("users_document_idx").on(table.document),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de Produtos
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),             // CPF do dono
  createdByUserId: varchar("created_by_user_id", { length: 11 }),       // CPF

  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  productType: varchar("product_type", { length: 100 }), // Nova coluna
  category: varchar("category", { length: 100 }),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(5),
  condition: productConditionEnum("condition").notNull().default("NEW"),
  images: text("images"), // JSON array de URLs de imagens

  // NOVO: Garantia
  warrantyPeriod: warrantyPeriodEnum("warranty_period").notNull().default("NONE"),
  defectiveQuantity: integer("defective_quantity").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => ({
  // Índices para performance
  accountIdIdx: index("products_account_id_idx").on(table.accountId),
  codeIdx: index("products_code_idx").on(table.code),
  nameIdx: index("products_name_idx").on(table.name),
  productTypeIdx: index("products_product_type_idx").on(table.productType),
  categoryIdx: index("products_category_idx").on(table.category),
  brandIdx: index("products_brand_idx").on(table.brand),
  createdAtIdx: index("products_created_at_idx").on(table.createdAt),
  // Índices compostos
  accountCategoryIdx: index("products_account_category_idx").on(table.accountId, table.category),
  accountCreatedIdx: index("products_account_created_idx").on(table.accountId, table.createdAt),
  searchIdx: index("products_search_idx").on(table.name, table.brand, table.category),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Tabela de Marcas
 */
export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  logoUrl: text("logo_url"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("brands_slug_idx").on(table.slug),
  activeIdx: index("brands_active_idx").on(table.isActive),
  displayOrderIdx: index("brands_display_order_idx").on(table.displayOrder),
}));

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

/**
 * Tabela de Tipos de Produto
 */
export const productTypes = pgTable("product_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("product_types_slug_idx").on(table.slug),
  activeIdx: index("product_types_active_idx").on(table.isActive),
  displayOrderIdx: index("product_types_display_order_idx").on(table.displayOrder),
}));

export type ProductType = typeof productTypes.$inferSelect;
export type InsertProductType = typeof productTypes.$inferInsert;

/**
 * Tabela de Peças/Aparelhos
 */
export const productParts = pgTable("product_parts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("product_parts_slug_idx").on(table.slug),
  activeIdx: index("product_parts_active_idx").on(table.isActive),
  displayOrderIdx: index("product_parts_display_order_idx").on(table.displayOrder),
}));

export type ProductPart = typeof productParts.$inferSelect;
export type InsertProductPart = typeof productParts.$inferInsert;

/**
 * Tabela de Condições
 */
export const productConditions = pgTable("product_conditions", {
  id: serial("id").primaryKey(),
  value: varchar("value", { length: 50 }).notNull().unique(), // NEW, USED, etc.
  label: varchar("label", { length: 100 }).notNull(), // "Novo", "Usado", etc.
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  valueIdx: index("product_conditions_value_idx").on(table.value),
  activeIdx: index("product_conditions_active_idx").on(table.isActive),
  displayOrderIdx: index("product_conditions_display_order_idx").on(table.displayOrder),
}));

export type ProductCondition = typeof productConditions.$inferSelect;
export type InsertProductCondition = typeof productConditions.$inferInsert;

/**
 * Tabela de Transações
 */
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),             // CPF do dono
  buyerId: varchar("buyer_id", { length: 11 }).notNull(),               // CPF
  sellerId: varchar("seller_id", { length: 11 }).notNull(),             // CPF

  transactionCode: varchar("transaction_code", { length: 50 }).notNull().unique(),
  type: transactionTypeEnum("type").notNull(),
  productId: integer("product_id").notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  counterparty: varchar("counterparty", { length: 255 }).notNull(),
  counterpartyRole: counterpartyRoleEnum("counterparty_role").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => ({
  // Índices para performance
  accountIdIdx: index("transactions_account_id_idx").on(table.accountId),
  ownerCpfIdx: index("transactions_owner_cpf_idx").on(table.ownerCpf),
  buyerIdIdx: index("transactions_buyer_id_idx").on(table.buyerId),
  sellerIdIdx: index("transactions_seller_id_idx").on(table.sellerId),
  productIdIdx: index("transactions_product_id_idx").on(table.productId),
  typeIdx: index("transactions_type_idx").on(table.type),
  statusIdx: index("transactions_status_idx").on(table.status),
  dateIdx: index("transactions_date_idx").on(table.date),
  createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
  // Índices compostos
  accountDateIdx: index("transactions_account_date_idx").on(table.accountId, table.date),
  buyerDateIdx: index("transactions_buyer_date_idx").on(table.buyerId, table.date),
  sellerDateIdx: index("transactions_seller_date_idx").on(table.sellerId, table.date),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Tabela de Avaliações
 */
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  reviewerId: varchar("reviewer_id", { length: 11 }).notNull(),         // CPF

  productId: integer("product_id").notNull(),
  transactionId: integer("transaction_id"),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  author: varchar("author", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;

/**
 * Tabela de Endereços
 */
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  userId: varchar("user_id", { length: 11 }).notNull(),                 // CPF

  street: varchar("street", { length: 255 }).notNull(),
  number: varchar("number", { length: 20 }).notNull(),
  complement: varchar("complement", { length: 255 }),
  neighborhood: varchar("neighborhood", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 100 }).notNull().default("Brasil"),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Address = typeof addresses.$inferSelect;
export type InsertAddress = typeof addresses.$inferInsert;

/**
 * Tabela de Preferências do Usuário
 */
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),

  // Multi-tenant
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  userId: varchar("user_id", { length: 11 }).notNull(),                 // CPF

  emailNotifications: boolean("email_notifications").notNull().default(true),
  marketingOffers: boolean("marketing_offers").notNull().default(true),
  dataSharing: boolean("data_sharing").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => ({
  accountIdIdx: index("user_preferences_account_id_idx").on(table.accountId),
  userIdIdx: index("user_preferences_user_id_idx").on(table.userId),
  accountUserIdx: index("user_preferences_account_user_idx").on(table.accountId, table.userId),
}));

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

/**
 * Tabela de Perfil de Vendedor (Perfil Unificado - Edição Privada + Visualização Pública)
 */
export const sellerProfiles = pgTable("seller_profiles", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),             // CPF do dono
  userId: varchar("user_id", { length: 11 }).notNull(),                 // CPF
  
  // Informações pessoais
  storeName: varchar("store_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  
  // Fotos (URLs do S3)
  profilePhoto: text("profile_photo"), // URL da foto de perfil
  coverPhoto: text("cover_photo"), // URL da foto de capa
  
  // Informações da loja
  description: text("description"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalSales: integer("total_sales").notNull().default(0),
  totalSalesAmount: decimal("total_sales_amount", { precision: 12, scale: 2 }).default("0"),
  totalProducts: integer("total_products").notNull().default(0),
  totalReviews: integer("total_reviews").notNull().default(0),
  followers: integer("followers").notNull().default(0),
  responseTime: integer("response_time"), // em minutos
  
  // Endereço da loja
  street: varchar("street", { length: 255 }),
  number: varchar("number", { length: 20 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  zipCode: varchar("zip_code", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type InsertSellerProfile = typeof sellerProfiles.$inferInsert;

/**
 * Relação de seguidores por loja
 * followerUserId: usuário logado que segue
 * sellerUserId: dono da loja seguida
 */
export const sellerFollowers = pgTable("seller_followers", {
  id: serial("id").primaryKey(),
  accountId: varchar("account_id", { length: 14 }).notNull(),
  followerUserId: varchar("follower_user_id", { length: 11 }).notNull(),
  sellerUserId: varchar("seller_user_id", { length: 11 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index("seller_followers_account_id_idx").on(table.accountId),
  followerUserIdIdx: index("seller_followers_follower_user_id_idx").on(table.followerUserId),
  sellerUserIdIdx: index("seller_followers_seller_user_id_idx").on(table.sellerUserId),
  accountSellerIdx: index("seller_followers_account_seller_idx").on(table.accountId, table.sellerUserId),
  uniqueFollowerSellerIdx: uniqueIndex("seller_followers_unique_follower_seller_idx").on(table.followerUserId, table.sellerUserId),
}));

export type SellerFollower = typeof sellerFollowers.$inferSelect;
export type InsertSellerFollower = typeof sellerFollowers.$inferInsert;

/**
 * Tabela de Carrinho
 */
export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  userId: varchar("user_id", { length: 11 }).notNull(),                 // CPF

  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),

  // NOVO: Reserva temporária
  reservedUntil: timestamp("reserved_until"),
  reservedAt: timestamp("reserved_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Cart = typeof carts.$inferSelect;
export type InsertCart = typeof carts.$inferInsert;

/**
 * Tabela de Pedidos
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),

  // Multi-tenant: isolamento por conta SaaS
  accountId: varchar("account_id", { length: 14 }).notNull(),           // CNPJ
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),             // CPF do dono
  // Contas envolvidas no pedido
  buyerAccountId: varchar("buyer_account_id", { length: 14 }),
  sellerAccountId: varchar("seller_account_id", { length: 14 }),
  buyerId: varchar("buyer_id", { length: 11 }).notNull(),               // CPF
  sellerId: varchar("seller_id", { length: 11 }).notNull(),             // CPF

  orderCode: varchar("order_code", { length: 20 }).notNull().unique(),
  parentOrderCode: varchar("parent_order_code", { length: 20 }), // Código do pedido agrupado (para comprador)
  status: orderStatusEnum("status").notNull().default("pending_payment"),

  // Valores monetários
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  freight: decimal("freight", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),

  // Dados da entrega
  addressId: integer("address_id").notNull(),

  // Itens do pedido (JSON)
  items: text("items").notNull(), // JSON array dos itens

  // Informações de pagamento
  paymentNotes: text("payment_notes"),        // Instruções de pagamento (PIX, conta bancária, etc.)
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  paymentConfirmedBy: varchar("payment_confirmed_by", { length: 11 }),   // CPF do vendedor

  // Tracking
  trackingCode: varchar("tracking_code", { length: 50 }),
  trackingCarrier: varchar("tracking_carrier", { length: 100 }),

  // Observações
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => ({
  // Índices para performance
  accountIdIdx: index("orders_account_id_idx").on(table.accountId),
  buyerIdIdx: index("orders_buyer_id_idx").on(table.buyerId),
  sellerIdIdx: index("orders_seller_id_idx").on(table.sellerId),
  statusIdx: index("orders_status_idx").on(table.status),
  orderCodeIdx: index("orders_order_code_idx").on(table.orderCode),
  parentOrderCodeIdx: index("orders_parent_order_code_idx").on(table.parentOrderCode),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  // Índice composto para queries comuns
  accountStatusIdx: index("orders_account_status_idx").on(table.accountId, table.status),
  buyerCreatedIdx: index("orders_buyer_created_idx").on(table.buyerId, table.createdAt),
  sellerCreatedIdx: index("orders_seller_created_idx").on(table.sellerId, table.createdAt),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Tabela de Devoluções/Trocas
 */
export const productReturns = pgTable("product_returns", {
  id: serial("id").primaryKey(),

  // Multi-tenant
  accountId: varchar("account_id", { length: 14 }).notNull(),
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),             // CPF do dono
  buyerId: varchar("buyer_id", { length: 11 }).notNull(),
  sellerId: varchar("seller_id", { length: 11 }).notNull(),

  // Referências
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  transactionId: integer("transaction_id"),

  // Dados da devolução
  returnCode: varchar("return_code", { length: 20 }).notNull().unique(),
  reason: text("reason").notNull(),
  quantity: integer("quantity").notNull().default(1),

  // Status
  status: returnStatusEnum("status").notNull().default("requested"),

  // Decisão do vendedor
  sellerDecision: varchar("seller_decision", { length: 50 }), // 'replacement', 'refund'
  sellerNotes: text("seller_notes"),

  // Tracking
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 11 }),
  completedAt: timestamp("completed_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),

  // Novo fluxo multi-etapa
  replacementProductId: integer("replacement_product_id"),
  replacementSentAt: timestamp("replacement_sent_at"),
  defectiveReceivedAt: timestamp("defective_received_at"),
  defectiveValidatedAt: timestamp("defective_validated_at"),
  validationNotes: text("validation_notes"),
  convertedToSaleAt: timestamp("converted_to_sale_at"),
  convertedOrderId: integer("converted_order_id"),
  reservedQuantity: integer("reserved_quantity").default(0),

  // Validação de garantia
  isWithinWarranty: boolean("is_within_warranty").notNull().default(true),
  warrantyExpiresAt: timestamp("warranty_expires_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index("product_returns_account_id_idx").on(table.accountId),
  ownerCpfIdx: index("product_returns_owner_cpf_idx").on(table.ownerCpf),
  buyerIdIdx: index("product_returns_buyer_id_idx").on(table.buyerId),
  sellerIdIdx: index("product_returns_seller_id_idx").on(table.sellerId),
  orderIdIdx: index("product_returns_order_id_idx").on(table.orderId),
  productIdIdx: index("product_returns_product_id_idx").on(table.productId),
  statusIdx: index("product_returns_status_idx").on(table.status),
}));

export type ProductReturn = typeof productReturns.$inferSelect;
export type InsertProductReturn = typeof productReturns.$inferInsert;

/**
 * Enum de tipo de movimentação de estoque
 */
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "IN",       // Entrada (reposição)
  "OUT",      // Saída (venda, defeito)
  "ADJUST",   // Ajuste manual
]);

/**
 * Tabela de Movimentações de Estoque
 * Registra automaticamente toda alteração de quantidade
 */
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),

  accountId: varchar("account_id", { length: 14 }).notNull(),
  ownerCpf: varchar("owner_cpf", { length: 11 }).notNull(),
  userId: varchar("user_id", { length: 11 }).notNull(),

  productId: integer("product_id").notNull(),
  productCode: varchar("product_code", { length: 50 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),

  type: stockMovementTypeEnum("type").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  delta: integer("delta").notNull(),  // newQuantity - previousQuantity (positivo = entrada, negativo = saída)
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index("stock_movements_account_id_idx").on(table.accountId),
  productIdIdx: index("stock_movements_product_id_idx").on(table.productId),
  typeIdx: index("stock_movements_type_idx").on(table.type),
  createdAtIdx: index("stock_movements_created_at_idx").on(table.createdAt),
  productCreatedIdx: index("stock_movements_product_created_idx").on(table.productId, table.createdAt),
}));

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;
