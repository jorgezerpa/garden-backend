# **PROMPT**
I have an express API that need some tests to it using Vitest and supertest for http request. 
I have some routes and controllers and I need you to write the tests for each of the routes. 
I'll be passing you small chunks of code, corresponding for a group or routes and it's related controllers. Of course I'll pass you a basic test file setup that you will use as starting point.  Also, I'll pass you a list of the tests I need you to write. 
Let me know if you understand so we can start

# MANAGER
## POST /addManager
Success: Should create both a Manager and a User record within a single transaction.
Success: Should normalize email addresses (lowercase and trimmed) before saving.
Success: Should correctly hash the password before it reaches the database.
Validation: Should return 400 if email, name, or password are missing from the request body.
Validation: Should return 400 if companyId is missing from the authenticated user context.
Integrity: Should fail the entire operation if the User creation fails after the Manager is created (Transaction Rollback).
Edge Case: Should return a 500 error with a descriptive message if the database throws a unique constraint error (e.g., duplicate email).
## PUT /editManager/:id
Success: Should update only the Manager name when only the name is provided.
Success: Should synchronize the email update across both the Manager and the linked User record.
Success: Should update the User password hash when a new password is provided in the request.
Success: Should return 200 and the updated manager object upon successful modification.
Logic: Should verify that the updateObject remains empty/undefined for fields not provided in the request body.
Error Handling: Should return 500 with "Update failed" if the id does not exist or the database update fails.
## GET /getManager/:id
Success: Should return 200 and the manager data, including the joined user and company relations.
Validation: Should return 400 if the id parameter is not a valid number.
Not Found: Should return 404 when searching for an ID that does not exist in the database.
Security/Middleware Logic (Internal): Ensure the checkManagerBelongsToCompany logic prevents accessing a manager from a different companyId.
## GET /getManagersList
Success: Should return a paginated object containing both the total count and the data array.
Success: Should default to page=1 and limit=10 if query parameters are omitted.
Scoping: Should strictly filter managers by the companyId of the requesting admin.
Formatting: Should include the company.name in the returned payload as specified in the Prisma include.
Logic: Should correctly calculate the skip value based on the page and limit (e.g., Page 2, Limit 10 results in Skip 10).
## DELETE /removeManagers/:id
Success: Should delete both the User and the Manager records within a transaction.
Success: Should return 204 No Content upon successful deletion.
Logic: Should check for the existence of the linked User before attempting to delete it to avoid null pointer errors in the transaction.
Integrity: Should rollback the deletion of the User if the Manager deletion fails.
Edge Case: Should handle cases where a Manager exists but has no linked User profile without crashing.


# AGENT 
## POST /addAgent
Success: Should create an Agent and a linked User (with role AGENT) in a single transaction.
Success: Should create/link the LEADDESK third-party service identifier immediately after user creation.
Success: Should ensure the email is stored in lowercase and trimmed.
Validation: Should return 400 if leadDeskId is an empty string, null, or only whitespace.
Validation: Should return 400 if email, name, or password are missing.
Consistency: Should ensure the passwordHash is generated correctly using bcrypt before saving.
## PUT /editAgent/:id
Success: Should update the Agent's name without affecting the User or Third-Party records if only name is provided.
Success: Should update the agentServiceIdentifier for LEADDESK using the upsert logic (create if missing, update if exists).
Success: Should allow updating the User password without requiring an email change.
Integrity: Should verify that updating the email in the Agent route correctly propagates to the User table.
Logic Check: Should ensure that if no leadDeskId is provided, the agentToThird relation remains untouched (remains undefined in the Prisma query).
## GET /getAgent/:id
Success: Should return 200 and include user, company, and agentToThird relations in the response.
Status Filter: Should return 200 if the user is ACTIVE.
Status Filter: Should return 404 if the user exists but their status is not ACTIVE (based on your current implementation logic).
Validation: Should return 400 if the id provided is not a number.
Not Found: Should return 404 if the agent ID does not exist in the database.
## GET /getAgentsList
Success: Should return a paginated result with total count and the data array.
Filtering: Should strictly exclude any agents whose associated user status is not ACTIVE.
Scoping: Should strictly filter agents by the companyId of the requesting admin/manager.
Security: Should verify that passwordHash is omitted from the user object in the response (using the Prisma omit feature).
Pagination: Should return the correct subset of agents when page and limit are provided.
## DELETE /removeAgent/:id (Soft Delete)
Success: Should change the User status to REMOVED instead of deleting the record from the database.
Success: Should return 204 No Content upon a successful status update.
Integrity: Should verify that after "deletion," the agent no longer appears in the getAgentsList results.
Integrity: Should verify that the Agent record and agentToThird records still exist in the database (preserving historical data).
Edge Case: Should return an error (or handle gracefully) if attempting to delete an agent that has no associated user record.


# Goals CRUD (Templates)
## POST /goals/create
Success: Should create a new goal template and correctly cast string inputs from the body into numbers.
Success: Should default all numeric metrics (talkTime, seeds, etc.) to 0 if they are omitted from the request.
Validation: Should return 400 if companyId or creatorId are missing from the request context.
Persistence: Should verify that the goal is saved with the correct creatorId to track who defined the template.
## GET /goals/company
Success: Should return 200 and a list of all goal templates belonging to the specific company.
Scoping: Should ensure that goals from Company A are never returned when Company B makes the request.
Empty State: Should return an empty array (200 OK) if the company has not created any templates yet.
## PUT /goals/update/:id
Success: Should allow partial updates (e.g., updating only sales and leads while keeping seeds the same).
Success: Should return the fully updated object.
Security: Should verify that "system" fields like id, companyId, or createdAt cannot be modified even if passed in the request body.
## DELETE /goals/delete/:id
Success: Should perform a cascading delete within a transaction: removing all GoalsAssignation records linked to this template before deleting the template itself.
Integrity: Should rollback the entire operation if the template deletion fails after assignations were already cleared.
Constraint Check: Should verify that no foreign key violations occur when a goal used in the calendar is deleted.

# Goals Assignation (Calendar)
## GET /assignation
Success: Should return all assignations within the specified from and to range (inclusive).
Success: Should include the full goal template details for each assignation in the response.
Validation: Should return 400 if from or to date strings are missing from the query parameters.
Logic: Should correctly normalize "start of day" and "end of day" to ensure assignations on the boundary dates are included.
## POST /upsert-assignation
Success (Create): Should assign a goal to a specific date if that date is currently empty for the company.
Success (Update): Should overwrite the existing goalId if the company already has a goal assigned to that specific date (Upsert logic).
Formatting: Should correctly parse the date string into a UTC 00:00:00.000Z Date object.
Validation: Should return 400 if date or goalId is missing.
## DELETE /delete-assignation-by-id/:id
Success: Should remove a specific calendar entry using its primary key ID.
Success: Should return 200 and the deleted assignation data.
Edge Case: Should return 500/error if the ID does not exist.
## DELETE /delete-assignation-by-date
Success: Should remove the assignment for a specific day using the composite key (companyId + date).
Success: Should correctly normalize the query date string to match the stored database date (midnight UTC) to ensure a match.
Validation: Should return 400 if the date query parameter is missing.


# Schema
## POST /create
Success: Should create a Schema along with all its nested SchemaBlock records in a single transaction.
Validation: Should return 400 if the blocks array is missing or empty (Must send at least 1 block).
Validation: Should return 400 if name, companyId, or creatorId are missing.
Integrity: Should verify that block timing (e.g., startMinutesFromMidnight) is stored as a number.
## GET /list
Success: Should return a paginated list of schemas with their nested blocks included.
Scoping: Should strictly filter schemas by the companyId in the request context.
Pagination: Should correctly apply skip and take based on the page and limit query parameters.
## GET /individual/:id
Success: Should return 200 and the schema details, with blocks ordered chronologically (startMinutesFromMidnight: 'asc').
Security: Should return 401 (via middleware) if the schema exists but belongs to a different company.
Not Found: Should return 404 if the schema ID does not exist.
## PUT /update/:id
Success (Metadata): Should update only the schema name if the blocks array is not provided.
Success (Full Structural Update): Should delete all existing schemaBlock records and create new ones when a new blocks array is provided.
Atomicity: Should ensure that if creating new blocks fails, the old blocks are not deleted (Transaction integrity).
Response: Should return the updated schema including the new set of blocks.
## DELETE /:id
Success: Should perform a cascading delete within a transaction: clearing schemaAssignation, then schemaBlock, then the Schema itself.
Integrity: Should verify that the schema is no longer available in the list or calendar after deletion.
**Group 2: Schema Assignation (Calendar)**
## GET /assignation
Success: Should return all schema assignations within the from and to range for the specific company.
Validation: Should return 400 if either from or to date strings are missing.
Logic: Should verify that dates are normalized to start/end of day to capture the full range.
## POST /upsert-assignation
Success (Create): Should link a schema to a date that previously had no assignment.
Success (Update): Should update the schemaId if an assignation already exists for that companyId_date combination.
Formatting: Should verify the date string is correctly converted to a UTC midnight Date object (00:00:00.000Z).
## DELETE /delete-assignation-by-id/:id
Success: Should remove the calendar assignment for a specific day using its primary key.
Security: Should verify (via middleware) that the user has authority over the company associated with that assignation ID.


# AUTH
## POST /register
Success: Should create a new Company, a Manager profile, and a User (as MAIN_ADMIN) in a single transaction.
Validation: Should return 422 if the email format is invalid.
Validation: Should return 400 if required fields (admin_email, password) are missing.
Conflict: Should return 409 if a user with the same email already exists.
Persistence: Should ensure the password is hashed with bcrypt before reaching the controller.
Integrity: Should rollback the company creation if user creation fails during the transaction.
## POST /login
Success: Should return 200, a JWT token, and user metadata upon successful password comparison.
Validation: Should return 401 for non-existent users or incorrect passwords.
Security: Should verify that the returned JWT contains the correct claims (sub, companyId, role).
Format: Should ensure email normalization (toLowerCase().trim()) is applied before querying the database.
**Group 2: API Key Management (MAIN_ADMIN Only)**
## POST /generate-key-pair
Success: Should generate a unique publicKey (UUID-based) and a secretKey (random bytes).
Security: Should hash the secret key using SHA-256 before saving to the database.
Conflict: Should return 409 if keys already exist for the company, preventing accidental overwriting.
Integrity: Should ensure the secretKey is returned to the user exactly once during the creation response.
## GET /get-public-key
Success: Should return the publicKey associated with the authenticated company.
Not Found: Should return 400 if no keys have been generated yet.
## DELETE /delete-key-pair
Success: Should remove the record from APIKeysAuth for the company.
Validation: Should return 400 if attempting to delete non-existent keys.
Side Effects: Should verify that after deletion, the keys can no longer be retrieved or used for API requests.
**Group 3: Middleware & Security Observations**
authenticateJWT: Should verify that the token signature is valid and the exp (expiration) claim is not in the past.
allowedRoles: Should ensure that only users with the MAIN_ADMIN role can access the key-pair generation/deletion endpoints.
Role Enforcement: Verify that a standard MANAGER or AGENT (if those roles had access) is rejected from key-pair management endpoints.


# AGENT DASHBOARD 
## GET /get-agent-day-insights
Success: Should return the full metrics object containing seeds, leads, sales, talkTime, and state scores (energy, focus, motivation).
Goal Logic: Should correctly fetch the GoalsAssignation for the specific date and companyId.
Percentage Calculation: Should calculate individual percentages for each metric against the assigned goal (e.g., seeds / goalSeeds) and return a capped average currentStreak (0-100).
Defaulting: Should return a currentStreak of 100 if no GoalsAssignation exists for the requested day.
Aggregations: Should correctly sum durationSeconds for talkTime and count total calls.
Deep Calls: Should accurately count calls where durationSeconds >= 300.
State Sync: Should fetch the latest AgentState recorded for the agent on that specific day.
**Group 2: Agent Weekly Growth**
##GET /get-agent-weekly-growth
Success: Should return an array of 7 objects (Mon–Sun) regardless of whether data exists for those days.
Growth Formula: Should strictly apply the weighted calculation: growth = seeds + (leads*2) + (sales*3) + calls + (deepCalls*2).
Date Range Logic: Should correctly identify the startOfWeek (Monday) based on the input date and iterate through exactly 7 days.
Boundary Precision: Should ensure each day's data is isolated using 00:00:00.000 to 23:59:59.999 UTC boundaries.
Edge Case: Should return 0 growth for days with no recorded activities.
**Group 3: Agent State & Schedule**
## POST /register-agent-state
Success: Should create a new AgentState record linked to the agentId.
Validation: Should return an error if energy, focus, or motivation scores are outside the 0-10 range.
Correlation: Should correctly identify the agentId from the authenticated userId.
## GET /get-assigned-schema
Success: Should return the Schema and its blocks (ordered by startMinutesFromMidnight ascending) for the requested date.
NotFound: Should return null if no schema is assigned to that date for the agent's company.
Scoping: Should ensure the schema fetched corresponds to the company the agent belongs to.


# Webhook 
Success: Should return 200 and the internal callId when a valid last_call_id is provided.
Validation: Should return 400 if the last_call_id query parameter is missing.
Security: Should return 500 (or 401/403 depending on your middleware) if companyId is not present in the request user object.
Error Resilience: Should return 500 if the handleCallWebhook service throws an error (e.g., external API is down).
**handleCallWebhook (Service Logic)**
**External Integration & Auth**
Auth Check: Should throw "No LeadDesk Auth String" if the company hasn't configured their LeadDesk credentials.
API Interaction: Should correctly pass the auth string and last_call_id as parameters to the LeadDesk API.
Data Mapping: Should correctly identify the Agent by matching the LeadDesk agent_id with the agentServiceIdentifier in the AgentToThird table.
Agent Validation
Inactive Agent: Should throw an error if the LeadDesk agent_id belongs to an agent whose user status is not ACTIVE.
Missing Relation: Should throw an error if the LeadDesk agent_id does not exist in the local AgentToThird mapping.
Database Synchronization (The Transaction)
Callee Upsert: Should create a new Callee if the phone number is new, or increment totalAttempts if they already exist.
Agent-Callee Link: Should correctly track the relationship between a specific agent and a specific phone number, incrementing their unique interaction counter.
Call Creation: Should correctly map LeadDesk fields (talk_start, talk_end, talk_time) to the internal Call record.
Date Parsing: Should ensure parseToUTC correctly handles the "YYYY-MM-DD HH:MM:SS" format without applying local timezone offsets.
Day Mapping: Should correctly map the talk_start date to the corresponding WEEK_DAYS enum (e.g., verifying a Monday date returns MONDAY).
Funnel Event Logic (The "Brain")
SEED Event: Should create a SEED event if it is the first time this specific agent has called this specific callee (totalAttemps == 1).
LEAD Event: Should create a LEAD event if the agent has called this callee more than once (totalAttemps > 1).
SALE Event: Should create a SALE event (in addition to SEED/LEAD) if the LeadDesk data contains one or more order_ids.
Multi-Event: Should verify that a single call can generate both a LEAD and a SALE simultaneously if the conditions are met.
Edge Cases & Integrity
Transaction Rollback: Should verify that if the funnelEvent creation fails, the Call and Callee updates are rolled back.
Missing Time: Should verify that parseToUTC defaults to 00:00:00 if LeadDesk sends a date-only string.
Lowercasing/Formatting: Should ensure phone number matching is consistent (e.g., handling potential spaces or formatting in ld.number).


