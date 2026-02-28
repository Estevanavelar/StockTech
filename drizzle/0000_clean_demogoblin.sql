CREATE TYPE "public"."counterparty_role" AS ENUM('buyer', 'seller');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('NEW', 'USED', 'REFURBISHED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('completed', 'pending', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('sale', 'purchase');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"street" varchar(255) NOT NULL,
	"number" varchar(20) NOT NULL,
	"complement" varchar(255),
	"neighborhood" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"zipCode" varchar(20) NOT NULL,
	"country" varchar(100) DEFAULT 'Brasil' NOT NULL,
	"isDefault" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"productId" integer NOT NULL,
	"quantity" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"brand" varchar(100),
	"category" varchar(100),
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"minQuantity" integer DEFAULT 5 NOT NULL,
	"condition" "product_condition" DEFAULT 'NEW' NOT NULL,
	"images" text,
	"sellerId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"productId" integer NOT NULL,
	"transactionId" integer,
	"rating" integer NOT NULL,
	"comment" text,
	"author" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellerProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"storeName" varchar(255) NOT NULL,
	"description" text,
	"rating" numeric(3, 2) DEFAULT '0',
	"totalSales" integer DEFAULT 0 NOT NULL,
	"responseTime" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionCode" varchar(50) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"productId" integer NOT NULL,
	"productName" varchar(255) NOT NULL,
	"counterparty" varchar(255) NOT NULL,
	"counterpartyRole" "counterparty_role" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transactionCode_unique" UNIQUE("transactionCode")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64),
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
