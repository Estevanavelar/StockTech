CREATE SCHEMA IF NOT EXISTS "avelar_stocktech";--> statement-breakpoint
SET search_path TO "avelar_stocktech";--> statement-breakpoint
CREATE TYPE "avelar_stocktech"."counterparty_role" AS ENUM('buyer', 'seller');--> statement-breakpoint
CREATE TYPE "avelar_stocktech"."order_status" AS ENUM('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "avelar_stocktech"."product_condition" AS ENUM('NEW', 'USED', 'REFURBISHED', 'ORIGINAL_RETIRADA');--> statement-breakpoint
CREATE TYPE "avelar_stocktech"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "avelar_stocktech"."transaction_status" AS ENUM('completed', 'pending', 'cancelled');--> statement-breakpoint
CREATE TYPE "avelar_stocktech"."transaction_type" AS ENUM('sale', 'purchase');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"user_id" varchar(11) NOT NULL,
	"street" varchar(255) NOT NULL,
	"number" varchar(20) NOT NULL,
	"complement" varchar(255),
	"neighborhood" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"zip_code" varchar(20) NOT NULL,
	"country" varchar(100) DEFAULT 'Brasil' NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"user_id" varchar(11) NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"buyer_account_id" varchar(14),
	"seller_account_id" varchar(14),
	"buyer_id" varchar(11) NOT NULL,
	"seller_id" varchar(11) NOT NULL,
	"order_code" varchar(20) NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"freight" numeric(10, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"address_id" integer NOT NULL,
	"items" text NOT NULL,
	"payment_notes" text,
	"payment_confirmed_at" timestamp,
	"payment_confirmed_by" varchar(11),
	"tracking_code" varchar(50),
	"tracking_carrier" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"created_by_user_id" varchar(11),
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"brand" varchar(100),
	"model" varchar(100),
	"category" varchar(100),
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 5 NOT NULL,
	"condition" "product_condition" DEFAULT 'NEW' NOT NULL,
	"images" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"reviewer_id" varchar(11) NOT NULL,
	"product_id" integer NOT NULL,
	"transaction_id" integer,
	"rating" integer NOT NULL,
	"comment" text,
	"author" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"user_id" varchar(11) NOT NULL,
	"store_name" varchar(255) NOT NULL,
	"email" varchar(320),
	"phone" varchar(20),
	"city" varchar(100),
	"state" varchar(2),
	"profile_photo" text,
	"cover_photo" text,
	"description" text,
	"rating" numeric(3, 2) DEFAULT '0',
	"total_sales" integer DEFAULT 0 NOT NULL,
	"total_sales_amount" numeric(12, 2) DEFAULT '0',
	"total_products" integer DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"response_time" integer,
	"street" varchar(255),
	"number" varchar(20),
	"neighborhood" varchar(100),
	"zip_code" varchar(20),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"buyer_id" varchar(11) NOT NULL,
	"seller_id" varchar(11) NOT NULL,
	"transaction_code" varchar(50) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"counterparty" varchar(255) NOT NULL,
	"counterparty_role" "counterparty_role" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_code_unique" UNIQUE("transaction_code")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" varchar(14) NOT NULL,
	"user_id" varchar(11) NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"marketing_offers" boolean DEFAULT true NOT NULL,
	"data_sharing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orders_account_id_idx" ON "orders" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_id_idx" ON "orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "orders_seller_id_idx" ON "orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_order_code_idx" ON "orders" USING btree ("order_code");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_account_status_idx" ON "orders" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "orders_buyer_created_idx" ON "orders" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_seller_created_idx" ON "orders" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "products_account_id_idx" ON "products" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "products_code_idx" ON "products" USING btree ("code");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "products_account_category_idx" ON "products" USING btree ("account_id","category");--> statement-breakpoint
CREATE INDEX "products_account_created_idx" ON "products" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING btree ("name","brand","category");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_buyer_id_idx" ON "transactions" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "transactions_seller_id_idx" ON "transactions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "transactions_product_id_idx" ON "transactions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_account_date_idx" ON "transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "transactions_buyer_date_idx" ON "transactions" USING btree ("buyer_id","date");--> statement-breakpoint
CREATE INDEX "transactions_seller_date_idx" ON "transactions" USING btree ("seller_id","date");--> statement-breakpoint
CREATE INDEX "user_preferences_account_id_idx" ON "user_preferences" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_account_user_idx" ON "user_preferences" USING btree ("account_id","user_id");