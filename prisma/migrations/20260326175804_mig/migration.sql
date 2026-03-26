-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MAIN_ADMIN', 'MANAGER', 'AGENT');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('WORKING', 'REST', 'EXTRA_TIME');

-- CreateEnum
CREATE TYPE "SchemaType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SEED', 'LEAD', 'SALE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PAUSED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "THIRD_PARTY_SERVICES" AS ENUM ('LEADDESK');

-- CreateEnum
CREATE TYPE "WEEK_DAYS" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "managerId" INTEGER,
    "agentId" INTEGER,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIKeysAuth" (
    "id" SERIAL NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKeyHash" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIKeysAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDeskCustomData" (
    "id" SERIAL NOT NULL,
    "authString" TEXT,
    "SeedEventIds" TEXT[],
    "SaleEventIds" TEXT[],
    "IANATimeZone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "LeadDeskCustomData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manager" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "profileImg" TEXT,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToThird" (
    "id" SERIAL NOT NULL,
    "serviceIdentifier" "THIRD_PARTY_SERVICES" NOT NULL,
    "agentServiceIdentifier" TEXT NOT NULL,
    "agentId" INTEGER NOT NULL,

    CONSTRAINT "AgentToThird_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Callee" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Callee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentToCallee" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "calleeId" INTEGER NOT NULL,
    "totalAttemps" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agentToCallee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schema" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,

    CONSTRAINT "Schema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaBlock" (
    "id" SERIAL NOT NULL,
    "startMinutesFromMidnight" INTEGER NOT NULL,
    "endMinutesFromMidnight" INTEGER NOT NULL,
    "blockType" "BlockType" NOT NULL DEFAULT 'WORKING',
    "name" TEXT,
    "schemaId" INTEGER NOT NULL,

    CONSTRAINT "SchemaBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaAssignation" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "schemaId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemaAssignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "calleeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "dayOfTheWeek" "WEEK_DAYS" NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" SERIAL NOT NULL,
    "type" "EventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentState" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energyScore" INTEGER NOT NULL,
    "focusScore" INTEGER NOT NULL,
    "motivationScore" INTEGER NOT NULL,

    CONSTRAINT "AgentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLevel" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "till" TIMESTAMP(3),
    "durationInWeeks" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL,

    CONSTRAINT "AgentLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporalGoals" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "talkTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "seeds" INTEGER NOT NULL DEFAULT 0,
    "callbacks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "numberOfCalls" INTEGER NOT NULL DEFAULT 0,
    "numberOfLongCalls" INTEGER NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporalGoals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalsAssignation" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "goalId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalsAssignation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_managerId_key" ON "User"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_agentId_key" ON "User"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "APIKeysAuth_publicKey_key" ON "APIKeysAuth"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "APIKeysAuth_secretKeyHash_key" ON "APIKeysAuth"("secretKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "APIKeysAuth_companyId_key" ON "APIKeysAuth"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadDeskCustomData_companyId_key" ON "LeadDeskCustomData"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Manager_email_key" ON "Manager"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToThird_agentId_serviceIdentifier_key" ON "AgentToThird"("agentId", "serviceIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "AgentToThird_serviceIdentifier_agentServiceIdentifier_key" ON "AgentToThird"("serviceIdentifier", "agentServiceIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Callee_phoneNumber_key" ON "Callee"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "agentToCallee_agentId_calleeId_key" ON "agentToCallee"("agentId", "calleeId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaAssignation_companyId_date_key" ON "SchemaAssignation"("companyId", "date");

-- CreateIndex
CREATE INDEX "AgentLevel_agentId_level_idx" ON "AgentLevel"("agentId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "GoalsAssignation_companyId_date_key" ON "GoalsAssignation"("companyId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIKeysAuth" ADD CONSTRAINT "APIKeysAuth_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDeskCustomData" ADD CONSTRAINT "LeadDeskCustomData_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manager" ADD CONSTRAINT "Manager_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToThird" ADD CONSTRAINT "AgentToThird_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentToCallee" ADD CONSTRAINT "agentToCallee_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentToCallee" ADD CONSTRAINT "agentToCallee_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "Callee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schema" ADD CONSTRAINT "Schema_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schema" ADD CONSTRAINT "Schema_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaBlock" ADD CONSTRAINT "SchemaBlock_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaAssignation" ADD CONSTRAINT "SchemaAssignation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaAssignation" ADD CONSTRAINT "SchemaAssignation_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "Callee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentState" ADD CONSTRAINT "AgentState_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLevel" ADD CONSTRAINT "AgentLevel_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporalGoals" ADD CONSTRAINT "TemporalGoals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporalGoals" ADD CONSTRAINT "TemporalGoals_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalsAssignation" ADD CONSTRAINT "GoalsAssignation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalsAssignation" ADD CONSTRAINT "GoalsAssignation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "TemporalGoals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
