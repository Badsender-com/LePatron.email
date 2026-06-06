-- AlterTable
ALTER TABLE "mapping_entries" ADD COLUMN "from_address_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
