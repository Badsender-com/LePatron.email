-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('PLATFORM', 'USAGE', 'DISPLAY_FROM_DOMAIN', 'DISPLAY_FROM_ADDRESS', 'REPLY_TO', 'MAIL_FROM_DOMAIN', 'TRACKING_DOMAIN', 'HOSTING_DOMAIN', 'IP', 'LINK_DESTINATION_DOMAIN');

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'DRAFT',
    "workshop_ready" BOOLEAN NOT NULL DEFAULT false,
    "organization" TEXT NOT NULL DEFAULT 'Badsender',
    "progress_platforms" BOOLEAN NOT NULL DEFAULT false,
    "progress_usages" BOOLEAN NOT NULL DEFAULT false,
    "progress_display_from_domains" BOOLEAN NOT NULL DEFAULT false,
    "progress_display_from_addresses" BOOLEAN NOT NULL DEFAULT false,
    "progress_reply_tos" BOOLEAN NOT NULL DEFAULT false,
    "progress_mail_from_domains" BOOLEAN NOT NULL DEFAULT false,
    "progress_tracking_domains" BOOLEAN NOT NULL DEFAULT false,
    "progress_hosting_domains" BOOLEAN NOT NULL DEFAULT false,
    "progress_ips" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audits_company_id_created_at_idx" ON "audits"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audits_company_id_status_idx" ON "audits"("company_id", "status");

-- CreateIndex
CREATE INDEX "inventory_items_audit_id_category_idx" ON "inventory_items"("audit_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_audit_id_category_value_key" ON "inventory_items"("audit_id", "category", "value");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
