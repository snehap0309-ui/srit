-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_CONDITIONS', 'REWARDS_POLICY', 'COMMUNITY_GUIDELINES', 'VENDOR_TERMS', 'CREATOR_TERMS', 'REFUND_POLICY', 'ABOUT_US', 'CONTACT_INFO', 'FAQ');

-- CreateEnum
CREATE TYPE "LegalVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LegalContentFormat" AS ENUM ('MARKDOWN', 'HTML', 'PLAIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LEGAL_VERSION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEGAL_VERSION_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'LEGAL_VERSION_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'LEGAL_VERSION_ROLLED_BACK';

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "format" "LegalContentFormat" NOT NULL DEFAULT 'MARKDOWN',
    "status" "LegalVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_date" TIMESTAMP(3),
    "change_summary" TEXT,
    "created_by_id" TEXT,
    "published_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_documents_type_idx" ON "legal_documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_locale_key" ON "legal_documents"("type", "locale");

-- CreateIndex
CREATE INDEX "legal_document_versions_document_id_status_idx" ON "legal_document_versions"("document_id", "status");

-- CreateIndex
CREATE INDEX "legal_document_versions_status_idx" ON "legal_document_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_versions_document_id_version_number_key" ON "legal_document_versions"("document_id", "version_number");

-- AddForeignKey
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
