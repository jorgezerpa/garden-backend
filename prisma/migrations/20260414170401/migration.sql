/*
  Warnings:

  - You are about to alter the column `durationInWeeks` on the `AgentLevel` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,1)`.

*/
-- AlterTable
ALTER TABLE "AgentLevel" ALTER COLUMN "durationInWeeks" SET DEFAULT 0,
ALTER COLUMN "durationInWeeks" SET DATA TYPE DECIMAL(10,1);

-- CreateTable
CREATE TABLE "AgentsRank" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "indexes" JSONB NOT NULL,

    CONSTRAINT "AgentsRank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentsRank_companyId_key" ON "AgentsRank"("companyId");

-- AddForeignKey
ALTER TABLE "AgentsRank" ADD CONSTRAINT "AgentsRank_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
