import express, { Router } from "express";
import axios from "axios";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as runtime from "@prisma/client/runtime/client";
import { createHash, randomBytes, randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { compare, hash } from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region generated/prisma/internal/class.ts
const config = {
	"previewFeatures": [],
	"clientVersion": "7.4.1",
	"engineVersion": "55ae170b1ced7fc6ed07a15f110549408c501bb3",
	"activeProvider": "postgresql",
	"inlineSchema": "// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\n// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?\n// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init\n\n// IMPORTANT\n// - Leaddesk API does not allows ut to fetch a list of agents, so, We will just store it once a call is performed. MAYBE from LD dashboard a agents list can be downloaded and uploaded here?\n\n/**\n * MAIN FLOW\n * - A company manager gets into our dashboard\n * - He registers as a manager, providing email, password.\n * - Is redirected to the dashboard in the page \"Connections\"\n * - It is required to input the leaddesk auth token\n * - ?? enters the agents -> autofetching(leaddesk api does not provide a way to fetch agents), manual input or upload csv or excel file\n * ---\n * - An agent performs a call\n * - Leaddesk webhook calls the api endpoint \"manage_webhook\"\n * - \"manage_webhook\" will read the parameter \"last_call_id\"\n * - Call the leaddesk endpoint \"https://api.leaddesk.com?auth=X&mod=call&cmd=get&call_ref_id=last_call_id\"\n * - The endpoint returns the next data:\n * {\n * \"id\": \"4999\",\n * \"agent_id\": \"11\",\n * \"agent_username\": \"teuvotest\",\n * \"talk_time\": \"45\",\n * \"talk_start\": \"2016-01-01 12:13:14\",\n * \"talk_end\": \"2016-02-02 14:12:10\",\n * \"number\": \"+358123123\",\n * \"campaign\": \"14\",\n * \"campaign_name\": \"test campaign\",\n * \"record_file\": \"test_recording.wav.mp3\",\n * \"created_at\": \"2016-01-01 12:13:10\",\n * \"customer_id\": \"21\",\n * \"comment\": \"test comment\",\n * \"agent_group_id\": \"13\",\n * \"agent_group_name\": \"test group\",\n * \"call_ending_reason\": \"15\",\n * \"call_ending_reason_name\": \"test reason\",\n * \"handling_stop\": \"2016-02-02 14:20:30\",\n * \"direction\": \"out\",\n * \"call_type\": \"1\",\n * \"contact_id\": \"1\",\n * \"call_type_name\": \"semi\",\n * \"order_ids\": [\n * 1,\n * 3\n * ]\n * }\n * - WE use that info to register in our database:\n * -\n */\n\ngenerator client {\n  provider = \"prisma-client\"\n  output   = \"../generated/prisma\"\n}\n\ndatasource db {\n  provider = \"postgresql\"\n}\n\nenum Role {\n  MAIN_ADMIN\n  MANAGER\n  AGENT\n}\n\nenum BlockType {\n  WORKING\n  REST\n  EXTRA_TIME\n}\n\nenum SchemaType {\n  DAILY\n  WEEKLY\n  MONTHLY\n}\n\nenum EventType {\n  SEED // CALLBACK. books a call as a \"Callback\" -> Since I have now exact way to now this, I will just count each call as a seed, by now.\n  LEAD // WATERING. Callback is performed AKA agent calls a callee more than 1 time: Every call from this increases +1 LEAD\n  SALE // HARVEST. Agent books a call as a deal -> the call data has order_ids.length more than 1\n}\n\nenum UserStatus {\n  PAUSED\n  ACTIVE\n  REMOVED // not return point, but we keep it due to historical reasons\n}\n\nenum THIRD_PARTY_SERVICES {\n  LEADDESK\n}\n\nenum WEEK_DAYS {\n  MONDAY\n  TUESDAY\n  WEDNESDAY\n  THURSDAY\n  FRIDAY\n  SATURDAY\n  SUNDAY\n}\n\nmodel User {\n  id           Int      @id @default(autoincrement())\n  email        String   @unique\n  passwordHash String // Store hashed passwords only\n  role         Role     @default(AGENT)\n  isActive     Boolean  @default(true)\n  createdAt    DateTime @default(now())\n  updatedAt    DateTime @updatedAt\n\n  // Relations to your existing entities\n  companyId Int\n  company   Company @relation(fields: [companyId], references: [id])\n\n  // Optional links depending on the role\n  managerProfile Manager? @relation(fields: [managerId], references: [id])\n  managerId      Int?     @unique\n\n  agentProfile Agent? @relation(fields: [agentId], references: [id])\n  agentId      Int?   @unique\n\n  status UserStatus @default(ACTIVE) // REMOVED is used when \"deleted\" -> we can not delete it directly due to historical data. \n  // Constraint: One MAIN_ADMIN per company\n  // This is enforced via a unique partial index in the DB (see note below)\n}\n\nmodel Company {\n  id                Int                 @id @default(autoincrement())\n  name              String\n  createdAt         DateTime            @default(now())\n  managers          Manager[]\n  agents            Agent[]\n  calls             Call[]\n  TimeSchemas       Schema[]\n  users             User[]\n  temporalGoals     TemporalGoals[] // goals list \n  GoalsAssignation  GoalsAssignation[] // assigns 1 TemporalGoal to a specific day (date)\n  schemaAssignation SchemaAssignation[] // assigns 1 TemporalGoal to a specific day (date)\n  apiKey            APIKeysAuth?\n}\n\n// 1-to-1 company-key (used to authenticate webhook call origin)\n// @dev@IMPORTANT probably not the most secure approach, research how is this managed in secure apps \nmodel APIKeysAuth {\n  id Int @id @default(autoincrement())\n\n  // Use UUIDs for the keys. \n  // 'public' is a reserved keyword in some DBs, 'publicKey' is safer.\n  publicKey     String  @unique // uuid prefixed with a specific string exp: \"prefix-uuid\" \n  secretKeyHash String  @unique // hashed secret \n  // Link to company and ensure 1-to-1\n  company       Company @relation(fields: [companyId], references: [id])\n  companyId     Int     @unique\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel Manager {\n  id            Int             @id @default(autoincrement())\n  name          String\n  email         String          @unique\n  company       Company         @relation(fields: [companyId], references: [id]) // companyId is the foreign key, and it is compared with the `id` field of the other table\n  companyId     Int\n  user          User?\n  temporalGoals TemporalGoals[]\n  schemas       Schema[]\n}\n\nmodel Agent {\n  id                    Int             @id @default(autoincrement())\n  name                  String\n  company               Company         @relation(fields: [companyId], references: [id])\n  companyId             Int\n  calls                 Call[]\n  feelings              AgentState[]\n  events                FunnelEvent[]\n  user                  User?\n  totalAttempsPerCallee agentToCallee[]\n  agentToThird          AgentToThird[]\n}\n\nmodel AgentToThird {\n  id                     Int                  @id @default(autoincrement())\n  serviceIdentifier      THIRD_PARTY_SERVICES\n  agentServiceIdentifier String\n\n  // Relation fields\n  agent   Agent @relation(fields: [agentId], references: [id])\n  agentId Int\n\n  @@unique([agentId, serviceIdentifier]) // agent can have only 1 relation for the same service\n  @@unique([serviceIdentifier, agentServiceIdentifier]) // only 1 agent service identifier per service\n}\n\nmodel Callee {\n  id                   Int             @id @default(autoincrement())\n  phoneNumber          String          @unique\n  totalAttempts        Int             @default(0)\n  calls                Call[]\n  totalAttempsPerAgent agentToCallee[]\n}\n\n// tracks the number of times an agent calls the same number\n// @dev maybe in future, would be better to track \"per campaign\" too\nmodel agentToCallee {\n  id           Int    @id @default(autoincrement())\n  agent        Agent  @relation(fields: [agentId], references: [id])\n  agentId      Int\n  callee       Callee @relation(fields: [calleeId], references: [id])\n  calleeId     Int\n  totalAttemps Int    @default(0)\n\n  @@unique([agentId, calleeId])\n}\n\n// --- BLOCKS MASKS ---\n// Managers create time schedules by block, so the can filter the call querying by such blocks \n\nmodel Schema {\n  id                 Int                 @id @default(autoincrement())\n  name               String\n  company            Company             @relation(fields: [companyId], references: [id])\n  companyId          Int\n  creator            Manager             @relation(fields: [creatorId], references: [id])\n  creatorId          Int\n  blocks             SchemaBlock[]\n  schemaAssignations SchemaAssignation[]\n}\n\nmodel SchemaBlock {\n  id                       Int       @id @default(autoincrement())\n  startMinutesFromMidnight Int\n  endMinutesFromMidnight   Int\n  blockType                BlockType @default(WORKING)\n  name                     String? // (e.g., \"Morning Blitz\", \"Afternoon Follow-ups\")\n  Schema                   Schema    @relation(fields: [schemaId], references: [id])\n  schemaId                 Int\n}\n\nmodel SchemaAssignation {\n  id        Int      @id @default(autoincrement())\n  company   Company  @relation(fields: [companyId], references: [id])\n  companyId Int\n  schema    Schema   @relation(fields: [schemaId], references: [id])\n  schemaId  Int\n  date      DateTime // day at which the goals are assigned \n\n  @@unique([companyId, date])\n}\n\n// --- PERFORMANCE DATA ---\n\nmodel Call {\n  id              Int       @id @default(autoincrement())\n  leadDeskId      String? //@todo  // Not unique because can variate per company. Also, this is temporary, will be better to create another table so we can handle multiple services aside leaddesk \n  agent           Agent     @relation(fields: [agentId], references: [id])\n  agentId         Int\n  callee          Callee    @relation(fields: [calleeId], references: [id])\n  calleeId        Int\n  company         Company   @relation(fields: [companyId], references: [id])\n  companyId       Int\n  startAt         DateTime  @default(now())\n  endAt           DateTime?\n  durationSeconds Int       @default(0)\n  // isEffective       Boolean          @default(false)\n\n  events FunnelEvent[]\n\n  // \n  dayOfTheWeek WEEK_DAYS\n}\n\nmodel FunnelEvent {\n  id        Int       @id @default(autoincrement())\n  type      EventType\n  timestamp DateTime  @default(now())\n  call      Call      @relation(fields: [callId], references: [id])\n  callId    Int\n  agent     Agent     @relation(fields: [agentId], references: [id])\n  agentId   Int\n}\n\n// @todo make \"funnelEventCountPerUser\" and \"funnelEventCount\" models for quicker fetches for related graphics @IMPORTANT \n\nmodel AgentState {\n  id              Int      @id @default(autoincrement())\n  agent           Agent    @relation(fields: [agentId], references: [id])\n  agentId         Int\n  timestamp       DateTime @default(now())\n  energyScore     Int // 1-10\n  focusScore      Int // 1-10\n  motivationScore Int // 1-10\n}\n\nmodel TemporalGoals {\n  id   Int    @id @default(autoincrement())\n  name String // i.e hard goals, newbies goals...\n\n  // Productivity Targets\n  talkTimeMinutes   Int      @default(0)\n  seeds             Int      @default(0)\n  callbacks         Int      @default(0)\n  leads             Int      @default(0)\n  sales             Int      @default(0)\n  numberOfCalls     Int      @default(0)\n  numberOfLongCalls Int      @default(0)\n  // Relations\n  company           Company  @relation(fields: [companyId], references: [id])\n  companyId         Int\n  creator           Manager  @relation(fields: [creatorId], references: [id])\n  creatorId         Int\n  createdAt         DateTime @default(now())\n  updatedAt         DateTime @updatedAt\n\n  goalsAssignation GoalsAssignation[]\n}\n\nmodel GoalsAssignation {\n  id        Int           @id @default(autoincrement())\n  company   Company       @relation(fields: [companyId], references: [id])\n  companyId Int\n  goal      TemporalGoals @relation(fields: [goalId], references: [id])\n  goalId    Int\n  date      DateTime // day at which the goals are assigned \n\n  @@unique([companyId, date])\n}\n\n/**\n * Looking at this prisma schema:\n * ```\n * ```\n * Let me know if it is possible to fetch the next information:\n * I'm gonna need to fetch data as follows:\n * - Per agent, per time (from-to values used to select a time gap)\n * - Per agent, per block (from-to values used to search for in-range blocks)\n * - Per selected agents, per time (from-to values used to select a time gap)\n * - Per selected agents, per block (from-to values used to search for in-range blocks)\n * - Per team, per time (from-to values used to select a time gap)\n * - Per team, per block (from-to values used to search for in-range blocks)\n * - ALL AGENTS DATA, per time (from-to values used to select a time gap)\n * - ALL AGENTS DATA, per block (from-to values used to search for in-range blocks)\n * I would need to fetch the next values (individually, then I prepare the views):\n * • Total effective talk time\n * • Number of logged calls\n * • Number of calls longer than 5 minutes\n * • Average call duration\n * • Calls per hour\n * • Active time vs idle time (time in call vs time of)\n * • Long call ratio\n * total Seeds\n * • total Callbacks\n * • total Leads\n * • total Sales\n * energy\n * focus\n * motivation\n * When I say \"fetch\" I just want to now if it is possible to fetch each individual point, because that means I an create compound queires that give me specific views.\n * Also, for each point, give me a path to access to each point, for example: \"Per agent, per time calls per hour: agentId->calls inside from-to -> divide results in hours and calculate counting the n. of calls perfomed\"\n * If there is one point I can not access, let me know, but I think is possible access to all.\n */\n",
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
config.runtimeDataModel = JSON.parse("{\"models\":{\"User\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"passwordHash\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"role\",\"kind\":\"enum\",\"type\":\"Role\"},{\"name\":\"isActive\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToUser\"},{\"name\":\"managerProfile\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"ManagerToUser\"},{\"name\":\"managerId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agentProfile\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToUser\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"UserStatus\"}],\"dbName\":null},\"Company\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"managers\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"CompanyToManager\"},{\"name\":\"agents\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToCompany\"},{\"name\":\"calls\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"CallToCompany\"},{\"name\":\"TimeSchemas\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"CompanyToSchema\"},{\"name\":\"users\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"CompanyToUser\"},{\"name\":\"temporalGoals\",\"kind\":\"object\",\"type\":\"TemporalGoals\",\"relationName\":\"CompanyToTemporalGoals\"},{\"name\":\"GoalsAssignation\",\"kind\":\"object\",\"type\":\"GoalsAssignation\",\"relationName\":\"CompanyToGoalsAssignation\"},{\"name\":\"schemaAssignation\",\"kind\":\"object\",\"type\":\"SchemaAssignation\",\"relationName\":\"CompanyToSchemaAssignation\"},{\"name\":\"apiKey\",\"kind\":\"object\",\"type\":\"APIKeysAuth\",\"relationName\":\"APIKeysAuthToCompany\"}],\"dbName\":null},\"APIKeysAuth\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"publicKey\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"secretKeyHash\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"APIKeysAuthToCompany\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"Manager\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToManager\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"ManagerToUser\"},{\"name\":\"temporalGoals\",\"kind\":\"object\",\"type\":\"TemporalGoals\",\"relationName\":\"ManagerToTemporalGoals\"},{\"name\":\"schemas\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"ManagerToSchema\"}],\"dbName\":null},\"Agent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"AgentToCompany\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"calls\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"AgentToCall\"},{\"name\":\"feelings\",\"kind\":\"object\",\"type\":\"AgentState\",\"relationName\":\"AgentToAgentState\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"FunnelEvent\",\"relationName\":\"AgentToFunnelEvent\"},{\"name\":\"user\",\"kind\":\"object\",\"type\":\"User\",\"relationName\":\"AgentToUser\"},{\"name\":\"totalAttempsPerCallee\",\"kind\":\"object\",\"type\":\"agentToCallee\",\"relationName\":\"AgentToagentToCallee\"},{\"name\":\"agentToThird\",\"kind\":\"object\",\"type\":\"AgentToThird\",\"relationName\":\"AgentToAgentToThird\"}],\"dbName\":null},\"AgentToThird\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"serviceIdentifier\",\"kind\":\"enum\",\"type\":\"THIRD_PARTY_SERVICES\"},{\"name\":\"agentServiceIdentifier\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToAgentToThird\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"Callee\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"phoneNumber\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"totalAttempts\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"calls\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"CallToCallee\"},{\"name\":\"totalAttempsPerAgent\",\"kind\":\"object\",\"type\":\"agentToCallee\",\"relationName\":\"CalleeToagentToCallee\"}],\"dbName\":null},\"agentToCallee\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToagentToCallee\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"callee\",\"kind\":\"object\",\"type\":\"Callee\",\"relationName\":\"CalleeToagentToCallee\"},{\"name\":\"calleeId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"totalAttemps\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"Schema\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToSchema\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"creator\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"ManagerToSchema\"},{\"name\":\"creatorId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"blocks\",\"kind\":\"object\",\"type\":\"SchemaBlock\",\"relationName\":\"SchemaToSchemaBlock\"},{\"name\":\"schemaAssignations\",\"kind\":\"object\",\"type\":\"SchemaAssignation\",\"relationName\":\"SchemaToSchemaAssignation\"}],\"dbName\":null},\"SchemaBlock\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startMinutesFromMidnight\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"endMinutesFromMidnight\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"blockType\",\"kind\":\"enum\",\"type\":\"BlockType\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"Schema\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"SchemaToSchemaBlock\"},{\"name\":\"schemaId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"SchemaAssignation\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToSchemaAssignation\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"schema\",\"kind\":\"object\",\"type\":\"Schema\",\"relationName\":\"SchemaToSchemaAssignation\"},{\"name\":\"schemaId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"Call\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"leadDeskId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToCall\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"callee\",\"kind\":\"object\",\"type\":\"Callee\",\"relationName\":\"CallToCallee\"},{\"name\":\"calleeId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CallToCompany\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"endAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"durationSeconds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"FunnelEvent\",\"relationName\":\"CallToFunnelEvent\"},{\"name\":\"dayOfTheWeek\",\"kind\":\"enum\",\"type\":\"WEEK_DAYS\"}],\"dbName\":null},\"FunnelEvent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"EventType\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"call\",\"kind\":\"object\",\"type\":\"Call\",\"relationName\":\"CallToFunnelEvent\"},{\"name\":\"callId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToFunnelEvent\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"AgentState\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"agent\",\"kind\":\"object\",\"type\":\"Agent\",\"relationName\":\"AgentToAgentState\"},{\"name\":\"agentId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"energyScore\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"focusScore\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"motivationScore\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"TemporalGoals\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"talkTimeMinutes\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"seeds\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"callbacks\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"leads\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"sales\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"numberOfCalls\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"numberOfLongCalls\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToTemporalGoals\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"creator\",\"kind\":\"object\",\"type\":\"Manager\",\"relationName\":\"ManagerToTemporalGoals\"},{\"name\":\"creatorId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"goalsAssignation\",\"kind\":\"object\",\"type\":\"GoalsAssignation\",\"relationName\":\"GoalsAssignationToTemporalGoals\"}],\"dbName\":null},\"GoalsAssignation\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"company\",\"kind\":\"object\",\"type\":\"Company\",\"relationName\":\"CompanyToGoalsAssignation\"},{\"name\":\"companyId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"goal\",\"kind\":\"object\",\"type\":\"TemporalGoals\",\"relationName\":\"GoalsAssignationToTemporalGoals\"},{\"name\":\"goalId\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"date\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null}},\"enums\":{},\"types\":{}}");
config.parameterizationSchema = {
	strings: JSON.parse("[\"where\",\"orderBy\",\"cursor\",\"company\",\"user\",\"creator\",\"goal\",\"goalsAssignation\",\"_count\",\"temporalGoals\",\"Schema\",\"blocks\",\"schema\",\"schemaAssignations\",\"schemas\",\"managers\",\"agent\",\"calls\",\"callee\",\"totalAttempsPerAgent\",\"call\",\"events\",\"feelings\",\"totalAttempsPerCallee\",\"agentToThird\",\"agents\",\"TimeSchemas\",\"users\",\"GoalsAssignation\",\"schemaAssignation\",\"apiKey\",\"managerProfile\",\"agentProfile\",\"User.findUnique\",\"User.findUniqueOrThrow\",\"User.findFirst\",\"User.findFirstOrThrow\",\"User.findMany\",\"data\",\"User.createOne\",\"User.createMany\",\"User.createManyAndReturn\",\"User.updateOne\",\"User.updateMany\",\"User.updateManyAndReturn\",\"create\",\"update\",\"User.upsertOne\",\"User.deleteOne\",\"User.deleteMany\",\"having\",\"_avg\",\"_sum\",\"_min\",\"_max\",\"User.groupBy\",\"User.aggregate\",\"Company.findUnique\",\"Company.findUniqueOrThrow\",\"Company.findFirst\",\"Company.findFirstOrThrow\",\"Company.findMany\",\"Company.createOne\",\"Company.createMany\",\"Company.createManyAndReturn\",\"Company.updateOne\",\"Company.updateMany\",\"Company.updateManyAndReturn\",\"Company.upsertOne\",\"Company.deleteOne\",\"Company.deleteMany\",\"Company.groupBy\",\"Company.aggregate\",\"APIKeysAuth.findUnique\",\"APIKeysAuth.findUniqueOrThrow\",\"APIKeysAuth.findFirst\",\"APIKeysAuth.findFirstOrThrow\",\"APIKeysAuth.findMany\",\"APIKeysAuth.createOne\",\"APIKeysAuth.createMany\",\"APIKeysAuth.createManyAndReturn\",\"APIKeysAuth.updateOne\",\"APIKeysAuth.updateMany\",\"APIKeysAuth.updateManyAndReturn\",\"APIKeysAuth.upsertOne\",\"APIKeysAuth.deleteOne\",\"APIKeysAuth.deleteMany\",\"APIKeysAuth.groupBy\",\"APIKeysAuth.aggregate\",\"Manager.findUnique\",\"Manager.findUniqueOrThrow\",\"Manager.findFirst\",\"Manager.findFirstOrThrow\",\"Manager.findMany\",\"Manager.createOne\",\"Manager.createMany\",\"Manager.createManyAndReturn\",\"Manager.updateOne\",\"Manager.updateMany\",\"Manager.updateManyAndReturn\",\"Manager.upsertOne\",\"Manager.deleteOne\",\"Manager.deleteMany\",\"Manager.groupBy\",\"Manager.aggregate\",\"Agent.findUnique\",\"Agent.findUniqueOrThrow\",\"Agent.findFirst\",\"Agent.findFirstOrThrow\",\"Agent.findMany\",\"Agent.createOne\",\"Agent.createMany\",\"Agent.createManyAndReturn\",\"Agent.updateOne\",\"Agent.updateMany\",\"Agent.updateManyAndReturn\",\"Agent.upsertOne\",\"Agent.deleteOne\",\"Agent.deleteMany\",\"Agent.groupBy\",\"Agent.aggregate\",\"AgentToThird.findUnique\",\"AgentToThird.findUniqueOrThrow\",\"AgentToThird.findFirst\",\"AgentToThird.findFirstOrThrow\",\"AgentToThird.findMany\",\"AgentToThird.createOne\",\"AgentToThird.createMany\",\"AgentToThird.createManyAndReturn\",\"AgentToThird.updateOne\",\"AgentToThird.updateMany\",\"AgentToThird.updateManyAndReturn\",\"AgentToThird.upsertOne\",\"AgentToThird.deleteOne\",\"AgentToThird.deleteMany\",\"AgentToThird.groupBy\",\"AgentToThird.aggregate\",\"Callee.findUnique\",\"Callee.findUniqueOrThrow\",\"Callee.findFirst\",\"Callee.findFirstOrThrow\",\"Callee.findMany\",\"Callee.createOne\",\"Callee.createMany\",\"Callee.createManyAndReturn\",\"Callee.updateOne\",\"Callee.updateMany\",\"Callee.updateManyAndReturn\",\"Callee.upsertOne\",\"Callee.deleteOne\",\"Callee.deleteMany\",\"Callee.groupBy\",\"Callee.aggregate\",\"agentToCallee.findUnique\",\"agentToCallee.findUniqueOrThrow\",\"agentToCallee.findFirst\",\"agentToCallee.findFirstOrThrow\",\"agentToCallee.findMany\",\"agentToCallee.createOne\",\"agentToCallee.createMany\",\"agentToCallee.createManyAndReturn\",\"agentToCallee.updateOne\",\"agentToCallee.updateMany\",\"agentToCallee.updateManyAndReturn\",\"agentToCallee.upsertOne\",\"agentToCallee.deleteOne\",\"agentToCallee.deleteMany\",\"agentToCallee.groupBy\",\"agentToCallee.aggregate\",\"Schema.findUnique\",\"Schema.findUniqueOrThrow\",\"Schema.findFirst\",\"Schema.findFirstOrThrow\",\"Schema.findMany\",\"Schema.createOne\",\"Schema.createMany\",\"Schema.createManyAndReturn\",\"Schema.updateOne\",\"Schema.updateMany\",\"Schema.updateManyAndReturn\",\"Schema.upsertOne\",\"Schema.deleteOne\",\"Schema.deleteMany\",\"Schema.groupBy\",\"Schema.aggregate\",\"SchemaBlock.findUnique\",\"SchemaBlock.findUniqueOrThrow\",\"SchemaBlock.findFirst\",\"SchemaBlock.findFirstOrThrow\",\"SchemaBlock.findMany\",\"SchemaBlock.createOne\",\"SchemaBlock.createMany\",\"SchemaBlock.createManyAndReturn\",\"SchemaBlock.updateOne\",\"SchemaBlock.updateMany\",\"SchemaBlock.updateManyAndReturn\",\"SchemaBlock.upsertOne\",\"SchemaBlock.deleteOne\",\"SchemaBlock.deleteMany\",\"SchemaBlock.groupBy\",\"SchemaBlock.aggregate\",\"SchemaAssignation.findUnique\",\"SchemaAssignation.findUniqueOrThrow\",\"SchemaAssignation.findFirst\",\"SchemaAssignation.findFirstOrThrow\",\"SchemaAssignation.findMany\",\"SchemaAssignation.createOne\",\"SchemaAssignation.createMany\",\"SchemaAssignation.createManyAndReturn\",\"SchemaAssignation.updateOne\",\"SchemaAssignation.updateMany\",\"SchemaAssignation.updateManyAndReturn\",\"SchemaAssignation.upsertOne\",\"SchemaAssignation.deleteOne\",\"SchemaAssignation.deleteMany\",\"SchemaAssignation.groupBy\",\"SchemaAssignation.aggregate\",\"Call.findUnique\",\"Call.findUniqueOrThrow\",\"Call.findFirst\",\"Call.findFirstOrThrow\",\"Call.findMany\",\"Call.createOne\",\"Call.createMany\",\"Call.createManyAndReturn\",\"Call.updateOne\",\"Call.updateMany\",\"Call.updateManyAndReturn\",\"Call.upsertOne\",\"Call.deleteOne\",\"Call.deleteMany\",\"Call.groupBy\",\"Call.aggregate\",\"FunnelEvent.findUnique\",\"FunnelEvent.findUniqueOrThrow\",\"FunnelEvent.findFirst\",\"FunnelEvent.findFirstOrThrow\",\"FunnelEvent.findMany\",\"FunnelEvent.createOne\",\"FunnelEvent.createMany\",\"FunnelEvent.createManyAndReturn\",\"FunnelEvent.updateOne\",\"FunnelEvent.updateMany\",\"FunnelEvent.updateManyAndReturn\",\"FunnelEvent.upsertOne\",\"FunnelEvent.deleteOne\",\"FunnelEvent.deleteMany\",\"FunnelEvent.groupBy\",\"FunnelEvent.aggregate\",\"AgentState.findUnique\",\"AgentState.findUniqueOrThrow\",\"AgentState.findFirst\",\"AgentState.findFirstOrThrow\",\"AgentState.findMany\",\"AgentState.createOne\",\"AgentState.createMany\",\"AgentState.createManyAndReturn\",\"AgentState.updateOne\",\"AgentState.updateMany\",\"AgentState.updateManyAndReturn\",\"AgentState.upsertOne\",\"AgentState.deleteOne\",\"AgentState.deleteMany\",\"AgentState.groupBy\",\"AgentState.aggregate\",\"TemporalGoals.findUnique\",\"TemporalGoals.findUniqueOrThrow\",\"TemporalGoals.findFirst\",\"TemporalGoals.findFirstOrThrow\",\"TemporalGoals.findMany\",\"TemporalGoals.createOne\",\"TemporalGoals.createMany\",\"TemporalGoals.createManyAndReturn\",\"TemporalGoals.updateOne\",\"TemporalGoals.updateMany\",\"TemporalGoals.updateManyAndReturn\",\"TemporalGoals.upsertOne\",\"TemporalGoals.deleteOne\",\"TemporalGoals.deleteMany\",\"TemporalGoals.groupBy\",\"TemporalGoals.aggregate\",\"GoalsAssignation.findUnique\",\"GoalsAssignation.findUniqueOrThrow\",\"GoalsAssignation.findFirst\",\"GoalsAssignation.findFirstOrThrow\",\"GoalsAssignation.findMany\",\"GoalsAssignation.createOne\",\"GoalsAssignation.createMany\",\"GoalsAssignation.createManyAndReturn\",\"GoalsAssignation.updateOne\",\"GoalsAssignation.updateMany\",\"GoalsAssignation.updateManyAndReturn\",\"GoalsAssignation.upsertOne\",\"GoalsAssignation.deleteOne\",\"GoalsAssignation.deleteMany\",\"GoalsAssignation.groupBy\",\"GoalsAssignation.aggregate\",\"AND\",\"OR\",\"NOT\",\"id\",\"companyId\",\"goalId\",\"date\",\"equals\",\"in\",\"notIn\",\"lt\",\"lte\",\"gt\",\"gte\",\"not\",\"name\",\"talkTimeMinutes\",\"seeds\",\"callbacks\",\"leads\",\"sales\",\"numberOfCalls\",\"numberOfLongCalls\",\"creatorId\",\"createdAt\",\"updatedAt\",\"contains\",\"startsWith\",\"endsWith\",\"agentId\",\"timestamp\",\"energyScore\",\"focusScore\",\"motivationScore\",\"EventType\",\"type\",\"callId\",\"leadDeskId\",\"calleeId\",\"startAt\",\"endAt\",\"durationSeconds\",\"WEEK_DAYS\",\"dayOfTheWeek\",\"schemaId\",\"startMinutesFromMidnight\",\"endMinutesFromMidnight\",\"BlockType\",\"blockType\",\"totalAttemps\",\"phoneNumber\",\"totalAttempts\",\"every\",\"some\",\"none\",\"THIRD_PARTY_SERVICES\",\"serviceIdentifier\",\"agentServiceIdentifier\",\"email\",\"publicKey\",\"secretKeyHash\",\"passwordHash\",\"Role\",\"role\",\"isActive\",\"managerId\",\"UserStatus\",\"status\",\"agentId_serviceIdentifier\",\"serviceIdentifier_agentServiceIdentifier\",\"agentId_calleeId\",\"companyId_date\",\"is\",\"isNot\",\"connectOrCreate\",\"upsert\",\"createMany\",\"set\",\"disconnect\",\"delete\",\"connect\",\"updateMany\",\"deleteMany\",\"increment\",\"decrement\",\"multiply\",\"divide\"]"),
	graph: "igmoAYACEQMAAPYDACAfAAC0BAAgIAAAtQQAIKkCAACvBAAwqgIAAAcAEKsCAACvBAAwrAICAAAAAa0CAgDpAwAhwQJAAPUDACHCAkAA9QMAIcYCAgAAAAHjAgEAAAAB5gIBAOoDACHoAgAAsAToAiLpAiAAsQQAIeoCAgAAAAHsAgAAswTsAiIBAAAAAQAgCwMAAPYDACAEAAChBAAgCQAA_QMAIA4AAPsDACCpAgAAtgQAMKoCAAADABCrAgAAtgQAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIeMCAQDqAwAhBAMAAPgGACAEAAD5BwAgCQAA6gcAIA4AAOgHACALAwAA9gMAIAQAAKEEACAJAAD9AwAgDgAA-wMAIKkCAAC2BAAwqgIAAAMAEKsCAAC2BAAwrAICAAAAAa0CAgDpAwAhuAIBAOoDACHjAgEAAAABAwAAAAMAIAEAAAQAMAIAAAUAIBEDAAD2AwAgHwAAtAQAICAAALUEACCpAgAArwQAMKoCAAAHABCrAgAArwQAMKwCAgDpAwAhrQICAOkDACHBAkAA9QMAIcICQAD1AwAhxgICALIEACHjAgEA6gMAIeYCAQDqAwAh6AIAALAE6AIi6QIgALEEACHqAgIAsgQAIewCAACzBOwCIgEAAAAHACATAwAA9gMAIAUAAKkEACAHAAD-AwAgqQIAAK4EADCqAgAACQAQqwIAAK4EADCsAgIA6QMAIa0CAgDpAwAhuAIBAOoDACG5AgIA6QMAIboCAgDpAwAhuwICAOkDACG8AgIA6QMAIb0CAgDpAwAhvgICAOkDACG_AgIA6QMAIcACAgDpAwAhwQJAAPUDACHCAkAA9QMAIQMDAAD4BgAgBQAA8wcAIAcAAOsHACATAwAA9gMAIAUAAKkEACAHAAD-AwAgqQIAAK4EADCqAgAACQAQqwIAAK4EADCsAgIAAAABrQICAOkDACG4AgEA6gMAIbkCAgDpAwAhugICAOkDACG7AgIA6QMAIbwCAgDpAwAhvQICAOkDACG-AgIA6QMAIb8CAgDpAwAhwAICAOkDACHBAkAA9QMAIcICQAD1AwAhAwAAAAkAIAEAAAoAMAIAAAsAIAkDAAD2AwAgBgAArQQAIKkCAACsBAAwqgIAAA0AEKsCAACsBAAwrAICAOkDACGtAgIA6QMAIa4CAgDpAwAhrwJAAPUDACECAwAA-AYAIAYAAP0HACAKAwAA9gMAIAYAAK0EACCpAgAArAQAMKoCAAANABCrAgAArAQAMKwCAgAAAAGtAgIA6QMAIa4CAgDpAwAhrwJAAPUDACHwAgAAqwQAIAMAAAANACABAAAOADACAAAPACABAAAADQAgCwMAAPYDACAFAACpBAAgCwAAqgQAIA0AAP8DACCpAgAAqAQAMKoCAAASABCrAgAAqAQAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIcACAgDpAwAhBAMAAPgGACAFAADzBwAgCwAA_AcAIA0AAOwHACALAwAA9gMAIAUAAKkEACALAACqBAAgDQAA_wMAIKkCAACoBAAwqgIAABIAEKsCAACoBAAwrAICAAAAAa0CAgDpAwAhuAIBAOoDACHAAgIA6QMAIQMAAAASACABAAATADACAAAUACAKCgAApQQAIKkCAACmBAAwqgIAABYAEKsCAACmBAAwrAICAOkDACG4AgEAmwQAIdUCAgDpAwAh1gICAOkDACHXAgIA6QMAIdkCAACnBNkCIgIKAAD7BwAguAIAAOsEACAKCgAApQQAIKkCAACmBAAwqgIAABYAEKsCAACmBAAwrAICAAAAAbgCAQCbBAAh1QICAOkDACHWAgIA6QMAIdcCAgDpAwAh2QIAAKcE2QIiAwAAABYAIAEAABcAMAIAABgAIAkDAAD2AwAgDAAApQQAIKkCAACkBAAwqgIAABoAEKsCAACkBAAwrAICAOkDACGtAgIA6QMAIa8CQAD1AwAh1QICAOkDACECAwAA-AYAIAwAAPsHACAKAwAA9gMAIAwAAKUEACCpAgAApAQAMKoCAAAaABCrAgAApAQAMKwCAgAAAAGtAgIA6QMAIa8CQAD1AwAh1QICAOkDACHwAgAAowQAIAMAAAAaACABAAAbADACAAAcACABAAAAFgAgAQAAABoAIAEAAAAJACABAAAAEgAgDQMAAPYDACAEAAChBAAgEQAA6wMAIBUAAJ4EACAWAACgBAAgFwAA7AMAIBgAAKIEACCpAgAAnwQAMKoCAAAiABCrAgAAnwQAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIQcDAAD4BgAgBAAA-QcAIBEAAOgFACAVAAD3BwAgFgAA-AcAIBcAAOkFACAYAAD6BwAgDQMAAPYDACAEAAChBAAgEQAA6wMAIBUAAJ4EACAWAACgBAAgFwAA7AMAIBgAAKIEACCpAgAAnwQAMKoCAAAiABCrAgAAnwQAMKwCAgAAAAGtAgIA6QMAIbgCAQDqAwAhAwAAACIAIAEAACMAMAIAACQAIBADAAD2AwAgEAAAkgQAIBIAAJkEACAVAACeBAAgqQIAAJoEADCqAgAAJgAQqwIAAJoEADCsAgIA6QMAIa0CAgDpAwAhxgICAOkDACHOAgEAmwQAIc8CAgDpAwAh0AJAAPUDACHRAkAAnAQAIdICAgDpAwAh1AIAAJ0E1AIiBgMAAPgGACAQAAD0BwAgEgAA9gcAIBUAAPcHACDOAgAA6wQAINECAADrBAAgEAMAAPYDACAQAACSBAAgEgAAmQQAIBUAAJ4EACCpAgAAmgQAMKoCAAAmABCrAgAAmgQAMKwCAgAAAAGtAgIA6QMAIcYCAgDpAwAhzgIBAJsEACHPAgIA6QMAIdACQAD1AwAh0QJAAJwEACHSAgIA6QMAIdQCAACdBNQCIgMAAAAmACABAAAnADACAAAoACADAAAAJgAgAQAAJwAwAgAAKAAgCRAAAJIEACASAACZBAAgqQIAAJgEADCqAgAAKwAQqwIAAJgEADCsAgIA6QMAIcYCAgDpAwAhzwICAOkDACHaAgIA6QMAIQIQAAD0BwAgEgAA9gcAIAoQAACSBAAgEgAAmQQAIKkCAACYBAAwqgIAACsAEKsCAACYBAAwrAICAAAAAcYCAgDpAwAhzwICAOkDACHaAgIA6QMAIe8CAACXBAAgAwAAACsAIAEAACwAMAIAAC0AIAEAAAAmACABAAAAKwAgChAAAJIEACAUAACWBAAgqQIAAJQEADCqAgAAMQAQqwIAAJQEADCsAgIA6QMAIcYCAgDpAwAhxwJAAPUDACHMAgAAlQTMAiLNAgIA6QMAIQIQAAD0BwAgFAAA9QcAIAoQAACSBAAgFAAAlgQAIKkCAACUBAAwqgIAADEAEKsCAACUBAAwrAICAAAAAcYCAgDpAwAhxwJAAPUDACHMAgAAlQTMAiLNAgIA6QMAIQMAAAAxACABAAAyADACAAAzACABAAAAMQAgChAAAJIEACCpAgAAkwQAMKoCAAA2ABCrAgAAkwQAMKwCAgDpAwAhxgICAOkDACHHAkAA9QMAIcgCAgDpAwAhyQICAOkDACHKAgIA6QMAIQEQAAD0BwAgChAAAJIEACCpAgAAkwQAMKoCAAA2ABCrAgAAkwQAMKwCAgAAAAHGAgIA6QMAIccCQAD1AwAhyAICAOkDACHJAgIA6QMAIcoCAgDpAwAhAwAAADYAIAEAADcAMAIAADgAIAMAAAAxACABAAAyADACAAAzACABAAAABwAgAwAAACsAIAEAACwAMAIAAC0AIAgQAACSBAAgqQIAAJAEADCqAgAAPQAQqwIAAJAEADCsAgIA6QMAIcYCAgDpAwAh4QIAAJEE4QIi4gIBAOoDACEBEAAA9AcAIAoQAACSBAAgqQIAAJAEADCqAgAAPQAQqwIAAJAEADCsAgIAAAABxgICAOkDACHhAgAAkQThAiLiAgEA6gMAIe0CAACOBAAg7gIAAI8EACADAAAAPQAgAQAAPgAwAgAAPwAgAQAAACYAIAEAAAA2ACABAAAAMQAgAQAAACsAIAEAAAA9ACADAAAAJgAgAQAAJwAwAgAAKAAgAwAAABIAIAEAABMAMAIAABQAIAUDAAD4BgAgHwAA8wcAICAAAPQHACDGAgAA6wQAIOoCAADrBAAgAwAAAAcAIAEAAEgAMAIAAAEAIAMAAAAJACABAAAKADACAAALACADAAAADQAgAQAADgAwAgAADwAgAwAAABoAIAEAABsAMAIAABwAIAoDAAD2AwAgqQIAAPQDADCqAgAATQAQqwIAAPQDADCsAgIA6QMAIa0CAgDpAwAhwQJAAPUDACHCAkAA9QMAIeQCAQDqAwAh5QIBAOoDACEBAAAATQAgAQAAAAMAIAEAAAAiACABAAAAJgAgAQAAABIAIAEAAAAHACABAAAACQAgAQAAAA0AIAEAAAAaACABAAAAAwAgAQAAACIAIAEAAAABACADAAAABwAgAQAASAAwAgAAAQAgAwAAAAcAIAEAAEgAMAIAAAEAIAMAAAAHACABAABIADACAAABACAOAwAAngYAIB8AAJ8GACAgAADsBgAgrAICAAAAAa0CAgAAAAHBAkAAAAABwgJAAAAAAcYCAgAAAAHjAgEAAAAB5gIBAAAAAegCAAAA6AIC6QIgAAAAAeoCAgAAAAHsAgAAAOwCAgEmAABdACALrAICAAAAAa0CAgAAAAHBAkAAAAABwgJAAAAAAcYCAgAAAAHjAgEAAAAB5gIBAAAAAegCAAAA6AIC6QIgAAAAAeoCAgAAAAHsAgAAAOwCAgEmAABfADABJgAAXwAwAQAAAAMAIAEAAAAiACAOAwAAmwYAIB8AAJwGACAgAADrBgAgrAICAL0EACGtAgIAvQQAIcECQAC8BAAhwgJAALwEACHGAgIAnQYAIeMCAQDHBAAh5gIBAMcEACHoAgAAmAboAiLpAiAAmQYAIeoCAgCdBgAh7AIAAJoG7AIiAgAAAAEAICYAAGQAIAusAgIAvQQAIa0CAgC9BAAhwQJAALwEACHCAkAAvAQAIcYCAgCdBgAh4wIBAMcEACHmAgEAxwQAIegCAACYBugCIukCIACZBgAh6gICAJ0GACHsAgAAmgbsAiICAAAABwAgJgAAZgAgAgAAAAcAICYAAGYAIAEAAAADACABAAAAIgAgAwAAAAEAIC0AAF0AIC4AAGQAIAEAAAABACABAAAABwAgBwgAAO4HACAzAADvBwAgNAAA8gcAIDUAAPEHACA2AADwBwAgxgIAAOsEACDqAgAA6wQAIA6pAgAAgQQAMKoCAABvABCrAgAAgQQAMKwCAgDFAwAhrQICAMUDACHBAkAAxgMAIcICQADGAwAhxgICAIQEACHjAgEAzQMAIeYCAQDNAwAh6AIAAIIE6AIi6QIgAIMEACHqAgIAhAQAIewCAACFBOwCIgMAAAAHACABAABuADAyAABvACADAAAABwAgAQAASAAwAgAAAQAgDwkAAP0DACAPAAD5AwAgEQAA6wMAIBkAAPoDACAaAAD7AwAgGwAA_AMAIBwAAP4DACAdAAD_AwAgHgAAgAQAIKkCAAD4AwAwqgIAAHUAEKsCAAD4AwAwrAICAAAAAbgCAQDqAwAhwQJAAPUDACEBAAAAcgAgAQAAAHIAIA8JAAD9AwAgDwAA-QMAIBEAAOsDACAZAAD6AwAgGgAA-wMAIBsAAPwDACAcAAD-AwAgHQAA_wMAIB4AAIAEACCpAgAA-AMAMKoCAAB1ABCrAgAA-AMAMKwCAgDpAwAhuAIBAOoDACHBAkAA9QMAIQkJAADqBwAgDwAA5gcAIBEAAOgFACAZAADnBwAgGgAA6AcAIBsAAOkHACAcAADrBwAgHQAA7AcAIB4AAO0HACADAAAAdQAgAQAAdgAwAgAAcgAgAwAAAHUAIAEAAHYAMAIAAHIAIAMAAAB1ACABAAB2ADACAAByACAMCQAA4gcAIA8AAN0HACARAADfBwAgGQAA3gcAIBoAAOAHACAbAADhBwAgHAAA4wcAIB0AAOQHACAeAADlBwAgrAICAAAAAbgCAQAAAAHBAkAAAAABASYAAHoAIAOsAgIAAAABuAIBAAAAAcECQAAAAAEBJgAAfAAwASYAAHwAMAwJAACDBwAgDwAA_gYAIBEAAIAHACAZAAD_BgAgGgAAgQcAIBsAAIIHACAcAACEBwAgHQAAhQcAIB4AAIYHACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACECAAAAcgAgJgAAfwAgA6wCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQIAAAB1ACAmAACBAQAgAgAAAHUAICYAAIEBACADAAAAcgAgLQAAegAgLgAAfwAgAQAAAHIAIAEAAAB1ACAFCAAA-QYAIDMAAPoGACA0AAD9BgAgNQAA_AYAIDYAAPsGACAGqQIAAPcDADCqAgAAiAEAEKsCAAD3AwAwrAICAMUDACG4AgEAzQMAIcECQADGAwAhAwAAAHUAIAEAAIcBADAyAACIAQAgAwAAAHUAIAEAAHYAMAIAAHIAIAoDAAD2AwAgqQIAAPQDADCqAgAATQAQqwIAAPQDADCsAgIAAAABrQICAAAAAcECQAD1AwAhwgJAAPUDACHkAgEAAAAB5QIBAAAAAQEAAACLAQAgAQAAAIsBACABAwAA-AYAIAMAAABNACABAACOAQAwAgAAiwEAIAMAAABNACABAACOAQAwAgAAiwEAIAMAAABNACABAACOAQAwAgAAiwEAIAcDAAD3BgAgrAICAAAAAa0CAgAAAAHBAkAAAAABwgJAAAAAAeQCAQAAAAHlAgEAAAABASYAAJIBACAGrAICAAAAAa0CAgAAAAHBAkAAAAABwgJAAAAAAeQCAQAAAAHlAgEAAAABASYAAJQBADABJgAAlAEAMAcDAAD2BgAgrAICAL0EACGtAgIAvQQAIcECQAC8BAAhwgJAALwEACHkAgEAxwQAIeUCAQDHBAAhAgAAAIsBACAmAACXAQAgBqwCAgC9BAAhrQICAL0EACHBAkAAvAQAIcICQAC8BAAh5AIBAMcEACHlAgEAxwQAIQIAAABNACAmAACZAQAgAgAAAE0AICYAAJkBACADAAAAiwEAIC0AAJIBACAuAACXAQAgAQAAAIsBACABAAAATQAgBQgAAPEGACAzAADyBgAgNAAA9QYAIDUAAPQGACA2AADzBgAgCakCAADzAwAwqgIAAKABABCrAgAA8wMAMKwCAgDFAwAhrQICAMUDACHBAkAAxgMAIcICQADGAwAh5AIBAM0DACHlAgEAzQMAIQMAAABNACABAACfAQAwMgAAoAEAIAMAAABNACABAACOAQAwAgAAiwEAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgCAMAAO0GACAEAADuBgAgCQAA7wYAIA4AAPAGACCsAgIAAAABrQICAAAAAbgCAQAAAAHjAgEAAAABASYAAKgBACAErAICAAAAAa0CAgAAAAG4AgEAAAAB4wIBAAAAAQEmAACqAQAwASYAAKoBADAIAwAAygYAIAQAAMsGACAJAADMBgAgDgAAzQYAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIeMCAQDHBAAhAgAAAAUAICYAAK0BACAErAICAL0EACGtAgIAvQQAIbgCAQDHBAAh4wIBAMcEACECAAAAAwAgJgAArwEAIAIAAAADACAmAACvAQAgAwAAAAUAIC0AAKgBACAuAACtAQAgAQAAAAUAIAEAAAADACAFCAAAxQYAIDMAAMYGACA0AADJBgAgNQAAyAYAIDYAAMcGACAHqQIAAPIDADCqAgAAtgEAEKsCAADyAwAwrAICAMUDACGtAgIAxQMAIbgCAQDNAwAh4wIBAM0DACEDAAAAAwAgAQAAtQEAMDIAALYBACADAAAAAwAgAQAABAAwAgAABQAgAQAAACQAIAEAAAAkACADAAAAIgAgAQAAIwAwAgAAJAAgAwAAACIAIAEAACMAMAIAACQAIAMAAAAiACABAAAjADACAAAkACAKAwAAvgYAIAQAAMIGACARAAC_BgAgFQAAwQYAIBYAAMAGACAXAADDBgAgGAAAxAYAIKwCAgAAAAGtAgIAAAABuAIBAAAAAQEmAAC-AQAgA6wCAgAAAAGtAgIAAAABuAIBAAAAAQEmAADAAQAwASYAAMABADAKAwAA9wUAIAQAAPsFACARAAD4BQAgFQAA-gUAIBYAAPkFACAXAAD8BQAgGAAA_QUAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIQIAAAAkACAmAADDAQAgA6wCAgC9BAAhrQICAL0EACG4AgEAxwQAIQIAAAAiACAmAADFAQAgAgAAACIAICYAAMUBACADAAAAJAAgLQAAvgEAIC4AAMMBACABAAAAJAAgAQAAACIAIAUIAADyBQAgMwAA8wUAIDQAAPYFACA1AAD1BQAgNgAA9AUAIAapAgAA8QMAMKoCAADMAQAQqwIAAPEDADCsAgIAxQMAIa0CAgDFAwAhuAIBAM0DACEDAAAAIgAgAQAAywEAMDIAAMwBACADAAAAIgAgAQAAIwAwAgAAJAAgAQAAAD8AIAEAAAA_ACADAAAAPQAgAQAAPgAwAgAAPwAgAwAAAD0AIAEAAD4AMAIAAD8AIAMAAAA9ACABAAA-ADACAAA_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_AgAQqwIAANEDADCsAgIAxQMAIcYCAgDFAwAhxwJAAMYDACHMAgAA0gPMAiLNAgIAxQMAIQMAAAAxACABAAD-AgAwMgAA_wIAIAMAAAAxACABAAAyADACAAAzACABAAAAOAAgAQAAADgAIAMAAAA2ACABAAA3ADACAAA4ACADAAAANgAgAQAANwAwAgAAOAAgAwAAADYAIAEAADcAMAIAADgAIAcQAADgBAAgrAICAAAAAcYCAgAAAAHHAkAAAAAByAICAAAAAckCAgAAAAHKAgIAAAABASYAAIcDACAGrAICAAAAAcYCAgAAAAHHAkAAAAAByAICAAAAAckCAgAAAAHKAgIAAAABASYAAIkDADABJgAAiQMAMAcQAADfBAAgrAICAL0EACHGAgIAvQQAIccCQAC8BAAhyAICAL0EACHJAgIAvQQAIcoCAgC9BAAhAgAAADgAICYAAIwDACAGrAICAL0EACHGAgIAvQQAIccCQAC8BAAhyAICAL0EACHJAgIAvQQAIcoCAgC9BAAhAgAAADYAICYAAI4DACACAAAANgAgJgAAjgMAIAMAAAA4ACAtAACHAwAgLgAAjAMAIAEAAAA4ACABAAAANgAgBQgAANoEACAzAADbBAAgNAAA3gQAIDUAAN0EACA2AADcBAAgCakCAADQAwAwqgIAAJUDABCrAgAA0AMAMKwCAgDFAwAhxgICAMUDACHHAkAAxgMAIcgCAgDFAwAhyQICAMUDACHKAgIAxQMAIQMAAAA2ACABAACUAwAwMgAAlQMAIAMAAAA2ACABAAA3ADACAAA4ACABAAAACwAgAQAAAAsAIAMAAAAJACABAAAKADACAAALACADAAAACQAgAQAACgAwAgAACwAgAwAAAAkAIAEAAAoAMAIAAAsAIBADAADXBAAgBQAA2AQAIAcAANkEACCsAgIAAAABrQICAAAAAbgCAQAAAAG5AgIAAAABugICAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAb4CAgAAAAG_AgIAAAABwAICAAAAAcECQAAAAAHCAkAAAAABASYAAJ0DACANrAICAAAAAa0CAgAAAAG4AgEAAAABuQICAAAAAboCAgAAAAG7AgIAAAABvAICAAAAAb0CAgAAAAG-AgIAAAABvwICAAAAAcACAgAAAAHBAkAAAAABwgJAAAAAAQEmAACfAwAwASYAAJ8DADAQAwAAyAQAIAUAAMkEACAHAADKBAAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAhuQICAL0EACG6AgIAvQQAIbsCAgC9BAAhvAICAL0EACG9AgIAvQQAIb4CAgC9BAAhvwICAL0EACHAAgIAvQQAIcECQAC8BAAhwgJAALwEACECAAAACwAgJgAAogMAIA2sAgIAvQQAIa0CAgC9BAAhuAIBAMcEACG5AgIAvQQAIboCAgC9BAAhuwICAL0EACG8AgIAvQQAIb0CAgC9BAAhvgICAL0EACG_AgIAvQQAIcACAgC9BAAhwQJAALwEACHCAkAAvAQAIQIAAAAJACAmAACkAwAgAgAAAAkAICYAAKQDACADAAAACwAgLQAAnQMAIC4AAKIDACABAAAACwAgAQAAAAkAIAUIAADCBAAgMwAAwwQAIDQAAMYEACA1AADFBAAgNgAAxAQAIBCpAgAAzAMAMKoCAACrAwAQqwIAAMwDADCsAgIAxQMAIa0CAgDFAwAhuAIBAM0DACG5AgIAxQMAIboCAgDFAwAhuwICAMUDACG8AgIAxQMAIb0CAgDFAwAhvgICAMUDACG_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_AMAIBwAAP4DACAdAAD_AwAgHgAAgAQAIKkCAAD4AwAwqgIAAHUAEKsCAAD4AwAwrAICAOkDACG4AgEA6gMAIcECQAD1AwAh8QIAAHUAIPICAAB1ACAGqQIAAPcDADCqAgAAiAEAEKsCAAD3AwAwrAICAMUDACG4AgEAzQMAIcECQADGAwAhDwkAAP0DACAPAAD5AwAgEQAA6wMAIBkAAPoDACAaAAD7AwAgGwAA_AMAIBwAAP4DACAdAAD_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_wMAIKkCAACoBAAwqgIAABIAEKsCAACoBAAwrAICAOkDACGtAgIA6QMAIbgCAQDqAwAhwAICAOkDACENAwAA9gMAIAQAAKEEACAJAAD9AwAgDgAA-wMAIKkCAAC2BAAwqgIAAAMAEKsCAAC2BAAwrAICAOkDACGtAgIA6QMAIbgCAQDqAwAh4wIBAOoDACHxAgAAAwAg8gIAAAMAIAPdAgAAFgAg3gIAABYAIN8CAAAWACACrQICAAAAAa8CQAAAAAEJAwAA9gMAIAYAAK0EACCpAgAArAQAMKoCAAANABCrAgAArAQAMKwCAgDpAwAhrQICAOkDACGuAgIA6QMAIa8CQAD1AwAhFQMAAPYDACAFAACpBAAgBwAA_gMAIKkCAACuBAAwqgIAAAkAEKsCAACuBAAwrAICAOkDACGtAgIA6QMAIbgCAQDqAwAhuQICAOkDACG6AgIA6QMAIbsCAgDpAwAhvAICAOkDACG9AgIA6QMAIb4CAgDpAwAhvwICAOkDACHAAgIA6QMAIcECQAD1AwAhwgJAAPUDACHxAgAACQAg8gIAAAkAIBMDAAD2AwAgBQAAqQQAIAcAAP4DACCpAgAArgQAMKoCAAAJABCrAgAArgQAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIbkCAgDpAwAhugICAOkDACG7AgIA6QMAIbwCAgDpAwAhvQICAOkDACG-AgIA6QMAIb8CAgDpAwAhwAICAOkDACHBAkAA9QMAIcICQAD1AwAhEQMAAPYDACAfAAC0BAAgIAAAtQQAIKkCAACvBAAwqgIAAAcAEKsCAACvBAAwrAICAOkDACGtAgIA6QMAIcECQAD1AwAhwgJAAPUDACHGAgIAsgQAIeMCAQDqAwAh5gIBAOoDACHoAgAAsAToAiLpAiAAsQQAIeoCAgCyBAAh7AIAALME7AIiBLACAAAA6AICsQIAAADoAgiyAgAAAOgCCLcCAACNBOgCIgKwAiAAAAABtwIgAIsEACEIsAICAAAAAbECAgAAAAWyAgIAAAAFswICAAAAAbQCAgAAAAG1AgIAAAABtgICAAAAAbcCAgDcAwAhBLACAAAA7AICsQIAAADsAgiyAgAAAOwCCLcCAACHBOwCIg0DAAD2AwAgBAAAoQQAIAkAAP0DACAOAAD7AwAgqQIAALYEADCqAgAAAwAQqwIAALYEADCsAgIA6QMAIa0CAgDpAwAhuAIBAOoDACHjAgEA6gMAIfECAAADACDyAgAAAwAgDwMAAPYDACAEAAChBAAgEQAA6wMAIBUAAJ4EACAWAACgBAAgFwAA7AMAIBgAAKIEACCpAgAAnwQAMKoCAAAiABCrAgAAnwQAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIfECAAAiACDyAgAAIgAgCwMAAPYDACAEAAChBAAgCQAA_QMAIA4AAPsDACCpAgAAtgQAMKoCAAADABCrAgAAtgQAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIeMCAQDqAwAhAAAAAAAB9gJAAAAAAQX2AgIAAAAB_AICAAAAAf0CAgAAAAH-AgIAAAAB_wICAAAAAQUtAACDCQAgLgAAiQkAIPMCAACECQAg9AIAAIgJACD5AgAAcgAgBS0AAIEJACAuAACGCQAg8wIAAIIJACD0AgAAhQkAIPkCAAALACADLQAAgwkAIPMCAACECQAg-QIAAHIAIAMtAACBCQAg8wIAAIIJACD5AgAACwAgAAAAAAAB9gIBAAAAAQUtAAD4CAAgLgAA_wgAIPMCAAD5CAAg9AIAAP4IACD5AgAAcgAgBS0AAPYIACAuAAD8CAAg8wIAAPcIACD0AgAA-wgAIPkCAAAFACALLQAAywQAMC4AANAEADDzAgAAzAQAMPQCAADNBAAw9QIAAM4EACD2AgAAzwQAMPcCAADPBAAw-AIAAM8EADD5AgAAzwQAMPoCAADRBAAw-wIAANIEADAEAwAAwAQAIKwCAgAAAAGtAgIAAAABrwJAAAAAAQIAAAAPACAtAADWBAAgAwAAAA8AIC0AANYEACAuAADVBAAgASYAAPoIADAKAwAA9gMAIAYAAK0EACCpAgAArAQAMKoCAAANABCrAgAArAQAMKwCAgAAAAGtAgIA6QMAIa4CAgDpAwAhrwJAAPUDACHwAgAAqwQAIAIAAAAPACAmAADVBAAgAgAAANMEACAmAADUBAAgB6kCAADSBAAwqgIAANMEABCrAgAA0gQAMKwCAgDpAwAhrQICAOkDACGuAgIA6QMAIa8CQAD1AwAhB6kCAADSBAAwqgIAANMEABCrAgAA0gQAMKwCAgDpAwAhrQICAOkDACGuAgIA6QMAIa8CQAD1AwAhA6wCAgC9BAAhrQICAL0EACGvAkAAvAQAIQQDAAC-BAAgrAICAL0EACGtAgIAvQQAIa8CQAC8BAAhBAMAAMAEACCsAgIAAAABrQICAAAAAa8CQAAAAAEDLQAA-AgAIPMCAAD5CAAg-QIAAHIAIAMtAAD2CAAg8wIAAPcIACD5AgAABQAgBC0AAMsEADDzAgAAzAQAMPUCAADOBAAg-QIAAM8EADAAAAAAAAUtAADxCAAgLgAA9AgAIPMCAADyCAAg9AIAAPMIACD5AgAAJAAgAy0AAPEIACDzAgAA8ggAIPkCAAAkACAAAAAAAAH2AgAAAMwCAgUtAADpCAAgLgAA7wgAIPMCAADqCAAg9AIAAO4IACD5AgAAKAAgBS0AAOcIACAuAADsCAAg8wIAAOgIACD0AgAA6wgAIPkCAAAkACADLQAA6QgAIPMCAADqCAAg-QIAACgAIAMtAADnCAAg8wIAAOgIACD5AgAAJAAgAAAAAAAAAfYCAQAAAAEB9gJAAAAAAQH2AgAAANQCAgUtAADbCAAgLgAA5QgAIPMCAADcCAAg9AIAAOQIACD5AgAAJAAgBS0AANkIACAuAADiCAAg8wIAANoIACD0AgAA4QgAIPkCAADlAQAgBS0AANcIACAuAADfCAAg8wIAANgIACD0AgAA3ggAIPkCAAByACALLQAA-AQAMC4AAP0EADDzAgAA-QQAMPQCAAD6BAAw9QIAAPsEACD2AgAA_AQAMPcCAAD8BAAw-AIAAPwEADD5AgAA_AQAMPoCAAD-BAAw-wIAAP8EADAFEAAA6gQAIKwCAgAAAAHGAgIAAAABxwJAAAAAAcwCAAAAzAICAgAAADMAIC0AAIMFACADAAAAMwAgLQAAgwUAIC4AAIIFACABJgAA3QgAMAoQAACSBAAgFAAAlgQAIKkCAACUBAAwqgIAADEAEKsCAACUBAAwrAICAAAAAcYCAgDpAwAhxwJAAPUDACHMAgAAlQTMAiLNAgIA6QMAIQIAAAAzACAmAACCBQAgAgAAAIAFACAmAACBBQAgCKkCAAD_BAAwqgIAAIAFABCrAgAA_wQAMKwCAgDpAwAhxgICAOkDACHHAkAA9QMAIcwCAACVBMwCIs0CAgDpAwAhCKkCAAD_BAAwqgIAAIAFABCrAgAA_wQAMKwCAgDpAwAhxgICAOkDACHHAkAA9QMAIcwCAACVBMwCIs0CAgDpAwAhBKwCAgC9BAAhxgICAL0EACHHAkAAvAQAIcwCAADmBMwCIgUQAADoBAAgrAICAL0EACHGAgIAvQQAIccCQAC8BAAhzAIAAOYEzAIiBRAAAOoEACCsAgIAAAABxgICAAAAAccCQAAAAAHMAgAAAMwCAgMtAADbCAAg8wIAANwIACD5AgAAJAAgAy0AANkIACDzAgAA2ggAIPkCAADlAQAgAy0AANcIACDzAgAA2AgAIPkCAAByACAELQAA-AQAMPMCAAD5BAAw9QIAAPsEACD5AgAA_AQAMAAAAAAABS0AAM8IACAuAADVCAAg8wIAANAIACD0AgAA1AgAIPkCAAByACAFLQAAzQgAIC4AANIIACDzAgAAzggAIPQCAADRCAAg-QIAABQAIAMtAADPCAAg8wIAANAIACD5AgAAcgAgAy0AAM0IACDzAgAAzggAIPkCAAAUACAAAAAAAAH2AgAAANkCAgUtAADICAAgLgAAywgAIPMCAADJCAAg9AIAAMoIACD5AgAAFAAgAy0AAMgIACDzAgAAyQgAIPkCAAAUACAAAAAAAAUtAAC-CAAgLgAAxggAIPMCAAC_CAAg9AIAAMUIACD5AgAAcgAgBS0AALwIACAuAADDCAAg8wIAAL0IACD0AgAAwggAIPkCAAAFACALLQAArgUAMC4AALMFADDzAgAArwUAMPQCAACwBQAw9QIAALEFACD2AgAAsgUAMPcCAACyBQAw-AIAALIFADD5AgAAsgUAMPoCAAC0BQAw-wIAALUFADALLQAAogUAMC4AAKcFADDzAgAAowUAMPQCAACkBQAw9QIAAKUFACD2AgAApgUAMPcCAACmBQAw-AIAAKYFADD5AgAApgUAMPoCAACoBQAw-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_AQAMPgCAAD8BAAw-QIAAPwEADD6AgAApQYAMPsCAAD_BAAwBy0AAJMGACAuAACWBgAg8wIAAJQGACD0AgAAlQYAIPcCAAAHACD4AgAABwAg-QIAAAEAIAstAACKBgAwLgAAjgYAMPMCAACLBgAw9AIAAIwGADD1AgAAjQYAIPYCAADSBQAw9wIAANIFADD4AgAA0gUAMPkCAADSBQAw-gIAAI8GADD7AgAA1QUAMAstAAD-BQAwLgAAgwYAMPMCAAD_BQAw9AIAAIAGADD1AgAAgQYAIPYCAACCBgAw9wIAAIIGADD4AgAAggYAMPkCAACCBgAw-gIAAIQGADD7AgAAhQYAMAOsAgIAAAAB4QIAAADhAgLiAgEAAAABAgAAAD8AIC0AAIkGACADAAAAPwAgLQAAiQYAIC4AAIgGACABJgAApwgAMAoQAACSBAAgqQIAAJAEADCqAgAAPQAQqwIAAJAEADCsAgIAAAABxgICAOkDACHhAgAAkQThAiLiAgEA6gMAIe0CAACOBAAg7gIAAI8EACACAAAAPwAgJgAAiAYAIAIAAACGBgAgJgAAhwYAIAepAgAAhQYAMKoCAACGBgAQqwIAAIUGADCsAgIA6QMAIcYCAgDpAwAh4QIAAJEE4QIi4gIBAOoDACEHqQIAAIUGADCqAgAAhgYAEKsCAACFBgAwrAICAOkDACHGAgIA6QMAIeECAACRBOECIuICAQDqAwAhA6wCAgC9BAAh4QIAAO8F4QIi4gIBAMcEACEDrAICAL0EACHhAgAA7wXhAiLiAgEAxwQAIQOsAgIAAAAB4QIAAADhAgLiAgEAAAABBBIAAMYFACCsAgIAAAABzwICAAAAAdoCAgAAAAECAAAALQAgLQAAkgYAIAMAAAAtACAtAACSBgAgLgAAkQYAIAEmAACmCAAwAgAAAC0AICYAAJEGACACAAAA1gUAICYAAJAGACADrAICAL0EACHPAgIAvQQAIdoCAgC9BAAhBBIAAMQFACCsAgIAvQQAIc8CAgC9BAAh2gICAL0EACEEEgAAxgUAIKwCAgAAAAHPAgIAAAAB2gICAAAAAQwDAACeBgAgHwAAnwYAIKwCAgAAAAGtAgIAAAABwQJAAAAAAcICQAAAAAHjAgEAAAAB5gIBAAAAAegCAAAA6AIC6QIgAAAAAeoCAgAAAAHsAgAAAOwCAgIAAAABACAtAACTBgAgAwAAAAcAIC0AAJMGACAuAACXBgAgDgAAAAcAIAMAAJsGACAfAACcBgAgJgAAlwYAIKwCAgC9BAAhrQICAL0EACHBAkAAvAQAIcICQAC8BAAh4wIBAMcEACHmAgEAxwQAIegCAACYBugCIukCIACZBgAh6gICAJ0GACHsAgAAmgbsAiIMAwAAmwYAIB8AAJwGACCsAgIAvQQAIa0CAgC9BAAhwQJAALwEACHCAkAAvAQAIeMCAQDHBAAh5gIBAMcEACHoAgAAmAboAiLpAiAAmQYAIeoCAgCdBgAh7AIAAJoG7AIiAfYCAAAA6AICAfYCIAAAAAEB9gIAAADsAgIFLQAAnggAIC4AAKQIACDzAgAAnwgAIPQCAACjCAAg-QIAAHIAIActAACcCAAgLgAAoQgAIPMCAACdCAAg9AIAAKAIACD3AgAAAwAg-AIAAAMAIPkCAAAFACAF9gICAAAAAfwCAgAAAAH9AgIAAAAB_gICAAAAAf8CAgAAAAEDLQAAnggAIPMCAACfCAAg-QIAAHIAIAMtAACcCAAg8wIAAJ0IACD5AgAABQAgBRQAAOkEACCsAgIAAAABxwJAAAAAAcwCAAAAzAICzQICAAAAAQIAAAAzACAtAACoBgAgAwAAADMAIC0AAKgGACAuAACnBgAgASYAAJsIADACAAAAMwAgJgAApwYAIAIAAACABQAgJgAApgYAIASsAgIAvQQAIccCQAC8BAAhzAIAAOYEzAIizQICAL0EACEFFAAA5wQAIKwCAgC9BAAhxwJAALwEACHMAgAA5gTMAiLNAgIAvQQAIQUUAADpBAAgrAICAAAAAccCQAAAAAHMAgAAAMwCAs0CAgAAAAEFrAICAAAAAccCQAAAAAHIAgIAAAAByQICAAAAAcoCAgAAAAECAAAAOAAgLQAAtAYAIAMAAAA4ACAtAAC0BgAgLgAAswYAIAEmAACaCAAwChAAAJIEACCpAgAAkwQAMKoCAAA2ABCrAgAAkwQAMKwCAgAAAAHGAgIA6QMAIccCQAD1AwAhyAICAOkDACHJAgIA6QMAIcoCAgDpAwAhAgAAADgAICYAALMGACACAAAAsQYAICYAALIGACAJqQIAALAGADCqAgAAsQYAEKsCAACwBgAwrAICAOkDACHGAgIA6QMAIccCQAD1AwAhyAICAOkDACHJAgIA6QMAIcoCAgDpAwAhCakCAACwBgAwqgIAALEGABCrAgAAsAYAMKwCAgDpAwAhxgICAOkDACHHAkAA9QMAIcgCAgDpAwAhyQICAOkDACHKAgIA6QMAIQWsAgIAvQQAIccCQAC8BAAhyAICAL0EACHJAgIAvQQAIcoCAgC9BAAhBawCAgC9BAAhxwJAALwEACHIAgIAvQQAIckCAgC9BAAhygICAL0EACEFrAICAAAAAccCQAAAAAHIAgIAAAAByQICAAAAAcoCAgAAAAELAwAAhgUAIBIAAIUFACAVAACHBQAgrAICAAAAAa0CAgAAAAHOAgEAAAABzwICAAAAAdACQAAAAAHRAkAAAAAB0gICAAAAAdQCAAAA1AICAgAAACgAIC0AAL0GACADAAAAKAAgLQAAvQYAIC4AALwGACABJgAAmQgAMAIAAAAoACAmAAC8BgAgAgAAAOIFACAmAAC7BgAgCKwCAgC9BAAhrQICAL0EACHOAgEA8QQAIc8CAgC9BAAh0AJAALwEACHRAkAA8gQAIdICAgC9BAAh1AIAAPME1AIiCwMAAPYEACASAAD1BAAgFQAA9wQAIKwCAgC9BAAhrQICAL0EACHOAgEA8QQAIc8CAgC9BAAh0AJAALwEACHRAkAA8gQAIdICAgC9BAAh1AIAAPME1AIiCwMAAIYFACASAACFBQAgFQAAhwUAIKwCAgAAAAGtAgIAAAABzgIBAAAAAc8CAgAAAAHQAkAAAAAB0QJAAAAAAdICAgAAAAHUAgAAANQCAgMtAACXCAAg8wIAAJgIACD5AgAAcgAgBC0AALUGADDzAgAAtgYAMPUCAAC4BgAg-QIAAN4FADAELQAAqQYAMPMCAACqBgAw9QIAAKwGACD5AgAArQYAMAQtAACgBgAw8wIAAKEGADD1AgAAowYAIPkCAAD8BAAwAy0AAJMGACDzAgAAlAYAIPkCAAABACAELQAAigYAMPMCAACLBgAw9QIAAI0GACD5AgAA0gUAMAQtAAD-BQAw8wIAAP8FADD1AgAAgQYAIPkCAACCBgAwAAAAAAAFLQAAiwgAIC4AAJUIACDzAgAAjAgAIPQCAACUCAAg-QIAAHIAIActAADmBgAgLgAA6QYAIPMCAADnBgAg9AIAAOgGACD3AgAABwAg-AIAAAcAIPkCAAABACALLQAA2gYAMC4AAN8GADDzAgAA2wYAMPQCAADcBgAw9QIAAN0GACD2AgAA3gYAMPcCAADeBgAw-AIAAN4GADD5AgAA3gYAMPoCAADgBgAw-wIAAOEGADALLQAAzgYAMC4AANMGADDzAgAAzwYAMPQCAADQBgAw9QIAANEGACD2AgAA0gYAMPcCAADSBgAw-AIAANIGADD5AgAA0gYAMPoCAADUBgAw-wIAANUGADAGAwAAugUAIAsAALwFACANAAC9BQAgrAICAAAAAa0CAgAAAAG4AgEAAAABAgAAABQAIC0AANkGACADAAAAFAAgLQAA2QYAIC4AANgGACABJgAAkwgAMAsDAAD2AwAgBQAAqQQAIAsAAKoEACANAAD_AwAgqQIAAKgEADCqAgAAEgAQqwIAAKgEADCsAgIAAAABrQICAOkDACG4AgEA6gMAIcACAgDpAwAhAgAAABQAICYAANgGACACAAAA1gYAICYAANcGACAHqQIAANUGADCqAgAA1gYAEKsCAADVBgAwrAICAOkDACGtAgIA6QMAIbgCAQDqAwAhwAICAOkDACEHqQIAANUGADCqAgAA1gYAEKsCAADVBgAwrAICAOkDACGtAgIA6QMAIbgCAQDqAwAhwAICAOkDACEDrAICAL0EACGtAgIAvQQAIbgCAQDHBAAhBgMAAJ4FACALAACgBQAgDQAAoQUAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIQYDAAC6BQAgCwAAvAUAIA0AAL0FACCsAgIAAAABrQICAAAAAbgCAQAAAAEOAwAA1wQAIAcAANkEACCsAgIAAAABrQICAAAAAbgCAQAAAAG5AgIAAAABugICAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAb4CAgAAAAG_AgIAAAABwQJAAAAAAcICQAAAAAECAAAACwAgLQAA5QYAIAMAAAALACAtAADlBgAgLgAA5AYAIAEmAACSCAAwEwMAAPYDACAFAACpBAAgBwAA_gMAIKkCAACuBAAwqgIAAAkAEKsCAACuBAAwrAICAAAAAa0CAgDpAwAhuAIBAOoDACG5AgIA6QMAIboCAgDpAwAhuwICAOkDACG8AgIA6QMAIb0CAgDpAwAhvgICAOkDACG_AgIA6QMAIcACAgDpAwAhwQJAAPUDACHCAkAA9QMAIQIAAAALACAmAADkBgAgAgAAAOIGACAmAADjBgAgEKkCAADhBgAwqgIAAOIGABCrAgAA4QYAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIbkCAgDpAwAhugICAOkDACG7AgIA6QMAIbwCAgDpAwAhvQICAOkDACG-AgIA6QMAIb8CAgDpAwAhwAICAOkDACHBAkAA9QMAIcICQAD1AwAhEKkCAADhBgAwqgIAAOIGABCrAgAA4QYAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIbkCAgDpAwAhugICAOkDACG7AgIA6QMAIbwCAgDpAwAhvQICAOkDACG-AgIA6QMAIb8CAgDpAwAhwAICAOkDACHBAkAA9QMAIcICQAD1AwAhDKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIbkCAgC9BAAhugICAL0EACG7AgIAvQQAIbwCAgC9BAAhvQICAL0EACG-AgIAvQQAIb8CAgC9BAAhwQJAALwEACHCAkAAvAQAIQ4DAADIBAAgBwAAygQAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIbkCAgC9BAAhugICAL0EACG7AgIAvQQAIbwCAgC9BAAhvQICAL0EACG-AgIAvQQAIb8CAgC9BAAhwQJAALwEACHCAkAAvAQAIQ4DAADXBAAgBwAA2QQAIKwCAgAAAAGtAgIAAAABuAIBAAAAAbkCAgAAAAG6AgIAAAABuwICAAAAAbwCAgAAAAG9AgIAAAABvgICAAAAAb8CAgAAAAHBAkAAAAABwgJAAAAAAQwDAACeBgAgIAAA7AYAIKwCAgAAAAGtAgIAAAABwQJAAAAAAcICQAAAAAHGAgIAAAAB4wIBAAAAAeYCAQAAAAHoAgAAAOgCAukCIAAAAAHsAgAAAOwCAgIAAAABACAtAADmBgAgAwAAAAcAIC0AAOYGACAuAADqBgAgDgAAAAcAIAMAAJsGACAgAADrBgAgJgAA6gYAIKwCAgC9BAAhrQICAL0EACHBAkAAvAQAIcICQAC8BAAhxgICAJ0GACHjAgEAxwQAIeYCAQDHBAAh6AIAAJgG6AIi6QIgAJkGACHsAgAAmgbsAiIMAwAAmwYAICAAAOsGACCsAgIAvQQAIa0CAgC9BAAhwQJAALwEACHCAkAAvAQAIcYCAgCdBgAh4wIBAMcEACHmAgEAxwQAIegCAACYBugCIukCIACZBgAh7AIAAJoG7AIiBy0AAI0IACAuAACQCAAg8wIAAI4IACD0AgAAjwgAIPcCAAAiACD4AgAAIgAg-QIAACQAIAMtAACNCAAg8wIAAI4IACD5AgAAJAAgAy0AAIsIACDzAgAAjAgAIPkCAAByACADLQAA5gYAIPMCAADnBgAg-QIAAAEAIAQtAADaBgAw8wIAANsGADD1AgAA3QYAIPkCAADeBgAwBC0AAM4GADDzAgAAzwYAMPUCAADRBgAg-QIAANIGADAAAAAAAAUtAACGCAAgLgAAiQgAIPMCAACHCAAg9AIAAIgIACD5AgAAcgAgAy0AAIYIACDzAgAAhwgAIPkCAAByACAJCQAA6gcAIA8AAOYHACARAADoBQAgGQAA5wcAIBoAAOgHACAbAADpBwAgHAAA6wcAIB0AAOwHACAeAADtBwAgAAAAAAALLQAA0QcAMC4AANYHADDzAgAA0gcAMPQCAADTBwAw9QIAANQHACD2AgAA1QcAMPcCAADVBwAw-AIAANUHADD5AgAA1QcAMPoCAADXBwAw-wIAANgHADALLQAAxQcAMC4AAMoHADDzAgAAxgcAMPQCAADHBwAw9QIAAMgHACD2AgAAyQcAMPcCAADJBwAw-AIAAMkHADD5AgAAyQcAMPoCAADLBwAw-wIAAMwHADALLQAAvAcAMC4AAMAHADDzAgAAvQcAMPQCAAC-BwAw9QIAAL8HACD2AgAA3gUAMPcCAADeBQAw-AIAAN4FADD5AgAA3gUAMPoCAADBBwAw-wIAAOEFADALLQAAswcAMC4AALcHADDzAgAAtAcAMPQCAAC1BwAw9QIAALYHACD2AgAA0gYAMPcCAADSBgAw-AIAANIGADD5AgAA0gYAMPoCAAC4BwAw-wIAANUGADALLQAApwcAMC4AAKwHADDzAgAAqAcAMPQCAACpBwAw9QIAAKoHACD2AgAAqwcAMPcCAACrBwAw-AIAAKsHADD5AgAAqwcAMPoCAACtBwAw-wIAAK4HADALLQAAngcAMC4AAKIHADDzAgAAnwcAMPQCAACgBwAw9QIAAKEHACD2AgAA3gYAMPcCAADeBgAw-AIAAN4GADD5AgAA3gYAMPoCAACjBwAw-wIAAOEGADALLQAAlQcAMC4AAJkHADDzAgAAlgcAMPQCAACXBwAw9QIAAJgHACD2AgAAzwQAMPcCAADPBAAw-AIAAM8EADD5AgAAzwQAMPoCAACaBwAw-wIAANIEADALLQAAjAcAMC4AAJAHADDzAgAAjQcAMPQCAACOBwAw9QIAAI8HACD2AgAApgUAMPcCAACmBQAw-AIAAKYFADD5AgAApgUAMPoCAACRBwAw-wIAAKkFADAHLQAAhwcAIC4AAIoHACDzAgAAiAcAIPQCAACJBwAg9wIAAE0AIPgCAABNACD5AgAAiwEAIAWsAgIAAAABwQJAAAAAAcICQAAAAAHkAgEAAAAB5QIBAAAAAQIAAACLAQAgLQAAhwcAIAMAAABNACAtAACHBwAgLgAAiwcAIAcAAABNACAmAACLBwAgrAICAL0EACHBAkAAvAQAIcICQAC8BAAh5AIBAMcEACHlAgEAxwQAIQWsAgIAvQQAIcECQAC8BAAhwgJAALwEACHkAgEAxwQAIeUCAQDHBAAhBAwAAJAFACCsAgIAAAABrwJAAAAAAdUCAgAAAAECAAAAHAAgLQAAlAcAIAMAAAAcACAtAACUBwAgLgAAkwcAIAEmAACFCAAwAgAAABwAICYAAJMHACACAAAAqgUAICYAAJIHACADrAICAL0EACGvAkAAvAQAIdUCAgC9BAAhBAwAAI4FACCsAgIAvQQAIa8CQAC8BAAh1QICAL0EACEEDAAAkAUAIKwCAgAAAAGvAkAAAAAB1QICAAAAAQQGAADBBAAgrAICAAAAAa4CAgAAAAGvAkAAAAABAgAAAA8AIC0AAJ0HACADAAAADwAgLQAAnQcAIC4AAJwHACABJgAAhAgAMAIAAAAPACAmAACcBwAgAgAAANMEACAmAACbBwAgA6wCAgC9BAAhrgICAL0EACGvAkAAvAQAIQQGAAC_BAAgrAICAL0EACGuAgIAvQQAIa8CQAC8BAAhBAYAAMEEACCsAgIAAAABrgICAAAAAa8CQAAAAAEOBQAA2AQAIAcAANkEACCsAgIAAAABuAIBAAAAAbkCAgAAAAG6AgIAAAABuwICAAAAAbwCAgAAAAG9AgIAAAABvgICAAAAAb8CAgAAAAHAAgIAAAABwQJAAAAAAcICQAAAAAECAAAACwAgLQAApgcAIAMAAAALACAtAACmBwAgLgAApQcAIAEmAACDCAAwAgAAAAsAICYAAKUHACACAAAA4gYAICYAAKQHACAMrAICAL0EACG4AgEAxwQAIbkCAgC9BAAhugICAL0EACG7AgIAvQQAIbwCAgC9BAAhvQICAL0EACG-AgIAvQQAIb8CAgC9BAAhwAICAL0EACHBAkAAvAQAIcICQAC8BAAhDgUAAMkEACAHAADKBAAgrAICAL0EACG4AgEAxwQAIbkCAgC9BAAhugICAL0EACG7AgIAvQQAIbwCAgC9BAAhvQICAL0EACG-AgIAvQQAIb8CAgC9BAAhwAICAL0EACHBAkAAvAQAIcICQAC8BAAhDgUAANgEACAHAADZBAAgrAICAAAAAbgCAQAAAAG5AgIAAAABugICAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAb4CAgAAAAG_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-wUAIBEAAPgFACAVAAD6BQAgFgAA-QUAIBcAAPwFACAYAAD9BQAgrAICAL0EACG4AgEAxwQAIQgEAADCBgAgEQAAvwYAIBUAAMEGACAWAADABgAgFwAAwwYAIBgAAMQGACCsAgIAAAABuAIBAAAAAQYEAADuBgAgCQAA7wYAIA4AAPAGACCsAgIAAAABuAIBAAAAAeMCAQAAAAECAAAABQAgLQAA3AcAIAMAAAAFACAtAADcBwAgLgAA2wcAIAEmAAD-BwAwCwMAAPYDACAEAAChBAAgCQAA_QMAIA4AAPsDACCpAgAAtgQAMKoCAAADABCrAgAAtgQAMKwCAgAAAAGtAgIA6QMAIbgCAQDqAwAh4wIBAAAAAQIAAAAFACAmAADbBwAgAgAAANkHACAmAADaBwAgB6kCAADYBwAwqgIAANkHABCrAgAA2AcAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIeMCAQDqAwAhB6kCAADYBwAwqgIAANkHABCrAgAA2AcAMKwCAgDpAwAhrQICAOkDACG4AgEA6gMAIeMCAQDqAwAhA6wCAgC9BAAhuAIBAMcEACHjAgEAxwQAIQYEAADLBgAgCQAAzAYAIA4AAM0GACCsAgIAvQQAIbgCAQDHBAAh4wIBAMcEACEGBAAA7gYAIAkAAO8GACAOAADwBgAgrAICAAAAAbgCAQAAAAHjAgEAAAABBC0AANEHADDzAgAA0gcAMPUCAADUBwAg-QIAANUHADAELQAAxQcAMPMCAADGBwAw9QIAAMgHACD5AgAAyQcAMAQtAAC8BwAw8wIAAL0HADD1AgAAvwcAIPkCAADeBQAwBC0AALMHADDzAgAAtAcAMPUCAAC2BwAg-QIAANIGADAELQAApwcAMPMCAACoBwAw9QIAAKoHACD5AgAAqwcAMAQtAACeBwAw8wIAAJ8HADD1AgAAoQcAIPkCAADeBgAwBC0AAJUHADDzAgAAlgcAMPUCAACYBwAg-QIAAM8EADAELQAAjAcAMPMCAACNBwAw9QIAAI8HACD5AgAApgUAMAMtAACHBwAg8wIAAIgHACD5AgAAiwEAIAAAAAAAAAABAwAA-AYAIAAAAAAABAMAAPgGACAEAAD5BwAgCQAA6gcAIA4AAOgHACAHAwAA-AYAIAQAAPkHACARAADoBQAgFQAA9wcAIBYAAPgHACAXAADpBQAgGAAA-gcAIAYDAAD4BgAgEAAA9AcAIBIAAPYHACAVAAD3BwAgzgIAAOsEACDRAgAA6wQAIAIRAADoBQAgEwAA6QUAIAAABQMAAPgGACAfAADzBwAgIAAA9AcAIMYCAADrBAAg6gIAAOsEACAABAMAAPgGACAFAADzBwAgCwAA_AcAIA0AAOwHACAAAwMAAPgGACAFAADzBwAgBwAA6wcAIAOsAgIAAAABuAIBAAAAAeMCAQAAAAECrAICAAAAAbgCAQAAAAEIrAICAAAAAcYCAgAAAAHOAgEAAAABzwICAAAAAdACQAAAAAHRAkAAAAAB0gICAAAAAdQCAAAA1AICA6wCAgAAAAG4AgEAAAABwAICAAAAAQqsAgIAAAABwQJAAAAAAcICQAAAAAHGAgIAAAAB4wIBAAAAAeYCAQAAAAHoAgAAAOgCAukCIAAAAAHqAgIAAAAB7AIAAADsAgIMrAICAAAAAbgCAQAAAAG5AgIAAAABugICAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAb4CAgAAAAG_AgIAAAABwAICAAAAAcECQAAAAAHCAkAAAAABA6wCAgAAAAGuAgIAAAABrwJAAAAAAQOsAgIAAAABrwJAAAAAAdUCAgAAAAELCQAA4gcAIA8AAN0HACARAADfBwAgGQAA3gcAIBoAAOAHACAbAADhBwAgHAAA4wcAIB0AAOQHACCsAgIAAAABuAIBAAAAAcECQAAAAAECAAAAcgAgLQAAhggAIAMAAAB1ACAtAACGCAAgLgAAiggAIA0AAAB1ACAJAACDBwAgDwAA_gYAIBEAAIAHACAZAAD_BgAgGgAAgQcAIBsAAIIHACAcAACEBwAgHQAAhQcAICYAAIoIACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACELCQAAgwcAIA8AAP4GACARAACABwAgGQAA_wYAIBoAAIEHACAbAACCBwAgHAAAhAcAIB0AAIUHACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACELCQAA4gcAIBEAAN8HACAZAADeBwAgGgAA4AcAIBsAAOEHACAcAADjBwAgHQAA5AcAIB4AAOUHACCsAgIAAAABuAIBAAAAAcECQAAAAAECAAAAcgAgLQAAiwgAIAkDAAC-BgAgEQAAvwYAIBUAAMEGACAWAADABgAgFwAAwwYAIBgAAMQGACCsAgIAAAABrQICAAAAAbgCAQAAAAECAAAAJAAgLQAAjQgAIAMAAAAiACAtAACNCAAgLgAAkQgAIAsAAAAiACADAAD3BQAgEQAA-AUAIBUAAPoFACAWAAD5BQAgFwAA_AUAIBgAAP0FACAmAACRCAAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAhCQMAAPcFACARAAD4BQAgFQAA-gUAIBYAAPkFACAXAAD8BQAgGAAA_QUAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIQysAgIAAAABrQICAAAAAbgCAQAAAAG5AgIAAAABugICAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAb4CAgAAAAG_AgIAAAABwQJAAAAAAcICQAAAAAEDrAICAAAAAa0CAgAAAAG4AgEAAAABAwAAAHUAIC0AAIsIACAuAACWCAAgDQAAAHUAIAkAAIMHACARAACABwAgGQAA_wYAIBoAAIEHACAbAACCBwAgHAAAhAcAIB0AAIUHACAeAACGBwAgJgAAlggAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQsJAACDBwAgEQAAgAcAIBkAAP8GACAaAACBBwAgGwAAggcAIBwAAIQHACAdAACFBwAgHgAAhgcAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQsJAADiBwAgDwAA3QcAIBEAAN8HACAaAADgBwAgGwAA4QcAIBwAAOMHACAdAADkBwAgHgAA5QcAIKwCAgAAAAG4AgEAAAABwQJAAAAAAQIAAAByACAtAACXCAAgCKwCAgAAAAGtAgIAAAABzgIBAAAAAc8CAgAAAAHQAkAAAAAB0QJAAAAAAdICAgAAAAHUAgAAANQCAgWsAgIAAAABxwJAAAAAAcgCAgAAAAHJAgIAAAABygICAAAAAQSsAgIAAAABxwJAAAAAAcwCAAAAzAICzQICAAAAAQcDAADtBgAgCQAA7wYAIA4AAPAGACCsAgIAAAABrQICAAAAAbgCAQAAAAHjAgEAAAABAgAAAAUAIC0AAJwIACALCQAA4gcAIA8AAN0HACARAADfBwAgGQAA3gcAIBoAAOAHACAcAADjBwAgHQAA5AcAIB4AAOUHACCsAgIAAAABuAIBAAAAAcECQAAAAAECAAAAcgAgLQAAnggAIAMAAAADACAtAACcCAAgLgAAoggAIAkAAAADACADAADKBgAgCQAAzAYAIA4AAM0GACAmAACiCAAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAh4wIBAMcEACEHAwAAygYAIAkAAMwGACAOAADNBgAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAh4wIBAMcEACEDAAAAdQAgLQAAnggAIC4AAKUIACANAAAAdQAgCQAAgwcAIA8AAP4GACARAACABwAgGQAA_wYAIBoAAIEHACAcAACEBwAgHQAAhQcAIB4AAIYHACAmAAClCAAgrAICAL0EACG4AgEAxwQAIcECQAC8BAAhCwkAAIMHACAPAAD-BgAgEQAAgAcAIBkAAP8GACAaAACBBwAgHAAAhAcAIB0AAIUHACAeAACGBwAgrAICAL0EACG4AgEAxwQAIcECQAC8BAAhA6wCAgAAAAHPAgIAAAAB2gICAAAAAQOsAgIAAAAB4QIAAADhAgLiAgEAAAABAwAAAHUAIC0AAJcIACAuAACqCAAgDQAAAHUAIAkAAIMHACAPAAD-BgAgEQAAgAcAIBoAAIEHACAbAACCBwAgHAAAhAcAIB0AAIUHACAeAACGBwAgJgAAqggAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQsJAACDBwAgDwAA_gYAIBEAAIAHACAaAACBBwAgGwAAggcAIBwAAIQHACAdAACFBwAgHgAAhgcAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQkDAAC-BgAgBAAAwgYAIBEAAL8GACAVAADBBgAgFgAAwAYAIBcAAMMGACCsAgIAAAABrQICAAAAAbgCAQAAAAECAAAAJAAgLQAAqwgAIAMAAAAiACAtAACrCAAgLgAArwgAIAsAAAAiACADAAD3BQAgBAAA-wUAIBEAAPgFACAVAAD6BQAgFgAA-QUAIBcAAPwFACAmAACvCAAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAhCQMAAPcFACAEAAD7BQAgEQAA-AUAIBUAAPoFACAWAAD5BQAgFwAA_AUAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIQisAgIAAAABrQICAAAAAcYCAgAAAAHOAgEAAAAB0AJAAAAAAdECQAAAAAHSAgIAAAAB1AIAAADUAgIDrAICAAAAAcYCAgAAAAHaAgIAAAABBBEAAOYFACCsAgIAAAAB2wIBAAAAAdwCAgAAAAECAAAA5QEAIC0AALIIACAJAwAAvgYAIAQAAMIGACARAAC_BgAgFQAAwQYAIBYAAMAGACAYAADEBgAgrAICAAAAAa0CAgAAAAG4AgEAAAABAgAAACQAIC0AALQIACADAAAA6AEAIC0AALIIACAuAAC4CAAgBgAAAOgBACARAADMBQAgJgAAuAgAIKwCAgC9BAAh2wIBAMcEACHcAgIAvQQAIQQRAADMBQAgrAICAL0EACHbAgEAxwQAIdwCAgC9BAAhAwAAACIAIC0AALQIACAuAAC7CAAgCwAAACIAIAMAAPcFACAEAAD7BQAgEQAA-AUAIBUAAPoFACAWAAD5BQAgGAAA_QUAICYAALsIACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACEJAwAA9wUAIAQAAPsFACARAAD4BQAgFQAA-gUAIBYAAPkFACAYAAD9BQAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAhBwMAAO0GACAEAADuBgAgCQAA7wYAIKwCAgAAAAGtAgIAAAABuAIBAAAAAeMCAQAAAAECAAAABQAgLQAAvAgAIAsJAADiBwAgDwAA3QcAIBEAAN8HACAZAADeBwAgGwAA4QcAIBwAAOMHACAdAADkBwAgHgAA5QcAIKwCAgAAAAG4AgEAAAABwQJAAAAAAQIAAAByACAtAAC-CAAgBawCAgAAAAG4AgEAAAAB1gICAAAAAdcCAgAAAAHZAgAAANkCAgOsAgIAAAABrQICAAAAAa8CQAAAAAEDAAAAAwAgLQAAvAgAIC4AAMQIACAJAAAAAwAgAwAAygYAIAQAAMsGACAJAADMBgAgJgAAxAgAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIeMCAQDHBAAhBwMAAMoGACAEAADLBgAgCQAAzAYAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIeMCAQDHBAAhAwAAAHUAIC0AAL4IACAuAADHCAAgDQAAAHUAIAkAAIMHACAPAAD-BgAgEQAAgAcAIBkAAP8GACAbAACCBwAgHAAAhAcAIB0AAIUHACAeAACGBwAgJgAAxwgAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQsJAACDBwAgDwAA_gYAIBEAAIAHACAZAAD_BgAgGwAAggcAIBwAAIQHACAdAACFBwAgHgAAhgcAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQcDAAC6BQAgBQAAuwUAIA0AAL0FACCsAgIAAAABrQICAAAAAbgCAQAAAAHAAgIAAAABAgAAABQAIC0AAMgIACADAAAAEgAgLQAAyAgAIC4AAMwIACAJAAAAEgAgAwAAngUAIAUAAJ8FACANAAChBQAgJgAAzAgAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIcACAgC9BAAhBwMAAJ4FACAFAACfBQAgDQAAoQUAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIcACAgC9BAAhBwMAALoFACAFAAC7BQAgCwAAvAUAIKwCAgAAAAGtAgIAAAABuAIBAAAAAcACAgAAAAECAAAAFAAgLQAAzQgAIAsJAADiBwAgDwAA3QcAIBEAAN8HACAZAADeBwAgGgAA4AcAIBsAAOEHACAcAADjBwAgHgAA5QcAIKwCAgAAAAG4AgEAAAABwQJAAAAAAQIAAAByACAtAADPCAAgAwAAABIAIC0AAM0IACAuAADTCAAgCQAAABIAIAMAAJ4FACAFAACfBQAgCwAAoAUAICYAANMIACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACHAAgIAvQQAIQcDAACeBQAgBQAAnwUAIAsAAKAFACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACHAAgIAvQQAIQMAAAB1ACAtAADPCAAgLgAA1ggAIA0AAAB1ACAJAACDBwAgDwAA_gYAIBEAAIAHACAZAAD_BgAgGgAAgQcAIBsAAIIHACAcAACEBwAgHgAAhgcAICYAANYIACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACELCQAAgwcAIA8AAP4GACARAACABwAgGQAA_wYAIBoAAIEHACAbAACCBwAgHAAAhAcAIB4AAIYHACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACELCQAA4gcAIA8AAN0HACAZAADeBwAgGgAA4AcAIBsAAOEHACAcAADjBwAgHQAA5AcAIB4AAOUHACCsAgIAAAABuAIBAAAAAcECQAAAAAECAAAAcgAgLQAA1wgAIAQTAADnBQAgrAICAAAAAdsCAQAAAAHcAgIAAAABAgAAAOUBACAtAADZCAAgCQMAAL4GACAEAADCBgAgFQAAwQYAIBYAAMAGACAXAADDBgAgGAAAxAYAIKwCAgAAAAGtAgIAAAABuAIBAAAAAQIAAAAkACAtAADbCAAgBKwCAgAAAAHGAgIAAAABxwJAAAAAAcwCAAAAzAICAwAAAHUAIC0AANcIACAuAADgCAAgDQAAAHUAIAkAAIMHACAPAAD-BgAgGQAA_wYAIBoAAIEHACAbAACCBwAgHAAAhAcAIB0AAIUHACAeAACGBwAgJgAA4AgAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQsJAACDBwAgDwAA_gYAIBkAAP8GACAaAACBBwAgGwAAggcAIBwAAIQHACAdAACFBwAgHgAAhgcAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQMAAADoAQAgLQAA2QgAIC4AAOMIACAGAAAA6AEAIBMAAM0FACAmAADjCAAgrAICAL0EACHbAgEAxwQAIdwCAgC9BAAhBBMAAM0FACCsAgIAvQQAIdsCAQDHBAAh3AICAL0EACEDAAAAIgAgLQAA2wgAIC4AAOYIACALAAAAIgAgAwAA9wUAIAQAAPsFACAVAAD6BQAgFgAA-QUAIBcAAPwFACAYAAD9BQAgJgAA5ggAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIQkDAAD3BQAgBAAA-wUAIBUAAPoFACAWAAD5BQAgFwAA_AUAIBgAAP0FACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACEJAwAAvgYAIAQAAMIGACARAAC_BgAgFgAAwAYAIBcAAMMGACAYAADEBgAgrAICAAAAAa0CAgAAAAG4AgEAAAABAgAAACQAIC0AAOcIACAMAwAAhgUAIBAAAIQFACASAACFBQAgrAICAAAAAa0CAgAAAAHGAgIAAAABzgIBAAAAAc8CAgAAAAHQAkAAAAAB0QJAAAAAAdICAgAAAAHUAgAAANQCAgIAAAAoACAtAADpCAAgAwAAACIAIC0AAOcIACAuAADtCAAgCwAAACIAIAMAAPcFACAEAAD7BQAgEQAA-AUAIBYAAPkFACAXAAD8BQAgGAAA_QUAICYAAO0IACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACEJAwAA9wUAIAQAAPsFACARAAD4BQAgFgAA-QUAIBcAAPwFACAYAAD9BQAgrAICAL0EACGtAgIAvQQAIbgCAQDHBAAhAwAAACYAIC0AAOkIACAuAADwCAAgDgAAACYAIAMAAPYEACAQAAD0BAAgEgAA9QQAICYAAPAIACCsAgIAvQQAIa0CAgC9BAAhxgICAL0EACHOAgEA8QQAIc8CAgC9BAAh0AJAALwEACHRAkAA8gQAIdICAgC9BAAh1AIAAPME1AIiDAMAAPYEACAQAAD0BAAgEgAA9QQAIKwCAgC9BAAhrQICAL0EACHGAgIAvQQAIc4CAQDxBAAhzwICAL0EACHQAkAAvAQAIdECQADyBAAh0gICAL0EACHUAgAA8wTUAiIJAwAAvgYAIAQAAMIGACARAAC_BgAgFQAAwQYAIBcAAMMGACAYAADEBgAgrAICAAAAAa0CAgAAAAG4AgEAAAABAgAAACQAIC0AAPEIACADAAAAIgAgLQAA8QgAIC4AAPUIACALAAAAIgAgAwAA9wUAIAQAAPsFACARAAD4BQAgFQAA-gUAIBcAAPwFACAYAAD9BQAgJgAA9QgAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIQkDAAD3BQAgBAAA-wUAIBEAAPgFACAVAAD6BQAgFwAA_AUAIBgAAP0FACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACEHAwAA7QYAIAQAAO4GACAOAADwBgAgrAICAAAAAa0CAgAAAAG4AgEAAAAB4wIBAAAAAQIAAAAFACAtAAD2CAAgCw8AAN0HACARAADfBwAgGQAA3gcAIBoAAOAHACAbAADhBwAgHAAA4wcAIB0AAOQHACAeAADlBwAgrAICAAAAAbgCAQAAAAHBAkAAAAABAgAAAHIAIC0AAPgIACADrAICAAAAAa0CAgAAAAGvAkAAAAABAwAAAAMAIC0AAPYIACAuAAD9CAAgCQAAAAMAIAMAAMoGACAEAADLBgAgDgAAzQYAICYAAP0IACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACHjAgEAxwQAIQcDAADKBgAgBAAAywYAIA4AAM0GACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACHjAgEAxwQAIQMAAAB1ACAtAAD4CAAgLgAAgAkAIA0AAAB1ACAPAAD-BgAgEQAAgAcAIBkAAP8GACAaAACBBwAgGwAAggcAIBwAAIQHACAdAACFBwAgHgAAhgcAICYAAIAJACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACELDwAA_gYAIBEAAIAHACAZAAD_BgAgGgAAgQcAIBsAAIIHACAcAACEBwAgHQAAhQcAIB4AAIYHACCsAgIAvQQAIbgCAQDHBAAhwQJAALwEACEPAwAA1wQAIAUAANgEACCsAgIAAAABrQICAAAAAbgCAQAAAAG5AgIAAAABugICAAAAAbsCAgAAAAG8AgIAAAABvQICAAAAAb4CAgAAAAG_AgIAAAABwAICAAAAAcECQAAAAAHCAkAAAAABAgAAAAsAIC0AAIEJACALCQAA4gcAIA8AAN0HACARAADfBwAgGQAA3gcAIBoAAOAHACAbAADhBwAgHQAA5AcAIB4AAOUHACCsAgIAAAABuAIBAAAAAcECQAAAAAECAAAAcgAgLQAAgwkAIAMAAAAJACAtAACBCQAgLgAAhwkAIBEAAAAJACADAADIBAAgBQAAyQQAICYAAIcJACCsAgIAvQQAIa0CAgC9BAAhuAIBAMcEACG5AgIAvQQAIboCAgC9BAAhuwICAL0EACG8AgIAvQQAIb0CAgC9BAAhvgICAL0EACG_AgIAvQQAIcACAgC9BAAhwQJAALwEACHCAkAAvAQAIQ8DAADIBAAgBQAAyQQAIKwCAgC9BAAhrQICAL0EACG4AgEAxwQAIbkCAgC9BAAhugICAL0EACG7AgIAvQQAIbwCAgC9BAAhvQICAL0EACG-AgIAvQQAIb8CAgC9BAAhwAICAL0EACHBAkAAvAQAIcICQAC8BAAhAwAAAHUAIC0AAIMJACAuAACKCQAgDQAAAHUAIAkAAIMHACAPAAD-BgAgEQAAgAcAIBkAAP8GACAaAACBBwAgGwAAggcAIB0AAIUHACAeAACGBwAgJgAAigkAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQsJAACDBwAgDwAA_gYAIBEAAIAHACAZAAD_BgAgGgAAgQcAIBsAAIIHACAdAACFBwAgHgAAhgcAIKwCAgC9BAAhuAIBAMcEACHBAkAAvAQAIQMDAAIfVwMgWAwKCAAXCUoEDwYDEUYNGSUMGkcHG0kBHEsFHUwJHk4WBQMAAgQIAQgACwkMBA4VBwQDAAIFAAMHEAUIAAYCAwACBgAEAQcRAAUDAAIFAAMIAAoLGQgNHQkBCgAHAgMAAgwABwILHgANHwACCSAADiEACAMAAgQ7AQgAFREpDRU6ERY5Exc8DxhAFAUDAAIIABIQAAwSAA4VNBEDCAAQESoNEy4PAhAADBIADgIRLwATMAACEAAMFAANARU1AAEQAAwBEAAMBRFBABVDABZCABdEABhFAAEDAAIICVQAD08AEVEAGVAAGlIAG1MAHFUAHVYAAAMDAAIfYgMgYwwDAwACH2kDIGoMBQgAHDMAHTQAHjUAHzYAIAAAAAAABQgAHDMAHTQAHjUAHzYAIAAABQgAJTMAJjQAJzUAKDYAKQAAAAAABQgAJTMAJjQAJzUAKDYAKQEDAAIBAwACBQgALjMALzQAMDUAMTYAMgAAAAAABQgALjMALzQAMDUAMTYAMgEDAAIBAwACBQgANzMAODQAOTUAOjYAOwAAAAAABQgANzMAODQAOTUAOjYAOwEDAAIBAwACBQgAQDMAQTQAQjUAQzYARAAAAAAABQgAQDMAQTQAQjUAQzYARAEQAAwBEAAMBQgASTMASjQASzUATDYATQAAAAAABQgASTMASjQASzUATDYATQAABQgAUjMAUzQAVDUAVTYAVgAAAAAABQgAUjMAUzQAVDUAVTYAVgIQAAwSAA4CEAAMEgAOBQgAWzMAXDQAXTUAXjYAXwAAAAAABQgAWzMAXDQAXTUAXjYAXwIDAAIFAAMCAwACBQADBQgAZDMAZTQAZjUAZzYAaAAAAAAABQgAZDMAZTQAZjUAZzYAaAEKAAcBCgAHBQgAbTMAbjQAbzUAcDYAcQAAAAAABQgAbTMAbjQAbzUAcDYAcQIDAAIMAAcCAwACDAAHBQgAdjMAdzQAeDUAeTYAegAAAAAABQgAdjMAdzQAeDUAeTYAegMDAAIQAAwSAA4DAwACEAAMEgAOBQgAfzMAgAE0AIEBNQCCATYAgwEAAAAAAAUIAH8zAIABNACBATUAggE2AIMBAhAADBQADQIQAAwUAA0FCACIATMAiQE0AIoBNQCLATYAjAEAAAAAAAUIAIgBMwCJATQAigE1AIsBNgCMAQEQAAwBEAAMBQgAkQEzAJIBNACTATUAlAE2AJUBAAAAAAAFCACRATMAkgE0AJMBNQCUATYAlQECAwACBQADAgMAAgUAAwUIAJoBMwCbATQAnAE1AJ0BNgCeAQAAAAAABQgAmgEzAJsBNACcATUAnQE2AJ4BAgMAAgYABAIDAAIGAAQFCACjATMApAE0AKUBNQCmATYApwEAAAAAAAUIAKMBMwCkATQApQE1AKYBNgCnASECASJZASNaASRbASVcASdeAShgGClhGSplAStnGCxoGi9rATBsATFtGDdwGzhxITlzAjp0Ajt3Ajx4Aj15Aj57Aj99GEB-IkGAAQJCggEYQ4MBI0SEAQJFhQECRoYBGEeJASRIigEqSYwBFkqNARZLjwEWTJABFk2RARZOkwEWT5UBGFCWAStRmAEWUpoBGFObASxUnAEWVZ0BFlaeARhXoQEtWKIBM1mjAQNapAEDW6UBA1ymAQNdpwEDXqkBA1-rARhgrAE0Ya4BA2KwARhjsQE1ZLIBA2WzAQNmtAEYZ7cBNmi4ATxpuQEMaroBDGu7AQxsvAEMbb0BDG6_AQxvwQEYcMIBPXHEAQxyxgEYc8cBPnTIAQx1yQEMdsoBGHfNAT94zgFFec8BFHrQARR70QEUfNIBFH3TARR-1QEUf9cBGIAB2AFGgQHaARSCAdwBGIMB3QFHhAHeARSFAd8BFIYB4AEYhwHjAUiIAeQBTokB5gEOigHnAQ6LAeoBDowB6wEOjQHsAQ6OAe4BDo8B8AEYkAHxAU-RAfMBDpIB9QEYkwH2AVCUAfcBDpUB-AEOlgH5ARiXAfwBUZgB_QFXmQH-AQ-aAf8BD5sBgAIPnAGBAg-dAYICD54BhAIPnwGGAhigAYcCWKEBiQIPogGLAhijAYwCWaQBjQIPpQGOAg-mAY8CGKcBkgJaqAGTAmCpAZQCB6oBlQIHqwGWAgesAZcCB60BmAIHrgGaAgevAZwCGLABnQJhsQGfAgeyAaECGLMBogJitAGjAge1AaQCB7YBpQIYtwGoAmO4AakCabkBqgIIugGrAgi7AawCCLwBrQIIvQGuAgi-AbACCL8BsgIYwAGzAmrBAbUCCMIBtwIYwwG4AmvEAbkCCMUBugIIxgG7AhjHAb4CbMgBvwJyyQHAAgnKAcECCcsBwgIJzAHDAgnNAcQCCc4BxgIJzwHIAhjQAckCc9EBywIJ0gHNAhjTAc4CdNQBzwIJ1QHQAgnWAdECGNcB1AJ12AHVAnvZAdYCDdoB1wIN2wHYAg3cAdkCDd0B2gIN3gHcAg3fAd4CGOAB3wJ84QHhAg3iAeMCGOMB5AJ95AHlAg3lAeYCDeYB5wIY5wHqAn7oAesChAHpAewCEeoB7QIR6wHuAhHsAe8CEe0B8AIR7gHyAhHvAfQCGPAB9QKFAfEB9wIR8gH5AhjzAfoChgH0AfsCEfUB_AIR9gH9Ahj3AYADhwH4AYEDjQH5AYIDE_oBgwMT-wGEAxP8AYUDE_0BhgMT_gGIAxP_AYoDGIACiwOOAYECjQMTggKPAxiDApADjwGEApEDE4UCkgMThgKTAxiHApYDkAGIApcDlgGJApgDBIoCmQMEiwKaAwSMApsDBI0CnAMEjgKeAwSPAqADGJACoQOXAZECowMEkgKlAxiTAqYDmAGUAqcDBJUCqAMElgKpAxiXAqwDmQGYAq0DnwGZAq4DBZoCrwMFmwKwAwWcArEDBZ0CsgMFngK0AwWfArYDGKACtwOgAaECuQMFogK7AxijArwDoQGkAr0DBaUCvgMFpgK_AxinAsIDogGoAsMDqAE"
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
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
//#endregion
//#region lib/prisma.ts
const prisma = new (getPrismaClientClass())({ adapter: new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` }) });
//#endregion
//#region controllers/Webhook.controller.ts
const AUTH = "";
/**
* handleCallWebhook
* Logic: Receives last_call_id -> Fetches full details from Leaddesk -> Upserts Agent/Callee -> Creates Call
*/
const handleCallWebhook = async (lastCallId, companyId) => {
	const company = await prisma.company.findUnique({ where: { id: companyId } });
	if (!company) throw new Error("Company not found");
	const ld = (await axios.get(`https://api.leaddesk.com`, { params: {
		auth: AUTH,
		mod: "call",
		cmd: "get",
		call_ref_id: lastCallId
	} })).data;
	const agentToThird = await prisma.agentToThird.findUnique({ where: { serviceIdentifier_agentServiceIdentifier: {
		serviceIdentifier: "LEADDESK",
		agentServiceIdentifier: String(ld.agent_id)
	} } });
	if (!agentToThird) throw /* @__PURE__ */ new Error("Agent has no relation with this third party service");
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
			leadDeskId: ld.id,
			agentId: agent.id,
			calleeId: callee.id,
			startAt: new Date(ld.talk_start),
			endAt: new Date(ld.talk_end),
			durationSeconds: parseInt(ld.talk_time),
			companyId: company.id,
			dayOfTheWeek: mapDateToWeekDayEnum(ld.talk_start)
		} });
		if (agentToCallee.totalAttemps == 1) await tx.funnelEvent.create({ data: {
			timestamp: new Date(ld.talk_start),
			agentId: agent.id,
			callId: call.id,
			type: "SEED"
		} });
		if (agentToCallee.totalAttemps > 1) await tx.funnelEvent.create({ data: {
			timestamp: new Date(ld.talk_start),
			agentId: agent.id,
			callId: call.id,
			type: "LEAD"
		} });
		if (ld.order_ids?.length > 0) await tx.funnelEvent.create({ data: {
			timestamp: new Date(ld.talk_start),
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
const mapDateToWeekDayEnum = (dateString) => {
	const dayIndex = new Date(dateString).getDay();
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
		console.error("Webhook Error:", error);
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
					if (!roles.includes(payload.role)) res.status(401).json({ error: "Path not granted for this role" });
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
const JWT_SECRET = process.env.JWT_SECRET;
const authRouter = Router();
authRouter.post("/register", async (req, res) => {
	try {
		const { companyName, admin_email, admin_name, password } = req.body;
		if (!admin_email || !password) return res.status(400).json({ error: "Missing required fields" });
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
		}, JWT_SECRET, { expiresIn: "8h" });
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
	return await prisma.manager.update({
		where: { id },
		data: {
			name: data.name,
			email: data.email,
			user: data.email ? { update: { email: data.email } } : void 0
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
			companyId: data.companyId
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
	return await prisma.agent.update({
		where: { id },
		data: {
			name: data.name,
			user: data.email ? { update: { email: data.email } } : void 0,
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
	const targetDate = new Date(date);
	targetDate.setUTCHours(0, 0, 0, 0);
	return await prisma.goalsAssignation.delete({ where: { companyId_date: {
		companyId,
		date: targetDate
	} } });
};
/**
* Normalizes a date to 00:00:00.000
*/
const getStartOfDay$1 = (date) => {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
};
/**
* Normalizes a date to 23:59:59.999
*/
const getEndOfDay$1 = (date) => {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
};
//#endregion
//#region routes/admin.route.ts
const adminRouter = Router();
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
		const { name, email } = req.body;
		const updated = await updateManagerData(id, {
			name,
			email
		});
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
		return res.status(500).json({ error: err.message });
	}
});
adminRouter.put("/editAgent/:id", checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { name, email, leadDeskId } = req.body;
		const updateObject = {};
		updateObject.name = name;
		updateObject.email = email;
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
		const assignations = await getAssignationsByRange$1(Number(companyId), new Date(from), new Date(to));
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
			const deleted = await deleteGoalAssignationByDate(Number(companyId), new Date(date));
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
		if ((await getAssignationsByRange$1(companyId, new Date(date), new Date(date)))[0]?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" });
		return next();
	}
	return res.status(500).json({ error: "unexpected error in goal middleware" });
}
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
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
};
/**
* Normalizes a date to 23:59:59.999
*/
const getEndOfDay = (date) => {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
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
schemaRouter.get("/assignation", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
	try {
		const { from, to } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
		const assignations = await getAssignationsByRange(Number(companyId), new Date(from), new Date(to));
		return res.status(200).json(assignations);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ error: err.message });
	}
});
schemaRouter.post("/upsert-assignation", allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
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
schemaRouter.delete("/delete-assignation-by-id/:id", checkSchemaAssignationBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req, res) => {
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
	if (new Date(lastCall.startAt).getTime() > (/* @__PURE__ */ new Date()).getTime()) return { lastCallDate: /* @__PURE__ */ new Date() };
	return { lastCallDate: lastCall.startAt };
};
const getGeneralInsights = async (companyId, startDate, endDate, filters) => {
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
const getDailyActivity = async (companyId, startDate, endDate, filters) => {
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND "agentId" IN (${join(filters.agents)})` : empty;
	const seedAgentFilter = filters.agents && filters.agents.length > 0 ? sql`AND fe."agentId" IN (${join(filters.agents)})` : empty;
	const dailyCalls = await prisma.$queryRaw`
    SELECT 
      DATE("startAt") as "date",
      SUM("durationSeconds") as "talkTime",
      COUNT(id) as "calls"
    FROM "Call"
    WHERE "companyId" = ${companyId}
      AND "startAt" >= ${startDate}
      AND "startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY DATE("startAt")
    ORDER BY DATE("startAt") ASC
  `;
	const dailySeeds = await prisma.$queryRaw`
    SELECT 
      DATE(fe."timestamp") as "date",
      COUNT(fe.id) as "seeds"
    FROM "FunnelEvent" fe
    JOIN "Agent" a ON fe."agentId" = a.id
    WHERE a."companyId" = ${companyId}
      AND fe."type" = ${EventType.SEED}
      AND fe."timestamp" >= ${startDate}
      AND fe."timestamp" <= ${endDate}
      ${seedAgentFilter}
    GROUP BY DATE(fe."timestamp")
  `;
	return dailyCalls.map((callDay) => {
		const dayString = new Date(callDay.date).toISOString().split("T")[0];
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
const getBlockPerformance = async (companyId, from, to, schemaId, filters) => {
	const startDate = /* @__PURE__ */ new Date(`${from}T00:00:00.000Z`);
	const endDate = /* @__PURE__ */ new Date(`${to}T23:59:59.999Z`);
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
		const callMinutes = call.startAt.getUTCHours() * 60 + call.startAt.getUTCMinutes();
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
const getLongCallDistribution = async (companyId, startDate, endDate, filters) => {
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
const getSeedTimelineHeatmap = async (companyId, year, filters) => {
	const startDate = new Date(year, 0, 1);
	const endDate = new Date(year, 11, 31, 23, 59, 59);
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND c."agentId" IN (${join(filters.agents)})` : empty;
	const dailyData = await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt") as "date",
      COUNT(fe.id) as "seeds"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id AND fe."type" = ${EventType.SEED}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY DATE(c."startAt")
    ORDER BY DATE(c."startAt") ASC
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
	const currentDate = new Date(startDate);
	while (currentDate <= endDate) {
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
const getSeedTimelineHeatmapPerDay = async (companyId, targetDate, filters) => {
	const startOfDay = /* @__PURE__ */ new Date(`${targetDate}T00:00:00.000Z`);
	const endOfDay = /* @__PURE__ */ new Date(`${targetDate}T23:59:59.999Z`);
	const agentFilter = filters.agents && filters.agents.length > 0 ? sql`AND c."agentId" IN (${join(filters.agents)})` : empty;
	const hourlyData = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM (c."startAt"::timestamp)) as "hour",
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
const getConversionFunnel = async (companyId, startDate, endDate, filters) => {
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
const getConsistencyHistory = async (goalId, companyId, startDate, endDate, filters) => {
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
      DATE(c."startAt") as "date",
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
    GROUP BY DATE(c."startAt")
    ORDER BY DATE(c."startAt") ASC
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
const getAgentsSorted = async (companyId, from, to, params) => {
	const { sortKey, direction, page, pageSize, agentIds } = params;
	const offset = (page - 1) * pageSize;
	const startDate = /* @__PURE__ */ new Date(`${from}T00:00:00.000Z`);
	const endDate = /* @__PURE__ */ new Date(`${to}T23:59:59.999Z`);
	const agentFilter = agentIds && agentIds.length > 0 ? sql`AND a.id IN (${join(agentIds)})` : empty;
	return (await prisma.$queryRaw`
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
        WHEN COUNT(c.id) > 0 
        THEN ROUND((COUNT(CASE WHEN c."durationSeconds" >= 300 THEN 1 END)::NUMERIC / COUNT(c.id)::NUMERIC) * 100, 1)
        ELSE 0 
      END as "longCallRatio",
      -- Placeholder for consistency logic (requires Goal comparison)
      85 as "consistency"
    FROM "Agent" a
    LEFT JOIN "Call" c ON c."agentId" = a.id 
      AND c."startAt" >= ${startDate} 
      AND c."startAt" <= ${endDate}
    LEFT JOIN "FunnelEvent" fe_seed ON fe_seed."callId" = c.id AND fe_seed."type" = 'SEED'
    LEFT JOIN "FunnelEvent" fe_sale ON fe_sale."callId" = c.id AND fe_sale."type" = 'SALE'
    WHERE a."companyId" = ${companyId}
    ${agentFilter}
    GROUP BY a.id, a.name
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
		});
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
		const startDate = new Date(from);
		const endDate = new Date(to);
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		endDate.setHours(23, 59, 59, 999);
		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
		const report = await getGeneralInsights(Number(companyId), startDate, endDate, { agents: parsedAgents });
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
dataVisRouter.get("/daily-activity", async (req, res) => {
	try {
		const { from, to, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
		const startDate = new Date(from);
		const endDate = new Date(to);
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		endDate.setHours(23, 59, 59, 999);
		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
		const report = await getDailyActivity(Number(companyId), startDate, endDate, { agents: parsedAgents });
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
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (typeof from !== "string" || !dateRegex.test(from) || typeof to !== "string" || !dateRegex.test(to)) return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD" });
		const sId = Number(schemaId);
		const parsedDays = parseBoolArray(days);
		const parsedTypes = parseBoolArray(types);
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const data = await getBlockPerformance(Number(companyId), from, to, sId, {
			days: parsedDays,
			types: parsedTypes,
			agents: parsedAgents
		});
		return res.status(200).json(data);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});
dataVisRouter.get("/long-call-distribution", async (req, res) => {
	try {
		const { from, to, agents } = req.query;
		const companyId = req.user?.companyId;
		if (!companyId || !from || !to) return res.status(400).json({ error: "Missing required parameters: companyId, from, to" });
		const startDate = new Date(from);
		const endDate = new Date(to);
		endDate.setHours(23, 59, 59, 999);
		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ error: "Invalid date format" });
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
		const heatmapData = await getSeedTimelineHeatmap(Number(companyId), Number(year), { agents: parsedAgents });
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
		const heatmapData = await getSeedTimelineHeatmapPerDay(Number(companyId), day, { agents: parsedAgents });
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
		const start = new Date(from);
		const end = new Date(to);
		end.setHours(23, 59, 59, 999);
		if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ error: "Invalid date format" });
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
		const start = new Date(from);
		const end = new Date(to);
		end.setHours(23, 59, 59, 999);
		const parsedAgents = agents ? parseNumberArray(agents) : [];
		const parsedDays = days ? parseBoolArray(days) : [];
		const history = await getConsistencyHistory(Number(goalId), Number(companyId), start, end, {
			agents: parsedAgents,
			days: parsedDays
		});
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
		if (isNaN(number)) throw "Not numerical value";
		return number;
	});
};
//#endregion
//#region controllers/agentDashboard.controller.ts
const getAgentDayInsights = async (userId, date) => {
	const startOfDay = /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`);
	const endOfDay = /* @__PURE__ */ new Date(`${date}T23:59:59.999Z`);
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
const getAgentWeeklyGrowth = async (agentId, dateStr) => {
	const date = /* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`);
	const day = date.getUTCDay();
	const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
	const startOfWeek = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
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
	for (let i = 0; i < 7; i++) {
		const startOfDay = new Date(startOfWeek);
		startOfDay.setUTCDate(startOfWeek.getUTCDate() + i);
		const endOfDay = new Date(startOfDay);
		endOfDay.setUTCHours(23, 59, 59, 999);
		const [calls, events, deepCalls] = await Promise.all([
			prisma.call.count({ where: {
				agentId,
				startAt: {
					gte: startOfDay,
					lte: endOfDay
				}
			} }),
			prisma.funnelEvent.findMany({ where: {
				agentId,
				timestamp: {
					gte: startOfDay,
					lte: endOfDay
				}
			} }),
			prisma.call.count({ where: {
				agentId,
				startAt: {
					gte: startOfDay,
					lte: endOfDay
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
		const agentId = req.user?.id;
		if (!agentId) return res.status(400).json({ error: "Missing agentId" });
		if (!date) return res.status(400).json({ error: "Missing date" });
		const report = await getAgentDayInsights(agentId, date);
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
agentDashboardRouter.get("/get-agent-weekly-growth", async (req, res) => {
	try {
		const { date } = req.query;
		const agentId = req.user?.id;
		if (!agentId) return res.status(400).json({ error: "Missing agentId" });
		if (!date) return res.status(400).json({ error: "Missing date" });
		const report = await getAgentWeeklyGrowth(agentId, date);
		return res.status(200).json(report);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
agentDashboardRouter.get("/get-assigned-schema", async (req, res) => {
	try {
		const { date } = req.query;
		const agentId = req.user?.id;
		if (!agentId) return res.status(400).json({ error: "Missing agentId" });
		if (!date) return res.status(400).json({ error: "Missing date" });
		const result = await getAssignedSchema(agentId, date);
		return res.status(200).json(result);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
	}
});
agentDashboardRouter.post("/register-agent-state", async (req, res) => {
	try {
		const { energy, focus, motivation } = req.body;
		const agentId = req.user?.id;
		if (!agentId) return res.status(400).json({ error: "Missing agentId" });
		const result = await registerAgentState(agentId, Number(energy), Number(focus), Number(motivation));
		return res.status(200).json(result);
	} catch (err) {
		console.error("DataVis Error:", err);
		return res.status(500).json({ error: "Internal server error processing visualization" });
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
router.use("/leaddesk", authenticateBasic, leadDeskWebhookRouter);
//#endregion
//#region app.ts
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);
//#endregion
//#region index.ts
var import_dist = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	const regExpToParseExpressPathRegExp = /^\/\^\\\/(?:(:?[\w\\.-]*(?:\\\/:?[\w\\.-]*)*)|(\(\?:\([^)]+\)\)))\\\/.*/;
	const regExpToReplaceExpressPathRegExpParams = /\(\?:\([^)]+\)\)/;
	const regexpExpressParamRegexp = /\(\?:\([^)]+\)\)/g;
	const regexpExpressPathParamRegexp = /(:[^)]+)\([^)]+\)/g;
	const EXPRESS_ROOT_PATH_REGEXP_VALUE = "/^\\/?(?=\\/|$)/i";
	const STACK_ITEM_VALID_NAMES = [
		"router",
		"bound dispatch",
		"mounted_app"
	];
	const getRouteMethods = function(route) {
		let methods = Object.keys(route.methods);
		methods = methods.filter((method) => method !== "_all");
		methods = methods.map((method) => method.toUpperCase());
		return methods;
	};
	const getRouteMiddlewares = function(route) {
		return route.stack.map((item) => {
			return item.handle.name || "anonymous";
		});
	};
	const hasParams = function(expressPathRegExp) {
		return regexpExpressParamRegexp.test(expressPathRegExp);
	};
	const parseExpressRoute = function(route, basePath) {
		const paths = [];
		if (Array.isArray(route.path)) paths.push(...route.path);
		else paths.push(route.path);
		return paths.map((path) => {
			return {
				path: (basePath && path === "/" ? basePath : `${basePath}${path}`).replace(regexpExpressPathParamRegexp, "$1"),
				methods: getRouteMethods(route),
				middlewares: getRouteMiddlewares(route)
			};
		});
	};
	const parseExpressPath = function(expressPathRegExp, params) {
		let parsedRegExp = expressPathRegExp.toString();
		let expressPathRegExpExec = regExpToParseExpressPathRegExp.exec(parsedRegExp);
		let paramIndex = 0;
		while (hasParams(parsedRegExp)) {
			const paramId = `:${params[paramIndex].name}`;
			parsedRegExp = parsedRegExp.replace(regExpToReplaceExpressPathRegExpParams, paramId);
			paramIndex++;
		}
		if (parsedRegExp !== expressPathRegExp.toString()) expressPathRegExpExec = regExpToParseExpressPathRegExp.exec(parsedRegExp);
		return expressPathRegExpExec[1].replace(/\\\//g, "/");
	};
	const parseEndpoints = function(app, basePath, endpoints) {
		const stack = app.stack || app._router && app._router.stack;
		endpoints = endpoints || [];
		basePath = basePath || "";
		if (!stack) {
			if (endpoints.length) endpoints = addEndpoints(endpoints, [{
				path: basePath,
				methods: [],
				middlewares: []
			}]);
		} else endpoints = parseStack(stack, basePath, endpoints);
		return endpoints;
	};
	const addEndpoints = function(currentEndpoints, endpointsToAdd) {
		endpointsToAdd.forEach((newEndpoint) => {
			const existingEndpoint = currentEndpoints.find((endpoint) => endpoint.path === newEndpoint.path);
			if (existingEndpoint !== void 0) {
				const newMethods = newEndpoint.methods.filter((method) => !existingEndpoint.methods.includes(method));
				existingEndpoint.methods = existingEndpoint.methods.concat(newMethods);
			} else currentEndpoints.push(newEndpoint);
		});
		return currentEndpoints;
	};
	const parseStack = function(stack, basePath, endpoints) {
		stack.forEach((stackItem) => {
			if (stackItem.route) {
				const newEndpoints = parseExpressRoute(stackItem.route, basePath);
				endpoints = addEndpoints(endpoints, newEndpoints);
			} else if (STACK_ITEM_VALID_NAMES.includes(stackItem.name)) {
				const isExpressPathRegexp = regExpToParseExpressPathRegExp.test(stackItem.regexp);
				let newBasePath = basePath;
				if (isExpressPathRegexp) {
					const parsedPath = parseExpressPath(stackItem.regexp, stackItem.keys);
					newBasePath += `/${parsedPath}`;
				} else if (!stackItem.path && stackItem.regexp && stackItem.regexp.toString() !== EXPRESS_ROOT_PATH_REGEXP_VALUE) {
					const regExpPath = ` RegExp(${stackItem.regexp}) `;
					newBasePath += `/${regExpPath}`;
				}
				endpoints = parseEndpoints(stackItem.handle, newBasePath, endpoints);
			}
		});
		return endpoints;
	};
	const expressListEndpoints = function(app) {
		return parseEndpoints(app);
	};
	module.exports = expressListEndpoints;
})))(), 1);
const PORT = process.env.PORT || 3e3;
app.listen(PORT, () => {
	console.log(`🚀 Server is running at http://localhost:${PORT}`);
	console.log((0, import_dist.default)(app));
});
//#endregion
export {};
