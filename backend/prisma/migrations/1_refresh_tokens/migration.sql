-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contraintes d'intégrité (non modélisées par Prisma, en plus de la validation applicative)
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_distinct_users" CHECK ("fromUserId" <> "toUserId");
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_amount_non_negative" CHECK ("amountCents" >= 0);
ALTER TABLE "category_shares" ADD CONSTRAINT "category_shares_bp_range" CHECK ("shareBp" BETWEEN 0 AND 10000);
