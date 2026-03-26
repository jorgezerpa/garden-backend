import express, { Router } from "express";
import axios from "axios";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import * as path$1 from "node:path";
import { fileURLToPath } from "node:url";
import * as runtime from "@prisma/client/runtime/client";
import { createHash, randomBytes, randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { compare, hash } from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import path from "path";
import cors from "cors";
//#region generated/prisma/internal/class.ts
const config = {
	"previewFeatures": [],
	"clientVersion": "7.4.1",
	"engineVersion": "55ae170b1ced7fc6ed07a15f110549408c501bb3",
	"activeProvider": "postgresql",
	"inlineSchema": "generator client {\n  provider = \"prisma-client\"\n  output   = \"../generated/prisma\"\n}\n\ndatasource db {\n  provider = \"postgresql\"\n}\n\nenum Role {\n  MAIN_ADMIN\n  MANAGER\n  AGENT\n}\n\nenum BlockType {\n  WORKING\n  REST\n  EXTRA_TIME\n}\n\nenum SchemaType {\n  DAILY\n  WEEKLY\n  MONTHLY\n}\n\nenum EventType {\n  SEED // CALLBACK. books a call as a \"Callback\" -> Since I have now exact way to now this, I will just count each call as a seed, by now.\n  LEAD // WATERING. Callback is performed AKA agent calls a callee more than 1 time: Every call from this increases +1 LEAD\n  SALE // HARVEST. Agent books a call as a deal -> the call data has order_ids.length more than 1\n}\n\nenum UserStatus {\n  PAUSED\n  ACTIVE\n  REMOVED // not return point, but we keep it due to historical reasons\n}\n\nenum THIRD_PARTY_SERVICES {\n  LEADDESK\n}\n\nenum WEEK_DAYS {\n  MONDAY\n  TUESDAY\n  WEDNESDAY\n  THURSDAY\n  FRIDAY\n  SATURDAY\n  SUNDAY\n}\n\nmodel User {\n  id           Int      @id @default(autoincrement())\n  email        String   @unique\n  passwordHash String // Store hashed passwords only\n  role         Role     @default(AGENT)\n  isActive     Boolean  @default(true)\n  createdAt    DateTime @default(now())\n  updatedAt    DateTime @updatedAt\n\n  // Relations to your existing entities\n  companyId Int\n  company   Company @relation(fields: [companyId], references: [id])\n\n  // Optional links depending on the role\n  managerProfile Manager? @relation(fields: [managerId], references: [id])\n  managerId      Int?     @unique\n\n  agentProfile Agent? @relation(fields: [agentId], references: [id])\n  agentId      Int?   @unique\n\n  status UserStatus @default(ACTIVE) // REMOVED is used when \"deleted\" -> we can not delete it directly due to historical data. \n  // Constraint: One MAIN_ADMIN per company\n  // This is enforced via a unique partial index in the DB (see note below)\n}\n\nmodel Company {\n  id                 Int                 @id @default(autoincrement())\n  name               String\n  createdAt          DateTime            @default(now())\n  managers           Manager[]\n  agents             Agent[]\n  calls              Call[]\n  TimeSchemas        Schema[]\n  users              User[]\n  temporalGoals      TemporalGoals[] // goals list \n  GoalsAssignation   GoalsAssignation[] // assigns 1 TemporalGoal to a specific day (date)\n  schemaAssignation  SchemaAssignation[] // assigns 1 TemporalGoal to a specific day (date)\n  apiKey             APIKeysAuth?\n  // Third party custom data \n  leadDeskCustomData LeadDeskCustomData?\n}\n\n// 1-to-1 company-key (used to authenticate webhook call origin)\nmodel APIKeysAuth {\n  id Int @id @default(autoincrement())\n\n  // Use UUIDs for the keys. \n  // 'public' is a reserved keyword in some DBs, 'publicKey' is safer.\n  publicKey     String  @unique // uuid prefixed with a specific string exp: \"prefix-uuid\" \n  secretKeyHash String  @unique // hashed secret \n  // Link to company and ensure 1-to-1\n  company       Company @relation(fields: [companyId], references: [id])\n  companyId     Int     @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\n// -------- START CUSTOM DATA SECTION ---------\n// For each connection to third party, is required some specific data that variates depending on the service\n// for that reason, we create a specific table for each service (if needed) designed to store the specific values \n// all this models are named with the convention [ThirdPartyName]+CustomMetadata\nmodel LeadDeskCustomData {\n  id           Int      @id @default(autoincrement())\n  authString   String? // 32-bytes string provided by LeadDesk to authenticate calls to its API -> used, for example, when fetch call data in webhook handler\n  SeedEventIds String[] // list of strings to be compared against call.call_ending_reason or call.call_ending_reason_name during the webhook call, to know if the call finished up with a callback apointment\n  SaleEventIds String[] // list of strings to be compared against call.call_ending_reason or call.call_ending_reason_name during the webhook call, to know if the call finished up with a sale/deal\n  IANATimeZone String   @default(\"Europe/Amsterdam\") // The timezone of the webhook server -> helps us to now at what timezone corresponds the dates and hours on the call data, to shift it to utc zulu \n  //\n  company      Company  @relation(fields: [companyId], references: [id])\n  companyId    Int      @unique\n}\n\n// -------- END CUSTOM DATA SECTION ---------\n\nmodel Manager {\n  id            Int             @id @default(autoincrement())\n  name          String\n  email         String          @unique\n  company       Company         @relation(fields: [companyId], references: [id]) // companyId is the foreign key, and it is compared with the `id` field of the other table\n  companyId     Int\n  user          User?\n  temporalGoals TemporalGoals[]\n  schemas       Schema[]\n}\n\nmodel Agent {\n  id                    Int             @id @default(autoincrement())\n  name                  String\n  company               Company         @relation(fields: [companyId], references: [id])\n  companyId             Int\n  calls                 Call[]\n  feelings              AgentState[]\n  events                FunnelEvent[]\n  user                  User?\n  totalAttempsPerCallee agentToCallee[]\n  agentToThird          AgentToThird[]\n  agentLevel            AgentLevel[]\n  // \n  profileImg            String?\n}\n\nmodel AgentToThird {\n  id                     Int                  @id @default(autoincrement())\n  serviceIdentifier      THIRD_PARTY_SERVICES\n  agentServiceIdentifier String\n\n  // Relation fields\n  agent   Agent @relation(fields: [agentId], references: [id])\n  agentId Int\n\n  @@unique([agentId, serviceIdentifier]) // agent can have only 1 relation for the same service\n  @@unique([serviceIdentifier, agentServiceIdentifier]) // only 1 agent service identifier per service\n}\n\nmodel Callee {\n  id                   Int             @id @default(autoincrement())\n  phoneNumber          String          @unique\n  totalAttempts        Int             @default(0)\n  calls                Call[]\n  totalAttempsPerAgent agentToCallee[]\n}\n\n// tracks the number of times an agent calls the same number\n// @dev maybe in future, would be better to track \"per campaign\" too\nmodel agentToCallee {\n  id           Int    @id @default(autoincrement())\n  agent        Agent  @relation(fields: [agentId], references: [id])\n  agentId      Int\n  callee       Callee @relation(fields: [calleeId], references: [id])\n  calleeId     Int\n  totalAttemps Int    @default(0)\n\n  @@unique([agentId, calleeId])\n}\n\n// --- BLOCKS MASKS ---\n// Managers create time schedules by block, so the can filter the call querying by such blocks \n\nmodel Schema {\n  id                 Int                 @id @default(autoincrement())\n  name               String\n  company            Company             @relation(fields: [companyId], references: [id])\n  companyId          Int\n  creator            Manager             @relation(fields: [creatorId], references: [id])\n  creatorId          Int\n  blocks             SchemaBlock[]\n  schemaAssignations SchemaAssignation[]\n}\n\nmodel SchemaBlock {\n  id                       Int       @id @default(autoincrement())\n  startMinutesFromMidnight Int\n  endMinutesFromMidnight   Int\n  blockType                BlockType @default(WORKING)\n  name                     String? // (e.g., \"Morning Blitz\", \"Afternoon Follow-ups\")\n  Schema                   Schema    @relation(fields: [schemaId], references: [id])\n  schemaId                 Int\n}\n\nmodel SchemaAssignation {\n  id        Int      @id @default(autoincrement())\n  company   Company  @relation(fields: [companyId], references: [id])\n  companyId Int\n  schema    Schema   @relation(fields: [schemaId], references: [id])\n  schemaId  Int\n  date      DateTime // day at which the goals are assigned \n\n  @@unique([companyId, date])\n}\n\n// --- PERFORMANCE DATA ---\n\nmodel Call {\n  id              Int       @id @default(autoincrement())\n  agent           Agent     @relation(fields: [agentId], references: [id])\n  agentId         Int\n  callee          Callee    @relation(fields: [calleeId], references: [id])\n  calleeId        Int\n  company         Company   @relation(fields: [companyId], references: [id])\n  companyId       Int\n  startAt         DateTime  @default(now())\n  endAt           DateTime?\n  durationSeconds Int       @default(0)\n  // isEffective       Boolean          @default(false)\n\n  events FunnelEvent[]\n\n  // \n  dayOfTheWeek WEEK_DAYS\n}\n\nmodel FunnelEvent {\n  id        Int       @id @default(autoincrement())\n  type      EventType\n  timestamp DateTime  @default(now())\n  call      Call      @relation(fields: [callId], references: [id])\n  callId    Int\n  agent     Agent     @relation(fields: [agentId], references: [id])\n  agentId   Int\n}\n\nmodel AgentState {\n  id              Int      @id @default(autoincrement())\n  agent           Agent    @relation(fields: [agentId], references: [id])\n  agentId         Int\n  timestamp       DateTime @default(now())\n  energyScore     Int // 1-10\n  focusScore      Int // 1-10\n  motivationScore Int // 1-10\n}\n\n// 1 agent to many agentLevel\n// updated weekly automatically could be AWS lambda updates (per batch of users), native pg-cron or AWS functions\n/**\n * Cool, finally, the current agentLevel depends on the next:\n * - 1 agent has many Call rows. A call has a  durationSeconds column.\n * - So, the level depends on: if total call duration of the week was more than X, then is level one, if was less than X but more than Y, is level 2, and if was less than Y, is level 3.\n * - So, by calculating this, the stored procedure should: if the state doesnt, changes, dont make anything. If changes, creates the new row, and update the till and durationInWeeks column of the previous latest row.\n */\nmodel AgentLevel {\n  id              Int       @id @default(autoincrement())\n  agent           Agent     @relation(fields: [agentId], references: [id])\n  agentId         Int\n  since           DateTime  @default(now())\n  till            DateTime?\n  durationInWeeks Int       @default(0) // everytime a new row for a user is created, we calculate this ones, then just SUM the values and calculate on-the-fly for the latest row\n  level           Int // 1 GOLD. 2 SILVER. 3 BRONZE \n\n  @@index([agentId, level])\n}\n\nmodel TemporalGoals {\n  id   Int    @id @default(autoincrement())\n  name String // i.e hard goals, newbies goals...\n\n  // Productivity Targets\n  talkTimeMinutes   Int      @default(0)\n  seeds             Int      @default(0)\n  callbacks         Int      @default(0)\n  leads             Int      @default(0)\n  sales             Int      @default(0)\n  numberOfCalls     Int      @default(0)\n  numberOfLongCalls Int      @default(0)\n  // Relations\n  company           Company  @relation(fields: [companyId], references: [id])\n  companyId         Int\n  creator           Manager  @relation(fields: [creatorId], references: [id])\n  creatorId         Int\n  createdAt         DateTime @default(now())\n  updatedAt         DateTime @updatedAt\n\n  goalsAssignation GoalsAssignation[]\n}\n\nmodel GoalsAssignation {\n  id        Int           @id @default(autoincrement())\n  company   Company       @relation(fields: [companyId], references: [id])\n  companyId Int\n  goal      TemporalGoals @relation(fields: [goalId], references: [id])\n  goalId    Int\n  date      DateTime // day at which the goals are assigned \n\n  @@unique([companyId, date])\n}\n",
	"runtimeDataModel": {
		"models": {},
		"enums": {},
		"types": {}
	},
	"parameterizationSchema": {
		"strings": [],
		"graph": ""
	}
};
config.runtimeDataModel = JSON.parse("{\"models\":{\"User\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"passwordHash\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"role\",\"kind\":\"enum\",\"type\":\"Role\"},{\"name\":\"isActive\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToUser\"},{\"name\":\"managerProfile\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"ManagerToUser\"},{\"name\":\"managerId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agentProfile\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToUser\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"UserStatus\"}],\"dbName\":null},\"Company\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"managers\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"CompanyToManager\"},{\"name\":\"agents\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToCompany\"},{\"name\":\"calls\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"CallToCompany\"},{\"name\":\"TimeSchemas\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"CompanyToSchema\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"CompanyToUser\"},{\"name\":\"temporalGoals\",\"kind\":\"object\",\"type\":\"TemporalGoals\",\"relationName\":\"CompanyToTemporalGoals\"},{\"name\":\"GoalsAssignation\",\"kind\":\"object\",\"type\":\"GoalsAssignation\",\"relationName\":\"CompanyToGoalsAssignation\"},{\"name\":\"schemaAssignation\",\"kind\":\"object\",\"type\":\"SchemaAssignation\",\"relationName\":\"CompanyToSchemaAssignation\"},{\"name\":\"apiKey\",\"kind\":\"object\",\"type\":\"APIKeysAuth\",\"relationName\":\"APIKeysAuthToCompany\"},{\"name\":\"leadDeskCustomData\",\"kind\":\"object\",\"type\":\"LeadDeskCustomData\",\"relationName\":\"CompanyToLeadDeskCustomData\"}],\"dbName\":null},\"APIKeysAuth\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"publicKey\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"secretKeyHash\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"APIKeysAuthToCompany\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"LeadDeskCustomData\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"authString\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"SeedEventIds\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"SaleEventIds\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"IANATimeZone\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToLeadDeskCustomData\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"Manager\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToManager\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"ManagerToUser\"},{\"name\":\"temporalGoals\",\"kind\":\"object\",\"type\":\"TemporalGoals\",\"relationName\":\"ManagerToTemporalGoals\"},{\"name\":\"schemas\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"ManagerToSchema\"}],\"dbName\":null},\"Agent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"AgentToCompany\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"calls\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"AgentToCall\"},{\"name\":\"feelings\",\"kind\":\"object\",\"type\":\"AgentState\",\"relationName\":\"AgentToAgentState\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"FunnelEvent\",\"relationName\":\"AgentToFunnelEvent\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"AgentToUser\"},{\"name\":\"totalAttempsPerCallee\",\"kind\":\"object\",\"type\":\"agentToCallee\",\"relationName\":\"AgentToagentToCallee\"},{\"name\":\"agentToThird\",\"kind\":\"object\",\"type\":\"AgentToThird\",\"relationName\":\"AgentToAgentToThird\"},{\"name\":\"agentLevel\",\"kind\":\"object\",\"type\":\"AgentLevel\",\"relationName\":\"AgentToAgentLevel\"},{\"name\":\"profileImg\",\"kind\":\"scalar\",\"type\":\"String\"}],\"dbName\":null},\"AgentToThird\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"serviceIdentifier\",\"kind\":\"enum\",\"type\":\"THIRD_PARTY_SERVICES\"},{\"name\":\"agentServiceIdentifier\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToAgentToThird\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"Callee\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"phoneNumber\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"totalAttempts\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"calls\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"CallToCallee\"},{\"name\":\"totalAttempsPerAgent\",\"kind\":\"object\",\"type\":\"agentToCallee\",\"relationName\":\"CalleeToagentToCallee\"}],\"dbName\":null},\"agentToCallee\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToagentToCallee\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"callee\",\"kind\":\"object\",\"type\":\"Callee\",\"relationName\":\"CalleeToagentToCallee\"},{\"name\":\"calleeId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"totalAttemps\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"Schema\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToSchema\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"creator\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"ManagerToSchema\"},{\"name\":\"creatorId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"blocks\",\"kind\":\"object\",\"type\":\"SchemaBlock\",\"relationName\":\"SchemaToSchemaBlock\"},{\"name\":\"schemaAssignations\",\"kind\":\"object\",\"type\":\"SchemaAssignation\",\"relationName\":\"SchemaToSchemaAssignation\"}],\"dbName\":null},\"SchemaBlock\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startMinutesFromMidnight\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"endMinutesFromMidnight\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"blockType\",\"kind\":\"enum\",\"type\":\"BlockType\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"Schema\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"SchemaToSchemaBlock\"},{\"name\":\"schemaId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"SchemaAssignation\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToSchemaAssignation\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"schema\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"SchemaToSchemaAssignation\"},{\"name\":\"schemaId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"Call\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToCall\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"callee\",\"kind\":\"object\",\"type\":\"Callee\",\"relationName\":\"CallToCallee\"},{\"name\":\"calleeId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CallToCompany\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"endAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"durationSeconds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"FunnelEvent\",\"relationName\":\"CallToFunnelEvent\"},{\"name\":\"dayOfTheWeek\",\"kind\":\"enum\",\"type\":\"WEEK_DAYS\"}],\"dbName\":null},\"FunnelEvent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"EventType\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"call\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"CallToFunnelEvent\"},{\"name\":\"callId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToFunnelEvent\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"AgentState\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToAgentState\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"energyScore\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"focusScore\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"motivationScore\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"AgentLevel\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToAgentLevel\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"since\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"till\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"durationInWeeks\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"level\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"TemporalGoals\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"talkTimeMinutes\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"seeds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"callbacks\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"leads\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"sales\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"numberOfCalls\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"numberOfLongCalls\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToTemporalGoals\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"creator\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"ManagerToTemporalGoals\"},{\"name\":\"creatorId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"goalsAssignation\",\"kind\":\"object\",\"type\":\"GoalsAssignation\",\"relationName\":\"GoalsAssignationToTemporalGoals\"}],\"dbName\":null},\"GoalsAssignation\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToGoalsAssignation\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"goal\",\"kind\":\"object\",\"type\":\"TemporalGoals\",\"relationName\":\"GoalsAssignationToTemporalGoals\"},{\"name\":\"goalId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null}},\"enums\":{},\"types\":{}}");
config.parameterizationSchema = {
	strings: JSON.parse("[\"where\",\"orderBy\",\"cursor\",\"company\",\"user\",\"creator\",\"goal\",\"goalsAssignation\",\"_count\",\"temporalGoals\",\"Schema\",\"blocks\",\"schema\",\"schemaAssignations\",\"schemas\",\"managers\",\"agent\",\"calls\",\"callee\",\"totalAttempsPerAgent\",\"call\",\"events\",\"feelings\",\"totalAttempsPerCallee\",\"agentToThird\",\"agentLevel\",\"agents\",\"TimeSchemas\",\"users\",\"GoalsAssignation\",\"schemaAssignation\",\"apiKey\",\"leadDeskCustomData\",\"managerProfile\",\"agentProfile\",\"User.findUnique\",\"User.findUniqueOrThrow\",\"User.findFirst\",\"User.findFirstOrThrow\",\"User.findMany\",\"data\",\"User.createOne\",\"User.createMany\",\"User.createManyAndReturn\",\"User.updateOne\",\"User.updateMany\",\"User.updateManyAndReturn\",\"create\",\"update\",\"User.upsertOne\",\"User.deleteOne\",\"User.deleteMany\",\"having\",\"_avg\",\"_sum\",\"_min\",\"_max\",\"User.groupBy\",\"User.aggregate\",\"Company.findUnique\",\"Company.findUniqueOrThrow\",\"Company.findFirst\",\"Company.findFirstOrThrow\",\"Company.findMany\",\"Company.createOne\",\"Company.createMany\",\"Company.createManyAndReturn\",\"Company.updateOne\",\"Company.updateMany\",\"Company.updateManyAndReturn\",\"Company.upsertOne\",\"Company.deleteOne\",\"Company.deleteMany\",\"Company.groupBy\",\"Company.aggregate\",\"APIKeysAuth.findUnique\",\"APIKeysAuth.findUniqueOrThrow\",\"APIKeysAuth.findFirst\",\"APIKeysAuth.findFirstOrThrow\",\"APIKeysAuth.findMany\",\"APIKeysAuth.createOne\",\"APIKeysAuth.createMany\",\"APIKeysAuth.createManyAndReturn\",\"APIKeysAuth.updateOne\",\"APIKeysAuth.updateMany\",\"APIKeysAuth.updateManyAndReturn\",\"APIKeysAuth.upsertOne\",\"APIKeysAuth.deleteOne\",\"APIKeysAuth.deleteMany\",\"APIKeysAuth.groupBy\",\"APIKeysAuth.aggregate\",\"LeadDeskCustomData.findUnique\",\"LeadDeskCustomData.findUniqueOrThrow\",\"LeadDeskCustomData.findFirst\",\"LeadDeskCustomData.findFirstOrThrow\",\"LeadDeskCustomData.findMany\",\"LeadDeskCustomData.createOne\",\"LeadDeskCustomData.createMany\",\"LeadDeskCustomData.createManyAndReturn\",\"LeadDeskCustomData.updateOne\",\"LeadDeskCustomData.updateMany\",\"LeadDeskCustomData.updateManyAndReturn\",\"LeadDeskCustomData.upsertOne\",\"LeadDeskCustomData.deleteOne\",\"LeadDeskCustomData.deleteMany\",\"LeadDeskCustomData.groupBy\",\"LeadDeskCustomData.aggregate\",\"Manager.findUnique\",\"Manager.findUniqueOrThrow\",\"Manager.findFirst\",\"Manager.findFirstOrThrow\",\"Manager.findMany\",\"Manager.createOne\",\"Manager.createMany\",\"Manager.createManyAndReturn\",\"Manager.updateOne\",\"Manager.updateMany\",\"Manager.updateManyAndReturn\",\"Manager.upsertOne\",\"Manager.deleteOne\",\"Manager.deleteMany\",\"Manager.groupBy\",\"Manager.aggregate\",\"Agent.findUnique\",\"Agent.findUniqueOrThrow\",\"Agent.findFirst\",\"Agent.findFirstOrThrow\",\"Agent.findMany\",\"Agent.createOne\",\"Agent.createMany\",\"Agent.createManyAndReturn\",\"Agent.updateOne\",\"Agent.updateMany\",\"Agent.updateManyAndReturn\",\"Agent.upsertOne\",\"Agent.deleteOne\",\"Agent.deleteMany\",\"Agent.groupBy\",\"Agent.aggregate\",\"AgentToThird.findUnique\",\"AgentToThird.findUniqueOrThrow\",\"AgentToThird.findFirst\",\"AgentToThird.findFirstOrThrow\",\"AgentToThird.findMany\",\"AgentToThird.createOne\",\"AgentToThird.createMany\",\"AgentToThird.createManyAndReturn\",\"AgentToThird.updateOne\",\"AgentToThird.updateMany\",\"AgentToThird.updateManyAndReturn\",\"AgentToThird.upsertOne\",\"AgentToThird.deleteOne\",\"AgentToThird.deleteMany\",\"AgentToThird.groupBy\",\"AgentToThird.aggregate\",\"Callee.findUnique\",\"Callee.findUniqueOrThrow\",\"Callee.findFirst\",\"Callee.findFirstOrThrow\",\"Callee.findMany\",\"Callee.createOne\",\"Callee.createMany\",\"Callee.createManyAndReturn\",\"Callee.updateOne\",\"Callee.updateMany\",\"Callee.updateManyAndReturn\",\"Callee.upsertOne\",\"Callee.deleteOne\",\"Callee.deleteMany\",\"Callee.groupBy\",\"Callee.aggregate\",\"agentToCallee.findUnique\",\"agentToCallee.findUniqueOrThrow\",\"agentToCallee.findFirst\",\"agentToCallee.findFirstOrThrow\",\"agentToCallee.findMany\",\"agentToCallee.createOne\",\"agentToCallee.createMany\",\"agentToCallee.createManyAndReturn\",\"agentToCallee.updateOne\",\"agentToCallee.updateMany\",\"agentToCallee.updateManyAndReturn\",\"agentToCallee.upsertOne\",\"agentToCallee.deleteOne\",\"agentToCallee.deleteMany\",\"agentToCallee.groupBy\",\"agentToCallee.aggregate\",\"Schema.findUnique\",\"Schema.findUniqueOrThrow\",\"Schema.findFirst\",\"Schema.findFirstOrThrow\",\"Schema.findMany\",\"Schema.createOne\",\"Schema.createMany\",\"Schema.createManyAndReturn\",\"Schema.updateOne\",\"Schema.updateMany\",\"Schema.updateManyAndReturn\",\"Schema.upsertOne\",\"Schema.deleteOne\",\"Schema.deleteMany\",\"Schema.groupBy\",\"Schema.aggregate\",\"SchemaBlock.findUnique\",\"SchemaBlock.findUniqueOrThrow\",\"SchemaBlock.findFirst\",\"SchemaBlock.findFirstOrThrow\",\"SchemaBlock.findMany\",\"SchemaBlock.createOne\",\"SchemaBlock.createMany\",\"SchemaBlock.createManyAndReturn\",\"SchemaBlock.updateOne\",\"SchemaBlock.updateMany\",\"SchemaBlock.updateManyAndReturn\",\"SchemaBlock.upsertOne\",\"SchemaBlock.deleteOne\",\"SchemaBlock.deleteMany\",\"SchemaBlock.groupBy\",\"SchemaBlock.aggregate\",\"SchemaAssignation.findUnique\",\"SchemaAssignation.findUniqueOrThrow\",\"SchemaAssignation.findFirst\",\"SchemaAssignation.findFirstOrThrow\",\"SchemaAssignation.findMany\",\"SchemaAssignation.createOne\",\"SchemaAssignation.createMany\",\"SchemaAssignation.createManyAndReturn\",\"SchemaAssignation.updateOne\",\"SchemaAssignation.updateMany\",\"SchemaAssignation.updateManyAndReturn\",\"SchemaAssignation.upsertOne\",\"SchemaAssignation.deleteOne\",\"SchemaAssignation.deleteMany\",\"SchemaAssignation.groupBy\",\"SchemaAssignation.aggregate\",\"Call.findUnique\",\"Call.findUniqueOrThrow\",\"Call.findFirst\",\"Call.findFirstOrThrow\",\"Call.findMany\",\"Call.createOne\",\"Call.createMany\",\"Call.createManyAndReturn\",\"Call.updateOne\",\"Call.updateMany\",\"Call.updateManyAndReturn\",\"Call.upsertOne\",\"Call.deleteOne\",\"Call.deleteMany\",\"Call.groupBy\",\"Call.aggregate\",\"FunnelEvent.findUnique\",\"FunnelEvent.findUniqueOrThrow\",\"FunnelEvent.findFirst\",\"FunnelEvent.findFirstOrThrow\",\"FunnelEvent.findMany\",\"FunnelEvent.createOne\",\"FunnelEvent.createMany\",\"FunnelEvent.createManyAndReturn\",\"FunnelEvent.updateOne\",\"FunnelEvent.updateMany\",\"FunnelEvent.updateManyAndReturn\",\"FunnelEvent.upsertOne\",\"FunnelEvent.deleteOne\",\"FunnelEvent.deleteMany\",\"FunnelEvent.groupBy\",\"FunnelEvent.aggregate\",\"AgentState.findUnique\",\"AgentState.findUniqueOrThrow\",\"AgentState.findFirst\",\"AgentState.findFirstOrThrow\",\"AgentState.findMany\",\"AgentState.createOne\",\"AgentState.createMany\",\"AgentState.createManyAndReturn\",\"AgentState.updateOne\",\"AgentState.updateMany\",\"AgentState.updateManyAndReturn\",\"AgentState.upsertOne\",\"AgentState.deleteOne\",\"AgentState.deleteMany\",\"AgentState.groupBy\",\"AgentState.aggregate\",\"AgentLevel.findUnique\",\"AgentLevel.findUniqueOrThrow\",\"AgentLevel.findFirst\",\"AgentLevel.findFirstOrThrow\",\"AgentLevel.findMany\",\"AgentLevel.createOne\",\"AgentLevel.createMany\",\"AgentLevel.createManyAndReturn\",\"AgentLevel.updateOne\",\"AgentLevel.updateMany\",\"AgentLevel.updateManyAndReturn\",\"AgentLevel.upsertOne\",\"AgentLevel.deleteOne\",\"AgentLevel.deleteMany\",\"AgentLevel.groupBy\",\"AgentLevel.aggregate\",\"TemporalGoals.findUnique\",\"TemporalGoals.findUniqueOrThrow\",\"TemporalGoals.findFirst\",\"TemporalGoals.findFirstOrThrow\",\"TemporalGoals.findMany\",\"TemporalGoals.createOne\",\"TemporalGoals.createMany\",\"TemporalGoals.createManyAndReturn\",\"TemporalGoals.updateOne\",\"TemporalGoals.updateMany\",\"TemporalGoals.updateManyAndReturn\",\"TemporalGoals.upsertOne\",\"TemporalGoals.deleteOne\",\"TemporalGoals.deleteMany\",\"TemporalGoals.groupBy\",\"TemporalGoals.aggregate\",\"GoalsAssignation.findUnique\",\"GoalsAssignation.findUniqueOrThrow\",\"GoalsAssignation.findFirst\",\"GoalsAssignation.findFirstOrThrow\",\"GoalsAssignation.findMany\",\"GoalsAssignation.createOne\",\"GoalsAssignation.createMany\",\"GoalsAssignation.createManyAndReturn\",\"GoalsAssignation.updateOne\",\"GoalsAssignation.updateMany\",\"GoalsAssignation.updateManyAndReturn\",\"GoalsAssignation.upsertOne\",\"GoalsAssignation.deleteOne\",\"GoalsAssignation.deleteMany\",\"GoalsAssignation.groupBy\",\"GoalsAssignation.aggregate\",\"AND\",\"OR\",\"NOT\",\"id\",\"companyId\",\"goalId\",\"date\",\"equals\",\"in\",\"notIn\",\"lt\",\"lte\",\"gt\",\"gte\",\"not\",\"name\",\"talkTimeMinutes\",\"seeds\",\"callbacks\",\"leads\",\"sales\",\"numberOfCalls\",\"numberOfLongCalls\",\"creatorId\",\"createdAt\",\"updatedAt\",\"contains\",\"startsWith\",\"endsWith\",\"agentId\",\"since\",\"till\",\"durationInWeeks\",\"level\",\"timestamp\",\"energyScore\",\"focusScore\",\"motivationScore\",\"EventType\",\"type\",\"callId\",\"calleeId\",\"startAt\",\"endAt\",\"durationSeconds\",\"WEEK_DAYS\",\"dayOfTheWeek\",\"schemaId\",\"startMinutesFromMidnight\",\"endMinutesFromMidnight\",\"BlockType\",\"blockType\",\"totalAttemps\",\"phoneNumber\",\"totalAttempts\",\"every\",\"some\",\"none\",\"THIRD_PARTY_SERVICES\",\"serviceIdentifier\",\"agentServiceIdentifier\",\"profileImg\",\"email\",\"authString\",\"SeedEventIds\",\"SaleEventIds\",\"IANATimeZone\",\"has\",\"hasEvery\",\"hasSome\",\"publicKey\",\"secretKeyHash\",\"passwordHash\",\"Role\",\"role\",\"isActive\",\"managerId\",\"UserStatus\",\"status\",\"agentId_serviceIdentifier\",\"serviceIdentifier_agentServiceIdentifier\",\"agentId_calleeId\",\"companyId_date\",\"is\",\"isNot\",\"connectOrCreate\",\"upsert\",\"createMany\",\"set\",\"disconnect\",\"delete\",\"connect\",\"updateMany\",\"deleteMany\",\"push\",\"increment\",\"decrement\",\"multiply\",\"divide\"]"),
	graph: "-gm8AaACEQMAAK0EACAhAADwBAAgIgAA8QQAIMsCAADrBAAwzAIAAAcAEM0CAADrBAAwzgICAAAAAc8CAgCfBAAh4wJAALAEACHkAkAAsAQAIegCAgAAAAGJAwEAAAABkwMBAKAEACGVAwAA7ASVAyKWAyAA7QQAIZcDAgAAAAGZAwAA7wSZAyIBAAAAAQAgCwMAAK0EACAEAADcBAAgCQAAtwQAIA4AALUEACDLAgAA8gQAMMwCAAADABDNAgAA8gQAMM4CAgCfBAAhzwICAJ8EACHaAgEAoAQAIYkDAQCgBAAhBAMAAM0HACAEAADdCAAgCQAAzQgAIA4AAMsIACALAwAArQQAIAQAANwEACAJAAC3BAAgDgAAtQQAIMsCAADyBAAwzAIAAAMAEM0CAADyBAAwzgICAAAAAc8CAgCfBAAh2gIBAKAEACGJAwEAAAABAwAAAAMAIAEAAAQAMAIAAAUAIBEDAACtBAAgIQAA8AQAICIAAPEEACDLAgAA6wQAMMwCAAAHABDNAgAA6wQAMM4CAgCfBAAhzwICAJ8EACHjAkAAsAQAIeQCQACwBAAh6AICAO4EACGJAwEAoAQAIZMDAQCgBAAhlQMAAOwElQMilgMgAO0EACGXAwIA7gQAIZkDAADvBJkDIgEAAAAHACATAwAArQQAIAUAAOUEACAHAAC4BAAgywIAAOoEADDMAgAACQAQzQIAAOoEADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACHbAgIAnwQAIdwCAgCfBAAh3QICAJ8EACHeAgIAnwQAId8CAgCfBAAh4AICAJ8EACHhAgIAnwQAIeICAgCfBAAh4wJAALAEACHkAkAAsAQAIQMDAADNBwAgBQAA1wgAIAcAAM4IACATAwAArQQAIAUAAOUEACAHAAC4BAAgywIAAOoEADDMAgAACQAQzQIAAOoEADDOAgIAAAABzwICAJ8EACHaAgEAoAQAIdsCAgCfBAAh3AICAJ8EACHdAgIAnwQAId4CAgCfBAAh3wICAJ8EACHgAgIAnwQAIeECAgCfBAAh4gICAJ8EACHjAkAAsAQAIeQCQACwBAAhAwAAAAkAIAEAAAoAMAIAAAsAIAkDAACtBAAgBgAA6QQAIMsCAADoBAAwzAIAAA0AEM0CAADoBAAwzgICAJ8EACHPAgIAnwQAIdACAgCfBAAh0QJAALAEACECAwAAzQcAIAYAAOIIACAKAwAArQQAIAYAAOkEACDLAgAA6AQAMMwCAAANABDNAgAA6AQAMM4CAgAAAAHPAgIAnwQAIdACAgCfBAAh0QJAALAEACGdAwAA5wQAIAMAAAANACABAAAOADACAAAPACABAAAADQAgCwMAAK0EACAFAADlBAAgCwAA5gQAIA0AALkEACDLAgAA5AQAMMwCAAASABDNAgAA5AQAMM4CAgCfBAAhzwICAJ8EACHaAgEAoAQAIeICAgCfBAAhBAMAAM0HACAFAADXCAAgCwAA4QgAIA0AAM8IACALAwAArQQAIAUAAOUEACALAADmBAAgDQAAuQQAIMsCAADkBAAwzAIAABIAEM0CAADkBAAwzgICAAAAAc8CAgCfBAAh2gIBAKAEACHiAgIAnwQAIQMAAAASACABAAATADACAAAUACAKCgAA4QQAIMsCAADiBAAwzAIAABYAEM0CAADiBAAwzgICAJ8EACHaAgEArAQAIfoCAgCfBAAh-wICAJ8EACH8AgIAnwQAIf4CAADjBP4CIgIKAADgCAAg2gIAAJYFACAKCgAA4QQAIMsCAADiBAAwzAIAABYAEM0CAADiBAAwzgICAAAAAdoCAQCsBAAh-gICAJ8EACH7AgIAnwQAIfwCAgCfBAAh_gIAAOME_gIiAwAAABYAIAEAABcAMAIAABgAIAkDAACtBAAgDAAA4QQAIMsCAADgBAAwzAIAABoAEM0CAADgBAAwzgICAJ8EACHPAgIAnwQAIdECQACwBAAh-gICAJ8EACECAwAAzQcAIAwAAOAIACAKAwAArQQAIAwAAOEEACDLAgAA4AQAMMwCAAAaABDNAgAA4AQAMM4CAgAAAAHPAgIAnwQAIdECQACwBAAh-gICAJ8EACGdAwAA3wQAIAMAAAAaACABAAAbADACAAAcACABAAAAFgAgAQAAABoAIAEAAAAJACABAAAAEgAgDwMAAK0EACAEAADcBAAgEQAAoQQAIBUAANkEACAWAADbBAAgFwAAogQAIBgAAN0EACAZAADeBAAgywIAANoEADDMAgAAIgAQzQIAANoEADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACGIAwEArAQAIQkDAADNBwAgBAAA3QgAIBEAAKsGACAVAADbCAAgFgAA3AgAIBcAAKwGACAYAADeCAAgGQAA3wgAIIgDAACWBQAgDwMAAK0EACAEAADcBAAgEQAAoQQAIBUAANkEACAWAADbBAAgFwAAogQAIBgAAN0EACAZAADeBAAgywIAANoEADDMAgAAIgAQzQIAANoEADDOAgIAAAABzwICAJ8EACHaAgEAoAQAIYgDAQCsBAAhAwAAACIAIAEAACMAMAIAACQAIA8DAACtBAAgEAAAywQAIBIAANYEACAVAADZBAAgywIAANcEADDMAgAAJgAQzQIAANcEADDOAgIAnwQAIc8CAgCfBAAh6AICAJ8EACH0AgIAnwQAIfUCQACwBAAh9gJAAMoEACH3AgIAnwQAIfkCAADYBPkCIgUDAADNBwAgEAAA2AgAIBIAANoIACAVAADbCAAg9gIAAJYFACAPAwAArQQAIBAAAMsEACASAADWBAAgFQAA2QQAIMsCAADXBAAwzAIAACYAEM0CAADXBAAwzgICAAAAAc8CAgCfBAAh6AICAJ8EACH0AgIAnwQAIfUCQACwBAAh9gJAAMoEACH3AgIAnwQAIfkCAADYBPkCIgMAAAAmACABAAAnADACAAAoACADAAAAJgAgAQAAJwAwAgAAKAAgCRAAAMsEACASAADWBAAgywIAANUEADDMAgAAKwAQzQIAANUEADDOAgIAnwQAIegCAgCfBAAh9AICAJ8EACH_AgIAnwQAIQIQAADYCAAgEgAA2ggAIAoQAADLBAAgEgAA1gQAIMsCAADVBAAwzAIAACsAEM0CAADVBAAwzgICAAAAAegCAgCfBAAh9AICAJ8EACH_AgIAnwQAIZwDAADUBAAgAwAAACsAIAEAACwAMAIAAC0AIAEAAAAmACABAAAAKwAgChAAAMsEACAUAADTBAAgywIAANEEADDMAgAAMQAQzQIAANEEADDOAgIAnwQAIegCAgCfBAAh7QJAALAEACHyAgAA0gTyAiLzAgIAnwQAIQIQAADYCAAgFAAA2QgAIAoQAADLBAAgFAAA0wQAIMsCAADRBAAwzAIAADEAEM0CAADRBAAwzgICAAAAAegCAgCfBAAh7QJAALAEACHyAgAA0gTyAiLzAgIAnwQAIQMAAAAxACABAAAyADACAAAzACABAAAAMQAgChAAAMsEACDLAgAA0AQAMMwCAAA2ABDNAgAA0AQAMM4CAgCfBAAh6AICAJ8EACHtAkAAsAQAIe4CAgCfBAAh7wICAJ8EACHwAgIAnwQAIQEQAADYCAAgChAAAMsEACDLAgAA0AQAMMwCAAA2ABDNAgAA0AQAMM4CAgAAAAHoAgIAnwQAIe0CQACwBAAh7gICAJ8EACHvAgIAnwQAIfACAgCfBAAhAwAAADYAIAEAADcAMAIAADgAIAMAAAAxACABAAAyADACAAAzACABAAAABwAgAwAAACsAIAEAACwAMAIAAC0AIAgQAADLBAAgywIAAM4EADDMAgAAPQAQzQIAAM4EADDOAgIAnwQAIegCAgCfBAAhhgMAAM8EhgMihwMBAKAEACEBEAAA2AgAIAoQAADLBAAgywIAAM4EADDMAgAAPQAQzQIAAM4EADDOAgIAAAAB6AICAJ8EACGGAwAAzwSGAyKHAwEAoAQAIZoDAADMBAAgmwMAAM0EACADAAAAPQAgAQAAPgAwAgAAPwAgChAAAMsEACDLAgAAyQQAMMwCAABBABDNAgAAyQQAMM4CAgCfBAAh6AICAJ8EACHpAkAAsAQAIeoCQADKBAAh6wICAJ8EACHsAgIAnwQAIQIQAADYCAAg6gIAAJYFACAKEAAAywQAIMsCAADJBAAwzAIAAEEAEM0CAADJBAAwzgICAAAAAegCAgCfBAAh6QJAALAEACHqAkAAygQAIesCAgCfBAAh7AICAJ8EACEDAAAAQQAgAQAAQgAwAgAAQwAgAQAAACYAIAEAAAA2ACABAAAAMQAgAQAAACsAIAEAAAA9ACABAAAAQQAgAwAAACYAIAEAACcAMAIAACgAIAMAAAASACABAAATADACAAAUACAFAwAAzQcAICEAANcIACAiAADYCAAg6AIAAJYFACCXAwAAlgUAIAMAAAAHACABAABNADACAAABACADAAAACQAgAQAACgAwAgAACwAgAwAAAA0AIAEAAA4AMAIAAA8AIAMAAAAaACABAAAbADACAAAcACAKAwAArQQAIMsCAACvBAAwzAIAAFIAEM0CAACvBAAwzgICAJ8EACHPAgIAnwQAIeMCQACwBAAh5AJAALAEACGRAwEAoAQAIZIDAQCgBAAhAQAAAFIAIAoDAACtBAAgywIAAKsEADDMAgAAVAAQzQIAAKsEADDOAgIAnwQAIc8CAgCfBAAhigMBAKwEACGLAwAAqgQAIIwDAACqBAAgjQMBAKAEACEBAAAAVAAgAQAAAAMAIAEAAAAiACABAAAAJgAgAQAAABIAIAEAAAAHACABAAAACQAgAQAAAA0AIAEAAAAaACABAAAAAwAgAQAAACIAIAEAAAABACADAAAABwAgAQAATQAwAgAAAQAgAwAAAAcAIAEAAE0AMAIAAAEAIAMAAAAHACABAABNADACAAABACAOAwAA7gYAICEAAO8GACAiAAC9BwAgzgICAAAAAc8CAgAAAAHjAkAAAAAB5AJAAAAAAegCAgAAAAGJAwEAAAABkwMBAAAAAZUDAAAAlQMClgMgAAAAAZcDAgAAAAGZAwAAAJkDAgEoAABkACALzgICAAAAAc8CAgAAAAHjAkAAAAAB5AJAAAAAAegCAgAAAAGJAwEAAAABkwMBAAAAAZUDAAAAlQMClgMgAAAAAZcDAgAAAAGZAwAAAJkDAgEoAABmADABKAAAZgAwAQAAAAMAIAEAAAAiACAOAwAA6wYAICEAAOwGACAiAAC8BwAgzgICAPkEACHPAgIA-QQAIeMCQAD4BAAh5AJAAPgEACHoAgIA7QYAIYkDAQCDBQAhkwMBAIMFACGVAwAA6AaVAyKWAyAA6QYAIZcDAgDtBgAhmQMAAOoGmQMiAgAAAAEAICgAAGsAIAvOAgIA-QQAIc8CAgD5BAAh4wJAAPgEACHkAkAA-AQAIegCAgDtBgAhiQMBAIMFACGTAwEAgwUAIZUDAADoBpUDIpYDIADpBgAhlwMCAO0GACGZAwAA6gaZAyICAAAABwAgKAAAbQAgAgAAAAcAICgAAG0AIAEAAAADACABAAAAIgAgAwAAAAEAIC8AAGQAIDAAAGsAIAEAAAABACABAAAABwAgBwgAANIIACA1AADTCAAgNgAA1ggAIDcAANUIACA4AADUCAAg6AIAAJYFACCXAwAAlgUAIA7LAgAAvAQAMMwCAAB2ABDNAgAAvAQAMM4CAgD6AwAhzwICAPoDACHjAkAA-wMAIeQCQAD7AwAh6AICAL8EACGJAwEAggQAIZMDAQCCBAAhlQMAAL0ElQMilgMgAL4EACGXAwIAvwQAIZkDAADABJkDIgMAAAAHACABAAB1ADA0AAB2ACADAAAABwAgAQAATQAwAgAAAQAgEAkAALcEACAPAACzBAAgEQAAoQQAIBoAALQEACAbAAC1BAAgHAAAtgQAIB0AALgEACAeAAC5BAAgHwAAugQAICAAALsEACDLAgAAsgQAMMwCAAB8ABDNAgAAsgQAMM4CAgAAAAHaAgEAoAQAIeMCQACwBAAhAQAAAHkAIAEAAAB5ACAQCQAAtwQAIA8AALMEACARAAChBAAgGgAAtAQAIBsAALUEACAcAAC2BAAgHQAAuAQAIB4AALkEACAfAAC6BAAgIAAAuwQAIMsCAACyBAAwzAIAAHwAEM0CAACyBAAwzgICAJ8EACHaAgEAoAQAIeMCQACwBAAhCgkAAM0IACAPAADJCAAgEQAAqwYAIBoAAMoIACAbAADLCAAgHAAAzAgAIB0AAM4IACAeAADPCAAgHwAA0AgAICAAANEIACADAAAAfAAgAQAAfQAwAgAAeQAgAwAAAHwAIAEAAH0AMAIAAHkAIAMAAAB8ACABAAB9ADACAAB5ACANCQAAxAgAIA8AAL8IACARAADBCAAgGgAAwAgAIBsAAMIIACAcAADDCAAgHQAAxQgAIB4AAMYIACAfAADHCAAgIAAAyAgAIM4CAgAAAAHaAgEAAAAB4wJAAAAAAQEoAACBAQAgA84CAgAAAAHaAgEAAAAB4wJAAAAAAQEoAACDAQAwASgAAIMBADANCQAA3wcAIA8AANoHACARAADcBwAgGgAA2wcAIBsAAN0HACAcAADeBwAgHQAA4AcAIB4AAOEHACAfAADiBwAgIAAA4wcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQIAAAB5ACAoAACGAQAgA84CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQIAAAB8ACAoAACIAQAgAgAAAHwAICgAAIgBACADAAAAeQAgLwAAgQEAIDAAAIYBACABAAAAeQAgAQAAAHwAIAUIAADVBwAgNQAA1gcAIDYAANkHACA3AADYBwAgOAAA1wcAIAbLAgAAsQQAMMwCAACPAQAQzQIAALEEADDOAgIA-gMAIdoCAQCCBAAh4wJAAPsDACEDAAAAfAAgAQAAjgEAMDQAAI8BACADAAAAfAAgAQAAfQAwAgAAeQAgCgMAAK0EACDLAgAArwQAMMwCAABSABDNAgAArwQAMM4CAgAAAAHPAgIAAAAB4wJAALAEACHkAkAAsAQAIZEDAQAAAAGSAwEAAAABAQAAAJIBACABAAAAkgEAIAEDAADNBwAgAwAAAFIAIAEAAJUBADACAACSAQAgAwAAAFIAIAEAAJUBADACAACSAQAgAwAAAFIAIAEAAJUBADACAACSAQAgBwMAANQHACDOAgIAAAABzwICAAAAAeMCQAAAAAHkAkAAAAABkQMBAAAAAZIDAQAAAAEBKAAAmQEAIAbOAgIAAAABzwICAAAAAeMCQAAAAAHkAkAAAAABkQMBAAAAAZIDAQAAAAEBKAAAmwEAMAEoAACbAQAwBwMAANMHACDOAgIA-QQAIc8CAgD5BAAh4wJAAPgEACHkAkAA-AQAIZEDAQCDBQAhkgMBAIMFACECAAAAkgEAICgAAJ4BACAGzgICAPkEACHPAgIA-QQAIeMCQAD4BAAh5AJAAPgEACGRAwEAgwUAIZIDAQCDBQAhAgAAAFIAICgAAKABACACAAAAUgAgKAAAoAEAIAMAAACSAQAgLwAAmQEAIDAAAJ4BACABAAAAkgEAIAEAAABSACAFCAAAzgcAIDUAAM8HACA2AADSBwAgNwAA0QcAIDgAANAHACAJywIAAK4EADDMAgAApwEAEM0CAACuBAAwzgICAPoDACHPAgIA-gMAIeMCQAD7AwAh5AJAAPsDACGRAwEAggQAIZIDAQCCBAAhAwAAAFIAIAEAAKYBADA0AACnAQAgAwAAAFIAIAEAAJUBADACAACSAQAgCgMAAK0EACDLAgAAqwQAMMwCAABUABDNAgAAqwQAMM4CAgAAAAHPAgIAAAABigMBAKwEACGLAwAAqgQAIIwDAACqBAAgjQMBAKAEACEBAAAAqgEAIAEAAACqAQAgAgMAAM0HACCKAwAAlgUAIAMAAABUACABAACtAQAwAgAAqgEAIAMAAABUACABAACtAQAwAgAAqgEAIAMAAABUACABAACtAQAwAgAAqgEAIAcDAADMBwAgzgICAAAAAc8CAgAAAAGKAwEAAAABiwMAAMoHACCMAwAAywcAII0DAQAAAAEBKAAAsQEAIAbOAgIAAAABzwICAAAAAYoDAQAAAAGLAwAAygcAIIwDAADLBwAgjQMBAAAAAQEoAACzAQAwASgAALMBADAHAwAAyQcAIM4CAgD5BAAhzwICAPkEACGKAwEA2QUAIYsDAADHBwAgjAMAAMgHACCNAwEAgwUAIQIAAACqAQAgKAAAtgEAIAbOAgIA-QQAIc8CAgD5BAAhigMBANkFACGLAwAAxwcAIIwDAADIBwAgjQMBAIMFACECAAAAVAAgKAAAuAEAIAIAAABUACAoAAC4AQAgAwAAAKoBACAvAACxAQAgMAAAtgEAIAEAAACqAQAgAQAAAFQAIAYIAADCBwAgNQAAwwcAIDYAAMYHACA3AADFBwAgOAAAxAcAIIoDAACWBQAgCcsCAACpBAAwzAIAAL8BABDNAgAAqQQAMM4CAgD6AwAhzwICAPoDACGKAwEAlgQAIYsDAACqBAAgjAMAAKoEACCNAwEAggQAIQMAAABUACABAAC-AQAwNAAAvwEAIAMAAABUACABAACtAQAwAgAAqgEAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgCAMAAL4HACAEAAC_BwAgCQAAwAcAIA4AAMEHACDOAgIAAAABzwICAAAAAdoCAQAAAAGJAwEAAAABASgAAMcBACAEzgICAAAAAc8CAgAAAAHaAgEAAAABiQMBAAAAAQEoAADJAQAwASgAAMkBADAIAwAAmwcAIAQAAJwHACAJAACdBwAgDgAAngcAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYkDAQCDBQAhAgAAAAUAICgAAMwBACAEzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiQMBAIMFACECAAAAAwAgKAAAzgEAIAIAAAADACAoAADOAQAgAwAAAAUAIC8AAMcBACAwAADMAQAgAQAAAAUAIAEAAAADACAFCAAAlgcAIDUAAJcHACA2AACaBwAgNwAAmQcAIDgAAJgHACAHywIAAKgEADDMAgAA1QEAEM0CAACoBAAwzgICAPoDACHPAgIA-gMAIdoCAQCCBAAhiQMBAIIEACEDAAAAAwAgAQAA1AEAMDQAANUBACADAAAAAwAgAQAABAAwAgAABQAgAQAAACQAIAEAAAAkACADAAAAIgAgAQAAIwAwAgAAJAAgAwAAACIAIAEAACMAMAIAACQAIAMAAAAiACABAAAjADACAAAkACAMAwAAjgcAIAQAAJIHACARAACPBwAgFQAAkQcAIBYAAJAHACAXAACTBwAgGAAAlAcAIBkAAJUHACDOAgIAAAABzwICAAAAAdoCAQAAAAGIAwEAAAABASgAAN0BACAEzgICAAAAAc8CAgAAAAHaAgEAAAABiAMBAAAAAQEoAADfAQAwASgAAN8BADAMAwAAugYAIAQAAL4GACARAAC7BgAgFQAAvQYAIBYAALwGACAXAAC_BgAgGAAAwAYAIBkAAMEGACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGIAwEA2QUAIQIAAAAkACAoAADiAQAgBM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhAgAAACIAICgAAOQBACACAAAAIgAgKAAA5AEAIAMAAAAkACAvAADdAQAgMAAA4gEAIAEAAAAkACABAAAAIgAgBggAALUGACA1AAC2BgAgNgAAuQYAIDcAALgGACA4AAC3BgAgiAMAAJYFACAHywIAAKcEADDMAgAA6wEAEM0CAACnBAAwzgICAPoDACHPAgIA-gMAIdoCAQCCBAAhiAMBAJYEACEDAAAAIgAgAQAA6gEAMDQAAOsBACADAAAAIgAgAQAAIwAwAgAAJAAgAQAAAD8AIAEAAAA_ACADAAAAPQAgAQAAPgAwAgAAPwAgAwAAAD0AIAEAAD4AMAIAAD8AIAMAAAA9ACABAAA-ADACAAA_ACAFEAAAtAYAIM4CAgAAAAHoAgIAAAABhgMAAACGAwKHAwEAAAABASgAAPMBACAEzgICAAAAAegCAgAAAAGGAwAAAIYDAocDAQAAAAEBKAAA9QEAMAEoAAD1AQAwBRAAALMGACDOAgIA-QQAIegCAgD5BAAhhgMAALIGhgMihwMBAIMFACECAAAAPwAgKAAA-AEAIATOAgIA-QQAIegCAgD5BAAhhgMAALIGhgMihwMBAIMFACECAAAAPQAgKAAA-gEAIAIAAAA9ACAoAAD6AQAgAwAAAD8AIC8AAPMBACAwAAD4AQAgAQAAAD8AIAEAAAA9ACAFCAAArQYAIDUAAK4GACA2AACxBgAgNwAAsAYAIDgAAK8GACAHywIAAKMEADDMAgAAgQIAEM0CAACjBAAwzgICAPoDACHoAgIA-gMAIYYDAACkBIYDIocDAQCCBAAhAwAAAD0AIAEAAIACADA0AACBAgAgAwAAAD0AIAEAAD4AMAIAAD8AIAgRAAChBAAgEwAAogQAIMsCAACeBAAwzAIAAIcCABDNAgAAngQAMM4CAgAAAAGAAwEAAAABgQMCAJ8EACEBAAAAhAIAIAEAAACEAgAgCBEAAKEEACATAACiBAAgywIAAJ4EADDMAgAAhwIAEM0CAACeBAAwzgICAJ8EACGAAwEAoAQAIYEDAgCfBAAhAhEAAKsGACATAACsBgAgAwAAAIcCACABAACIAgAwAgAAhAIAIAMAAACHAgAgAQAAiAIAMAIAAIQCACADAAAAhwIAIAEAAIgCADACAACEAgAgBREAAKkGACATAACqBgAgzgICAAAAAYADAQAAAAGBAwIAAAABASgAAIwCACADzgICAAAAAYADAQAAAAGBAwIAAAABASgAAI4CADABKAAAjgIAMAURAACPBgAgEwAAkAYAIM4CAgD5BAAhgAMBAIMFACGBAwIA-QQAIQIAAACEAgAgKAAAkQIAIAPOAgIA-QQAIYADAQCDBQAhgQMCAPkEACECAAAAhwIAICgAAJMCACACAAAAhwIAICgAAJMCACADAAAAhAIAIC8AAIwCACAwAACRAgAgAQAAAIQCACABAAAAhwIAIAUIAACKBgAgNQAAiwYAIDYAAI4GACA3AACNBgAgOAAAjAYAIAbLAgAAnQQAMMwCAACaAgAQzQIAAJ0EADDOAgIA-gMAIYADAQCCBAAhgQMCAPoDACEDAAAAhwIAIAEAAJkCADA0AACaAgAgAwAAAIcCACABAACIAgAwAgAAhAIAIAEAAAAtACABAAAALQAgAwAAACsAIAEAACwAMAIAAC0AIAMAAAArACABAAAsADACAAAtACADAAAAKwAgAQAALAAwAgAALQAgBhAAAIgGACASAACJBgAgzgICAAAAAegCAgAAAAH0AgIAAAAB_wICAAAAAQEoAACiAgAgBM4CAgAAAAHoAgIAAAAB9AICAAAAAf8CAgAAAAEBKAAApAIAMAEoAACkAgAwBhAAAIYGACASAACHBgAgzgICAPkEACHoAgIA-QQAIfQCAgD5BAAh_wICAPkEACECAAAALQAgKAAApwIAIATOAgIA-QQAIegCAgD5BAAh9AICAPkEACH_AgIA-QQAIQIAAAArACAoAACpAgAgAgAAACsAICgAAKkCACADAAAALQAgLwAAogIAIDAAAKcCACABAAAALQAgAQAAACsAIAUIAACBBgAgNQAAggYAIDYAAIUGACA3AACEBgAgOAAAgwYAIAfLAgAAnAQAMMwCAACwAgAQzQIAAJwEADDOAgIA-gMAIegCAgD6AwAh9AICAPoDACH_AgIA-gMAIQMAAAArACABAACvAgAwNAAAsAIAIAMAAAArACABAAAsADACAAAtACABAAAAFAAgAQAAABQAIAMAAAASACABAAATADACAAAUACADAAAAEgAgAQAAEwAwAgAAFAAgAwAAABIAIAEAABMAMAIAABQAIAgDAAD9BQAgBQAA_gUAIAsAAP8FACANAACABgAgzgICAAAAAc8CAgAAAAHaAgEAAAAB4gICAAAAAQEoAAC4AgAgBM4CAgAAAAHPAgIAAAAB2gIBAAAAAeICAgAAAAEBKAAAugIAMAEoAAC6AgAwCAMAAOEFACAFAADiBQAgCwAA4wUAIA0AAOQFACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACHiAgIA-QQAIQIAAAAUACAoAAC9AgAgBM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIeICAgD5BAAhAgAAABIAICgAAL8CACACAAAAEgAgKAAAvwIAIAMAAAAUACAvAAC4AgAgMAAAvQIAIAEAAAAUACABAAAAEgAgBQgAANwFACA1AADdBQAgNgAA4AUAIDcAAN8FACA4AADeBQAgB8sCAACbBAAwzAIAAMYCABDNAgAAmwQAMM4CAgD6AwAhzwICAPoDACHaAgEAggQAIeICAgD6AwAhAwAAABIAIAEAAMUCADA0AADGAgAgAwAAABIAIAEAABMAMAIAABQAIAEAAAAYACABAAAAGAAgAwAAABYAIAEAABcAMAIAABgAIAMAAAAWACABAAAXADACAAAYACADAAAAFgAgAQAAFwAwAgAAGAAgBwoAANsFACDOAgIAAAAB2gIBAAAAAfoCAgAAAAH7AgIAAAAB_AICAAAAAf4CAAAA_gICASgAAM4CACAGzgICAAAAAdoCAQAAAAH6AgIAAAAB-wICAAAAAfwCAgAAAAH-AgAAAP4CAgEoAADQAgAwASgAANACADAHCgAA2gUAIM4CAgD5BAAh2gIBANkFACH6AgIA-QQAIfsCAgD5BAAh_AICAPkEACH-AgAA2AX-AiICAAAAGAAgKAAA0wIAIAbOAgIA-QQAIdoCAQDZBQAh-gICAPkEACH7AgIA-QQAIfwCAgD5BAAh_gIAANgF_gIiAgAAABYAICgAANUCACACAAAAFgAgKAAA1QIAIAMAAAAYACAvAADOAgAgMAAA0wIAIAEAAAAYACABAAAAFgAgBggAANMFACA1AADUBQAgNgAA1wUAIDcAANYFACA4AADVBQAg2gIAAJYFACAJywIAAJQEADDMAgAA3AIAEM0CAACUBAAwzgICAPoDACHaAgEAlgQAIfoCAgD6AwAh-wICAPoDACH8AgIA-gMAIf4CAACVBP4CIgMAAAAWACABAADbAgAwNAAA3AIAIAMAAAAWACABAAAXADACAAAYACABAAAAHAAgAQAAABwAIAMAAAAaACABAAAbADACAAAcACADAAAAGgAgAQAAGwAwAgAAHAAgAwAAABoAIAEAABsAMAIAABwAIAYDAADRBQAgDAAA0gUAIM4CAgAAAAHPAgIAAAAB0QJAAAAAAfoCAgAAAAEBKAAA5AIAIATOAgIAAAABzwICAAAAAdECQAAAAAH6AgIAAAABASgAAOYCADABKAAA5gIAMAYDAADPBQAgDAAA0AUAIM4CAgD5BAAhzwICAPkEACHRAkAA-AQAIfoCAgD5BAAhAgAAABwAICgAAOkCACAEzgICAPkEACHPAgIA-QQAIdECQAD4BAAh-gICAPkEACECAAAAGgAgKAAA6wIAIAIAAAAaACAoAADrAgAgAwAAABwAIC8AAOQCACAwAADpAgAgAQAAABwAIAEAAAAaACAFCAAAygUAIDUAAMsFACA2AADOBQAgNwAAzQUAIDgAAMwFACAHywIAAJMEADDMAgAA8gIAEM0CAACTBAAwzgICAPoDACHPAgIA-gMAIdECQAD7AwAh-gICAPoDACEDAAAAGgAgAQAA8QIAMDQAAPICACADAAAAGgAgAQAAGwAwAgAAHAAgAQAAACgAIAEAAAAoACADAAAAJgAgAQAAJwAwAgAAKAAgAwAAACYAIAEAACcAMAIAACgAIAMAAAAmACABAAAnADACAAAoACAMAwAAyAUAIBAAAMYFACASAADHBQAgFQAAyQUAIM4CAgAAAAHPAgIAAAAB6AICAAAAAfQCAgAAAAH1AkAAAAAB9gJAAAAAAfcCAgAAAAH5AgAAAPkCAgEoAAD6AgAgCM4CAgAAAAHPAgIAAAAB6AICAAAAAfQCAgAAAAH1AkAAAAAB9gJAAAAAAfcCAgAAAAH5AgAAAPkCAgEoAAD8AgAwASgAAPwCADAMAwAAuAUAIBAAALYFACASAAC3BQAgFQAAuQUAIM4CAgD5BAAhzwICAPkEACHoAgIA-QQAIfQCAgD5BAAh9QJAAPgEACH2AkAAnAUAIfcCAgD5BAAh-QIAALUF-QIiAgAAACgAICgAAP8CACAIzgICAPkEACHPAgIA-QQAIegCAgD5BAAh9AICAPkEACH1AkAA-AQAIfYCQACcBQAh9wICAPkEACH5AgAAtQX5AiICAAAAJgAgKAAAgQMAIAIAAAAmACAoAACBAwAgAwAAACgAIC8AAPoCACAwAAD_AgAgAQAAACgAIAEAAAAmACAGCAAAsAUAIDUAALEFACA2AAC0BQAgNwAAswUAIDgAALIFACD2AgAAlgUAIAvLAgAAjwQAMMwCAACIAwAQzQIAAI8EADDOAgIA-gMAIc8CAgD6AwAh6AICAPoDACH0AgIA-gMAIfUCQAD7AwAh9gJAAIYEACH3AgIA-gMAIfkCAACQBPkCIgMAAAAmACABAACHAwAwNAAAiAMAIAMAAAAmACABAAAnADACAAAoACABAAAAMwAgAQAAADMAIAMAAAAxACABAAAyADACAAAzACADAAAAMQAgAQAAMgAwAgAAMwAgAwAAADEAIAEAADIAMAIAADMAIAcQAACvBQAgFAAArgUAIM4CAgAAAAHoAgIAAAAB7QJAAAAAAfICAAAA8gIC8wICAAAAAQEoAACQAwAgBc4CAgAAAAHoAgIAAAAB7QJAAAAAAfICAAAA8gIC8wICAAAAAQEoAACSAwAwASgAAJIDADAHEAAArQUAIBQAAKwFACDOAgIA-QQAIegCAgD5BAAh7QJAAPgEACHyAgAAqwXyAiLzAgIA-QQAIQIAAAAzACAoAACVAwAgBc4CAgD5BAAh6AICAPkEACHtAkAA-AQAIfICAACrBfICIvMCAgD5BAAhAgAAADEAICgAAJcDACACAAAAMQAgKAAAlwMAIAMAAAAzACAvAACQAwAgMAAAlQMAIAEAAAAzACABAAAAMQAgBQgAAKYFACA1AACnBQAgNgAAqgUAIDcAAKkFACA4AACoBQAgCMsCAACLBAAwzAIAAJ4DABDNAgAAiwQAMM4CAgD6AwAh6AICAPoDACHtAkAA-wMAIfICAACMBPICIvMCAgD6AwAhAwAAADEAIAEAAJ0DADA0AACeAwAgAwAAADEAIAEAADIAMAIAADMAIAEAAAA4ACABAAAAOAAgAwAAADYAIAEAADcAMAIAADgAIAMAAAA2ACABAAA3ADACAAA4ACADAAAANgAgAQAANwAwAgAAOAAgBxAAAKUFACDOAgIAAAAB6AICAAAAAe0CQAAAAAHuAgIAAAAB7wICAAAAAfACAgAAAAEBKAAApgMAIAbOAgIAAAAB6AICAAAAAe0CQAAAAAHuAgIAAAAB7wICAAAAAfACAgAAAAEBKAAAqAMAMAEoAACoAwAwBxAAAKQFACDOAgIA-QQAIegCAgD5BAAh7QJAAPgEACHuAgIA-QQAIe8CAgD5BAAh8AICAPkEACECAAAAOAAgKAAAqwMAIAbOAgIA-QQAIegCAgD5BAAh7QJAAPgEACHuAgIA-QQAIe8CAgD5BAAh8AICAPkEACECAAAANgAgKAAArQMAIAIAAAA2ACAoAACtAwAgAwAAADgAIC8AAKYDACAwAACrAwAgAQAAADgAIAEAAAA2ACAFCAAAnwUAIDUAAKAFACA2AACjBQAgNwAAogUAIDgAAKEFACAJywIAAIoEADDMAgAAtAMAEM0CAACKBAAwzgICAPoDACHoAgIA-gMAIe0CQAD7AwAh7gICAPoDACHvAgIA-gMAIfACAgD6AwAhAwAAADYAIAEAALMDADA0AAC0AwAgAwAAADYAIAEAADcAMAIAADgAIAEAAABDACABAAAAQwAgAwAAAEEAIAEAAEIAMAIAAEMAIAMAAABBACABAABCADACAABDACADAAAAQQAgAQAAQgAwAgAAQwAgBxAAAJ4FACDOAgIAAAAB6AICAAAAAekCQAAAAAHqAkAAAAAB6wICAAAAAewCAgAAAAEBKAAAvAMAIAbOAgIAAAAB6AICAAAAAekCQAAAAAHqAkAAAAAB6wICAAAAAewCAgAAAAEBKAAAvgMAMAEoAAC-AwAwBxAAAJ0FACDOAgIA-QQAIegCAgD5BAAh6QJAAPgEACHqAkAAnAUAIesCAgD5BAAh7AICAPkEACECAAAAQwAgKAAAwQMAIAbOAgIA-QQAIegCAgD5BAAh6QJAAPgEACHqAkAAnAUAIesCAgD5BAAh7AICAPkEACECAAAAQQAgKAAAwwMAIAIAAABBACAoAADDAwAgAwAAAEMAIC8AALwDACAwAADBAwAgAQAAAEMAIAEAAABBACAGCAAAlwUAIDUAAJgFACA2AACbBQAgNwAAmgUAIDgAAJkFACDqAgAAlgUAIAnLAgAAhQQAMMwCAADKAwAQzQIAAIUEADDOAgIA-gMAIegCAgD6AwAh6QJAAPsDACHqAkAAhgQAIesCAgD6AwAh7AICAPoDACEDAAAAQQAgAQAAyQMAMDQAAMoDACADAAAAQQAgAQAAQgAwAgAAQwAgAQAAAAsAIAEAAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIAMAAAAJACABAAAKADACAAALACAQAwAAkwUAIAUAAJQFACAHAACVBQAgzgICAAAAAc8CAgAAAAHaAgEAAAAB2wICAAAAAdwCAgAAAAHdAgIAAAAB3gICAAAAAd8CAgAAAAHgAgIAAAAB4QICAAAAAeICAgAAAAHjAkAAAAAB5AJAAAAAAQEoAADSAwAgDc4CAgAAAAHPAgIAAAAB2gIBAAAAAdsCAgAAAAHcAgIAAAAB3QICAAAAAd4CAgAAAAHfAgIAAAAB4AICAAAAAeECAgAAAAHiAgIAAAAB4wJAAAAAAeQCQAAAAAEBKAAA1AMAMAEoAADUAwAwEAMAAIQFACAFAACFBQAgBwAAhgUAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIdsCAgD5BAAh3AICAPkEACHdAgIA-QQAId4CAgD5BAAh3wICAPkEACHgAgIA-QQAIeECAgD5BAAh4gICAPkEACHjAkAA-AQAIeQCQAD4BAAhAgAAAAsAICgAANcDACANzgICAPkEACHPAgIA-QQAIdoCAQCDBQAh2wICAPkEACHcAgIA-QQAId0CAgD5BAAh3gICAPkEACHfAgIA-QQAIeACAgD5BAAh4QICAPkEACHiAgIA-QQAIeMCQAD4BAAh5AJAAPgEACECAAAACQAgKAAA2QMAIAIAAAAJACAoAADZAwAgAwAAAAsAIC8AANIDACAwAADXAwAgAQAAAAsAIAEAAAAJACAFCAAA_gQAIDUAAP8EACA2AACCBQAgNwAAgQUAIDgAAIAFACAQywIAAIEEADDMAgAA4AMAEM0CAACBBAAwzgICAPoDACHPAgIA-gMAIdoCAQCCBAAh2wICAPoDACHcAgIA-gMAId0CAgD6AwAh3gICAPoDACHfAgIA-gMAIeACAgD6AwAh4QICAPoDACHiAgIA-gMAIeMCQAD7AwAh5AJAAPsDACEDAAAACQAgAQAA3wMAMDQAAOADACADAAAACQAgAQAACgAwAgAACwAgAQAAAA8AIAEAAAAPACADAAAADQAgAQAADgAwAgAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIAMAAAANACABAAAOADACAAAPACAGAwAA_AQAIAYAAP0EACDOAgIAAAABzwICAAAAAdACAgAAAAHRAkAAAAABASgAAOgDACAEzgICAAAAAc8CAgAAAAHQAgIAAAAB0QJAAAAAAQEoAADqAwAwASgAAOoDADAGAwAA-gQAIAYAAPsEACDOAgIA-QQAIc8CAgD5BAAh0AICAPkEACHRAkAA-AQAIQIAAAAPACAoAADtAwAgBM4CAgD5BAAhzwICAPkEACHQAgIA-QQAIdECQAD4BAAhAgAAAA0AICgAAO8DACACAAAADQAgKAAA7wMAIAMAAAAPACAvAADoAwAgMAAA7QMAIAEAAAAPACABAAAADQAgBQgAAPMEACA1AAD0BAAgNgAA9wQAIDcAAPYEACA4AAD1BAAgB8sCAAD5AwAwzAIAAPYDABDNAgAA-QMAMM4CAgD6AwAhzwICAPoDACHQAgIA-gMAIdECQAD7AwAhAwAAAA0AIAEAAPUDADA0AAD2AwAgAwAAAA0AIAEAAA4AMAIAAA8AIAfLAgAA-QMAMMwCAAD2AwAQzQIAAPkDADDOAgIA-gMAIc8CAgD6AwAh0AICAPoDACHRAkAA-wMAIQ0IAAD9AwAgNQAAgAQAIDYAAP0DACA3AAD9AwAgOAAA_QMAINICAgAAAAHTAgIAAAAE1AICAAAABNUCAgAAAAHWAgIAAAAB1wICAAAAAdgCAgAAAAHZAgIA_wMAIQsIAAD9AwAgNwAA_gMAIDgAAP4DACDSAkAAAAAB0wJAAAAABNQCQAAAAATVAkAAAAAB1gJAAAAAAdcCQAAAAAHYAkAAAAAB2QJAAPwDACELCAAA_QMAIDcAAP4DACA4AAD-AwAg0gJAAAAAAdMCQAAAAATUAkAAAAAE1QJAAAAAAdYCQAAAAAHXAkAAAAAB2AJAAAAAAdkCQAD8AwAhCNICAgAAAAHTAgIAAAAE1AICAAAABNUCAgAAAAHWAgIAAAAB1wICAAAAAdgCAgAAAAHZAgIA_QMAIQjSAkAAAAAB0wJAAAAABNQCQAAAAATVAkAAAAAB1gJAAAAAAdcCQAAAAAHYAkAAAAAB2QJAAP4DACENCAAA_QMAIDUAAIAEACA2AAD9AwAgNwAA_QMAIDgAAP0DACDSAgIAAAAB0wICAAAABNQCAgAAAATVAgIAAAAB1gICAAAAAdcCAgAAAAHYAgIAAAAB2QICAP8DACEI0gIIAAAAAdMCCAAAAATUAggAAAAE1QIIAAAAAdYCCAAAAAHXAggAAAAB2AIIAAAAAdkCCACABAAhEMsCAACBBAAwzAIAAOADABDNAgAAgQQAMM4CAgD6AwAhzwICAPoDACHaAgEAggQAIdsCAgD6AwAh3AICAPoDACHdAgIA-gMAId4CAgD6AwAh3wICAPoDACHgAgIA-gMAIeECAgD6AwAh4gICAPoDACHjAkAA-wMAIeQCQAD7AwAhDggAAP0DACA3AACEBAAgOAAAhAQAINICAQAAAAHTAgEAAAAE1AIBAAAABNUCAQAAAAHWAgEAAAAB1wIBAAAAAdgCAQAAAAHZAgEAgwQAIeUCAQAAAAHmAgEAAAAB5wIBAAAAAQ4IAAD9AwAgNwAAhAQAIDgAAIQEACDSAgEAAAAB0wIBAAAABNQCAQAAAATVAgEAAAAB1gIBAAAAAdcCAQAAAAHYAgEAAAAB2QIBAIMEACHlAgEAAAAB5gIBAAAAAecCAQAAAAEL0gIBAAAAAdMCAQAAAATUAgEAAAAE1QIBAAAAAdYCAQAAAAHXAgEAAAAB2AIBAAAAAdkCAQCEBAAh5QIBAAAAAeYCAQAAAAHnAgEAAAABCcsCAACFBAAwzAIAAMoDABDNAgAAhQQAMM4CAgD6AwAh6AICAPoDACHpAkAA-wMAIeoCQACGBAAh6wICAPoDACHsAgIA-gMAIQsIAACIBAAgNwAAiQQAIDgAAIkEACDSAkAAAAAB0wJAAAAABdQCQAAAAAXVAkAAAAAB1gJAAAAAAdcCQAAAAAHYAkAAAAAB2QJAAIcEACELCAAAiAQAIDcAAIkEACA4AACJBAAg0gJAAAAAAdMCQAAAAAXUAkAAAAAF1QJAAAAAAdYCQAAAAAHXAkAAAAAB2AJAAAAAAdkCQACHBAAhCNICAgAAAAHTAgIAAAAF1AICAAAABdUCAgAAAAHWAgIAAAAB1wICAAAAAdgCAgAAAAHZAgIAiAQAIQjSAkAAAAAB0wJAAAAABdQCQAAAAAXVAkAAAAAB1gJAAAAAAdcCQAAAAAHYAkAAAAAB2QJAAIkEACEJywIAAIoEADDMAgAAtAMAEM0CAACKBAAwzgICAPoDACHoAgIA-gMAIe0CQAD7AwAh7gICAPoDACHvAgIA-gMAIfACAgD6AwAhCMsCAACLBAAwzAIAAJ4DABDNAgAAiwQAMM4CAgD6AwAh6AICAPoDACHtAkAA-wMAIfICAACMBPICIvMCAgD6AwAhBwgAAP0DACA3AACOBAAgOAAAjgQAINICAAAA8gIC0wIAAADyAgjUAgAAAPICCNkCAACNBPICIgcIAAD9AwAgNwAAjgQAIDgAAI4EACDSAgAAAPICAtMCAAAA8gII1AIAAADyAgjZAgAAjQTyAiIE0gIAAADyAgLTAgAAAPICCNQCAAAA8gII2QIAAI4E8gIiC8sCAACPBAAwzAIAAIgDABDNAgAAjwQAMM4CAgD6AwAhzwICAPoDACHoAgIA-gMAIfQCAgD6AwAh9QJAAPsDACH2AkAAhgQAIfcCAgD6AwAh-QIAAJAE-QIiBwgAAP0DACA3AACSBAAgOAAAkgQAINICAAAA-QIC0wIAAAD5AgjUAgAAAPkCCNkCAACRBPkCIgcIAAD9AwAgNwAAkgQAIDgAAJIEACDSAgAAAPkCAtMCAAAA-QII1AIAAAD5AgjZAgAAkQT5AiIE0gIAAAD5AgLTAgAAAPkCCNQCAAAA-QII2QIAAJIE-QIiB8sCAACTBAAwzAIAAPICABDNAgAAkwQAMM4CAgD6AwAhzwICAPoDACHRAkAA-wMAIfoCAgD6AwAhCcsCAACUBAAwzAIAANwCABDNAgAAlAQAMM4CAgD6AwAh2gIBAJYEACH6AgIA-gMAIfsCAgD6AwAh_AICAPoDACH-AgAAlQT-AiIHCAAA_QMAIDcAAJoEACA4AACaBAAg0gIAAAD-AgLTAgAAAP4CCNQCAAAA_gII2QIAAJkE_gIiDggAAIgEACA3AACYBAAgOAAAmAQAINICAQAAAAHTAgEAAAAF1AIBAAAABdUCAQAAAAHWAgEAAAAB1wIBAAAAAdgCAQAAAAHZAgEAlwQAIeUCAQAAAAHmAgEAAAAB5wIBAAAAAQ4IAACIBAAgNwAAmAQAIDgAAJgEACDSAgEAAAAB0wIBAAAABdQCAQAAAAXVAgEAAAAB1gIBAAAAAdcCAQAAAAHYAgEAAAAB2QIBAJcEACHlAgEAAAAB5gIBAAAAAecCAQAAAAEL0gIBAAAAAdMCAQAAAAXUAgEAAAAF1QIBAAAAAdYCAQAAAAHXAgEAAAAB2AIBAAAAAdkCAQCYBAAh5QIBAAAAAeYCAQAAAAHnAgEAAAABBwgAAP0DACA3AACaBAAgOAAAmgQAINICAAAA_gIC0wIAAAD-AgjUAgAAAP4CCNkCAACZBP4CIgTSAgAAAP4CAtMCAAAA_gII1AIAAAD-AgjZAgAAmgT-AiIHywIAAJsEADDMAgAAxgIAEM0CAACbBAAwzgICAPoDACHPAgIA-gMAIdoCAQCCBAAh4gICAPoDACEHywIAAJwEADDMAgAAsAIAEM0CAACcBAAwzgICAPoDACHoAgIA-gMAIfQCAgD6AwAh_wICAPoDACEGywIAAJ0EADDMAgAAmgIAEM0CAACdBAAwzgICAPoDACGAAwEAggQAIYEDAgD6AwAhCBEAAKEEACATAACiBAAgywIAAJ4EADDMAgAAhwIAEM0CAACeBAAwzgICAJ8EACGAAwEAoAQAIYEDAgCfBAAhCNICAgAAAAHTAgIAAAAE1AICAAAABNUCAgAAAAHWAgIAAAAB1wICAAAAAdgCAgAAAAHZAgIA_QMAIQvSAgEAAAAB0wIBAAAABNQCAQAAAATVAgEAAAAB1gIBAAAAAdcCAQAAAAHYAgEAAAAB2QIBAIQEACHlAgEAAAAB5gIBAAAAAecCAQAAAAEDggMAACYAIIMDAAAmACCEAwAAJgAgA4IDAAArACCDAwAAKwAghAMAACsAIAfLAgAAowQAMMwCAACBAgAQzQIAAKMEADDOAgIA-gMAIegCAgD6AwAhhgMAAKQEhgMihwMBAIIEACEHCAAA_QMAIDcAAKYEACA4AACmBAAg0gIAAACGAwLTAgAAAIYDCNQCAAAAhgMI2QIAAKUEhgMiBwgAAP0DACA3AACmBAAgOAAApgQAINICAAAAhgMC0wIAAACGAwjUAgAAAIYDCNkCAAClBIYDIgTSAgAAAIYDAtMCAAAAhgMI1AIAAACGAwjZAgAApgSGAyIHywIAAKcEADDMAgAA6wEAEM0CAACnBAAwzgICAPoDACHPAgIA-gMAIdoCAQCCBAAhiAMBAJYEACEHywIAAKgEADDMAgAA1QEAEM0CAACoBAAwzgICAPoDACHPAgIA-gMAIdoCAQCCBAAhiQMBAIIEACEJywIAAKkEADDMAgAAvwEAEM0CAACpBAAwzgICAPoDACHPAgIA-gMAIYoDAQCWBAAhiwMAAKoEACCMAwAAqgQAII0DAQCCBAAhBNICAQAAAAWOAwEAAAABjwMBAAAABJADAQAAAAQKAwAArQQAIMsCAACrBAAwzAIAAFQAEM0CAACrBAAwzgICAJ8EACHPAgIAnwQAIYoDAQCsBAAhiwMAAKoEACCMAwAAqgQAII0DAQCgBAAhC9ICAQAAAAHTAgEAAAAF1AIBAAAABdUCAQAAAAHWAgEAAAAB1wIBAAAAAdgCAQAAAAHZAgEAmAQAIeUCAQAAAAHmAgEAAAAB5wIBAAAAARIJAAC3BAAgDwAAswQAIBEAAKEEACAaAAC0BAAgGwAAtQQAIBwAALYEACAdAAC4BAAgHgAAuQQAIB8AALoEACAgAAC7BAAgywIAALIEADDMAgAAfAAQzQIAALIEADDOAgIAnwQAIdoCAQCgBAAh4wJAALAEACGeAwAAfAAgnwMAAHwAIAnLAgAArgQAMMwCAACnAQAQzQIAAK4EADDOAgIA-gMAIc8CAgD6AwAh4wJAAPsDACHkAkAA-wMAIZEDAQCCBAAhkgMBAIIEACEKAwAArQQAIMsCAACvBAAwzAIAAFIAEM0CAACvBAAwzgICAJ8EACHPAgIAnwQAIeMCQACwBAAh5AJAALAEACGRAwEAoAQAIZIDAQCgBAAhCNICQAAAAAHTAkAAAAAE1AJAAAAABNUCQAAAAAHWAkAAAAAB1wJAAAAAAdgCQAAAAAHZAkAA_gMAIQbLAgAAsQQAMMwCAACPAQAQzQIAALEEADDOAgIA-gMAIdoCAQCCBAAh4wJAAPsDACEQCQAAtwQAIA8AALMEACARAAChBAAgGgAAtAQAIBsAALUEACAcAAC2BAAgHQAAuAQAIB4AALkEACAfAAC6BAAgIAAAuwQAIMsCAACyBAAwzAIAAHwAEM0CAACyBAAwzgICAJ8EACHaAgEAoAQAIeMCQACwBAAhA4IDAAADACCDAwAAAwAghAMAAAMAIAOCAwAAIgAggwMAACIAIIQDAAAiACADggMAABIAIIMDAAASACCEAwAAEgAgA4IDAAAHACCDAwAABwAghAMAAAcAIAOCAwAACQAggwMAAAkAIIQDAAAJACADggMAAA0AIIMDAAANACCEAwAADQAgA4IDAAAaACCDAwAAGgAghAMAABoAIAwDAACtBAAgywIAAK8EADDMAgAAUgAQzQIAAK8EADDOAgIAnwQAIc8CAgCfBAAh4wJAALAEACHkAkAAsAQAIZEDAQCgBAAhkgMBAKAEACGeAwAAUgAgnwMAAFIAIAwDAACtBAAgywIAAKsEADDMAgAAVAAQzQIAAKsEADDOAgIAnwQAIc8CAgCfBAAhigMBAKwEACGLAwAAqgQAIIwDAACqBAAgjQMBAKAEACGeAwAAVAAgnwMAAFQAIA7LAgAAvAQAMMwCAAB2ABDNAgAAvAQAMM4CAgD6AwAhzwICAPoDACHjAkAA-wMAIeQCQAD7AwAh6AICAL8EACGJAwEAggQAIZMDAQCCBAAhlQMAAL0ElQMilgMgAL4EACGXAwIAvwQAIZkDAADABJkDIgcIAAD9AwAgNwAAyAQAIDgAAMgEACDSAgAAAJUDAtMCAAAAlQMI1AIAAACVAwjZAgAAxwSVAyIFCAAA_QMAIDcAAMYEACA4AADGBAAg0gIgAAAAAdkCIADFBAAhDQgAAIgEACA1AADEBAAgNgAAiAQAIDcAAIgEACA4AACIBAAg0gICAAAAAdMCAgAAAAXUAgIAAAAF1QICAAAAAdYCAgAAAAHXAgIAAAAB2AICAAAAAdkCAgDDBAAhBwgAAP0DACA3AADCBAAgOAAAwgQAINICAAAAmQMC0wIAAACZAwjUAgAAAJkDCNkCAADBBJkDIgcIAAD9AwAgNwAAwgQAIDgAAMIEACDSAgAAAJkDAtMCAAAAmQMI1AIAAACZAwjZAgAAwQSZAyIE0gIAAACZAwLTAgAAAJkDCNQCAAAAmQMI2QIAAMIEmQMiDQgAAIgEACA1AADEBAAgNgAAiAQAIDcAAIgEACA4AACIBAAg0gICAAAAAdMCAgAAAAXUAgIAAAAF1QICAAAAAdYCAgAAAAHXAgIAAAAB2AICAAAAAdkCAgDDBAAhCNICCAAAAAHTAggAAAAF1AIIAAAABdUCCAAAAAHWAggAAAAB1wIIAAAAAdgCCAAAAAHZAggAxAQAIQUIAAD9AwAgNwAAxgQAIDgAAMYEACDSAiAAAAAB2QIgAMUEACEC0gIgAAAAAdkCIADGBAAhBwgAAP0DACA3AADIBAAgOAAAyAQAINICAAAAlQMC0wIAAACVAwjUAgAAAJUDCNkCAADHBJUDIgTSAgAAAJUDAtMCAAAAlQMI1AIAAACVAwjZAgAAyASVAyIKEAAAywQAIMsCAADJBAAwzAIAAEEAEM0CAADJBAAwzgICAJ8EACHoAgIAnwQAIekCQACwBAAh6gJAAMoEACHrAgIAnwQAIewCAgCfBAAhCNICQAAAAAHTAkAAAAAF1AJAAAAABdUCQAAAAAHWAkAAAAAB1wJAAAAAAdgCQAAAAAHZAkAAiQQAIREDAACtBAAgBAAA3AQAIBEAAKEEACAVAADZBAAgFgAA2wQAIBcAAKIEACAYAADdBAAgGQAA3gQAIMsCAADaBAAwzAIAACIAEM0CAADaBAAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAhiAMBAKwEACGeAwAAIgAgnwMAACIAIALoAgIAAAABhgMAAACGAwIChgMAAACGAwKHAwEAAAABCBAAAMsEACDLAgAAzgQAMMwCAAA9ABDNAgAAzgQAMM4CAgCfBAAh6AICAJ8EACGGAwAAzwSGAyKHAwEAoAQAIQTSAgAAAIYDAtMCAAAAhgMI1AIAAACGAwjZAgAApgSGAyIKEAAAywQAIMsCAADQBAAwzAIAADYAEM0CAADQBAAwzgICAJ8EACHoAgIAnwQAIe0CQACwBAAh7gICAJ8EACHvAgIAnwQAIfACAgCfBAAhChAAAMsEACAUAADTBAAgywIAANEEADDMAgAAMQAQzQIAANEEADDOAgIAnwQAIegCAgCfBAAh7QJAALAEACHyAgAA0gTyAiLzAgIAnwQAIQTSAgAAAPICAtMCAAAA8gII1AIAAADyAgjZAgAAjgTyAiIRAwAArQQAIBAAAMsEACASAADWBAAgFQAA2QQAIMsCAADXBAAwzAIAACYAEM0CAADXBAAwzgICAJ8EACHPAgIAnwQAIegCAgCfBAAh9AICAJ8EACH1AkAAsAQAIfYCQADKBAAh9wICAJ8EACH5AgAA2AT5AiKeAwAAJgAgnwMAACYAIALoAgIAAAAB9AICAAAAAQkQAADLBAAgEgAA1gQAIMsCAADVBAAwzAIAACsAEM0CAADVBAAwzgICAJ8EACHoAgIAnwQAIfQCAgCfBAAh_wICAJ8EACEKEQAAoQQAIBMAAKIEACDLAgAAngQAMMwCAACHAgAQzQIAAJ4EADDOAgIAnwQAIYADAQCgBAAhgQMCAJ8EACGeAwAAhwIAIJ8DAACHAgAgDwMAAK0EACAQAADLBAAgEgAA1gQAIBUAANkEACDLAgAA1wQAMMwCAAAmABDNAgAA1wQAMM4CAgCfBAAhzwICAJ8EACHoAgIAnwQAIfQCAgCfBAAh9QJAALAEACH2AkAAygQAIfcCAgCfBAAh-QIAANgE-QIiBNICAAAA-QIC0wIAAAD5AgjUAgAAAPkCCNkCAACSBPkCIgOCAwAAMQAggwMAADEAIIQDAAAxACAPAwAArQQAIAQAANwEACARAAChBAAgFQAA2QQAIBYAANsEACAXAACiBAAgGAAA3QQAIBkAAN4EACDLAgAA2gQAMMwCAAAiABDNAgAA2gQAMM4CAgCfBAAhzwICAJ8EACHaAgEAoAQAIYgDAQCsBAAhA4IDAAA2ACCDAwAANgAghAMAADYAIBMDAACtBAAgIQAA8AQAICIAAPEEACDLAgAA6wQAMMwCAAAHABDNAgAA6wQAMM4CAgCfBAAhzwICAJ8EACHjAkAAsAQAIeQCQACwBAAh6AICAO4EACGJAwEAoAQAIZMDAQCgBAAhlQMAAOwElQMilgMgAO0EACGXAwIA7gQAIZkDAADvBJkDIp4DAAAHACCfAwAABwAgA4IDAAA9ACCDAwAAPQAghAMAAD0AIAOCAwAAQQAggwMAAEEAIIQDAABBACACzwICAAAAAdECQAAAAAEJAwAArQQAIAwAAOEEACDLAgAA4AQAMMwCAAAaABDNAgAA4AQAMM4CAgCfBAAhzwICAJ8EACHRAkAAsAQAIfoCAgCfBAAhDQMAAK0EACAFAADlBAAgCwAA5gQAIA0AALkEACDLAgAA5AQAMMwCAAASABDNAgAA5AQAMM4CAgCfBAAhzwICAJ8EACHaAgEAoAQAIeICAgCfBAAhngMAABIAIJ8DAAASACAKCgAA4QQAIMsCAADiBAAwzAIAABYAEM0CAADiBAAwzgICAJ8EACHaAgEArAQAIfoCAgCfBAAh-wICAJ8EACH8AgIAnwQAIf4CAADjBP4CIgTSAgAAAP4CAtMCAAAA_gII1AIAAAD-AgjZAgAAmgT-AiILAwAArQQAIAUAAOUEACALAADmBAAgDQAAuQQAIMsCAADkBAAwzAIAABIAEM0CAADkBAAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAh4gICAJ8EACENAwAArQQAIAQAANwEACAJAAC3BAAgDgAAtQQAIMsCAADyBAAwzAIAAAMAEM0CAADyBAAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAhiQMBAKAEACGeAwAAAwAgnwMAAAMAIAOCAwAAFgAggwMAABYAIIQDAAAWACACzwICAAAAAdECQAAAAAEJAwAArQQAIAYAAOkEACDLAgAA6AQAMMwCAAANABDNAgAA6AQAMM4CAgCfBAAhzwICAJ8EACHQAgIAnwQAIdECQACwBAAhFQMAAK0EACAFAADlBAAgBwAAuAQAIMsCAADqBAAwzAIAAAkAEM0CAADqBAAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAh2wICAJ8EACHcAgIAnwQAId0CAgCfBAAh3gICAJ8EACHfAgIAnwQAIeACAgCfBAAh4QICAJ8EACHiAgIAnwQAIeMCQACwBAAh5AJAALAEACGeAwAACQAgnwMAAAkAIBMDAACtBAAgBQAA5QQAIAcAALgEACDLAgAA6gQAMMwCAAAJABDNAgAA6gQAMM4CAgCfBAAhzwICAJ8EACHaAgEAoAQAIdsCAgCfBAAh3AICAJ8EACHdAgIAnwQAId4CAgCfBAAh3wICAJ8EACHgAgIAnwQAIeECAgCfBAAh4gICAJ8EACHjAkAAsAQAIeQCQACwBAAhEQMAAK0EACAhAADwBAAgIgAA8QQAIMsCAADrBAAwzAIAAAcAEM0CAADrBAAwzgICAJ8EACHPAgIAnwQAIeMCQACwBAAh5AJAALAEACHoAgIA7gQAIYkDAQCgBAAhkwMBAKAEACGVAwAA7ASVAyKWAyAA7QQAIZcDAgDuBAAhmQMAAO8EmQMiBNICAAAAlQMC0wIAAACVAwjUAgAAAJUDCNkCAADIBJUDIgLSAiAAAAAB2QIgAMYEACEI0gICAAAAAdMCAgAAAAXUAgIAAAAF1QICAAAAAdYCAgAAAAHXAgIAAAAB2AICAAAAAdkCAgCIBAAhBNICAAAAmQMC0wIAAACZAwjUAgAAAJkDCNkCAADCBJkDIg0DAACtBAAgBAAA3AQAIAkAALcEACAOAAC1BAAgywIAAPIEADDMAgAAAwAQzQIAAPIEADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACGJAwEAoAQAIZ4DAAADACCfAwAAAwAgEQMAAK0EACAEAADcBAAgEQAAoQQAIBUAANkEACAWAADbBAAgFwAAogQAIBgAAN0EACAZAADeBAAgywIAANoEADDMAgAAIgAQzQIAANoEADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACGIAwEArAQAIZ4DAAAiACCfAwAAIgAgCwMAAK0EACAEAADcBAAgCQAAtwQAIA4AALUEACDLAgAA8gQAMMwCAAADABDNAgAA8gQAMM4CAgCfBAAhzwICAJ8EACHaAgEAoAQAIYkDAQCgBAAhAAAAAAABowNAAAAAAQWjAwIAAAABqgMCAAAAAasDAgAAAAGsAwIAAAABrQMCAAAAAQUvAADzCQAgMAAA-QkAIKADAAD0CQAgoQMAAPgJACCmAwAAeQAgBS8AAPEJACAwAAD2CQAgoAMAAPIJACChAwAA9QkAIKYDAAALACADLwAA8wkAIKADAAD0CQAgpgMAAHkAIAMvAADxCQAgoAMAAPIJACCmAwAACwAgAAAAAAABowMBAAAAAQUvAADoCQAgMAAA7wkAIKADAADpCQAgoQMAAO4JACCmAwAAeQAgBS8AAOYJACAwAADsCQAgoAMAAOcJACChAwAA6wkAIKYDAAAFACALLwAAhwUAMDAAAIwFADCgAwAAiAUAMKEDAACJBQAwogMAAIoFACCjAwAAiwUAMKQDAACLBQAwpQMAAIsFADCmAwAAiwUAMKcDAACNBQAwqAMAAI4FADAEAwAA_AQAIM4CAgAAAAHPAgIAAAAB0QJAAAAAAQIAAAAPACAvAACSBQAgAwAAAA8AIC8AAJIFACAwAACRBQAgASgAAOoJADAKAwAArQQAIAYAAOkEACDLAgAA6AQAMMwCAAANABDNAgAA6AQAMM4CAgAAAAHPAgIAnwQAIdACAgCfBAAh0QJAALAEACGdAwAA5wQAIAIAAAAPACAoAACRBQAgAgAAAI8FACAoAACQBQAgB8sCAACOBQAwzAIAAI8FABDNAgAAjgUAMM4CAgCfBAAhzwICAJ8EACHQAgIAnwQAIdECQACwBAAhB8sCAACOBQAwzAIAAI8FABDNAgAAjgUAMM4CAgCfBAAhzwICAJ8EACHQAgIAnwQAIdECQACwBAAhA84CAgD5BAAhzwICAPkEACHRAkAA-AQAIQQDAAD6BAAgzgICAPkEACHPAgIA-QQAIdECQAD4BAAhBAMAAPwEACDOAgIAAAABzwICAAAAAdECQAAAAAEDLwAA6AkAIKADAADpCQAgpgMAAHkAIAMvAADmCQAgoAMAAOcJACCmAwAABQAgBC8AAIcFADCgAwAAiAUAMKIDAACKBQAgpgMAAIsFADAAAAAAAAABowNAAAAAAQUvAADhCQAgMAAA5AkAIKADAADiCQAgoQMAAOMJACCmAwAAJAAgAy8AAOEJACCgAwAA4gkAIKYDAAAkACAAAAAAAAUvAADcCQAgMAAA3wkAIKADAADdCQAgoQMAAN4JACCmAwAAJAAgAy8AANwJACCgAwAA3QkAIKYDAAAkACAAAAAAAAGjAwAAAPICAgUvAADUCQAgMAAA2gkAIKADAADVCQAgoQMAANkJACCmAwAAKAAgBS8AANIJACAwAADXCQAgoAMAANMJACChAwAA1gkAIKYDAAAkACADLwAA1AkAIKADAADVCQAgpgMAACgAIAMvAADSCQAgoAMAANMJACCmAwAAJAAgAAAAAAABowMAAAD5AgIFLwAAxgkAIDAAANAJACCgAwAAxwkAIKEDAADPCQAgpgMAACQAIAUvAADECQAgMAAAzQkAIKADAADFCQAgoQMAAMwJACCmAwAAhAIAIAUvAADCCQAgMAAAygkAIKADAADDCQAgoQMAAMkJACCmAwAAeQAgCy8AALoFADAwAAC_BQAwoAMAALsFADChAwAAvAUAMKIDAAC9BQAgowMAAL4FADCkAwAAvgUAMKUDAAC-BQAwpgMAAL4FADCnAwAAwAUAMKgDAADBBQAwBRAAAK8FACDOAgIAAAAB6AICAAAAAe0CQAAAAAHyAgAAAPICAgIAAAAzACAvAADFBQAgAwAAADMAIC8AAMUFACAwAADEBQAgASgAAMgJADAKEAAAywQAIBQAANMEACDLAgAA0QQAMMwCAAAxABDNAgAA0QQAMM4CAgAAAAHoAgIAnwQAIe0CQACwBAAh8gIAANIE8gIi8wICAJ8EACECAAAAMwAgKAAAxAUAIAIAAADCBQAgKAAAwwUAIAjLAgAAwQUAMMwCAADCBQAQzQIAAMEFADDOAgIAnwQAIegCAgCfBAAh7QJAALAEACHyAgAA0gTyAiLzAgIAnwQAIQjLAgAAwQUAMMwCAADCBQAQzQIAAMEFADDOAgIAnwQAIegCAgCfBAAh7QJAALAEACHyAgAA0gTyAiLzAgIAnwQAIQTOAgIA-QQAIegCAgD5BAAh7QJAAPgEACHyAgAAqwXyAiIFEAAArQUAIM4CAgD5BAAh6AICAPkEACHtAkAA-AQAIfICAACrBfICIgUQAACvBQAgzgICAAAAAegCAgAAAAHtAkAAAAAB8gIAAADyAgIDLwAAxgkAIKADAADHCQAgpgMAACQAIAMvAADECQAgoAMAAMUJACCmAwAAhAIAIAMvAADCCQAgoAMAAMMJACCmAwAAeQAgBC8AALoFADCgAwAAuwUAMKIDAAC9BQAgpgMAAL4FADAAAAAAAAUvAAC6CQAgMAAAwAkAIKADAAC7CQAgoQMAAL8JACCmAwAAeQAgBS8AALgJACAwAAC9CQAgoAMAALkJACChAwAAvAkAIKYDAAAUACADLwAAugkAIKADAAC7CQAgpgMAAHkAIAMvAAC4CQAgoAMAALkJACCmAwAAFAAgAAAAAAABowMAAAD-AgIBowMBAAAAAQUvAACzCQAgMAAAtgkAIKADAAC0CQAgoQMAALUJACCmAwAAFAAgAy8AALMJACCgAwAAtAkAIKYDAAAUACAAAAAAAAUvAACpCQAgMAAAsQkAIKADAACqCQAgoQMAALAJACCmAwAAeQAgBS8AAKcJACAwAACuCQAgoAMAAKgJACChAwAArQkAIKYDAAAFACALLwAA8QUAMDAAAPYFADCgAwAA8gUAMKEDAADzBQAwogMAAPQFACCjAwAA9QUAMKQDAAD1BQAwpQMAAPUFADCmAwAA9QUAMKcDAAD3BQAwqAMAAPgFADALLwAA5QUAMDAAAOoFADCgAwAA5gUAMKEDAADnBQAwogMAAOgFACCjAwAA6QUAMKQDAADpBQAwpQMAAOkFADCmAwAA6QUAMKcDAADrBQAwqAMAAOwFADAEAwAA0QUAIM4CAgAAAAHPAgIAAAAB0QJAAAAAAQIAAAAcACAvAADwBQAgAwAAABwAIC8AAPAFACAwAADvBQAgASgAAKwJADAKAwAArQQAIAwAAOEEACDLAgAA4AQAMMwCAAAaABDNAgAA4AQAMM4CAgAAAAHPAgIAnwQAIdECQACwBAAh-gICAJ8EACGdAwAA3wQAIAIAAAAcACAoAADvBQAgAgAAAO0FACAoAADuBQAgB8sCAADsBQAwzAIAAO0FABDNAgAA7AUAMM4CAgCfBAAhzwICAJ8EACHRAkAAsAQAIfoCAgCfBAAhB8sCAADsBQAwzAIAAO0FABDNAgAA7AUAMM4CAgCfBAAhzwICAJ8EACHRAkAAsAQAIfoCAgCfBAAhA84CAgD5BAAhzwICAPkEACHRAkAA-AQAIQQDAADPBQAgzgICAPkEACHPAgIA-QQAIdECQAD4BAAhBAMAANEFACDOAgIAAAABzwICAAAAAdECQAAAAAEFzgICAAAAAdoCAQAAAAH7AgIAAAAB_AICAAAAAf4CAAAA_gICAgAAABgAIC8AAPwFACADAAAAGAAgLwAA_AUAIDAAAPsFACABKAAAqwkAMAoKAADhBAAgywIAAOIEADDMAgAAFgAQzQIAAOIEADDOAgIAAAAB2gIBAKwEACH6AgIAnwQAIfsCAgCfBAAh_AICAJ8EACH-AgAA4wT-AiICAAAAGAAgKAAA-wUAIAIAAAD5BQAgKAAA-gUAIAnLAgAA-AUAMMwCAAD5BQAQzQIAAPgFADDOAgIAnwQAIdoCAQCsBAAh-gICAJ8EACH7AgIAnwQAIfwCAgCfBAAh_gIAAOME_gIiCcsCAAD4BQAwzAIAAPkFABDNAgAA-AUAMM4CAgCfBAAh2gIBAKwEACH6AgIAnwQAIfsCAgCfBAAh_AICAJ8EACH-AgAA4wT-AiIFzgICAPkEACHaAgEA2QUAIfsCAgD5BAAh_AICAPkEACH-AgAA2AX-AiIFzgICAPkEACHaAgEA2QUAIfsCAgD5BAAh_AICAPkEACH-AgAA2AX-AiIFzgICAAAAAdoCAQAAAAH7AgIAAAAB_AICAAAAAf4CAAAA_gICAy8AAKkJACCgAwAAqgkAIKYDAAB5ACADLwAApwkAIKADAACoCQAgpgMAAAUAIAQvAADxBQAwoAMAAPIFADCiAwAA9AUAIKYDAAD1BQAwBC8AAOUFADCgAwAA5gUAMKIDAADoBQAgpgMAAOkFADAAAAAAAAUvAACfCQAgMAAApQkAIKADAACgCQAgoQMAAKQJACCmAwAAJAAgBS8AAJ0JACAwAACiCQAgoAMAAJ4JACChAwAAoQkAIKYDAACEAgAgAy8AAJ8JACCgAwAAoAkAIKYDAAAkACADLwAAnQkAIKADAACeCQAgpgMAAIQCACAAAAAAAAsvAACdBgAwMAAAogYAMKADAACeBgAwoQMAAJ8GADCiAwAAoAYAIKMDAAChBgAwpAMAAKEGADClAwAAoQYAMKYDAAChBgAwpwMAAKMGADCoAwAApAYAMAsvAACRBgAwMAAAlgYAMKADAACSBgAwoQMAAJMGADCiAwAAlAYAIKMDAACVBgAwpAMAAJUGADClAwAAlQYAMKYDAACVBgAwpwMAAJcGADCoAwAAmAYAMAQQAACIBgAgzgICAAAAAegCAgAAAAH_AgIAAAABAgAAAC0AIC8AAJwGACADAAAALQAgLwAAnAYAIDAAAJsGACABKAAAnAkAMAoQAADLBAAgEgAA1gQAIMsCAADVBAAwzAIAACsAEM0CAADVBAAwzgICAAAAAegCAgCfBAAh9AICAJ8EACH_AgIAnwQAIZwDAADUBAAgAgAAAC0AICgAAJsGACACAAAAmQYAICgAAJoGACAHywIAAJgGADDMAgAAmQYAEM0CAACYBgAwzgICAJ8EACHoAgIAnwQAIfQCAgCfBAAh_wICAJ8EACEHywIAAJgGADDMAgAAmQYAEM0CAACYBgAwzgICAJ8EACHoAgIAnwQAIfQCAgCfBAAh_wICAJ8EACEDzgICAPkEACHoAgIA-QQAIf8CAgD5BAAhBBAAAIYGACDOAgIA-QQAIegCAgD5BAAh_wICAPkEACEEEAAAiAYAIM4CAgAAAAHoAgIAAAAB_wICAAAAAQoDAADIBQAgEAAAxgUAIBUAAMkFACDOAgIAAAABzwICAAAAAegCAgAAAAH1AkAAAAAB9gJAAAAAAfcCAgAAAAH5AgAAAPkCAgIAAAAoACAvAACoBgAgAwAAACgAIC8AAKgGACAwAACnBgAgASgAAJsJADAPAwAArQQAIBAAAMsEACASAADWBAAgFQAA2QQAIMsCAADXBAAwzAIAACYAEM0CAADXBAAwzgICAAAAAc8CAgCfBAAh6AICAJ8EACH0AgIAnwQAIfUCQACwBAAh9gJAAMoEACH3AgIAnwQAIfkCAADYBPkCIgIAAAAoACAoAACnBgAgAgAAAKUGACAoAACmBgAgC8sCAACkBgAwzAIAAKUGABDNAgAApAYAMM4CAgCfBAAhzwICAJ8EACHoAgIAnwQAIfQCAgCfBAAh9QJAALAEACH2AkAAygQAIfcCAgCfBAAh-QIAANgE-QIiC8sCAACkBgAwzAIAAKUGABDNAgAApAYAMM4CAgCfBAAhzwICAJ8EACHoAgIAnwQAIfQCAgCfBAAh9QJAALAEACH2AkAAygQAIfcCAgCfBAAh-QIAANgE-QIiB84CAgD5BAAhzwICAPkEACHoAgIA-QQAIfUCQAD4BAAh9gJAAJwFACH3AgIA-QQAIfkCAAC1BfkCIgoDAAC4BQAgEAAAtgUAIBUAALkFACDOAgIA-QQAIc8CAgD5BAAh6AICAPkEACH1AkAA-AQAIfYCQACcBQAh9wICAPkEACH5AgAAtQX5AiIKAwAAyAUAIBAAAMYFACAVAADJBQAgzgICAAAAAc8CAgAAAAHoAgIAAAAB9QJAAAAAAfYCQAAAAAH3AgIAAAAB-QIAAAD5AgIELwAAnQYAMKADAACeBgAwogMAAKAGACCmAwAAoQYAMAQvAACRBgAwoAMAAJIGADCiAwAAlAYAIKYDAACVBgAwAAAAAAAAAAGjAwAAAIYDAgUvAACWCQAgMAAAmQkAIKADAACXCQAgoQMAAJgJACCmAwAAJAAgAy8AAJYJACCgAwAAlwkAIKYDAAAkACAAAAAAAAUvAACBCQAgMAAAlAkAIKADAACCCQAgoQMAAJMJACCmAwAAeQAgCy8AAIUHADAwAACJBwAwoAMAAIYHADChAwAAhwcAMKIDAACIBwAgowMAAKEGADCkAwAAoQYAMKUDAAChBgAwpgMAAKEGADCnAwAAigcAMKgDAACkBgAwCy8AAPkGADAwAAD-BgAwoAMAAPoGADChAwAA-wYAMKIDAAD8BgAgowMAAP0GADCkAwAA_QYAMKUDAAD9BgAwpgMAAP0GADCnAwAA_wYAMKgDAACABwAwCy8AAPAGADAwAAD0BgAwoAMAAPEGADChAwAA8gYAMKIDAADzBgAgowMAAL4FADCkAwAAvgUAMKUDAAC-BQAwpgMAAL4FADCnAwAA9QYAMKgDAADBBQAwBy8AAOMGACAwAADmBgAgoAMAAOQGACChAwAA5QYAIKQDAAAHACClAwAABwAgpgMAAAEAIAsvAADaBgAwMAAA3gYAMKADAADbBgAwoQMAANwGADCiAwAA3QYAIKMDAACVBgAwpAMAAJUGADClAwAAlQYAMKYDAACVBgAwpwMAAN8GADCoAwAAmAYAMAsvAADOBgAwMAAA0wYAMKADAADPBgAwoQMAANAGADCiAwAA0QYAIKMDAADSBgAwpAMAANIGADClAwAA0gYAMKYDAADSBgAwpwMAANQGADCoAwAA1QYAMAsvAADCBgAwMAAAxwYAMKADAADDBgAwoQMAAMQGADCiAwAAxQYAIKMDAADGBgAwpAMAAMYGADClAwAAxgYAMKYDAADGBgAwpwMAAMgGADCoAwAAyQYAMAXOAgIAAAAB6QJAAAAAAeoCQAAAAAHrAgIAAAAB7AICAAAAAQIAAABDACAvAADNBgAgAwAAAEMAIC8AAM0GACAwAADMBgAgASgAAJIJADAKEAAAywQAIMsCAADJBAAwzAIAAEEAEM0CAADJBAAwzgICAAAAAegCAgCfBAAh6QJAALAEACHqAkAAygQAIesCAgCfBAAh7AICAJ8EACECAAAAQwAgKAAAzAYAIAIAAADKBgAgKAAAywYAIAnLAgAAyQYAMMwCAADKBgAQzQIAAMkGADDOAgIAnwQAIegCAgCfBAAh6QJAALAEACHqAkAAygQAIesCAgCfBAAh7AICAJ8EACEJywIAAMkGADDMAgAAygYAEM0CAADJBgAwzgICAJ8EACHoAgIAnwQAIekCQACwBAAh6gJAAMoEACHrAgIAnwQAIewCAgCfBAAhBc4CAgD5BAAh6QJAAPgEACHqAkAAnAUAIesCAgD5BAAh7AICAPkEACEFzgICAPkEACHpAkAA-AQAIeoCQACcBQAh6wICAPkEACHsAgIA-QQAIQXOAgIAAAAB6QJAAAAAAeoCQAAAAAHrAgIAAAAB7AICAAAAAQPOAgIAAAABhgMAAACGAwKHAwEAAAABAgAAAD8AIC8AANkGACADAAAAPwAgLwAA2QYAIDAAANgGACABKAAAkQkAMAoQAADLBAAgywIAAM4EADDMAgAAPQAQzQIAAM4EADDOAgIAAAAB6AICAJ8EACGGAwAAzwSGAyKHAwEAoAQAIZoDAADMBAAgmwMAAM0EACACAAAAPwAgKAAA2AYAIAIAAADWBgAgKAAA1wYAIAfLAgAA1QYAMMwCAADWBgAQzQIAANUGADDOAgIAnwQAIegCAgCfBAAhhgMAAM8EhgMihwMBAKAEACEHywIAANUGADDMAgAA1gYAEM0CAADVBgAwzgICAJ8EACHoAgIAnwQAIYYDAADPBIYDIocDAQCgBAAhA84CAgD5BAAhhgMAALIGhgMihwMBAIMFACEDzgICAPkEACGGAwAAsgaGAyKHAwEAgwUAIQPOAgIAAAABhgMAAACGAwKHAwEAAAABBBIAAIkGACDOAgIAAAAB9AICAAAAAf8CAgAAAAECAAAALQAgLwAA4gYAIAMAAAAtACAvAADiBgAgMAAA4QYAIAEoAACQCQAwAgAAAC0AICgAAOEGACACAAAAmQYAICgAAOAGACADzgICAPkEACH0AgIA-QQAIf8CAgD5BAAhBBIAAIcGACDOAgIA-QQAIfQCAgD5BAAh_wICAPkEACEEEgAAiQYAIM4CAgAAAAH0AgIAAAAB_wICAAAAAQwDAADuBgAgIQAA7wYAIM4CAgAAAAHPAgIAAAAB4wJAAAAAAeQCQAAAAAGJAwEAAAABkwMBAAAAAZUDAAAAlQMClgMgAAAAAZcDAgAAAAGZAwAAAJkDAgIAAAABACAvAADjBgAgAwAAAAcAIC8AAOMGACAwAADnBgAgDgAAAAcAIAMAAOsGACAhAADsBgAgKAAA5wYAIM4CAgD5BAAhzwICAPkEACHjAkAA-AQAIeQCQAD4BAAhiQMBAIMFACGTAwEAgwUAIZUDAADoBpUDIpYDIADpBgAhlwMCAO0GACGZAwAA6gaZAyIMAwAA6wYAICEAAOwGACDOAgIA-QQAIc8CAgD5BAAh4wJAAPgEACHkAkAA-AQAIYkDAQCDBQAhkwMBAIMFACGVAwAA6AaVAyKWAyAA6QYAIZcDAgDtBgAhmQMAAOoGmQMiAaMDAAAAlQMCAaMDIAAAAAEBowMAAACZAwIFLwAAiAkAIDAAAI4JACCgAwAAiQkAIKEDAACNCQAgpgMAAHkAIAcvAACGCQAgMAAAiwkAIKADAACHCQAgoQMAAIoJACCkAwAAAwAgpQMAAAMAIKYDAAAFACAFowMCAAAAAaoDAgAAAAGrAwIAAAABrAMCAAAAAa0DAgAAAAEDLwAAiAkAIKADAACJCQAgpgMAAHkAIAMvAACGCQAgoAMAAIcJACCmAwAABQAgBRQAAK4FACDOAgIAAAAB7QJAAAAAAfICAAAA8gIC8wICAAAAAQIAAAAzACAvAAD4BgAgAwAAADMAIC8AAPgGACAwAAD3BgAgASgAAIUJADACAAAAMwAgKAAA9wYAIAIAAADCBQAgKAAA9gYAIATOAgIA-QQAIe0CQAD4BAAh8gIAAKsF8gIi8wICAPkEACEFFAAArAUAIM4CAgD5BAAh7QJAAPgEACHyAgAAqwXyAiLzAgIA-QQAIQUUAACuBQAgzgICAAAAAe0CQAAAAAHyAgAAAPICAvMCAgAAAAEFzgICAAAAAe0CQAAAAAHuAgIAAAAB7wICAAAAAfACAgAAAAECAAAAOAAgLwAAhAcAIAMAAAA4ACAvAACEBwAgMAAAgwcAIAEoAACECQAwChAAAMsEACDLAgAA0AQAMMwCAAA2ABDNAgAA0AQAMM4CAgAAAAHoAgIAnwQAIe0CQACwBAAh7gICAJ8EACHvAgIAnwQAIfACAgCfBAAhAgAAADgAICgAAIMHACACAAAAgQcAICgAAIIHACAJywIAAIAHADDMAgAAgQcAEM0CAACABwAwzgICAJ8EACHoAgIAnwQAIe0CQACwBAAh7gICAJ8EACHvAgIAnwQAIfACAgCfBAAhCcsCAACABwAwzAIAAIEHABDNAgAAgAcAMM4CAgCfBAAh6AICAJ8EACHtAkAAsAQAIe4CAgCfBAAh7wICAJ8EACHwAgIAnwQAIQXOAgIA-QQAIe0CQAD4BAAh7gICAPkEACHvAgIA-QQAIfACAgD5BAAhBc4CAgD5BAAh7QJAAPgEACHuAgIA-QQAIe8CAgD5BAAh8AICAPkEACEFzgICAAAAAe0CQAAAAAHuAgIAAAAB7wICAAAAAfACAgAAAAEKAwAAyAUAIBIAAMcFACAVAADJBQAgzgICAAAAAc8CAgAAAAH0AgIAAAAB9QJAAAAAAfYCQAAAAAH3AgIAAAAB-QIAAAD5AgICAAAAKAAgLwAAjQcAIAMAAAAoACAvAACNBwAgMAAAjAcAIAEoAACDCQAwAgAAACgAICgAAIwHACACAAAApQYAICgAAIsHACAHzgICAPkEACHPAgIA-QQAIfQCAgD5BAAh9QJAAPgEACH2AkAAnAUAIfcCAgD5BAAh-QIAALUF-QIiCgMAALgFACASAAC3BQAgFQAAuQUAIM4CAgD5BAAhzwICAPkEACH0AgIA-QQAIfUCQAD4BAAh9gJAAJwFACH3AgIA-QQAIfkCAAC1BfkCIgoDAADIBQAgEgAAxwUAIBUAAMkFACDOAgIAAAABzwICAAAAAfQCAgAAAAH1AkAAAAAB9gJAAAAAAfcCAgAAAAH5AgAAAPkCAgMvAACBCQAgoAMAAIIJACCmAwAAeQAgBC8AAIUHADCgAwAAhgcAMKIDAACIBwAgpgMAAKEGADAELwAA-QYAMKADAAD6BgAwogMAAPwGACCmAwAA_QYAMAQvAADwBgAwoAMAAPEGADCiAwAA8wYAIKYDAAC-BQAwAy8AAOMGACCgAwAA5AYAIKYDAAABACAELwAA2gYAMKADAADbBgAwogMAAN0GACCmAwAAlQYAMAQvAADOBgAwoAMAAM8GADCiAwAA0QYAIKYDAADSBgAwBC8AAMIGADCgAwAAwwYAMKIDAADFBgAgpgMAAMYGADAAAAAAAAUvAAD1CAAgMAAA_wgAIKADAAD2CAAgoQMAAP4IACCmAwAAeQAgBy8AALcHACAwAAC6BwAgoAMAALgHACChAwAAuQcAIKQDAAAHACClAwAABwAgpgMAAAEAIAsvAACrBwAwMAAAsAcAMKADAACsBwAwoQMAAK0HADCiAwAArgcAIKMDAACvBwAwpAMAAK8HADClAwAArwcAMKYDAACvBwAwpwMAALEHADCoAwAAsgcAMAsvAACfBwAwMAAApAcAMKADAACgBwAwoQMAAKEHADCiAwAAogcAIKMDAACjBwAwpAMAAKMHADClAwAAowcAMKYDAACjBwAwpwMAAKUHADCoAwAApgcAMAYDAAD9BQAgCwAA_wUAIA0AAIAGACDOAgIAAAABzwICAAAAAdoCAQAAAAECAAAAFAAgLwAAqgcAIAMAAAAUACAvAACqBwAgMAAAqQcAIAEoAAD9CAAwCwMAAK0EACAFAADlBAAgCwAA5gQAIA0AALkEACDLAgAA5AQAMMwCAAASABDNAgAA5AQAMM4CAgAAAAHPAgIAnwQAIdoCAQCgBAAh4gICAJ8EACECAAAAFAAgKAAAqQcAIAIAAACnBwAgKAAAqAcAIAfLAgAApgcAMMwCAACnBwAQzQIAAKYHADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACHiAgIAnwQAIQfLAgAApgcAMMwCAACnBwAQzQIAAKYHADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACHiAgIAnwQAIQPOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACEGAwAA4QUAIAsAAOMFACANAADkBQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhBgMAAP0FACALAAD_BQAgDQAAgAYAIM4CAgAAAAHPAgIAAAAB2gIBAAAAAQ4DAACTBQAgBwAAlQUAIM4CAgAAAAHPAgIAAAAB2gIBAAAAAdsCAgAAAAHcAgIAAAAB3QICAAAAAd4CAgAAAAHfAgIAAAAB4AICAAAAAeECAgAAAAHjAkAAAAAB5AJAAAAAAQIAAAALACAvAAC2BwAgAwAAAAsAIC8AALYHACAwAAC1BwAgASgAAPwIADATAwAArQQAIAUAAOUEACAHAAC4BAAgywIAAOoEADDMAgAACQAQzQIAAOoEADDOAgIAAAABzwICAJ8EACHaAgEAoAQAIdsCAgCfBAAh3AICAJ8EACHdAgIAnwQAId4CAgCfBAAh3wICAJ8EACHgAgIAnwQAIeECAgCfBAAh4gICAJ8EACHjAkAAsAQAIeQCQACwBAAhAgAAAAsAICgAALUHACACAAAAswcAICgAALQHACAQywIAALIHADDMAgAAswcAEM0CAACyBwAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAh2wICAJ8EACHcAgIAnwQAId0CAgCfBAAh3gICAJ8EACHfAgIAnwQAIeACAgCfBAAh4QICAJ8EACHiAgIAnwQAIeMCQACwBAAh5AJAALAEACEQywIAALIHADDMAgAAswcAEM0CAACyBwAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAh2wICAJ8EACHcAgIAnwQAId0CAgCfBAAh3gICAJ8EACHfAgIAnwQAIeACAgCfBAAh4QICAJ8EACHiAgIAnwQAIeMCQACwBAAh5AJAALAEACEMzgICAPkEACHPAgIA-QQAIdoCAQCDBQAh2wICAPkEACHcAgIA-QQAId0CAgD5BAAh3gICAPkEACHfAgIA-QQAIeACAgD5BAAh4QICAPkEACHjAkAA-AQAIeQCQAD4BAAhDgMAAIQFACAHAACGBQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAh2wICAPkEACHcAgIA-QQAId0CAgD5BAAh3gICAPkEACHfAgIA-QQAIeACAgD5BAAh4QICAPkEACHjAkAA-AQAIeQCQAD4BAAhDgMAAJMFACAHAACVBQAgzgICAAAAAc8CAgAAAAHaAgEAAAAB2wICAAAAAdwCAgAAAAHdAgIAAAAB3gICAAAAAd8CAgAAAAHgAgIAAAAB4QICAAAAAeMCQAAAAAHkAkAAAAABDAMAAO4GACAiAAC9BwAgzgICAAAAAc8CAgAAAAHjAkAAAAAB5AJAAAAAAegCAgAAAAGJAwEAAAABkwMBAAAAAZUDAAAAlQMClgMgAAAAAZkDAAAAmQMCAgAAAAEAIC8AALcHACADAAAABwAgLwAAtwcAIDAAALsHACAOAAAABwAgAwAA6wYAICIAALwHACAoAAC7BwAgzgICAPkEACHPAgIA-QQAIeMCQAD4BAAh5AJAAPgEACHoAgIA7QYAIYkDAQCDBQAhkwMBAIMFACGVAwAA6AaVAyKWAyAA6QYAIZkDAADqBpkDIgwDAADrBgAgIgAAvAcAIM4CAgD5BAAhzwICAPkEACHjAkAA-AQAIeQCQAD4BAAh6AICAO0GACGJAwEAgwUAIZMDAQCDBQAhlQMAAOgGlQMilgMgAOkGACGZAwAA6gaZAyIHLwAA9wgAIDAAAPoIACCgAwAA-AgAIKEDAAD5CAAgpAMAACIAIKUDAAAiACCmAwAAJAAgAy8AAPcIACCgAwAA-AgAIKYDAAAkACADLwAA9QgAIKADAAD2CAAgpgMAAHkAIAMvAAC3BwAgoAMAALgHACCmAwAAAQAgBC8AAKsHADCgAwAArAcAMKIDAACuBwAgpgMAAK8HADAELwAAnwcAMKADAACgBwAwogMAAKIHACCmAwAAowcAMAAAAAAAAqMDAQAAAASpAwEAAAAFAqMDAQAAAASpAwEAAAAFBS8AAPAIACAwAADzCAAgoAMAAPEIACChAwAA8ggAIKYDAAB5ACABowMBAAAABAGjAwEAAAAEAy8AAPAIACCgAwAA8QgAIKYDAAB5ACAKCQAAzQgAIA8AAMkIACARAACrBgAgGgAAyggAIBsAAMsIACAcAADMCAAgHQAAzggAIB4AAM8IACAfAADQCAAgIAAA0QgAIAAAAAAABS8AAOsIACAwAADuCAAgoAMAAOwIACChAwAA7QgAIKYDAAB5ACADLwAA6wgAIKADAADsCAAgpgMAAHkAIAAAAAAACy8AALMIADAwAAC4CAAwoAMAALQIADChAwAAtQgAMKIDAAC2CAAgowMAALcIADCkAwAAtwgAMKUDAAC3CAAwpgMAALcIADCnAwAAuQgAMKgDAAC6CAAwCy8AAKcIADAwAACsCAAwoAMAAKgIADChAwAAqQgAMKIDAACqCAAgowMAAKsIADCkAwAAqwgAMKUDAACrCAAwpgMAAKsIADCnAwAArQgAMKgDAACuCAAwCy8AAJ4IADAwAACiCAAwoAMAAJ8IADChAwAAoAgAMKIDAAChCAAgowMAAKEGADCkAwAAoQYAMKUDAAChBgAwpgMAAKEGADCnAwAAowgAMKgDAACkBgAwCy8AAJUIADAwAACZCAAwoAMAAJYIADChAwAAlwgAMKIDAACYCAAgowMAAKMHADCkAwAAowcAMKUDAACjBwAwpgMAAKMHADCnAwAAmggAMKgDAACmBwAwCy8AAIkIADAwAACOCAAwoAMAAIoIADChAwAAiwgAMKIDAACMCAAgowMAAI0IADCkAwAAjQgAMKUDAACNCAAwpgMAAI0IADCnAwAAjwgAMKgDAACQCAAwCy8AAIAIADAwAACECAAwoAMAAIEIADChAwAAgggAMKIDAACDCAAgowMAAK8HADCkAwAArwcAMKUDAACvBwAwpgMAAK8HADCnAwAAhQgAMKgDAACyBwAwCy8AAPcHADAwAAD7BwAwoAMAAPgHADChAwAA-QcAMKIDAAD6BwAgowMAAIsFADCkAwAAiwUAMKUDAACLBQAwpgMAAIsFADCnAwAA_AcAMKgDAACOBQAwCy8AAO4HADAwAADyBwAwoAMAAO8HADChAwAA8AcAMKIDAADxBwAgowMAAOkFADCkAwAA6QUAMKUDAADpBQAwpgMAAOkFADCnAwAA8wcAMKgDAADsBQAwBy8AAOkHACAwAADsBwAgoAMAAOoHACChAwAA6wcAIKQDAABSACClAwAAUgAgpgMAAJIBACAHLwAA5AcAIDAAAOcHACCgAwAA5QcAIKEDAADmBwAgpAMAAFQAIKUDAABUACCmAwAAqgEAIAXOAgIAAAABigMBAAAAAYsDAADKBwAgjAMAAMsHACCNAwEAAAABAgAAAKoBACAvAADkBwAgAwAAAFQAIC8AAOQHACAwAADoBwAgBwAAAFQAICgAAOgHACDOAgIA-QQAIYoDAQDZBQAhiwMAAMcHACCMAwAAyAcAII0DAQCDBQAhBc4CAgD5BAAhigMBANkFACGLAwAAxwcAIIwDAADIBwAgjQMBAIMFACEFzgICAAAAAeMCQAAAAAHkAkAAAAABkQMBAAAAAZIDAQAAAAECAAAAkgEAIC8AAOkHACADAAAAUgAgLwAA6QcAIDAAAO0HACAHAAAAUgAgKAAA7QcAIM4CAgD5BAAh4wJAAPgEACHkAkAA-AQAIZEDAQCDBQAhkgMBAIMFACEFzgICAPkEACHjAkAA-AQAIeQCQAD4BAAhkQMBAIMFACGSAwEAgwUAIQQMAADSBQAgzgICAAAAAdECQAAAAAH6AgIAAAABAgAAABwAIC8AAPYHACADAAAAHAAgLwAA9gcAIDAAAPUHACABKAAA6ggAMAIAAAAcACAoAAD1BwAgAgAAAO0FACAoAAD0BwAgA84CAgD5BAAh0QJAAPgEACH6AgIA-QQAIQQMAADQBQAgzgICAPkEACHRAkAA-AQAIfoCAgD5BAAhBAwAANIFACDOAgIAAAAB0QJAAAAAAfoCAgAAAAEEBgAA_QQAIM4CAgAAAAHQAgIAAAAB0QJAAAAAAQIAAAAPACAvAAD_BwAgAwAAAA8AIC8AAP8HACAwAAD-BwAgASgAAOkIADACAAAADwAgKAAA_gcAIAIAAACPBQAgKAAA_QcAIAPOAgIA-QQAIdACAgD5BAAh0QJAAPgEACEEBgAA-wQAIM4CAgD5BAAh0AICAPkEACHRAkAA-AQAIQQGAAD9BAAgzgICAAAAAdACAgAAAAHRAkAAAAABDgUAAJQFACAHAACVBQAgzgICAAAAAdoCAQAAAAHbAgIAAAAB3AICAAAAAd0CAgAAAAHeAgIAAAAB3wICAAAAAeACAgAAAAHhAgIAAAAB4gICAAAAAeMCQAAAAAHkAkAAAAABAgAAAAsAIC8AAIgIACADAAAACwAgLwAAiAgAIDAAAIcIACABKAAA6AgAMAIAAAALACAoAACHCAAgAgAAALMHACAoAACGCAAgDM4CAgD5BAAh2gIBAIMFACHbAgIA-QQAIdwCAgD5BAAh3QICAPkEACHeAgIA-QQAId8CAgD5BAAh4AICAPkEACHhAgIA-QQAIeICAgD5BAAh4wJAAPgEACHkAkAA-AQAIQ4FAACFBQAgBwAAhgUAIM4CAgD5BAAh2gIBAIMFACHbAgIA-QQAIdwCAgD5BAAh3QICAPkEACHeAgIA-QQAId8CAgD5BAAh4AICAPkEACHhAgIA-QQAIeICAgD5BAAh4wJAAPgEACHkAkAA-AQAIQ4FAACUBQAgBwAAlQUAIM4CAgAAAAHaAgEAAAAB2wICAAAAAdwCAgAAAAHdAgIAAAAB3gICAAAAAd8CAgAAAAHgAgIAAAAB4QICAAAAAeICAgAAAAHjAkAAAAAB5AJAAAAAAQwhAADvBgAgIgAAvQcAIM4CAgAAAAHjAkAAAAAB5AJAAAAAAegCAgAAAAGJAwEAAAABkwMBAAAAAZUDAAAAlQMClgMgAAAAAZcDAgAAAAGZAwAAAJkDAgIAAAABACAvAACUCAAgAwAAAAEAIC8AAJQIACAwAACTCAAgASgAAOcIADARAwAArQQAICEAAPAEACAiAADxBAAgywIAAOsEADDMAgAABwAQzQIAAOsEADDOAgIAAAABzwICAJ8EACHjAkAAsAQAIeQCQACwBAAh6AICAAAAAYkDAQAAAAGTAwEAoAQAIZUDAADsBJUDIpYDIADtBAAhlwMCAAAAAZkDAADvBJkDIgIAAAABACAoAACTCAAgAgAAAJEIACAoAACSCAAgDssCAACQCAAwzAIAAJEIABDNAgAAkAgAMM4CAgCfBAAhzwICAJ8EACHjAkAAsAQAIeQCQACwBAAh6AICAO4EACGJAwEAoAQAIZMDAQCgBAAhlQMAAOwElQMilgMgAO0EACGXAwIA7gQAIZkDAADvBJkDIg7LAgAAkAgAMMwCAACRCAAQzQIAAJAIADDOAgIAnwQAIc8CAgCfBAAh4wJAALAEACHkAkAAsAQAIegCAgDuBAAhiQMBAKAEACGTAwEAoAQAIZUDAADsBJUDIpYDIADtBAAhlwMCAO4EACGZAwAA7wSZAyIKzgICAPkEACHjAkAA-AQAIeQCQAD4BAAh6AICAO0GACGJAwEAgwUAIZMDAQCDBQAhlQMAAOgGlQMilgMgAOkGACGXAwIA7QYAIZkDAADqBpkDIgwhAADsBgAgIgAAvAcAIM4CAgD5BAAh4wJAAPgEACHkAkAA-AQAIegCAgDtBgAhiQMBAIMFACGTAwEAgwUAIZUDAADoBpUDIpYDIADpBgAhlwMCAO0GACGZAwAA6gaZAyIMIQAA7wYAICIAAL0HACDOAgIAAAAB4wJAAAAAAeQCQAAAAAHoAgIAAAABiQMBAAAAAZMDAQAAAAGVAwAAAJUDApYDIAAAAAGXAwIAAAABmQMAAACZAwIGBQAA_gUAIAsAAP8FACANAACABgAgzgICAAAAAdoCAQAAAAHiAgIAAAABAgAAABQAIC8AAJ0IACADAAAAFAAgLwAAnQgAIDAAAJwIACABKAAA5ggAMAIAAAAUACAoAACcCAAgAgAAAKcHACAoAACbCAAgA84CAgD5BAAh2gIBAIMFACHiAgIA-QQAIQYFAADiBQAgCwAA4wUAIA0AAOQFACDOAgIA-QQAIdoCAQCDBQAh4gICAPkEACEGBQAA_gUAIAsAAP8FACANAACABgAgzgICAAAAAdoCAQAAAAHiAgIAAAABChAAAMYFACASAADHBQAgFQAAyQUAIM4CAgAAAAHoAgIAAAAB9AICAAAAAfUCQAAAAAH2AkAAAAAB9wICAAAAAfkCAAAA-QICAgAAACgAIC8AAKYIACADAAAAKAAgLwAApggAIDAAAKUIACABKAAA5QgAMAIAAAAoACAoAAClCAAgAgAAAKUGACAoAACkCAAgB84CAgD5BAAh6AICAPkEACH0AgIA-QQAIfUCQAD4BAAh9gJAAJwFACH3AgIA-QQAIfkCAAC1BfkCIgoQAAC2BQAgEgAAtwUAIBUAALkFACDOAgIA-QQAIegCAgD5BAAh9AICAPkEACH1AkAA-AQAIfYCQACcBQAh9wICAPkEACH5AgAAtQX5AiIKEAAAxgUAIBIAAMcFACAVAADJBQAgzgICAAAAAegCAgAAAAH0AgIAAAAB9QJAAAAAAfYCQAAAAAH3AgIAAAAB-QIAAAD5AgIKBAAAkgcAIBEAAI8HACAVAACRBwAgFgAAkAcAIBcAAJMHACAYAACUBwAgGQAAlQcAIM4CAgAAAAHaAgEAAAABiAMBAAAAAQIAAAAkACAvAACyCAAgAwAAACQAIC8AALIIACAwAACxCAAgASgAAOQIADAPAwAArQQAIAQAANwEACARAAChBAAgFQAA2QQAIBYAANsEACAXAACiBAAgGAAA3QQAIBkAAN4EACDLAgAA2gQAMMwCAAAiABDNAgAA2gQAMM4CAgAAAAHPAgIAnwQAIdoCAQCgBAAhiAMBAKwEACECAAAAJAAgKAAAsQgAIAIAAACvCAAgKAAAsAgAIAfLAgAArggAMMwCAACvCAAQzQIAAK4IADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACGIAwEArAQAIQfLAgAArggAMMwCAACvCAAQzQIAAK4IADDOAgIAnwQAIc8CAgCfBAAh2gIBAKAEACGIAwEArAQAIQPOAgIA-QQAIdoCAQCDBQAhiAMBANkFACEKBAAAvgYAIBEAALsGACAVAAC9BgAgFgAAvAYAIBcAAL8GACAYAADABgAgGQAAwQYAIM4CAgD5BAAh2gIBAIMFACGIAwEA2QUAIQoEAACSBwAgEQAAjwcAIBUAAJEHACAWAACQBwAgFwAAkwcAIBgAAJQHACAZAACVBwAgzgICAAAAAdoCAQAAAAGIAwEAAAABBgQAAL8HACAJAADABwAgDgAAwQcAIM4CAgAAAAHaAgEAAAABiQMBAAAAAQIAAAAFACAvAAC-CAAgAwAAAAUAIC8AAL4IACAwAAC9CAAgASgAAOMIADALAwAArQQAIAQAANwEACAJAAC3BAAgDgAAtQQAIMsCAADyBAAwzAIAAAMAEM0CAADyBAAwzgICAAAAAc8CAgCfBAAh2gIBAKAEACGJAwEAAAABAgAAAAUAICgAAL0IACACAAAAuwgAICgAALwIACAHywIAALoIADDMAgAAuwgAEM0CAAC6CAAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAhiQMBAKAEACEHywIAALoIADDMAgAAuwgAEM0CAAC6CAAwzgICAJ8EACHPAgIAnwQAIdoCAQCgBAAhiQMBAKAEACEDzgICAPkEACHaAgEAgwUAIYkDAQCDBQAhBgQAAJwHACAJAACdBwAgDgAAngcAIM4CAgD5BAAh2gIBAIMFACGJAwEAgwUAIQYEAAC_BwAgCQAAwAcAIA4AAMEHACDOAgIAAAAB2gIBAAAAAYkDAQAAAAEELwAAswgAMKADAAC0CAAwogMAALYIACCmAwAAtwgAMAQvAACnCAAwoAMAAKgIADCiAwAAqggAIKYDAACrCAAwBC8AAJ4IADCgAwAAnwgAMKIDAAChCAAgpgMAAKEGADAELwAAlQgAMKADAACWCAAwogMAAJgIACCmAwAAowcAMAQvAACJCAAwoAMAAIoIADCiAwAAjAgAIKYDAACNCAAwBC8AAIAIADCgAwAAgQgAMKIDAACDCAAgpgMAAK8HADAELwAA9wcAMKADAAD4BwAwogMAAPoHACCmAwAAiwUAMAQvAADuBwAwoAMAAO8HADCiAwAA8QcAIKYDAADpBQAwAy8AAOkHACCgAwAA6gcAIKYDAACSAQAgAy8AAOQHACCgAwAA5QcAIKYDAACqAQAgAAAAAAAAAAEDAADNBwAgAgMAAM0HACCKAwAAlgUAIAAAAAAABAMAAM0HACAEAADdCAAgCQAAzQgAIA4AAMsIACAJAwAAzQcAIAQAAN0IACARAACrBgAgFQAA2wgAIBYAANwIACAXAACsBgAgGAAA3ggAIBkAAN8IACCIAwAAlgUAIAUDAADNBwAgEAAA2AgAIBIAANoIACAVAADbCAAg9gIAAJYFACACEQAAqwYAIBMAAKwGACAAAAUDAADNBwAgIQAA1wgAICIAANgIACDoAgAAlgUAIJcDAACWBQAgAAAEAwAAzQcAIAUAANcIACALAADhCAAgDQAAzwgAIAADAwAAzQcAIAUAANcIACAHAADOCAAgA84CAgAAAAHaAgEAAAABiQMBAAAAAQPOAgIAAAAB2gIBAAAAAYgDAQAAAAEHzgICAAAAAegCAgAAAAH0AgIAAAAB9QJAAAAAAfYCQAAAAAH3AgIAAAAB-QIAAAD5AgIDzgICAAAAAdoCAQAAAAHiAgIAAAABCs4CAgAAAAHjAkAAAAAB5AJAAAAAAegCAgAAAAGJAwEAAAABkwMBAAAAAZUDAAAAlQMClgMgAAAAAZcDAgAAAAGZAwAAAJkDAgzOAgIAAAAB2gIBAAAAAdsCAgAAAAHcAgIAAAAB3QICAAAAAd4CAgAAAAHfAgIAAAAB4AICAAAAAeECAgAAAAHiAgIAAAAB4wJAAAAAAeQCQAAAAAEDzgICAAAAAdACAgAAAAHRAkAAAAABA84CAgAAAAHRAkAAAAAB-gICAAAAAQwJAADECAAgDwAAvwgAIBEAAMEIACAaAADACAAgGwAAwggAIBwAAMMIACAdAADFCAAgHgAAxggAICAAAMgIACDOAgIAAAAB2gIBAAAAAeMCQAAAAAECAAAAeQAgLwAA6wgAIAMAAAB8ACAvAADrCAAgMAAA7wgAIA4AAAB8ACAJAADfBwAgDwAA2gcAIBEAANwHACAaAADbBwAgGwAA3QcAIBwAAN4HACAdAADgBwAgHgAA4QcAICAAAOMHACAoAADvCAAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhDAkAAN8HACAPAADaBwAgEQAA3AcAIBoAANsHACAbAADdBwAgHAAA3gcAIB0AAOAHACAeAADhBwAgIAAA4wcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQwJAADECAAgDwAAvwgAIBEAAMEIACAaAADACAAgGwAAwggAIBwAAMMIACAdAADFCAAgHgAAxggAIB8AAMcIACDOAgIAAAAB2gIBAAAAAeMCQAAAAAECAAAAeQAgLwAA8AgAIAMAAAB8ACAvAADwCAAgMAAA9AgAIA4AAAB8ACAJAADfBwAgDwAA2gcAIBEAANwHACAaAADbBwAgGwAA3QcAIBwAAN4HACAdAADgBwAgHgAA4QcAIB8AAOIHACAoAAD0CAAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhDAkAAN8HACAPAADaBwAgEQAA3AcAIBoAANsHACAbAADdBwAgHAAA3gcAIB0AAOAHACAeAADhBwAgHwAA4gcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQwJAADECAAgEQAAwQgAIBoAAMAIACAbAADCCAAgHAAAwwgAIB0AAMUIACAeAADGCAAgHwAAxwgAICAAAMgIACDOAgIAAAAB2gIBAAAAAeMCQAAAAAECAAAAeQAgLwAA9QgAIAsDAACOBwAgEQAAjwcAIBUAAJEHACAWAACQBwAgFwAAkwcAIBgAAJQHACAZAACVBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiAMBAAAAAQIAAAAkACAvAAD3CAAgAwAAACIAIC8AAPcIACAwAAD7CAAgDQAAACIAIAMAALoGACARAAC7BgAgFQAAvQYAIBYAALwGACAXAAC_BgAgGAAAwAYAIBkAAMEGACAoAAD7CAAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiAMBANkFACELAwAAugYAIBEAALsGACAVAAC9BgAgFgAAvAYAIBcAAL8GACAYAADABgAgGQAAwQYAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhDM4CAgAAAAHPAgIAAAAB2gIBAAAAAdsCAgAAAAHcAgIAAAAB3QICAAAAAd4CAgAAAAHfAgIAAAAB4AICAAAAAeECAgAAAAHjAkAAAAAB5AJAAAAAAQPOAgIAAAABzwICAAAAAdoCAQAAAAEDAAAAfAAgLwAA9QgAIDAAAIAJACAOAAAAfAAgCQAA3wcAIBEAANwHACAaAADbBwAgGwAA3QcAIBwAAN4HACAdAADgBwAgHgAA4QcAIB8AAOIHACAgAADjBwAgKAAAgAkAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQwJAADfBwAgEQAA3AcAIBoAANsHACAbAADdBwAgHAAA3gcAIB0AAOAHACAeAADhBwAgHwAA4gcAICAAAOMHACDOAgIA-QQAIdoCAQCDBQAh4wJAAPgEACEMCQAAxAgAIA8AAL8IACARAADBCAAgGwAAwggAIBwAAMMIACAdAADFCAAgHgAAxggAIB8AAMcIACAgAADICAAgzgICAAAAAdoCAQAAAAHjAkAAAAABAgAAAHkAIC8AAIEJACAHzgICAAAAAc8CAgAAAAH0AgIAAAAB9QJAAAAAAfYCQAAAAAH3AgIAAAAB-QIAAAD5AgIFzgICAAAAAe0CQAAAAAHuAgIAAAAB7wICAAAAAfACAgAAAAEEzgICAAAAAe0CQAAAAAHyAgAAAPICAvMCAgAAAAEHAwAAvgcAIAkAAMAHACAOAADBBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiQMBAAAAAQIAAAAFACAvAACGCQAgDAkAAMQIACAPAAC_CAAgEQAAwQgAIBoAAMAIACAbAADCCAAgHQAAxQgAIB4AAMYIACAfAADHCAAgIAAAyAgAIM4CAgAAAAHaAgEAAAAB4wJAAAAAAQIAAAB5ACAvAACICQAgAwAAAAMAIC8AAIYJACAwAACMCQAgCQAAAAMAIAMAAJsHACAJAACdBwAgDgAAngcAICgAAIwJACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGJAwEAgwUAIQcDAACbBwAgCQAAnQcAIA4AAJ4HACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGJAwEAgwUAIQMAAAB8ACAvAACICQAgMAAAjwkAIA4AAAB8ACAJAADfBwAgDwAA2gcAIBEAANwHACAaAADbBwAgGwAA3QcAIB0AAOAHACAeAADhBwAgHwAA4gcAICAAAOMHACAoAACPCQAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhDAkAAN8HACAPAADaBwAgEQAA3AcAIBoAANsHACAbAADdBwAgHQAA4AcAIB4AAOEHACAfAADiBwAgIAAA4wcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQPOAgIAAAAB9AICAAAAAf8CAgAAAAEDzgICAAAAAYYDAAAAhgMChwMBAAAAAQXOAgIAAAAB6QJAAAAAAeoCQAAAAAHrAgIAAAAB7AICAAAAAQMAAAB8ACAvAACBCQAgMAAAlQkAIA4AAAB8ACAJAADfBwAgDwAA2gcAIBEAANwHACAbAADdBwAgHAAA3gcAIB0AAOAHACAeAADhBwAgHwAA4gcAICAAAOMHACAoAACVCQAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhDAkAAN8HACAPAADaBwAgEQAA3AcAIBsAAN0HACAcAADeBwAgHQAA4AcAIB4AAOEHACAfAADiBwAgIAAA4wcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQsDAACOBwAgBAAAkgcAIBEAAI8HACAVAACRBwAgFgAAkAcAIBcAAJMHACAZAACVBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiAMBAAAAAQIAAAAkACAvAACWCQAgAwAAACIAIC8AAJYJACAwAACaCQAgDQAAACIAIAMAALoGACAEAAC-BgAgEQAAuwYAIBUAAL0GACAWAAC8BgAgFwAAvwYAIBkAAMEGACAoAACaCQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiAMBANkFACELAwAAugYAIAQAAL4GACARAAC7BgAgFQAAvQYAIBYAALwGACAXAAC_BgAgGQAAwQYAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhB84CAgAAAAHPAgIAAAAB6AICAAAAAfUCQAAAAAH2AkAAAAAB9wICAAAAAfkCAAAA-QICA84CAgAAAAHoAgIAAAAB_wICAAAAAQQRAACpBgAgzgICAAAAAYADAQAAAAGBAwIAAAABAgAAAIQCACAvAACdCQAgCwMAAI4HACAEAACSBwAgEQAAjwcAIBUAAJEHACAWAACQBwAgGAAAlAcAIBkAAJUHACDOAgIAAAABzwICAAAAAdoCAQAAAAGIAwEAAAABAgAAACQAIC8AAJ8JACADAAAAhwIAIC8AAJ0JACAwAACjCQAgBgAAAIcCACARAACPBgAgKAAAowkAIM4CAgD5BAAhgAMBAIMFACGBAwIA-QQAIQQRAACPBgAgzgICAPkEACGAAwEAgwUAIYEDAgD5BAAhAwAAACIAIC8AAJ8JACAwAACmCQAgDQAAACIAIAMAALoGACAEAAC-BgAgEQAAuwYAIBUAAL0GACAWAAC8BgAgGAAAwAYAIBkAAMEGACAoAACmCQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiAMBANkFACELAwAAugYAIAQAAL4GACARAAC7BgAgFQAAvQYAIBYAALwGACAYAADABgAgGQAAwQYAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhBwMAAL4HACAEAAC_BwAgCQAAwAcAIM4CAgAAAAHPAgIAAAAB2gIBAAAAAYkDAQAAAAECAAAABQAgLwAApwkAIAwJAADECAAgDwAAvwgAIBEAAMEIACAaAADACAAgHAAAwwgAIB0AAMUIACAeAADGCAAgHwAAxwgAICAAAMgIACDOAgIAAAAB2gIBAAAAAeMCQAAAAAECAAAAeQAgLwAAqQkAIAXOAgIAAAAB2gIBAAAAAfsCAgAAAAH8AgIAAAAB_gIAAAD-AgIDzgICAAAAAc8CAgAAAAHRAkAAAAABAwAAAAMAIC8AAKcJACAwAACvCQAgCQAAAAMAIAMAAJsHACAEAACcBwAgCQAAnQcAICgAAK8JACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGJAwEAgwUAIQcDAACbBwAgBAAAnAcAIAkAAJ0HACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGJAwEAgwUAIQMAAAB8ACAvAACpCQAgMAAAsgkAIA4AAAB8ACAJAADfBwAgDwAA2gcAIBEAANwHACAaAADbBwAgHAAA3gcAIB0AAOAHACAeAADhBwAgHwAA4gcAICAAAOMHACAoAACyCQAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhDAkAAN8HACAPAADaBwAgEQAA3AcAIBoAANsHACAcAADeBwAgHQAA4AcAIB4AAOEHACAfAADiBwAgIAAA4wcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQcDAAD9BQAgBQAA_gUAIA0AAIAGACDOAgIAAAABzwICAAAAAdoCAQAAAAHiAgIAAAABAgAAABQAIC8AALMJACADAAAAEgAgLwAAswkAIDAAALcJACAJAAAAEgAgAwAA4QUAIAUAAOIFACANAADkBQAgKAAAtwkAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIeICAgD5BAAhBwMAAOEFACAFAADiBQAgDQAA5AUAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIeICAgD5BAAhBwMAAP0FACAFAAD-BQAgCwAA_wUAIM4CAgAAAAHPAgIAAAAB2gIBAAAAAeICAgAAAAECAAAAFAAgLwAAuAkAIAwJAADECAAgDwAAvwgAIBEAAMEIACAaAADACAAgGwAAwggAIBwAAMMIACAdAADFCAAgHwAAxwgAICAAAMgIACDOAgIAAAAB2gIBAAAAAeMCQAAAAAECAAAAeQAgLwAAugkAIAMAAAASACAvAAC4CQAgMAAAvgkAIAkAAAASACADAADhBQAgBQAA4gUAIAsAAOMFACAoAAC-CQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAh4gICAPkEACEHAwAA4QUAIAUAAOIFACALAADjBQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAh4gICAPkEACEDAAAAfAAgLwAAugkAIDAAAMEJACAOAAAAfAAgCQAA3wcAIA8AANoHACARAADcBwAgGgAA2wcAIBsAAN0HACAcAADeBwAgHQAA4AcAIB8AAOIHACAgAADjBwAgKAAAwQkAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQwJAADfBwAgDwAA2gcAIBEAANwHACAaAADbBwAgGwAA3QcAIBwAAN4HACAdAADgBwAgHwAA4gcAICAAAOMHACDOAgIA-QQAIdoCAQCDBQAh4wJAAPgEACEMCQAAxAgAIA8AAL8IACAaAADACAAgGwAAwggAIBwAAMMIACAdAADFCAAgHgAAxggAIB8AAMcIACAgAADICAAgzgICAAAAAdoCAQAAAAHjAkAAAAABAgAAAHkAIC8AAMIJACAEEwAAqgYAIM4CAgAAAAGAAwEAAAABgQMCAAAAAQIAAACEAgAgLwAAxAkAIAsDAACOBwAgBAAAkgcAIBUAAJEHACAWAACQBwAgFwAAkwcAIBgAAJQHACAZAACVBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiAMBAAAAAQIAAAAkACAvAADGCQAgBM4CAgAAAAHoAgIAAAAB7QJAAAAAAfICAAAA8gICAwAAAHwAIC8AAMIJACAwAADLCQAgDgAAAHwAIAkAAN8HACAPAADaBwAgGgAA2wcAIBsAAN0HACAcAADeBwAgHQAA4AcAIB4AAOEHACAfAADiBwAgIAAA4wcAICgAAMsJACDOAgIA-QQAIdoCAQCDBQAh4wJAAPgEACEMCQAA3wcAIA8AANoHACAaAADbBwAgGwAA3QcAIBwAAN4HACAdAADgBwAgHgAA4QcAIB8AAOIHACAgAADjBwAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhAwAAAIcCACAvAADECQAgMAAAzgkAIAYAAACHAgAgEwAAkAYAICgAAM4JACDOAgIA-QQAIYADAQCDBQAhgQMCAPkEACEEEwAAkAYAIM4CAgD5BAAhgAMBAIMFACGBAwIA-QQAIQMAAAAiACAvAADGCQAgMAAA0QkAIA0AAAAiACADAAC6BgAgBAAAvgYAIBUAAL0GACAWAAC8BgAgFwAAvwYAIBgAAMAGACAZAADBBgAgKAAA0QkAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhCwMAALoGACAEAAC-BgAgFQAAvQYAIBYAALwGACAXAAC_BgAgGAAAwAYAIBkAAMEGACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGIAwEA2QUAIQsDAACOBwAgBAAAkgcAIBEAAI8HACAWAACQBwAgFwAAkwcAIBgAAJQHACAZAACVBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiAMBAAAAAQIAAAAkACAvAADSCQAgCwMAAMgFACAQAADGBQAgEgAAxwUAIM4CAgAAAAHPAgIAAAAB6AICAAAAAfQCAgAAAAH1AkAAAAAB9gJAAAAAAfcCAgAAAAH5AgAAAPkCAgIAAAAoACAvAADUCQAgAwAAACIAIC8AANIJACAwAADYCQAgDQAAACIAIAMAALoGACAEAAC-BgAgEQAAuwYAIBYAALwGACAXAAC_BgAgGAAAwAYAIBkAAMEGACAoAADYCQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiAMBANkFACELAwAAugYAIAQAAL4GACARAAC7BgAgFgAAvAYAIBcAAL8GACAYAADABgAgGQAAwQYAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhAwAAACYAIC8AANQJACAwAADbCQAgDQAAACYAIAMAALgFACAQAAC2BQAgEgAAtwUAICgAANsJACDOAgIA-QQAIc8CAgD5BAAh6AICAPkEACH0AgIA-QQAIfUCQAD4BAAh9gJAAJwFACH3AgIA-QQAIfkCAAC1BfkCIgsDAAC4BQAgEAAAtgUAIBIAALcFACDOAgIA-QQAIc8CAgD5BAAh6AICAPkEACH0AgIA-QQAIfUCQAD4BAAh9gJAAJwFACH3AgIA-QQAIfkCAAC1BfkCIgsDAACOBwAgBAAAkgcAIBEAAI8HACAVAACRBwAgFwAAkwcAIBgAAJQHACAZAACVBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiAMBAAAAAQIAAAAkACAvAADcCQAgAwAAACIAIC8AANwJACAwAADgCQAgDQAAACIAIAMAALoGACAEAAC-BgAgEQAAuwYAIBUAAL0GACAXAAC_BgAgGAAAwAYAIBkAAMEGACAoAADgCQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiAMBANkFACELAwAAugYAIAQAAL4GACARAAC7BgAgFQAAvQYAIBcAAL8GACAYAADABgAgGQAAwQYAIM4CAgD5BAAhzwICAPkEACHaAgEAgwUAIYgDAQDZBQAhCwMAAI4HACAEAACSBwAgEQAAjwcAIBUAAJEHACAWAACQBwAgFwAAkwcAIBgAAJQHACDOAgIAAAABzwICAAAAAdoCAQAAAAGIAwEAAAABAgAAACQAIC8AAOEJACADAAAAIgAgLwAA4QkAIDAAAOUJACANAAAAIgAgAwAAugYAIAQAAL4GACARAAC7BgAgFQAAvQYAIBYAALwGACAXAAC_BgAgGAAAwAYAICgAAOUJACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACGIAwEA2QUAIQsDAAC6BgAgBAAAvgYAIBEAALsGACAVAAC9BgAgFgAAvAYAIBcAAL8GACAYAADABgAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiAMBANkFACEHAwAAvgcAIAQAAL8HACAOAADBBwAgzgICAAAAAc8CAgAAAAHaAgEAAAABiQMBAAAAAQIAAAAFACAvAADmCQAgDA8AAL8IACARAADBCAAgGgAAwAgAIBsAAMIIACAcAADDCAAgHQAAxQgAIB4AAMYIACAfAADHCAAgIAAAyAgAIM4CAgAAAAHaAgEAAAAB4wJAAAAAAQIAAAB5ACAvAADoCQAgA84CAgAAAAHPAgIAAAAB0QJAAAAAAQMAAAADACAvAADmCQAgMAAA7QkAIAkAAAADACADAACbBwAgBAAAnAcAIA4AAJ4HACAoAADtCQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiQMBAIMFACEHAwAAmwcAIAQAAJwHACAOAACeBwAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAhiQMBAIMFACEDAAAAfAAgLwAA6AkAIDAAAPAJACAOAAAAfAAgDwAA2gcAIBEAANwHACAaAADbBwAgGwAA3QcAIBwAAN4HACAdAADgBwAgHgAA4QcAIB8AAOIHACAgAADjBwAgKAAA8AkAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQwPAADaBwAgEQAA3AcAIBoAANsHACAbAADdBwAgHAAA3gcAIB0AAOAHACAeAADhBwAgHwAA4gcAICAAAOMHACDOAgIA-QQAIdoCAQCDBQAh4wJAAPgEACEPAwAAkwUAIAUAAJQFACDOAgIAAAABzwICAAAAAdoCAQAAAAHbAgIAAAAB3AICAAAAAd0CAgAAAAHeAgIAAAAB3wICAAAAAeACAgAAAAHhAgIAAAAB4gICAAAAAeMCQAAAAAHkAkAAAAABAgAAAAsAIC8AAPEJACAMCQAAxAgAIA8AAL8IACARAADBCAAgGgAAwAgAIBsAAMIIACAcAADDCAAgHgAAxggAIB8AAMcIACAgAADICAAgzgICAAAAAdoCAQAAAAHjAkAAAAABAgAAAHkAIC8AAPMJACADAAAACQAgLwAA8QkAIDAAAPcJACARAAAACQAgAwAAhAUAIAUAAIUFACAoAAD3CQAgzgICAPkEACHPAgIA-QQAIdoCAQCDBQAh2wICAPkEACHcAgIA-QQAId0CAgD5BAAh3gICAPkEACHfAgIA-QQAIeACAgD5BAAh4QICAPkEACHiAgIA-QQAIeMCQAD4BAAh5AJAAPgEACEPAwAAhAUAIAUAAIUFACDOAgIA-QQAIc8CAgD5BAAh2gIBAIMFACHbAgIA-QQAIdwCAgD5BAAh3QICAPkEACHeAgIA-QQAId8CAgD5BAAh4AICAPkEACHhAgIA-QQAIeICAgD5BAAh4wJAAPgEACHkAkAA-AQAIQMAAAB8ACAvAADzCQAgMAAA-gkAIA4AAAB8ACAJAADfBwAgDwAA2gcAIBEAANwHACAaAADbBwAgGwAA3QcAIBwAAN4HACAeAADhBwAgHwAA4gcAICAAAOMHACAoAAD6CQAgzgICAPkEACHaAgEAgwUAIeMCQAD4BAAhDAkAAN8HACAPAADaBwAgEQAA3AcAIBoAANsHACAbAADdBwAgHAAA3gcAIB4AAOEHACAfAADiBwAgIAAA4wcAIM4CAgD5BAAh2gIBAIMFACHjAkAA-AQAIQMDAAIhXgMiXwwLCAAZCU8EDwYDEUsNGiUMG0wHHE4BHVAFHlEJH1MXIFUYBQMAAgQIAQgACwkMBA4VBwQDAAIFAAMHEAUIAAYCAwACBgAEAQcRAAUDAAIFAAMIAAoLGQgNHQkBCgAHAgMAAgwABwILHgANHwACCSAADiEACQMAAgQ7AQgAFhEpDRU6ERY5Exc8DxhAFBlEFQUDAAIIABIQAAwSAA4VNBEDCAAQESoNEy4PAhAADBIADgIRLwATMAACEAAMFAANARU1AAEQAAwBEAAMARAADAYRRQAVRwAWRgAXSAAYSQAZSgABAwACAQMAAggJWwAPVgARWAAaVwAbWQAcWgAdXAAeXQAAAwMAAiFpAyJqDAMDAAIhcAMicQwFCAAeNQAfNgAgNwAhOAAiAAAAAAAFCAAeNQAfNgAgNwAhOAAiAAAFCAAnNQAoNgApNwAqOAArAAAAAAAFCAAnNQAoNgApNwAqOAArAQMAAgEDAAIFCAAwNQAxNgAyNwAzOAA0AAAAAAAFCAAwNQAxNgAyNwAzOAA0AQMAAgEDAAIFCAA5NQA6NgA7NwA8OAA9AAAAAAAFCAA5NQA6NgA7NwA8OAA9AQMAAgEDAAIFCABCNQBDNgBENwBFOABGAAAAAAAFCABCNQBDNgBENwBFOABGAQMAAgEDAAIFCABLNQBMNgBNNwBOOABPAAAAAAAFCABLNQBMNgBNNwBOOABPARAADAEQAAwFCABUNQBVNgBWNwBXOABYAAAAAAAFCABUNQBVNgBWNwBXOABYAAAFCABdNQBeNgBfNwBgOABhAAAAAAAFCABdNQBeNgBfNwBgOABhAhAADBIADgIQAAwSAA4FCABmNQBnNgBoNwBpOABqAAAAAAAFCABmNQBnNgBoNwBpOABqAgMAAgUAAwIDAAIFAAMFCABvNQBwNgBxNwByOABzAAAAAAAFCABvNQBwNgBxNwByOABzAQoABwEKAAcFCAB4NQB5NgB6NwB7OAB8AAAAAAAFCAB4NQB5NgB6NwB7OAB8AgMAAgwABwIDAAIMAAcFCACBATUAggE2AIMBNwCEATgAhQEAAAAAAAUIAIEBNQCCATYAgwE3AIQBOACFAQMDAAIQAAwSAA4DAwACEAAMEgAOBQgAigE1AIsBNgCMATcAjQE4AI4BAAAAAAAFCACKATUAiwE2AIwBNwCNATgAjgECEAAMFAANAhAADBQADQUIAJMBNQCUATYAlQE3AJYBOACXAQAAAAAABQgAkwE1AJQBNgCVATcAlgE4AJcBARAADAEQAAwFCACcATUAnQE2AJ4BNwCfATgAoAEAAAAAAAUIAJwBNQCdATYAngE3AJ8BOACgAQEQAAwBEAAMBQgApQE1AKYBNgCnATcAqAE4AKkBAAAAAAAFCAClATUApgE2AKcBNwCoATgAqQECAwACBQADAgMAAgUAAwUIAK4BNQCvATYAsAE3ALEBOACyAQAAAAAABQgArgE1AK8BNgCwATcAsQE4ALIBAgMAAgYABAIDAAIGAAQFCAC3ATUAuAE2ALkBNwC6ATgAuwEAAAAAAAUIALcBNQC4ATYAuQE3ALoBOAC7ASMCASRgASVhASZiASdjASllASpnGitoGyxsAS1uGi5vHDFyATJzATN0Gjl3HTp4Izt6Ajx7Aj1-Aj5_Aj-AAQJAggECQYQBGkKFASRDhwECRIkBGkWKASVGiwECR4wBAkiNARpJkAEmSpEBLEuTARdMlAEXTZYBF06XARdPmAEXUJoBF1GcARpSnQEtU58BF1ShARpVogEuVqMBF1ekARdYpQEaWagBL1qpATVbqwEYXKwBGF2uARherwEYX7ABGGCyARhhtAEaYrUBNmO3ARhkuQEaZboBN2a7ARhnvAEYaL0BGmnAAThqwQE-a8IBA2zDAQNtxAEDbsUBA2_GAQNwyAEDccoBGnLLAT9zzQEDdM8BGnXQAUB20QEDd9IBA3jTARp51gFBetcBR3vYAQx82QEMfdoBDH7bAQx_3AEMgAHeAQyBAeABGoIB4QFIgwHjAQyEAeUBGoUB5gFJhgHnAQyHAegBDIgB6QEaiQHsAUqKAe0BUIsB7gEUjAHvARSNAfABFI4B8QEUjwHyARSQAfQBFJEB9gEakgH3AVGTAfkBFJQB-wEalQH8AVKWAf0BFJcB_gEUmAH_ARqZAYICU5oBgwJZmwGFAg6cAYYCDp0BiQIOngGKAg6fAYsCDqABjQIOoQGPAhqiAZACWqMBkgIOpAGUAhqlAZUCW6YBlgIOpwGXAg6oAZgCGqkBmwJcqgGcAmKrAZ0CD6wBngIPrQGfAg-uAaACD68BoQIPsAGjAg-xAaUCGrIBpgJjswGoAg-0AaoCGrUBqwJktgGsAg-3Aa0CD7gBrgIauQGxAmW6AbICa7sBswIHvAG0Age9AbUCB74BtgIHvwG3AgfAAbkCB8EBuwIawgG8AmzDAb4CB8QBwAIaxQHBAm3GAcICB8cBwwIHyAHEAhrJAccCbsoByAJ0ywHJAgjMAcoCCM0BywIIzgHMAgjPAc0CCNABzwII0QHRAhrSAdICddMB1AII1AHWAhrVAdcCdtYB2AII1wHZAgjYAdoCGtkB3QJ32gHeAn3bAd8CCdwB4AIJ3QHhAgneAeICCd8B4wIJ4AHlAgnhAecCGuIB6AJ-4wHqAgnkAewCGuUB7QJ_5gHuAgnnAe8CCegB8AIa6QHzAoAB6gH0AoYB6wH1Ag3sAfYCDe0B9wIN7gH4Ag3vAfkCDfAB-wIN8QH9AhryAf4ChwHzAYADDfQBggMa9QGDA4gB9gGEAw33AYUDDfgBhgMa-QGJA4kB-gGKA48B-wGLAxH8AYwDEf0BjQMR_gGOAxH_AY8DEYACkQMRgQKTAxqCApQDkAGDApYDEYQCmAMahQKZA5EBhgKaAxGHApsDEYgCnAMaiQKfA5IBigKgA5gBiwKhAxOMAqIDE40CowMTjgKkAxOPAqUDE5ACpwMTkQKpAxqSAqoDmQGTAqwDE5QCrgMalQKvA5oBlgKwAxOXArEDE5gCsgMamQK1A5sBmgK2A6EBmwK3AxWcArgDFZ0CuQMVngK6AxWfArsDFaACvQMVoQK_AxqiAsADogGjAsIDFaQCxAMapQLFA6MBpgLGAxWnAscDFagCyAMaqQLLA6QBqgLMA6oBqwLNAwSsAs4DBK0CzwMErgLQAwSvAtEDBLAC0wMEsQLVAxqyAtYDqwGzAtgDBLQC2gMatQLbA6wBtgLcAwS3At0DBLgC3gMauQLhA60BugLiA7MBuwLjAwW8AuQDBb0C5QMFvgLmAwW_AucDBcAC6QMFwQLrAxrCAuwDtAHDAu4DBcQC8AMaxQLxA7UBxgLyAwXHAvMDBcgC9AMayQL3A7YBygL4A7wB"
};
async function decodeBase64AsWasm(wasmBase64) {
	const { Buffer } = await import("node:buffer");
	const wasmArray = Buffer.from(wasmBase64, "base64");
	return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
	getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
	getQueryCompilerWasmModule: async () => {
		const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
		return await decodeBase64AsWasm(wasm);
	},
	importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
	return runtime.getPrismaClient(config);
}
runtime.PrismaClientKnownRequestError;
runtime.PrismaClientUnknownRequestError;
runtime.PrismaClientRustPanicError;
runtime.PrismaClientInitializationError;
runtime.PrismaClientValidationError;
/**
* Re-export of sql-template-tag
*/
const sql = runtime.sqltag;
const empty = runtime.empty;
const join = runtime.join;
const raw = runtime.raw;
runtime.Sql;
runtime.Decimal;
runtime.Extensions.getExtensionContext;
runtime.NullTypes.DbNull, runtime.NullTypes.JsonNull, runtime.NullTypes.AnyNull;
runtime.DbNull;
runtime.JsonNull;
runtime.AnyNull;
runtime.makeStrictEnum({
	ReadUncommitted: "ReadUncommitted",
	ReadCommitted: "ReadCommitted",
	RepeatableRead: "RepeatableRead",
	Serializable: "Serializable"
});
runtime.Extensions.defineExtension;
//#endregion
//#region generated/prisma/enums.ts
const Role = {
	MAIN_ADMIN: "MAIN_ADMIN",
	MANAGER: "MANAGER",
	AGENT: "AGENT"
};
const BlockType = {
	WORKING: "WORKING",
	REST: "REST",
	EXTRA_TIME: "EXTRA_TIME"
};
const EventType = {
	SEED: "SEED",
	LEAD: "LEAD",
	SALE: "SALE"
};
const WEEK_DAYS = {
	MONDAY: "MONDAY",
	TUESDAY: "TUESDAY",
	WEDNESDAY: "WEDNESDAY",
	THURSDAY: "THURSDAY",
	FRIDAY: "FRIDAY",
	SATURDAY: "SATURDAY",
	SUNDAY: "SUNDAY"
};
//#endregion
//#region generated/prisma/client.ts
globalThis["__dirname"] = path$1.dirname(fileURLToPath(import.meta.url));
//#endregion
//#region lib/prisma.ts
const prisma = new (getPrismaClientClass())({ adapter: new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` }) });
//#endregion
//#region utils/date.ts
/**
* Converts a target wall-clock time (ISO string) in a specific IANA timezone 
* into a precise UTC Date object.
*/
const getZonedUtcDate = (isoString, ianaTimezone) => {
	const targetTime = new Date(isoString);
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: ianaTimezone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hour12: false
	}).formatToParts(targetTime);
	const v = {};
	parts.forEach((p) => v[p.type] = p.value);
	const diff = new Date(Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour), Number(v.minute), Number(v.second))).getTime() - targetTime.getTime();
	return new Date(targetTime.getTime() - diff);
};
/**
* Converts a precise UTC Date/string into a Date object representing 
* the "Wall Clock" time in a specific IANA timezone.
* * Example: If UTC is 12:00 PM and Bogota is UTC-5, 
* this returns a Date object set to 07:00 AM.
*/
const getZonedLocalTime = (utcDate, ianaTimezone) => {
	const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: ianaTimezone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hour12: false
	}).formatToParts(date);
	const v = {};
	parts.forEach((p) => v[p.type] = p.value);
	return new Date(Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour), Number(v.minute), Number(v.second)));
};
const getYYYYMMDD = (d) => {
	const dateObj = new Date(d);
	return `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
};
/**
* We use Intl to find the offset for this specific timezone at this specific time.
* This is safer than hardcoding -4 because of potential Daylight Saving changes
* (though usually not an issue on Jan 1st, it's a good habit).
*/
const getUTC = (dateStr, timeZone) => {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false
	});
	const date = new Date(dateStr);
	const parts = formatter.formatToParts(date);
	const partMap = {};
	parts.forEach((p) => partMap[p.type] = p.value);
	const utcDate = Date.UTC(parseInt(partMap.year), parseInt(partMap.month) - 1, parseInt(partMap.day), parseInt(partMap.hour), parseInt(partMap.minute), parseInt(partMap.second));
	const offset = date.getTime() - utcDate;
	return new Date(date.getTime() + offset);
};
const getYearBoundariesInUTC = (year, iana) => {
	const localStartStr = `${year}-01-01T00:00:00`;
	const localEndStr = `${year + 1}-01-01T00:00:00`;
	const startDate = getUTC(localStartStr, iana);
	const endDate = getUTC(localEndStr, iana);
	return {
		startDate,
		endDate,
		startDateISO: startDate.toISOString(),
		endDateISO: endDate.toISOString()
	};
};
const getDayBoundariesInUTC = (dateStr, iana) => {
	const localStartIso = `${dateStr}T00:00:00.000Z`;
	const localEndIso = `${dateStr}T23:59:59.999Z`;
	const startDate = getUTC(localStartIso, iana);
	const endDate = getUTC(localEndIso, iana);
	return {
		startDate,
		endDate,
		startDateISO: startDate.toISOString(),
		endDateISO: endDate.toISOString()
	};
};
/**
* Converts a date string in a specific IANA timezone to a UTC ISO string.
* @param {string} dateStr - Format "YYYY-MM-DD HH:mm:ss"
* @param {string} ianaZone - e.g., "America/New_York", "Asia/Tokyo"
*/
const convertDBToUTC = (dateStr, ianaZone) => {
	const normalizedStr = dateStr.replace(" ", "T");
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: ianaZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false
	});
	const tempDate = /* @__PURE__ */ new Date(normalizedStr + "Z");
	const p = formatter.formatToParts(tempDate).reduce((acc, part) => {
		acc[part.type] = part.value;
		return acc;
	}, {});
	const offsetMilliseconds = (/* @__PURE__ */ new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)).getTime() - tempDate.getTime();
	return new Date((/* @__PURE__ */ new Date(normalizedStr + "Z")).getTime() - offsetMilliseconds);
};
/**
* Calculates the UTC start and end dates for each day of the week 
* based on a reference date and a target IANA timezone.
*/
function getDailyWeekBoundariesInUTC(yymmdd, ianaZone) {
	const wallTime = new Date(`${yymmdd}T00:00:00.000Z`.replace(/Z$/i, ""));
	const dayOfWeek = wallTime.getDay();
	const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const monday = new Date(wallTime);
	monday.setDate(wallTime.getDate() + diffToMonday);
	monday.setHours(0, 0, 0, 0);
	const weekDays = [];
	for (let i = 0; i < 7; i++) {
		const currentDay = new Date(monday);
		currentDay.setDate(monday.getDate() + i);
		const localStart = new Date(currentDay);
		const localEnd = new Date(currentDay);
		localEnd.setHours(23, 59, 59, 999);
		weekDays.push({
			startDate: convertWallTimeToUTC(localStart, ianaZone),
			endDate: convertWallTimeToUTC(localEnd, ianaZone)
		});
	}
	return weekDays;
}
/**
* Helper: Adjusts a 'wall clock' date to a real UTC Date 
* by subtracting the timezone offset.
*/
function convertWallTimeToUTC(date, timeZone) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hour12: false
	}).formatToParts(date);
	const offset = (/* @__PURE__ */ new Date(`${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value} ${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}:${parts.find((p) => p.type === "second")?.value}`)).getTime() - date.getTime();
	return new Date(date.getTime() - offset);
}
//#endregion
//#region controllers/Webhook.controller.ts
/**
* handleCallWebhook
* Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
*/
const handleCallWebhook = async (lastCallId, companyId) => {
	const company = await prisma.company.findUnique({
		where: { id: companyId },
		include: { leadDeskCustomData: true }
	});
	if (!company) throw new Error("Company not found");
	if (!company.leadDeskCustomData) throw new Error("no custom data for this company");
	if (company.leadDeskCustomData.SaleEventIds.length == 0) throw "Should set LeadDesk Sale Event Ids";
	if (company.leadDeskCustomData.SeedEventIds.length == 0) throw "Should set LeadDesk Seed Event Ids";
	if (!company.leadDeskCustomData.authString) throw new Error("Should set LeadDesk Auth String");
	const ld = (await axios.get(`https://api.leaddesk.com`, { params: {
		auth: company.leadDeskCustomData.authString,
		mod: "call",
		cmd: "get",
		call_ref_id: lastCallId
	} })).data;
	const agentToThird = await prisma.agentToThird.findUnique({ where: { serviceIdentifier_agentServiceIdentifier: {
		serviceIdentifier: "LEADDESK",
		agentServiceIdentifier: String(ld.agent_id)
	} } });
	if (!agentToThird) throw /* @__PURE__ */ new Error(`Agent ${ld.agent_id} has no relation with this third party service`);
	const agent = await prisma.agent.findUnique({
		where: {
			companyId: company.id,
			id: agentToThird.agentId
		},
		include: { user: true }
	});
	if (!agent) throw /* @__PURE__ */ new Error("Agent does not exists");
	if (agent.user?.status != "ACTIVE") throw /* @__PURE__ */ new Error("Agent is not active");
	return await prisma.$transaction(async (tx) => {
		const callee = await tx.callee.upsert({
			where: { phoneNumber: ld.number },
			update: { totalAttempts: { increment: 1 } },
			create: {
				phoneNumber: ld.number,
				totalAttempts: 1
			}
		});
		const agentToCallee = await tx.agentToCallee.upsert({
			where: { agentId_calleeId: {
				agentId: agent.id,
				calleeId: callee.id
			} },
			update: { totalAttemps: { increment: 1 } },
			create: {
				agentId: agent.id,
				calleeId: callee.id,
				totalAttemps: 1
			}
		});
		const call = await tx.call.create({ data: {
			agentId: agent.id,
			calleeId: callee.id,
			startAt: convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone),
			endAt: convertDBToUTC(ld.talk_end, company.leadDeskCustomData?.IANATimeZone),
			durationSeconds: parseInt(ld.talk_time),
			companyId: company.id,
			dayOfTheWeek: mapDateToWeekDayEnum(ld.talk_start, company.leadDeskCustomData?.IANATimeZone)
		} });
		if (company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason) || company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason_name)) await tx.funnelEvent.create({ data: {
			timestamp: convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone),
			agentId: agent.id,
			callId: call.id,
			type: "SEED"
		} });
		if (agentToCallee.totalAttemps > 1) await tx.funnelEvent.create({ data: {
			timestamp: convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone),
			agentId: agent.id,
			callId: call.id,
			type: "LEAD"
		} });
		if (company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason) || company.leadDeskCustomData?.SeedEventIds.includes(ld.call_ending_reason_name)) await tx.funnelEvent.create({ data: {
			timestamp: convertDBToUTC(ld.talk_start, company.leadDeskCustomData?.IANATimeZone),
			agentId: agent.id,
			callId: call.id,
			type: "SALE"
		} });
		return call;
	});
};
/**
* Maps JS getDay() (0-6) to WEEK_DAYS enum strings.
* JS getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
*/
const mapDateToWeekDayEnum = (dateString, iana) => {
	const dayIndex = convertDBToUTC(dateString, iana).getUTCDay();
	return {
		0: WEEK_DAYS.SUNDAY,
		1: WEEK_DAYS.MONDAY,
		2: WEEK_DAYS.TUESDAY,
		3: WEEK_DAYS.WEDNESDAY,
		4: WEEK_DAYS.THURSDAY,
		5: WEEK_DAYS.FRIDAY,
		6: WEEK_DAYS.SATURDAY
	}[dayIndex];
};
//#endregion
//#region routes/LeadDeskWebHook.route.ts
const leadDeskWebhookRouter = Router();
leadDeskWebhookRouter.get("/webhook", async (req, res) => {
	try {
		const lastCallId = req.query.last_call_id;
		if (!lastCallId) return res.status(400).send("Missing last_call_id");
		if (!req.user?.companyId) throw "No company id in req.user";
		const result = await handleCallWebhook(lastCallId, req.user.companyId);
		res.status(200).json({
			status: "success",
			callId: result.id
		});
	} catch (error) {
		console.log(error);
		res.status(500).send("Internal Server Error");
	}
});
//#endregion
//#region controllers/Auth.controller.ts
const findUserByEmail = async (email) => {
	return await prisma.user.findUnique({ where: { email } });
};
//#endregion
//#region controllers/Company.controller.ts
const registerCompany = async (companyName, email, passwordHash, name) => {
	return await prisma.$transaction(async (tx) => {
		const company = await tx.company.create({ data: { name: companyName } });
		const manager = await tx.manager.create({ data: {
			name,
			email,
			companyId: company.id
		} });
		return {
			company,
			user: await tx.user.create({ data: {
				email,
				passwordHash,
				role: Role.MAIN_ADMIN,
				companyId: company.id,
				managerId: manager.id
			} })
		};
	});
};
const generateKeyPair = async (companyId) => {
	const publicKey = `pk_${randomUUID()}`;
	const rawSecretKey = randomBytes(32).toString("hex");
	const secretHash = createHash("sha256").update(rawSecretKey).digest("hex");
	await prisma.aPIKeysAuth.upsert({
		where: { companyId },
		update: {
			publicKey,
			secretKeyHash: secretHash
		},
		create: {
			publicKey,
			secretKeyHash: secretHash,
			companyId
		}
	});
	return {
		publicKey,
		secretKey: rawSecretKey
	};
};
const deleteKeyPair = async (companyId) => {
	await prisma.aPIKeysAuth.delete({ where: { companyId } });
};
const getPublicKey = async (companyId) => {
	return { publicKey: (await prisma.aPIKeysAuth.findUnique({ where: { companyId } }))?.publicKey };
};
//#endregion
//#region middleware/authJWT.middleware.ts
const JWT_SECRET$1 = process.env.JWT_SECRET;
const authenticateJWT = (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (authHeader) {
			const token = authHeader.split(" ")[1];
			jwt.verify(token, JWT_SECRET$1, (err, payload) => {
				if (err) return res.status(403).json({ error: "Token invalid or expired" });
				req.user = {
					id: payload.sub,
					companyId: payload.companyId,
					role: payload.role
				};
				next();
			});
		} else res.status(401).json({ error: "Authorization header missing" });
	} catch (error) {
		res.status(500).json({ error: "Unexpected Error" });
	}
};
const allowedRoles = (roles) => {
	return (req, res, next) => {
		try {
			const authHeader = req.headers.authorization;
			if (authHeader) {
				const token = authHeader.split(" ")[1];
				jwt.verify(token, JWT_SECRET$1, (err, payload) => {
					if (err) return res.status(403).json({ error: "Token invalid or expired" });
					if (!roles.includes(payload.role)) res.status(403).json({ error: "Path not granted for this role" });
					next();
				});
			} else res.status(401).json({ error: "Authorization header missing" });
		} catch (error) {
			res.status(500).json({ error: "Unexpected Error" });
		}
	};
};
//#endregion
//#region routes/auth.route.ts
const isValidEmail = (email) => {
	return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};
const JWT_SECRET = process.env.JWT_SECRET;
const authRouter = Router();
authRouter.post("/register", async (req, res) => {
	try {
		const { companyName, admin_email, admin_name, password } = req.body;
		if (!admin_email || !password) return res.status(400).json({ error: "Missing required fields" });
		if (!isValidEmail(admin_email)) return res.status(422).json({ error: "Invalid Email format" });
		if (await findUserByEmail(admin_email.toLowerCase().trim())) return res.status(409).json({ error: "User already exists" });
		const { company, user } = await registerCompany(companyName, admin_email, await hash(password, 10), admin_name);
		return res.status(201).json({
			companyId: company.id,
			userId: user.id
		});
	} catch (error) {
		console.error("DEBUG ERROR:", error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
});
authRouter.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) return res.status(400).json({ error: "Email and password required" });
		const user = await findUserByEmail(email.toLowerCase().trim());
		if (!user) return res.status(401).json({ error: "Invalid credentials" });
		if (!await compare(password, user.passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
		const token = jwt.sign({
			sub: user.id,
			companyId: user.companyId,
			role: user.role
		}, JWT_SECRET, { expiresIn: "168h" });
		return res.status(200).json({
			message: "Login successful",
			token,
			user: {
				id: user.id,
				role: user.role,
				companyId: user.companyId
			}
		});
	} catch (error) {
		return res.status(500).json({ error: "Internal Server Error" });
	}
});
authRouter.post("/generate-key-pair", authenticateJWT, allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing company" });
		if ((await getPublicKey(companyId))?.publicKey) return res.status(409).json({ error: "Keys already generated. Delete it first to create a new one" });
		const { publicKey, secretKey } = await generateKeyPair(companyId);
		return res.status(201).json({
			publicKey,
			secretKey
		});
	} catch (error) {
		return res.status(500).json({ error: "Internal Server Error" });
	}
});
authRouter.delete("/delete-key-pair", authenticateJWT, allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing company" });
		const { publicKey } = await getPublicKey(companyId);
		if (!publicKey) return res.status(400).json({ error: "No public key" });
		await deleteKeyPair(companyId);
		return res.status(203).json({ succesful: true });
	} catch (error) {
		return res.status(500).json({ error: "Internal Server Error" });
	}
});
authRouter.get("/get-public-key", authenticateJWT, allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing company" });
		const { publicKey } = await getPublicKey(companyId);
		if (!publicKey) return res.status(400).json({ error: "No public key" });
		return res.status(200).json({ publicKey });
	} catch (error) {
		return res.status(500).json({ error: "Internal Server Error" });
	}
});
//#endregion
//#region controllers/manager.controller.ts
const upsertLeadDeskAPIAuthString = async (authString, companyId) => {
	return { id: (await prisma.leadDeskCustomData.upsert({
		where: { companyId },
		create: {
			authString,
			companyId
		},
		update: { authString }
	})).id };
};
const getLeadDeskAuthString = async (companyId) => {
	return (await prisma.leadDeskCustomData.findUnique({
		where: { companyId },
		select: { authString: true }
	}))?.authString || null;
};
const upsertLeadDeskEventIds = async (companyId, LeadDeskSeedEventIds, LeadDeskSaleEventIds) => {
	return { id: (await prisma.leadDeskCustomData.upsert({
		where: { companyId },
		create: {
			companyId,
			SaleEventIds: LeadDeskSaleEventIds,
			SeedEventIds: LeadDeskSeedEventIds
		},
		update: {
			SaleEventIds: LeadDeskSaleEventIds,
			SeedEventIds: LeadDeskSeedEventIds
		}
	})).id };
};
const getLeadDeskEventIds = async (companyId) => {
	const result = await prisma.leadDeskCustomData.findUnique({
		where: { companyId },
		select: {
			SaleEventIds: true,
			SeedEventIds: true
		}
	});
	return {
		seedEventIds: result?.SeedEventIds || [],
		saleEventIds: result?.SaleEventIds || []
	};
};
const createManagerWithUser = async (data) => {
	return await prisma.$transaction(async (tx) => {
		const manager = await tx.manager.create({ data: {
			email: data.email,
			name: data.name,
			companyId: data.companyId
		} });
		const user = await tx.user.create({ data: {
			email: data.email,
			passwordHash: data.passwordHash,
			role: "MANAGER",
			companyId: data.companyId,
			managerId: manager.id
		} });
		return {
			managerId: manager.id,
			userId: user.id
		};
	});
};
const updateManagerData = async (id, data) => {
	const passwordHash = data.password ? await hash(data.password, 10) : void 0;
	return await prisma.manager.update({
		where: { id },
		data: {
			name: data.name,
			email: data.email,
			user: data.email || passwordHash ? { update: {
				email: data.email,
				passwordHash
			} } : void 0
		}
	});
};
const getManagerById = async (id) => {
	return await prisma.manager.findUnique({
		where: { id },
		include: {
			user: true,
			company: true
		}
	});
};
const getManagersPaginated = async (skip, take, companyId) => {
	const [total, data] = await prisma.$transaction([prisma.manager.count(), prisma.manager.findMany({
		skip,
		take,
		where: { companyId },
		include: { company: { select: { name: true } } },
		orderBy: { id: "asc" }
	})]);
	return {
		total,
		data
	};
};
const deleteManagerAndUser = async (id) => {
	return await prisma.$transaction(async (tx) => {
		const manager = await tx.manager.findUnique({
			where: { id },
			include: { user: true }
		});
		if (manager?.user) await tx.user.delete({ where: { id: manager.user.id } });
		return await tx.manager.delete({ where: { id } });
	});
};
const createAgentWithUser = async (data) => {
	return await prisma.$transaction(async (tx) => {
		const agent = await tx.agent.create({ data: {
			name: data.name,
			companyId: data.companyId,
			agentLevel: { create: { level: 3 } }
		} });
		const user = await tx.user.create({ data: {
			email: data.email,
			passwordHash: data.passwordHash,
			role: "AGENT",
			companyId: data.companyId,
			agentId: agent.id
		} });
		return {
			agentId: agent.id,
			userId: user.id
		};
	});
};
const updateAgentData = async (id, data) => {
	const passwordHash = data.password ? await hash(data.password, 10) : void 0;
	return await prisma.agent.update({
		where: { id },
		data: {
			name: data.name,
			user: data.email || data.password ? { update: {
				email: data.email || void 0,
				passwordHash
			} } : void 0,
			agentToThird: data.thirdPartyService ? { upsert: {
				where: { agentId_serviceIdentifier: {
					agentId: id,
					serviceIdentifier: data.thirdPartyService.serviceIdentifier
				} },
				update: { agentServiceIdentifier: data.thirdPartyService.agentServiceIdentifier },
				create: {
					serviceIdentifier: data.thirdPartyService.serviceIdentifier,
					agentServiceIdentifier: data.thirdPartyService.agentServiceIdentifier
				}
			} } : void 0
		}
	});
};
const upsertAgentThirdParty = async (id, data) => {
	return await prisma.agentToThird.upsert({
		where: { agentId_serviceIdentifier: {
			agentId: id,
			serviceIdentifier: data.serviceIdentifier
		} },
		create: {
			agentId: id,
			serviceIdentifier: data.serviceIdentifier,
			agentServiceIdentifier: data.agentServiceIdentifier
		},
		update: { agentServiceIdentifier: data.agentServiceIdentifier }
	});
};
const getAgentById = async (id) => {
	return await prisma.agent.findUnique({
		where: { id },
		include: {
			user: true,
			company: true,
			agentToThird: true
		}
	});
};
const getAgentsPaginated = async (skip, take, companyId) => {
	const [total, data] = await prisma.$transaction([prisma.agent.count({ where: {
		companyId,
		user: { status: "ACTIVE" }
	} }), prisma.agent.findMany({
		skip,
		take,
		where: {
			companyId,
			user: { status: "ACTIVE" }
		},
		include: {
			company: { select: { name: true } },
			user: { omit: { passwordHash: true } },
			agentToThird: true
		},
		orderBy: { id: "asc" }
	})]);
	return {
		total,
		data
	};
};
const deleteAgentAndUser = async (id) => {
	const agent = await prisma.agent.findUnique({
		where: { id },
		include: { user: true }
	});
	return await prisma.user.update({
		where: { id: agent?.user?.id },
		data: { status: "REMOVED" }
	});
};
//#endregion
//#region controllers/goals.controller.ts
/**
* Creates a new Temporal Goal set by a Manager
*/
const createTemporalGoal = async (data) => {
	return await prisma.temporalGoals.create({ data });
};
/**
* Retrieves all goals for a specific company
* Useful for a dashboard view
*/
const findGoalsByCompany = async (companyId) => {
	return await prisma.temporalGoals.findMany({ where: { companyId } });
};
const findGoalById = async (goalId) => {
	return await prisma.temporalGoals.findUnique({ where: { id: goalId } });
};
/**
* Updates an existing goal
* Uses Partial to allow updating only specific metrics
*/
const updateTemporalGoal = async (id, data) => {
	return await prisma.temporalGoals.update({
		where: { id },
		data
	});
};
/**
* Deletes a goal by ID, ensuring all linked assignations 
* are removed first to prevent foreign key constraint errors.
*/
const deleteTemporalGoal = async (id) => {
	return await prisma.$transaction(async (tx) => {
		await tx.goalsAssignation.deleteMany({ where: { goalId: id } });
		return await tx.temporalGoals.delete({ where: { id } });
	});
};
/**
* Retrieves assignations within a specific date range.
* inclusive: from 00:00:00 of 'from' to 23:59:59 of 'to'.
*/
const getAssignationsByRange$1 = async (companyId, from, to) => {
	return await prisma.goalsAssignation.findMany({
		where: {
			companyId,
			date: {
				gte: getStartOfDay$1(from),
				lte: getEndOfDay$1(to)
			}
		},
		include: { goal: true },
		orderBy: { date: "asc" }
	});
};
/**
* Assigns a goal to a specific date. 
* If a goal is already assigned to that date, it updates it to the new goalId.
*/
const upsertGoalAssignation = async (companyId, date, goalId) => {
	const targetDate = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
	return await prisma.goalsAssignation.upsert({
		where: { companyId_date: {
			companyId,
			date: targetDate
		} },
		update: { goalId },
		create: {
			companyId,
			date: targetDate,
			goalId
		}
	});
};
/**
* Removes a goal assignation by its ID
*/
const deleteGoalAssignation = async (id) => {
	return await prisma.goalsAssignation.delete({ where: { id } });
};
/**
* Optional: Delete by Date
* Useful if the UI doesn't have the primary key ID handy
*/
const deleteGoalAssignationByDate = async (companyId, date) => {
	const targetDate = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
	return await prisma.goalsAssignation.delete({ where: { companyId_date: {
		companyId,
		date: targetDate
	} } });
};
/**
* Normalizes a date to 00:00:00.000
*/
const getStartOfDay$1 = (date) => {
	return /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
};
/**
* Normalizes a date to 23:59:59.999
*/
const getEndOfDay$1 = (date) => {
	return /* @__PURE__ */ new Date(`${date}T23:59:59.999Z`);
};
//#endregion
//#region routes/admin.route.ts
const adminRouter = Router();
adminRouter.post("/upsertLeadDeskEventIds", allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const { seedEventIds, saleEventIds } = req.body;
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing required fields" });
		const parsedSeedEventIds = parseStringArray(seedEventIds);
		const parsedSaleEventIds = parseStringArray(saleEventIds);
		if (parsedSeedEventIds.length == 0 && parsedSaleEventIds.length == 0) return res.status(400).json({ error: "No event ids sended" });
		const result = await upsertLeadDeskEventIds(Number(companyId), parsedSeedEventIds, parsedSaleEventIds);
		return res.status(201).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.get("/getLeadDeskEventIds", allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing required fields" });
		const result = await getLeadDeskEventIds(companyId);
		return res.status(201).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.post("/upsertLeadDeskAPIAuthString", allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const { authString } = req.body;
		const companyId = req.user?.companyId;
		if (!authString || !companyId) return res.status(400).json({ error: "Missing required fields" });
		const result = await upsertLeadDeskAPIAuthString(authString, Number(companyId));
		return res.status(201).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.get("/getLeadDeskAPIAuthString", allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing required fields" });
		const result = await getLeadDeskAuthString(companyId);
		return res.status(201).json({ authString: result });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.post("/addManager", allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const { email, name, password } = req.body;
		const companyId = req.user?.companyId;
		if (!email || !name || !password || !companyId) return res.status(400).json({ error: "Missing required manager fields" });
		const passwordHash = await bcrypt.hash(password, 10);
		const result = await createManagerWithUser({
			email: email.toLowerCase().trim(),
			name,
			passwordHash,
			companyId: Number(companyId)
		});
		return res.status(201).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.put("/editManager/:id", allowedRoles(["MAIN_ADMIN"]), checkManagerBelongsToCompany, async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { name, email, password } = req.body;
		const updateObject = {};
		if (name) updateObject.name = name;
		if (email) updateObject.email = email;
		if (password) updateObject.password = password;
		const updated = await updateManagerData(id, updateObject);
		return res.status(200).json(updated);
	} catch (err) {
		return res.status(500).json({ error: "Update failed" });
	}
});
adminRouter.get("/getManager/:id", allowedRoles(["MAIN_ADMIN"]), checkManagerBelongsToCompany, async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!id) return res.status(400).json({ error: "ID is required" });
		const manager = await getManagerById(id);
		return manager ? res.status(200).json(manager) : res.status(404).json({ error: "Not found" });
	} catch (err) {
		return res.status(500).json({ error: "Search failed" });
	}
});
adminRouter.get("/getManagersList", allowedRoles(["MAIN_ADMIN"]), async (req, res) => {
	try {
		const page = Number(req.query.page) || 1;
		const limit = Number(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing companyId" });
		const result = await getManagersPaginated(skip, limit, companyId);
		return res.status(200).json(result);
	} catch (err) {
		return res.status(500).json({ error: "Fetch failed" });
	}
});
adminRouter.delete("/removeManagers/:id", allowedRoles(["MAIN_ADMIN"]), checkManagerBelongsToCompany, async (req, res) => {
	try {
		await deleteManagerAndUser(Number(req.params.id));
		return res.status(204).send();
	} catch (err) {
		return res.status(500).json({ error: "Deletion failed" });
	}
});
adminRouter.post("/addAgent", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { email, name, password, leadDeskId } = req.body;
		const companyId = req.user?.companyId;
		const isMissingLeadDesk = leadDeskId === void 0 || leadDeskId === null || String(leadDeskId).trim() === "";
		if (!email || !name || !password || !companyId || isMissingLeadDesk) return res.status(400).json({ error: "Missing required agent fields" });
		const passwordHash = await bcrypt.hash(password, 10);
		const result = await createAgentWithUser({
			email: email.toLowerCase().trim(),
			name,
			passwordHash,
			companyId: Number(companyId)
		});
		await upsertAgentThirdParty(result.agentId, {
			agentServiceIdentifier: leadDeskId,
			serviceIdentifier: "LEADDESK"
		});
		return res.status(201).json(result);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.put("/editAgent/:id", checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { name, email, leadDeskId, password } = req.body;
		const updateObject = {};
		if (name) updateObject.name = name;
		if (email) updateObject.email = email;
		if (password) updateObject.password = password;
		if (leadDeskId) updateObject.thirdPartyService = {
			agentServiceIdentifier: leadDeskId,
			serviceIdentifier: "LEADDESK"
		};
		const updated = await updateAgentData(id, updateObject);
		return res.status(200).json(updated);
	} catch (err) {
		return res.status(500).json({ error: "Update failed" });
	}
});
adminRouter.get("/getAgent/:id", checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!id) return res.status(400).json({ error: "ID is required" });
		const agent = await getAgentById(id);
		return agent && agent.user?.status == "ACTIVE" ? res.status(200).json(agent) : res.status(404).json({ error: "Not found" });
	} catch (err) {
		return res.status(500).json({ error: "Search failed" });
	}
});
adminRouter.get("/getAgentsList", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const page = Number(req.query.page) || 1;
		const limit = Number(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing companyId" });
		const result = await getAgentsPaginated(skip, limit, companyId);
		return res.status(200).json(result);
	} catch (err) {
		return res.status(500).json({ error: "Fetch failed" });
	}
});
adminRouter.delete("/removeAgent/:id", checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		await deleteAgentAndUser(Number(req.params.id));
		return res.status(204).send();
	} catch (err) {
		return res.status(500).json({ error: "Deletion failed" });
	}
});
adminRouter.post("/goals/create", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { talkTimeMinutes, seeds, callbacks, leads, sales, numberOfCalls, numberOfLongCalls, name } = req.body;
		const companyId = req.user?.companyId;
		const creatorId = req.user?.id;
		if (!companyId || !creatorId) return res.status(400).json({ error: "Missing required timing or relation fields" });
		const goal = await createTemporalGoal({
			name,
			talkTimeMinutes: Number(talkTimeMinutes) || 0,
			seeds: Number(seeds) || 0,
			callbacks: Number(callbacks) || 0,
			leads: Number(leads) || 0,
			sales: Number(sales) || 0,
			numberOfCalls: Number(numberOfCalls) || 0,
			numberOfLongCalls: Number(numberOfLongCalls) || 0,
			companyId: Number(companyId),
			creatorId: Number(creatorId)
		});
		return res.status(201).json(goal);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.get("/goals/company", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing required timing or relation fields" });
		const goals = await findGoalsByCompany(companyId);
		return res.status(200).json(goals);
	} catch (err) {
		return res.status(500).json({ error: "Failed to fetch goals" });
	}
});
adminRouter.put("/goals/update/:id", checkGoalBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const id = Number(req.params.id);
		const updateData = req.body;
		const updatedGoal = await updateTemporalGoal(id, updateData);
		return res.status(200).json(updatedGoal);
	} catch (err) {
		return res.status(500).json({ error: "Update failed" });
	}
});
adminRouter.delete("/goals/delete/:id", checkGoalBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		await deleteTemporalGoal(Number(req.params.id));
		return res.status(204).send();
	} catch (err) {
		return res.status(500).json({ error: "Deletion failed" });
	}
});
adminRouter.get("/assignation", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { from, to } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
		const assignations = await getAssignationsByRange$1(Number(companyId), from, to);
		return res.status(200).json(assignations);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.post("/upsert-assignation", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { date, goalId } = req.body;
		const companyId = req.user?.companyId;
		if (!companyId || !date || !goalId) return res.status(400).json({ error: "Missing companyId, date, or goalId" });
		const result = await upsertGoalAssignation(Number(companyId), date, Number(goalId));
		return res.status(200).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.delete("/delete-assignation-by-id/:id", checkGoalAssignationBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { id } = req.params;
		if (id) {
			const deleted = await deleteGoalAssignation(Number(id));
			return res.status(200).json(deleted);
		}
		return res.status(400).json({ error: "Provide either an ID or companyId and date" });
	} catch (err) {
		return res.status(500).json({ error: "Deletion failed" });
	}
});
adminRouter.delete("/delete-assignation-by-date", checkGoalAssignationBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { date } = req.query;
		const companyId = req.user?.companyId;
		if (companyId && date) {
			const deleted = await deleteGoalAssignationByDate(Number(companyId), date);
			return res.status(200).json(deleted);
		}
		return res.status(400).json({ error: "Provide either an ID or companyId and date" });
	} catch (err) {
		return res.status(500).json({ error: "Deletion failed" });
	}
});
async function checkManagerBelongsToCompany(req, res, next) {
	const companyId = req.user?.companyId;
	const manager = await getManagerById(Number(req.params.id));
	if (!manager) return res.status(404).json({ error: "Manager not found" });
	if (manager.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" });
	next();
}
async function checkAgentBelongsToCompany(req, res, next) {
	const companyId = req.user?.companyId;
	const agent = await getAgentById(Number(req.params.id));
	if (!agent) return res.status(404).json({ error: "agent not found" });
	if (agent.companyId != companyId) return res.status(401).json({ error: "agent does not belogn to company" });
	next();
}
async function checkGoalBelongsToCompany(req, res, next) {
	const companyId = req.user?.companyId;
	const goal = await findGoalById(Number(req.params.id));
	if (!goal) return res.status(404).json({ error: "Goal not found" });
	if (goal.companyId != companyId) return res.status(401).json({ error: "Goal does not belogn to company" });
	next();
}
async function checkGoalAssignationBelongsToCompany(req, res, next) {
	const companyId = req.user?.companyId;
	const goalId = Number(req.params.id);
	const date = req.query.date;
	if (!companyId) return res.status(400).json({ error: "Missing companyId" });
	if (goalId) {
		if ((await findGoalById(goalId))?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" });
		return next();
	}
	if (date) {
		if ((await getAssignationsByRange$1(companyId, date, date))[0]?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" });
		return next();
	}
	return res.status(500).json({ error: "unexpected error in goal middleware" });
}
const parseStringArray = (val) => {
	if (val === null || val === void 0) return [];
	return (Array.isArray(val) ? val : [val]).map((item) => {
		const str = String(item).trim();
		if (!str) throw new Error("Invalid or empty string value provided in array");
		return str;
	});
};
//#endregion
//#region controllers/schema.controller.ts
const createSchema = async (data) => {
	return await prisma.schema.create({
		data: {
			name: data.name,
			companyId: data.companyId,
			creatorId: data.creatorId,
			blocks: { create: data.blocks }
		},
		include: { blocks: true }
	});
};
const getSchemaById = async (id) => {
	return await prisma.schema.findUnique({
		where: { id },
		include: { blocks: { orderBy: { startMinutesFromMidnight: "asc" } } }
	});
};
const getSchemasPaginated = async (companyId, skip, take) => {
	const [total, data] = await prisma.$transaction([prisma.schema.count({ where: { companyId } }), prisma.schema.findMany({
		where: { companyId },
		include: { blocks: true },
		skip,
		take,
		orderBy: { id: "desc" }
	})]);
	return {
		total,
		data
	};
};
const deleteSchema = async (id) => {
	return await prisma.$transaction(async (tx) => {
		await tx.schemaAssignation.deleteMany({ where: { schemaId: id } });
		await tx.schemaBlock.deleteMany({ where: { schemaId: id } });
		return await tx.schema.delete({ where: { id } });
	});
};
/**
* Updates just the basic metadata of a Schema
*/
const updateSchemaMetadata = async (id, data) => {
	return await prisma.schema.update({
		where: { id },
		data,
		include: { blocks: true }
	});
};
/**
* Performs a full structural update. 
* It deletes existing days/blocks and replaces them with the new structure.
*/
const fullUpdateSchema = async (id, data) => {
	return await prisma.$transaction(async (tx) => {
		await tx.schemaBlock.deleteMany({ where: { schemaId: id } });
		return await tx.schema.update({
			where: { id },
			data: {
				name: data.name,
				blocks: { create: data.blocks }
			},
			include: { blocks: true }
		});
	});
};
const getAssignationsByRange = async (companyId, from, to) => {
	return await prisma.schemaAssignation.findMany({
		where: {
			companyId,
			date: {
				gte: getStartOfDay(from),
				lte: getEndOfDay(to)
			}
		},
		orderBy: { date: "asc" }
	});
};
const upsertSchemaAssignation = async (companyId, date, schemaId) => {
	const targetDate = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
	return await prisma.schemaAssignation.upsert({
		where: { companyId_date: {
			companyId,
			date: targetDate
		} },
		update: { schemaId },
		create: {
			companyId,
			date: targetDate,
			schemaId
		}
	});
};
const deleteSchemaAssignation = async (id) => {
	return await prisma.schemaAssignation.delete({ where: { id } });
};
/**
* Normalizes a date to 00:00:00.000
*/
const getStartOfDay = (date) => {
	return /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
};
/**
* Normalizes a date to 23:59:59.999
*/
const getEndOfDay = (date) => {
	return /* @__PURE__ */ new Date(`${date}T23:59:59.999Z`);
};
//#endregion
//#region routes/schema.route.ts
const schemaRouter = Router();
schemaRouter.post("/create", async (req, res) => {
	try {
		const { name, blocks } = req.body;
		const companyId = req.user?.companyId;
		const creatorId = req.user?.id;
		if (!name || !companyId || !creatorId || !Array.isArray(blocks)) return res.status(400).json({ error: "Missing required schema structure" });
		if (blocks.length == 0) return res.status(400).json({ error: "Must send at least 1 block" });
		const result = await createSchema({
			name,
			companyId: Number(companyId),
			creatorId: Number(creatorId),
			blocks
		});
		return res.status(201).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
schemaRouter.get("/list", async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(404).json({ error: "missing companyId" });
		const page = Number(req.query.page) || 1;
		const limit = Number(req.query.limit) || 10;
		const result = await getSchemasPaginated(companyId, (page - 1) * limit, limit);
		return res.status(200).json(result);
	} catch (err) {
		return res.status(500).json({ error: "Fetch failed" });
	}
});
schemaRouter.get("/individual/:id", checkSchemaBelongsToCompany, async (req, res) => {
	try {
		const schema = await getSchemaById(Number(req.params.id));
		return schema ? res.status(200).json(schema) : res.status(404).json({ error: "Schema not found" });
	} catch (err) {
		return res.status(500).json({ error: "Fetch failed" });
	}
});
schemaRouter.delete("/:id", checkSchemaBelongsToCompany, async (req, res) => {
	try {
		await deleteSchema(Number(req.params.id));
		return res.status(204).send();
	} catch (err) {
		console.log(err);
		return res.status(500).json({ error: "Deletion failed" });
	}
});
schemaRouter.put("/update/:id", checkSchemaBelongsToCompany, async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { name, blocks } = req.body;
		if (blocks && Array.isArray(blocks)) await fullUpdateSchema(id, {
			name,
			blocks
		});
		const updatedMetadata = await updateSchemaMetadata(id, { name });
		return res.status(200).json(updatedMetadata);
	} catch (err) {
		console.error("Schema Update Error:", err);
		return res.status(500).json({ error: "Update failed: " + err.message });
	}
});
schemaRouter.get("/assignation", async (req, res) => {
	try {
		const { from, to } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
		const assignations = await getAssignationsByRange(Number(companyId), from, to);
		return res.status(200).json(assignations);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ error: err.message });
	}
});
schemaRouter.post("/upsert-assignation", async (req, res) => {
	try {
		const { date, schemaId } = req.body;
		const companyId = req.user?.companyId;
		if (!companyId || !date || !schemaId) return res.status(400).json({ error: "Missing companyId, date, or goalId" });
		const result = await upsertSchemaAssignation(Number(companyId), date, Number(schemaId));
		return res.status(200).json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
schemaRouter.delete("/delete-assignation-by-id/:id", checkSchemaAssignationBelongsToCompany, async (req, res) => {
	try {
		const { id } = req.params;
		if (id) {
			const deleted = await deleteSchemaAssignation(Number(id));
			return res.status(200).json(deleted);
		}
		return res.status(400).json({ error: "Provide either an ID or companyId and date" });
	} catch (err) {
		return res.status(500).json({ error: "Deletion failed" });
	}
});
async function checkSchemaBelongsToCompany(req, res, next) {
	const companyId = req.user?.companyId;
	const schema = await getSchemaById(Number(req.params.id));
	if (!schema) return res.status(404).json({ error: "Manager not found" });
	if (schema.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" });
	next();
}
async function checkSchemaAssignationBelongsToCompany(req, res, next) {
	const companyId = req.user?.companyId;
	const schemaId = Number(req.params.id);
	if (!companyId) return res.status(400).json({ error: "Missing companyId" });
	if (schemaId) {
		if ((await getSchemaById(schemaId))?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" });
		return next();
	}
	return res.status(500).json({ error: "unexpected error in goal middleware" });
}
//#endregion
//#region controllers/DataVis.controller.ts
const getLastRegister = async (companyId) => {
	const lastCall = await prisma.call.findFirst({
		where: { companyId },
		orderBy: { startAt: "desc" },
		select: { startAt: true }
	});
	if (!lastCall) return { lastCallDate: null };
	return { lastCallDate: getZonedLocalTime(lastCall.startAt.toISOString(), "Europe/Amsterdam") };
};
const getGeneralInsights = async (companyId, startDateStr, endDateStr, filters) => {
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const agentFilter = filters.agents?.length > 0 ? { in: filters.agents } : void 0;
	const callMetrics = await prisma.call.aggregate({
		where: {
			companyId,
			startAt: {
				gte: startDate,
				lte: endDate
			},
			agentId: agentFilter
		},
		_sum: { durationSeconds: true },
		_count: { id: true },
		_avg: { durationSeconds: true }
	});
	const eventCounts = await prisma.funnelEvent.groupBy({
		by: ["type"],
		where: {
			agent: { companyId },
			agentId: agentFilter,
			timestamp: {
				gte: startDate,
				lte: endDate
			}
		},
		_count: { id: true }
	});
	const getEventCount = (type) => eventCounts.find((e) => e.type === type)?._count.id || 0;
	const totalSeeds = getEventCount(EventType.SEED);
	const totalLeads = getEventCount(EventType.LEAD);
	const totalSales = getEventCount(EventType.SALE);
	const totalCalls = callMetrics._count.id || 0;
	const totalTalkTime = callMetrics._sum.durationSeconds || 0;
	const avgCallDuration = Math.round(callMetrics._avg.durationSeconds || 0);
	return {
		totalTalkTime,
		totalCalls,
		totalSeeds,
		totalLeads,
		totalSales,
		conversionRate: totalSeeds > 0 ? parseFloat((totalSales / totalSeeds * 100).toFixed(2)) : 0,
		avgCallDuration
	};
};
const getDailyActivity = async (companyId, startDateStr, endDateStr, filters, config) => {
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND "agentId" IN (${join(filters.agents)})` : empty;
	const seedAgentFilter = filters.agents && filters.agents.length > 0 ? sql`AND fe."agentId" IN (${join(filters.agents)})` : empty;
	const dailyCalls = await prisma.$queryRaw`
    SELECT 
      DATE("startAt" AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA}) as "date",
      SUM("durationSeconds") as "talkTime",
      COUNT(id) as "calls"
    FROM "Call"
    WHERE "companyId" = ${companyId}
      AND "startAt" >= ${startDate}
      AND "startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY "date"
    ORDER BY "date" ASC
  `;
	const dailySeeds = await prisma.$queryRaw`
    SELECT 
      DATE(fe."timestamp" AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA}) as "date",
      COUNT(fe.id) as "seeds"
    FROM "FunnelEvent" fe
    JOIN "Agent" a ON fe."agentId" = a.id
    WHERE a."companyId" = ${companyId}
      AND fe."type" = ${EventType.SEED}
      AND fe."timestamp" >= ${startDate}
      AND fe."timestamp" <= ${endDate}
      ${seedAgentFilter}
    GROUP BY "date"
  `;
	return dailyCalls.map((callDay) => {
		const dayString = getYYYYMMDD(callDay.date);
		const seedData = dailySeeds.find((s) => {
			return new Date(s.date).toISOString().split("T")[0] === dayString;
		});
		return {
			date: dayString,
			talkTime: Number(callDay.talkTime) || 0,
			calls: Number(callDay.calls) || 0,
			seeds: Number(seedData?.seeds) || 0
		};
	});
};
const getBlockPerformance = async (companyId, from, to, schemaId, filters, config) => {
	const startDate = new Date(from);
	const endDate = new Date(to);
	const activeBlockTypes = [];
	if (filters.types[0]) activeBlockTypes.push(BlockType.WORKING);
	if (filters.types[1]) activeBlockTypes.push(BlockType.REST);
	if (filters.types[2]) activeBlockTypes.push(BlockType.EXTRA_TIME);
	const schema = await prisma.schema.findUnique({
		where: { id: schemaId },
		include: { blocks: {
			where: { blockType: { in: activeBlockTypes } },
			orderBy: { startMinutesFromMidnight: "asc" }
		} }
	});
	if (!schema) throw new Error("Schema not found");
	const activeDays = [];
	if (filters.days[0]) activeDays.push(WEEK_DAYS.MONDAY);
	if (filters.days[1]) activeDays.push(WEEK_DAYS.TUESDAY);
	if (filters.days[2]) activeDays.push(WEEK_DAYS.WEDNESDAY);
	if (filters.days[3]) activeDays.push(WEEK_DAYS.THURSDAY);
	if (filters.days[4]) activeDays.push(WEEK_DAYS.FRIDAY);
	if (filters.days[5]) activeDays.push(WEEK_DAYS.SATURDAY);
	if (filters.days[6]) activeDays.push(WEEK_DAYS.SUNDAY);
	const calls = await prisma.call.findMany({
		where: {
			companyId,
			startAt: {
				gte: startDate,
				lte: endDate
			},
			dayOfTheWeek: { in: activeDays },
			agentId: { in: filters.agents?.length > 0 ? filters.agents : void 0 }
		},
		include: { events: true }
	});
	let blockStats = schema.blocks.map((block) => ({
		id: block.id,
		startMinutes: block.startMinutesFromMidnight,
		endMinutes: block.endMinutesFromMidnight,
		type: block.blockType,
		talkTime: 0,
		seeds: 0,
		sales: 0
	}));
	if (activeBlockTypes.includes(BlockType.EXTRA_TIME)) blockStats = fillGapsWithExtraTime(blockStats);
	calls.forEach((call, i) => {
		const startAtTimeZoned = getZonedUtcDate(call.startAt.toISOString(), config.IANA);
		const callMinutes = startAtTimeZoned.getHours() * 60 + startAtTimeZoned.getMinutes();
		const targetBlock = blockStats.find((b) => callMinutes >= b.startMinutes && callMinutes < b.endMinutes);
		if (targetBlock) {
			targetBlock.talkTime += call.durationSeconds / 60;
			call.events.forEach((event) => {
				if (event.type === EventType.SEED) targetBlock.seeds++;
				if (event.type === EventType.SALE) targetBlock.sales++;
			});
		}
	});
	return blockStats.map((b) => ({
		blockStartTimeMinutesFromMidnight: b.startMinutes,
		blockEndTimeMinutesFromMidnight: b.endMinutes,
		talkTime: Math.round(b.talkTime),
		seeds: b.seeds,
		sales: b.sales,
		type: b.type
	}));
};
const getLongCallDistribution = async (companyId, startDateStr, endDateStr, filters) => {
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND "agentId" IN (${join(filters.agents)})` : empty;
	return (await prisma.$queryRaw`
    SELECT 
      CASE 
        WHEN "durationSeconds" < 60 THEN '0-1 min'
        WHEN "durationSeconds" >= 60 AND "durationSeconds" < 180 THEN '1-3 min'
        WHEN "durationSeconds" >= 180 AND "durationSeconds" < 300 THEN '3-5 min'
        WHEN "durationSeconds" >= 300 AND "durationSeconds" < 600 THEN '5-10 min'
        ELSE '10+ min'
      END as "range",
      COUNT(*) as "count",
      CASE 
        WHEN "durationSeconds" < 60 THEN 1
        WHEN "durationSeconds" >= 60 AND "durationSeconds" < 180 THEN 2
        WHEN "durationSeconds" >= 180 AND "durationSeconds" < 300 THEN 3
        WHEN "durationSeconds" >= 300 AND "durationSeconds" < 600 THEN 4
        ELSE 5
      END as "sortOrder"
    FROM "Call"
    WHERE "companyId" = ${companyId}
      AND "startAt" >= ${startDate}
      AND "startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY "range", "sortOrder"
    ORDER BY "sortOrder" ASC
  `).map((row) => ({
		range: row.range,
		count: Number(row.count)
	}));
};
const getSeedTimelineHeatmap = async (companyId, year, filters, config) => {
	const yearBoundaries = getYearBoundariesInUTC(year, config.IANA);
	const startDate = yearBoundaries.startDate;
	const endDate = yearBoundaries.endDate;
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND c."agentId" IN (${join(filters.agents)})` : empty;
	const dailyData = await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt" AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA}) as "date",
      COUNT(fe.id) as "seeds"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id AND fe."type" = ${EventType.SEED}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY "date"
    ORDER BY "date" ASC
  `;
	const dataMap = new Map(dailyData.map((d) => [new Date(d.date).toISOString().split("T")[0], Number(d.seeds)]));
	const seedValues = Array.from(dataMap.values());
	const minSeeds = seedValues.length > 0 ? Math.min(...seedValues) : 0;
	const maxSeeds = seedValues.length > 0 ? Math.max(...seedValues) : 0;
	const calculateLevel = (val, min, max) => {
		if (val === 0) return 0;
		if (max === min) return 2;
		const range = max - min;
		const level = Math.floor((val - min) / range * 5);
		return Math.max(1, Math.min(level, 4));
	};
	const fullYearData = [];
	const currentDate = /* @__PURE__ */ new Date(`${year}-01-01T00:00:00.000Z`);
	const loopEndDate = /* @__PURE__ */ new Date(`${year}-12-31T23:59:59.999Z`);
	while (currentDate <= loopEndDate) {
		const dateStr = currentDate.toISOString().split("T")[0];
		const seeds = dataMap.get(dateStr) || 0;
		fullYearData.push({
			date: dateStr,
			intensity: calculateLevel(seeds, minSeeds, maxSeeds),
			seeds
		});
		currentDate.setDate(currentDate.getDate() + 1);
	}
	return fullYearData;
};
const getSeedTimelineHeatmapPerDay = async (companyId, targetDate, filters, config) => {
	const dayBoundaries = getDayBoundariesInUTC(targetDate, config.IANA);
	const startOfDay = dayBoundaries.startDate;
	const endOfDay = dayBoundaries.endDate;
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND c."agentId" IN (${join(filters.agents)})` : empty;
	const hourlyData = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM (c."startAt" AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA})) as "hour",
      COUNT(fe.id) as "seeds"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id 
      AND fe."type" = ${EventType.SEED}::"EventType"
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startOfDay}
      AND c."startAt" <= ${endOfDay}
      ${agentFilter}
    GROUP BY "hour"
    ORDER BY "hour" ASC
  `;
	const hourMap = new Map(hourlyData.map((d) => [Number(d.hour), Number(d.seeds)]));
	const seedValues = Array.from(hourMap.values());
	const maxSeeds = seedValues.length > 0 ? Math.max(...seedValues) : 0;
	const calculateLevel = (val, max) => {
		if (val === 0) return 0;
		if (max === 0 || val === max) return 3;
		const level = Math.floor(val / max * 5);
		return Math.max(1, Math.min(level, 4));
	};
	return Array.from({ length: 24 }, (_, hour) => {
		const seeds = hourMap.get(hour) || 0;
		return {
			hour,
			intensity: calculateLevel(seeds, maxSeeds),
			seeds,
			label: `${hour.toString().padStart(2, "0")}:00`
		};
	});
};
const getConversionFunnel = async (companyId, startDateStr, endDateStr, filters) => {
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const eventCounts = await prisma.funnelEvent.groupBy({
		by: ["type"],
		where: {
			agent: { companyId },
			agentId: { in: filters.agents?.length > 0 ? filters.agents : void 0 },
			timestamp: {
				gte: startDate,
				lte: endDate
			}
		},
		_count: { id: true }
	});
	const getCount = (type) => {
		return eventCounts.find((e) => e.type === type)?._count.id || 0;
	};
	return [
		{
			name: "Seeds",
			value: getCount(EventType.SEED)
		},
		{
			name: "Leads",
			value: getCount(EventType.LEAD)
		},
		{
			name: "Sales",
			value: getCount(EventType.SALE)
		}
	];
};
const getConsistencyHistory = async (goalId, companyId, startDateStr, endDateStr, filters, config) => {
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const goal = await prisma.temporalGoals.findUnique({ where: { id: goalId } });
	if (!goal) throw new Error("Target goal not found");
	const activeDays = [
		WEEK_DAYS.MONDAY,
		WEEK_DAYS.TUESDAY,
		WEEK_DAYS.WEDNESDAY,
		WEEK_DAYS.THURSDAY,
		WEEK_DAYS.FRIDAY,
		WEEK_DAYS.SATURDAY,
		WEEK_DAYS.SUNDAY
	].filter((_, index) => filters.days[index]);
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND c."agentId" IN (${join(filters.agents)})` : empty;
	const dayFilter = activeDays.length > 0 ? sql`AND c."dayOfTheWeek" IN (${join(activeDays)})` : empty;
	return (await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt" AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA}) as "date",
      SUM(c."durationSeconds") / 60.0 as "talkTime",
      COUNT(c.id) as "calls",
      COUNT(fe_seed.id) as "seeds",
      COUNT(fe_lead.id) as "leads",
      COUNT(fe_sale.id) as "sales"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe_seed ON fe_seed."callId" = c.id AND fe_seed."type" = ${EventType.SEED}
    LEFT JOIN "FunnelEvent" fe_lead ON fe_lead."callId" = c.id AND fe_lead."type" = ${EventType.LEAD}
    LEFT JOIN "FunnelEvent" fe_sale ON fe_sale."callId" = c.id AND fe_sale."type" = ${EventType.SALE}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
      ${agentFilter}
      ${dayFilter}
    GROUP BY "date"
    ORDER BY "date" ASC
  `).map((day) => {
		const scores = [];
		const addScore = (current, target) => {
			if (target && target > 0) {
				const s = current / target * 100;
				scores.push(Math.min(s, 100));
			}
		};
		addScore(Number(day.talkTime), goal.talkTimeMinutes);
		addScore(Number(day.seeds), goal.seeds);
		addScore(Number(day.leads), goal.leads);
		addScore(Number(day.sales), goal.sales);
		addScore(Number(day.calls), goal.numberOfCalls);
		const finalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
		return {
			day: new Date(day.date).toISOString().split("T")[0].split("-")[2],
			score: finalScore
		};
	});
};
const getAgentsSorted = async (companyId, from, to, params, config) => {
	const { sortKey, direction, page, pageSize, agentIds } = params;
	const offset = (page - 1) * pageSize;
	const startDate = new Date(from);
	const endDate = new Date(to);
	const agentFilter = agentIds && agentIds.length > 0 ? sql`AND a.id IN (${join(agentIds)})` : empty;
	return (await prisma.$queryRaw`
    WITH call_agg AS (
      SELECT
        c.id,
        c."agentId",
        DATE(c."startAt" AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA}) as call_date,
        c."durationSeconds",
        COUNT(CASE WHEN fe.type = 'SEED' THEN 1 END) as seed_cnt,
        COUNT(CASE WHEN fe.type = 'LEAD' THEN 1 END) as lead_cnt,
        COUNT(CASE WHEN fe.type = 'SALE' THEN 1 END) as sale_cnt
      FROM "Call" c
      LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id
      WHERE c."companyId" = ${companyId}
        AND c."startAt" >= ${startDate} 
        AND c."startAt" <= ${endDate}
      GROUP BY c.id
    ),
    daily_stats AS (
      SELECT
        "agentId",
        call_date,
        SUM("durationSeconds") / 60.0 as daily_talk_time,
        COUNT(id) as daily_calls,
        SUM(seed_cnt) as daily_seeds,
        SUM(lead_cnt) as daily_leads,
        SUM(sale_cnt) as daily_sales
      FROM call_agg
      GROUP BY "agentId", call_date
    ),
    daily_scores AS (
      SELECT
        ds."agentId",
        -- Sum up the scores (capped at 100) and divide by the number of active goals
        (
          COALESCE(LEAST((ds.daily_talk_time / NULLIF(tg."talkTimeMinutes", 0)) * 100, 100), 0) +
          COALESCE(LEAST((ds.daily_seeds::NUMERIC / NULLIF(tg.seeds, 0)) * 100, 100), 0) +
          COALESCE(LEAST((ds.daily_leads::NUMERIC / NULLIF(tg.leads, 0)) * 100, 100), 0) +
          COALESCE(LEAST((ds.daily_sales::NUMERIC / NULLIF(tg.sales, 0)) * 100, 100), 0) +
          COALESCE(LEAST((ds.daily_calls::NUMERIC / NULLIF(tg."numberOfCalls", 0)) * 100, 100), 0)
        ) / NULLIF(
          (CASE WHEN tg."talkTimeMinutes" > 0 THEN 1 ELSE 0 END) +
          (CASE WHEN tg.seeds > 0 THEN 1 ELSE 0 END) +
          (CASE WHEN tg.leads > 0 THEN 1 ELSE 0 END) +
          (CASE WHEN tg.sales > 0 THEN 1 ELSE 0 END) +
          (CASE WHEN tg."numberOfCalls" > 0 THEN 1 ELSE 0 END),
          0
        ) as daily_consistency
      FROM daily_stats ds
      -- Join on the specific Goal Assignation for that day
      JOIN "GoalsAssignation" ga ON ga."companyId" = ${companyId} AND DATE(ga.date AT TIME ZONE 'UTC' AT TIME ZONE ${config.IANA}) = ds.call_date
      JOIN "TemporalGoals" tg ON tg.id = ga."goalId"
    ),
    agent_consistency AS (
      SELECT "agentId", ROUND(AVG(daily_consistency)) as consistency_score
      FROM daily_scores
      GROUP BY "agentId"
    )
    SELECT 
      a.id,
      a.name,
      COALESCE(SUM(c."durationSeconds") / 60, 0)::INT as "talkTime",
      COUNT(DISTINCT fe_seed.id)::INT as "seeds",
      
      -- Conversion Calculation
      CASE 
        WHEN COUNT(DISTINCT fe_seed.id) > 0 
        THEN ROUND((COUNT(DISTINCT fe_sale.id)::NUMERIC / COUNT(DISTINCT fe_seed.id)::NUMERIC) * 100, 1)
        ELSE 0 
      END as "conversion",
      
      -- Long Call Ratio ( > 5 minutes / 300 seconds)
      CASE 
        WHEN COUNT(DISTINCT c.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN c."durationSeconds" >= 300 THEN c.id END)::NUMERIC / COUNT(DISTINCT c.id)::NUMERIC) * 100, 1)
        ELSE 0 
      END as "longCallRatio",

      -- Dynamically attached Consistency Score
      COALESCE(ac.consistency_score, 0)::INT as "consistency"
      
    FROM "Agent" a
    LEFT JOIN "Call" c ON c."agentId" = a.id 
      AND c."startAt" >= ${startDate} 
      AND c."startAt" <= ${endDate}
    LEFT JOIN "FunnelEvent" fe_seed ON fe_seed."callId" = c.id AND fe_seed."type" = 'SEED'
    LEFT JOIN "FunnelEvent" fe_sale ON fe_sale."callId" = c.id AND fe_sale."type" = 'SALE'
    
    -- Connect our consistency CTE
    LEFT JOIN agent_consistency ac ON ac."agentId" = a.id
    
    WHERE a."companyId" = ${companyId}
    ${agentFilter}
    GROUP BY a.id, a.name, ac.consistency_score
    ORDER BY "${raw(sortKey)}" ${raw(direction.toUpperCase())}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `).map((agent) => ({
		id: agent.id,
		name: agent.name,
		talkTime: Number(agent.talkTime),
		seeds: Number(agent.seeds),
		conversion: Number(agent.conversion),
		consistency: Number(agent.consistency),
		longCallRatio: Number(agent.longCallRatio)
	}));
};
const fillGapsWithExtraTime = (blocks) => {
	const fullDay = [];
	const TOTAL_MINUTES = 1440;
	let currentTime = 0;
	const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
	for (const block of sortedBlocks) {
		if (block.startMinutes > currentTime) fullDay.push({
			startMinutes: currentTime,
			endMinutes: block.startMinutes,
			type: "EXTRA_TIME",
			talkTime: 0,
			seeds: 0,
			sales: 0
		});
		fullDay.push(block);
		currentTime = Math.max(currentTime, block.endMinutes);
	}
	if (currentTime < TOTAL_MINUTES) fullDay.push({
		startMinutes: currentTime,
		endMinutes: TOTAL_MINUTES,
		type: "EXTRA_TIME",
		talkTime: 0,
		seeds: 0,
		sales: 0
	});
	return fullDay;
};
//#endregion
//#region routes/dataVis.route.ts
const dataVisRouter = Router();
dataVisRouter.get("/get-agents-comparisson", async (req, res) => {
	try {
		const { from, to, sortKey, direction, page, pageSize, agents } = req.query;
		const companyId = req.user?.companyId;
		const report = await getAgentsSorted(Number(companyId), from, to, {
			sortKey: sortKey || "talkTime",
			direction: direction || "desc",
			page: Number(page) || 1,
			pageSize: Number(pageSize) || 10,
			agentIds: agents ? parseNumberArray(agents) : []
		}, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
dataVisRouter.get("/get-last-call-date", async (req, res) => {
	try {
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(400).json({ error: "Missing companyId" });
		const result = await getLastRegister(companyId);
		return res.status(200).json(result);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
dataVisRouter.get("/general-insights", async (req, res) => {
	try {
		const { from, to, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
		const startDate = from;
		const endDate = to;
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const report = await getGeneralInsights(Number(companyId), startDate, endDate, { agents: parsedAgents });
		return res.status(200).json(report);
	} catch (err) {
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
dataVisRouter.get("/daily-activity", async (req, res) => {
	try {
		const { from, to, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
		const startDate = from;
		const endDate = to;
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const report = await getDailyActivity(Number(companyId), startDate, endDate, { agents: parsedAgents }, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
dataVisRouter.get("/block-performance", async (req, res) => {
	try {
		const { schemaId, from, to, days, types, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !schemaId || !from || !to || !days || !types) return res.status(400).json({ error: "Missing required parameters" });
		const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})?$/;
		if (typeof from !== "string" || !iso8601Regex.test(from) || typeof to !== "string" || !iso8601Regex.test(to)) return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD" });
		const sId = Number(schemaId);
		const parsedDays = parseBoolArray(days);
		const parsedTypes = parseBoolArray(types);
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const data = await getBlockPerformance(Number(companyId), from, to, sId, {
			days: parsedDays,
			types: parsedTypes,
			agents: parsedAgents
		}, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(data);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ error: err.message });
	}
});
dataVisRouter.get("/long-call-distribution", async (req, res) => {
	try {
		const { from, to, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing required parameters: companyId, from, to" });
		const startDate = from;
		const endDate = to;
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const data = await getLongCallDistribution(Number(companyId), startDate, endDate, { agents: parsedAgents });
		return res.status(200).json(data);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
dataVisRouter.get("/seed-timeline-heatmap", async (req, res) => {
	try {
		const { year, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !year) return res.status(400).json({ error: "Missing companyId, from, or to" });
		if (isNaN(Number(year))) return res.status(400).json({ error: "Invalid year parameter" });
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const heatmapData = await getSeedTimelineHeatmap(Number(companyId), Number(year), { agents: parsedAgents }, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(heatmapData);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
dataVisRouter.get("/seed-timeline-heatmap-per-day", async (req, res) => {
	try {
		const { day, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !day) return res.status(400).json({ error: "Missing companyId or day" });
		if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD" });
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const heatmapData = await getSeedTimelineHeatmapPerDay(Number(companyId), day, { agents: parsedAgents }, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(heatmapData);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
dataVisRouter.get("/conversion-funnel", async (req, res) => {
	try {
		const { from, to, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing required parameters" });
		const start = from;
		const end = to;
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const funnelData = await getConversionFunnel(Number(companyId), start, end, { agents: parsedAgents });
		return res.status(200).json(funnelData);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
dataVisRouter.get("/consistency-streak", async (req, res) => {
	try {
		const { goalId, from, to, agents, days } = req.query;
		const companyId = req.user?.companyId;
		if (!goalId || !companyId || !from || !to || !days) return res.status(400).json({ error: "Missing required parameters" });
		const start = from;
		const end = to;
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const parsedDays = days ? parseBoolArray(days) : [];
		const history = await getConsistencyHistory(Number(goalId), Number(companyId), start, end, {
			agents: parsedAgents,
			days: parsedDays
		}, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(history);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
const parseBoolArray = (val) => {
	return (Array.isArray(val) ? val : [val]).map((item) => String(item).toLowerCase() === "true");
};
const parseNumberArray = (val) => {
	return (Array.isArray(val) ? val : [val]).map((item) => {
		const number = Number(item);
		if (item === null && Number.isNaN(number)) throw "Not numerical value";
		return number;
	});
};
//#endregion
//#region controllers/agentDashboard.controller.ts
const getAgentDayInsights = async (userId, date, config) => {
	const dayBoundaries = getDayBoundariesInUTC(date, config.IANA);
	const startOfDay = dayBoundaries.startDate;
	const endOfDay = dayBoundaries.endDate;
	const agentId = (await prisma.user.findUnique({ where: { id: userId } }))?.agentId;
	if (!agentId) throw "No agent";
	const companyId = (await prisma.agent.findUnique({ where: { id: agentId } }))?.companyId;
	const [callMetrics, events, latestState, totalStates] = await Promise.all([
		prisma.call.aggregate({
			where: {
				agentId,
				startAt: {
					gte: startOfDay,
					lte: endOfDay
				}
			},
			_count: { id: true },
			_sum: { durationSeconds: true }
		}),
		prisma.funnelEvent.findMany({ where: {
			agentId,
			timestamp: {
				gte: startOfDay,
				lte: endOfDay
			}
		} }),
		prisma.agentState.findFirst({
			where: {
				agentId,
				timestamp: {
					gte: startOfDay,
					lte: endOfDay
				}
			},
			orderBy: { timestamp: "desc" }
		}),
		prisma.agentState.aggregate({
			where: {
				agentId,
				timestamp: {
					gte: startOfDay,
					lte: endOfDay
				}
			},
			_count: { id: true }
		})
	]);
	const totalCalls = callMetrics._count.id || 0;
	const talkTime = callMetrics._sum.durationSeconds || 0;
	const seeds = events.filter((e) => e.type === EventType.SEED).length;
	const leads = events.filter((e) => e.type === EventType.LEAD).length;
	const sales = events.filter((e) => e.type === EventType.SALE).length;
	const deepCalls = await prisma.call.count({ where: {
		agentId,
		startAt: {
			gte: startOfDay,
			lte: endOfDay
		},
		durationSeconds: { gte: 300 }
	} });
	const goalAssignation = await prisma.goalsAssignation.findFirst({
		where: {
			companyId,
			date: startOfDay
		},
		include: { goal: true }
	});
	let currentStreak = 100;
	let goalSeeds = 0;
	let goalLeads = 0;
	let goalSales = 0;
	let goalNumberOfCalls = 0;
	let goalNumberOfLongCalls = 0;
	let goalTalkTimeMinutes = 0;
	if (goalAssignation) {
		const g = goalAssignation.goal;
		const percentages = [
			g.seeds ? seeds / g.seeds : 1,
			g.leads ? leads / g.leads : 1,
			g.sales ? sales / g.sales : 1,
			g.numberOfCalls ? totalCalls / g.numberOfCalls : 1
		];
		currentStreak = Math.min(100, Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length * 100));
		goalSeeds = g.seeds;
		goalLeads = g.leads;
		goalSales = g.sales;
		goalNumberOfCalls = g.numberOfCalls;
		goalNumberOfLongCalls = g.numberOfLongCalls;
		goalTalkTimeMinutes = g.talkTimeMinutes;
	}
	const energy = latestState?.energyScore;
	const motivation = latestState?.motivationScore;
	const focus = latestState?.focusScore;
	totalStates._count.id;
	return {
		seeds,
		leads,
		sales,
		currentStreak,
		number_of_calls: totalCalls,
		number_of_deep_call: deepCalls,
		energy: energy || 0,
		focus: focus || 0,
		motivation: motivation || 0,
		talkTime,
		goalSeeds,
		goalLeads,
		goalSales,
		goalNumberOfCalls,
		goalNumberOfLongCalls,
		goalTalkTimeMinutes
	};
};
const getAssignedSchema = async (userId, dateStr) => {
	const date = /* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`);
	const company = await prisma.user.findUnique({
		where: { id: userId },
		select: { companyId: true }
	});
	if (!company) throw "Not company found";
	const assigned = await prisma.schemaAssignation.findUnique({ where: { companyId_date: {
		companyId: company?.companyId,
		date
	} } });
	if (!assigned) return null;
	return await prisma.schema.findUnique({
		where: { id: assigned.schemaId },
		include: { blocks: { orderBy: { startMinutesFromMidnight: "asc" } } }
	});
};
const getAgentWeeklyGrowth = async (userId, dateStr, config) => {
	const agentId = (await prisma.user.findUnique({ where: { id: userId } }))?.agentId;
	if (!agentId) throw "No agent";
	const weekDays = getDailyWeekBoundariesInUTC(dateStr, config.IANA);
	const days = [
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat",
		"Sun"
	];
	const weeklyData = [];
	for (let i = 0; i < weekDays.length; i++) {
		const [calls, events, deepCalls] = await Promise.all([
			prisma.call.count({ where: {
				agentId,
				startAt: {
					gte: weekDays[i].startDate,
					lte: weekDays[i].endDate
				}
			} }),
			prisma.funnelEvent.findMany({ where: {
				agentId,
				timestamp: {
					gte: weekDays[i].startDate,
					lte: weekDays[i].endDate
				}
			} }),
			prisma.call.count({ where: {
				agentId,
				startAt: {
					gte: weekDays[i].startDate,
					lte: weekDays[i].endDate
				},
				durationSeconds: { gte: 300 }
			} })
		]);
		const s = events.filter((e) => e.type === EventType.SEED).length;
		const l = events.filter((e) => e.type === EventType.LEAD).length;
		const sa = events.filter((e) => e.type === EventType.SALE).length;
		const growth = s + l * 2 + sa * 3 + calls + deepCalls * 2;
		weeklyData.push({
			day: days[i],
			growth
		});
	}
	return weeklyData;
};
/**
* Registers a new state entry for an agent.
* @param agentId - The ID of the agent reporting their state
* @param energy - Score from 1-10
* @param focus - Score from 1-10
* @param motivation - Score from 1-10
*/
const registerAgentState = async (userId, energy, focus, motivation) => {
	try {
		const agentId = (await prisma.user.findUnique({ where: { id: userId } }))?.agentId;
		if (!agentId) throw "No agent";
		if ([
			energy,
			focus,
			motivation
		].some((score) => score < 0 || score > 10)) throw new Error("Scores must be between 0 and 10.");
		return await prisma.agentState.create({ data: {
			agentId,
			energyScore: energy,
			focusScore: focus,
			motivationScore: motivation
		} });
	} catch (error) {
		console.error("Error registering agent state:", error);
		throw error;
	}
};
//#endregion
//#region routes/agentDashboard.route.ts
const agentDashboardRouter = Router();
agentDashboardRouter.get("/get-agent-day-insights", async (req, res) => {
	try {
		const { date } = req.query;
		const userId = req.user?.id;
		if (!userId) return res.status(400).json({ error: "Missing userId" });
		if (!date) return res.status(400).json({ error: "Missing date" });
		const report = await getAgentDayInsights(userId, date, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
agentDashboardRouter.get("/get-agent-weekly-growth", async (req, res) => {
	try {
		const { date } = req.query;
		const userId = req.user?.id;
		if (!userId) return res.status(400).json({ error: "Missing agentId" });
		if (!date) return res.status(400).json({ error: "Missing date" });
		const report = await getAgentWeeklyGrowth(userId, date, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
agentDashboardRouter.get("/get-assigned-schema", async (req, res) => {
	try {
		const { date } = req.query;
		const userId = req.user?.id;
		if (!userId) return res.status(400).json({ error: "Missing agentId" });
		if (!date) return res.status(400).json({ error: "Missing date" });
		const result = await getAssignedSchema(userId, date);
		return res.status(200).json(result);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
agentDashboardRouter.post("/register-agent-state", async (req, res) => {
	try {
		const { energy, focus, motivation } = req.body;
		const userId = req.user?.id;
		if (!userId) return res.status(400).json({ error: "Missing agentId" });
		const result = await registerAgentState(userId, Number(energy), Number(focus), Number(motivation));
		return res.status(200).json(result);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
//#endregion
//#region controllers/SharedScreen.controller.ts
const getAgentPerformanceReport = async (companyId, startDateStr, endDateStr, page = 1, size = 10) => {
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const offset = (page - 1) * size;
	/**
	* We use a Raw Query to:
	* 1. Join Agents with their current Level (till is null).
	* 2. Left join with Calls and FunnelEvents within the date range.
	* 3. Group by Agent to get sums/counts.
	* 4. Calculate a 'performance_score' for sorting.
	*/
	const report = await prisma.$queryRaw`
    SELECT 
      a.id,
      a.name,
      a."profileImg",
      COALESCE(al.level, 3) as "currentLevel", -- Default to 3 (Bronze) if no level found
      SUM(COALESCE(c."durationSeconds", 0)) as "totalCallingTime",
      COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SEED} THEN fe.id END) as "totalSeeds",
      COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SALE} THEN fe.id END) as "totalSales",
      -- Formula: (CallingTime + Seeds + Sales) / 3
      (
        SUM(COALESCE(c."durationSeconds", 0)) + 
        COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SEED} THEN fe.id END) + 
        COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SALE} THEN fe.id END)
      ) / 3.0 as "performanceScore"
    FROM "Agent" a
    -- Get current level
    LEFT JOIN "AgentLevel" al ON al."agentId" = a.id AND al.till IS NULL
    -- Join Calls in range
    LEFT JOIN "Call" c ON c."agentId" = a.id 
      AND c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate} 
      AND c."startAt" <= ${endDate}
    -- Join FunnelEvents in range
    LEFT JOIN "FunnelEvent" fe ON fe."agentId" = a.id 
      AND fe.timestamp >= ${startDate} 
      AND fe.timestamp <= ${endDate}
    WHERE a."companyId" = ${companyId}
    GROUP BY a.id, a.name, al.level
    ORDER BY "performanceScore" DESC
    LIMIT ${size}
    OFFSET ${offset}
  `;
	const totalAgents = await prisma.agent.count({ where: { companyId } });
	return {
		data: report.map((item) => ({
			name: item.name,
			callingTime: Number(item.totalCallingTime),
			seeds: Number(item.totalSeeds),
			sales: Number(item.totalSales),
			currentLevel: item.currentLevel,
			averageScore: parseFloat(Number(item.performanceScore).toFixed(2)),
			profileImg: item.profileImg
		})),
		meta: {
			totalAgents,
			totalPages: Math.ceil(totalAgents / size),
			currentPage: page
		}
	};
};
const getTeamHeatScore = async (companyId, dateStr, config) => {
	const targetDate = /* @__PURE__ */ new Date(`${dateStr}T00:00:00.000Z`);
	const dayBoundaries = getDayBoundariesInUTC(dateStr, config.IANA);
	const startDate = dayBoundaries.startDate;
	const endDate = dayBoundaries.endDate;
	const goalAssignation = await prisma.goalsAssignation.findUnique({
		where: { companyId_date: {
			companyId,
			date: targetDate
		} },
		include: { goal: true }
	});
	if (!goalAssignation) return {
		heatScore: 0,
		message: "No goals assigned for this date.",
		metrics: null
	};
	const targets = goalAssignation.goal;
	/**
	* 2. Aggregate Actual Performance for the team on that day
	* We count total calls, duration, seeds, sales, and leads.
	*/
	const actuals = await prisma.$queryRaw`
    SELECT 
      COUNT(c.id)::float as "totalCalls",
      SUM(COALESCE(c."durationSeconds", 0))::float as "totalDuration",
      COUNT(CASE WHEN fe.type = ${EventType.SEED} THEN 1 END)::float as "totalSeeds",
      COUNT(CASE WHEN fe.type = ${EventType.SALE} THEN 1 END)::float as "totalSales",
      COUNT(CASE WHEN fe.type = ${EventType.LEAD} THEN 1 END)::float as "totalLeads"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
  `;
	await prisma.call.findFirst({ where: { companyId } });
	const stats = actuals[0];
	/**
	* 3. Calculate Heat Score
	* We calculate the percentage of completion for each metric.
	* We use weights to give "Sales" or "Seeds" more importance in the "Heat".
	*/
	const weights = {
		calls: .1,
		time: .2,
		seeds: .25,
		leads: .15,
		sales: .3
	};
	const calcProgress = (actual, target) => {
		if (target <= 0) return 1;
		return Math.min(actual / target, 1.2);
	};
	const callProgress = calcProgress(Number(stats.totalCalls), targets.numberOfCalls);
	const timeProgress = calcProgress(Number(stats.totalDuration) / 60, targets.talkTimeMinutes);
	const seedProgress = calcProgress(Number(stats.totalSeeds), targets.seeds);
	const leadProgress = calcProgress(Number(stats.totalLeads), targets.leads);
	const saleProgress = calcProgress(Number(stats.totalSales), targets.sales);
	const weightedScore = (callProgress * weights.calls + timeProgress * weights.time + seedProgress * weights.seeds + leadProgress * weights.leads + saleProgress * weights.sales) * 100;
	return {
		heatScore: Math.round(Math.min(weightedScore, 100)),
		details: {
			actual: {
				calls: Number(stats.totalCalls),
				minutes: Math.round(Number(stats.totalDuration) / 60),
				seeds: Number(stats.totalSeeds),
				leads: Number(stats.totalLeads),
				sales: Number(stats.totalSales)
			},
			targets: {
				calls: targets.numberOfCalls,
				minutes: targets.talkTimeMinutes,
				seeds: targets.seeds,
				leads: targets.leads,
				sales: targets.sales
			}
		}
	};
};
//#endregion
//#region routes/SharedScreen.route.ts
const sharedScreenRoute = Router();
sharedScreenRoute.get("/get_agents_positions", async (req, res) => {
	try {
		const { from, to, page, pageSize } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(401).json({ error: "Unauthorized: Company ID not found" });
		if (!from || !to) return res.status(400).json({ error: "Parameters 'from' and 'to' are required (YYYY-MM-DD)" });
		const report = await getAgentPerformanceReport(Number(companyId), from, to, Number(page) || 1, Number(pageSize) || 10);
		return res.status(200).json(report);
	} catch (err) {
		console.error("Agent Positions Error:", err);
		return res.status(500).json({ error: "Internal server error calculating agent positions" });
	}
});
sharedScreenRoute.get("/get_team_heat", async (req, res) => {
	try {
		const { date } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId) return res.status(401).json({ error: "Unauthorized: Company ID not found" });
		if (!date) return res.status(400).json({ error: "Parameter 'date' is required (YYYY-MM-DDTHH:MM:SS.MMMZ)" });
		const report = await getTeamHeatScore(companyId, date, { IANA: "Europe/Amsterdam" });
		return res.status(200).json(report);
	} catch (err) {
		console.error("team heat calculation Error:", err);
		return res.status(500).json({ error: "Internal server error calculating team heat map" });
	}
});
//#endregion
//#region routes/upload.route.ts
const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
	}
});
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});
const uploadRoute = Router();
uploadRoute.get("/agent-profile", upload.single("profile"), async (req, res) => {
	try {
		if (!req.user?.id || !req.user?.companyId) return res.status(400).json({ message: "No user id or company id" });
		const result = await prisma.user.findUnique({
			where: { id: req.user.id },
			include: { agentProfile: true }
		});
		return res.status(200).json({ url: result?.agentProfile?.profileImg || null });
	} catch (error) {
		return res.status(500).json({ error });
	}
});
uploadRoute.post("/agent-profile", upload.single("profile"), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ message: "No file uploaded" });
		if (!req.user?.id || !req.user?.companyId) return res.status(400).json({ message: "No user id or company id" });
		const user = await prisma.user.findUnique({
			where: {
				id: req.user.id,
				companyId: req.user.companyId
			},
			select: { agentProfile: true }
		});
		if (!user || !user.agentProfile) return res.status(400).json({ message: "Not existant agent" });
		const agent = user.agentProfile;
		const file = req.file;
		const fileName = `profiles/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
		const uploadParams = {
			Bucket: process.env.AWS_S_BUCKET_NAME,
			Key: fileName,
			Body: file.buffer,
			ContentType: file.mimetype
		};
		await s3Client.send(new PutObjectCommand(uploadParams));
		const s3Url = `https://${process.env.AWS_S_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
		await prisma.agent.update({
			where: { id: agent.id },
			data: { profileImg: s3Url }
		});
		return res.status(200).json({
			message: "Uploaded to AWS S3 successfully",
			url: s3Url
		});
	} catch (error) {
		console.error("S3 Upload Error:", error);
		return res.status(500).json({ message: "Upload failed" });
	}
});
//#endregion
//#region middleware/authBasic.middleware.ts
const authenticateBasic = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader) return res.status(401).send("Authentication required");
		const base64Credentials = authHeader.split(" ")[1];
		const [publicKey, secretKey] = Buffer.from(base64Credentials, "base64").toString("ascii").split(":");
		const secretHash = createHash("sha256").update(secretKey).digest("hex");
		const company = await prisma.company.findFirst({
			where: { apiKey: { publicKey } },
			include: { apiKey: { select: { secretKeyHash: true } } }
		});
		if (!company) return res.status(401).send("Unathorized");
		if (company.apiKey?.secretKeyHash !== secretHash) return res.status(401).send("Unauthorized");
		req.user = { companyId: company.id };
		next();
	} catch (error) {
		res.status(500).json({ error: "Unexpected Error" });
	}
};
//#endregion
//#region routes/index.ts
const router = Router();
/**
* You can create separate files for 'userRoutes.ts', 'productRoutes.ts', etc.
* and import them here.
*/
router.use("/auth", authRouter);
router.use("/admin", authenticateJWT, adminRouter);
router.use("/schema", authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER"]), schemaRouter);
router.use("/datavis", authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER"]), dataVisRouter);
router.use("/agent-dashboard", authenticateJWT, allowedRoles([
	"MAIN_ADMIN",
	"MANAGER",
	"AGENT"
]), agentDashboardRouter);
router.use("/shared-screen", authenticateJWT, allowedRoles([
	"MAIN_ADMIN",
	"MANAGER",
	"AGENT"
]), sharedScreenRoute);
router.use("/upload", authenticateJWT, allowedRoles(["AGENT"]), uploadRoute);
router.use("/leaddesk", authenticateBasic, leadDeskWebhookRouter);
//#endregion
//#region app.ts
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);
//#endregion
//#region index.ts
const PORT = process.env.PORT || 3e3;
app.listen(PORT, () => {
	console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
//#endregion
export {};
