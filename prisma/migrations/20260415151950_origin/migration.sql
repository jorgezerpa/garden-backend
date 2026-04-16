/*
  Warnings:

  - You are about to drop the `AgentsRank` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgentsRank" DROP CONSTRAINT "AgentsRank_companyId_fkey";

-- DropTable
DROP TABLE "AgentsRank";
