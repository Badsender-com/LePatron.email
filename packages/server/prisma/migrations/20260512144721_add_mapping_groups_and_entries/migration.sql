-- CreateEnum
CREATE TYPE "MappingEntryStatus" AS ENUM ('EN_DISCUSSION', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "progress_link_destination_domains" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mapping_groups" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Group',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_collapsed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_entries" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "group_id" TEXT,
    "custom_name" TEXT,
    "platform_id" TEXT,
    "usage_id" TEXT,
    "from_domain_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ip_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mail_from_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reply_to_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tracking_domain_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hosting_domain_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "link_destination_domain_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comments" TEXT,
    "status" "MappingEntryStatus" NOT NULL DEFAULT 'EN_DISCUSSION',
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "strategic_score" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uses_shared_ips" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mapping_groups_audit_id_sort_order_idx" ON "mapping_groups"("audit_id", "sort_order");

-- CreateIndex
CREATE INDEX "mapping_entries_audit_id_sort_order_idx" ON "mapping_entries"("audit_id", "sort_order");

-- CreateIndex
CREATE INDEX "mapping_entries_audit_id_group_id_idx" ON "mapping_entries"("audit_id", "group_id");

-- AddForeignKey
ALTER TABLE "mapping_groups" ADD CONSTRAINT "mapping_groups_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_entries" ADD CONSTRAINT "mapping_entries_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_entries" ADD CONSTRAINT "mapping_entries_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "mapping_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
