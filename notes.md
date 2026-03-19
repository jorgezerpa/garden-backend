npx prisma migrate dev --name init
npx prisma migrate deploy
npx prisma db push --accept-data-loss

docker compose up -d
docker compose stop: Pauses the DB. Data is kept.
docker compose down: Removes the container. Data is still kept because of the volumes setting.
docker compose down -v: Removes everything, including the data. Use this if you want a completely fresh start.


## Todos
- [DONE] Implement authentication middleware and write specific tests
- [DONE] Implement leaddesk webhook authentication and api keys generation  
- [DONE] convert previous point into a middleware
- [DONE] all routes "companyId", "creator", etc params, should be taken from the auth token via middleware 
- [DONE] create "generate api key" page on admin UI
- [DONE] Modify tests to work with the auth system
- [DONE] Connect api to frontend
- [DONE] Track in database the n of times a SPECIFIC AGENT calls a callee to count "waterings"
- [DONE] Create table to track goals assignation to a specific period of time 
- [DONE] Not send the keys on register, instead, add an endpoint to generate them specifically for each app. (leaddesk, etc) and make the frontend ui for this
- [DONE]some UI component does not seems okay in both modes light-dark
- [DONE] can not just delete users because calls will be like Batman (no parents) -> Implement a pause flag and filter on the query
- [DONE] create endpoint for user comparisson page 
- [DONE] add inputs to get latest data date
- [DONE] modify blocks schemas. Now only 1 type -> daily
- [DONE] add "considered days" filters to datavis per block 
- [DONE] Build goals assignation UI
- [DONE] Modify blocks schema -> remove TYPE no is only daily. And build assignation db and logic, and build UI for this 
- [DONE] Confusing userId with agentId/managerId in some parts 
- [DONE]  schema routes unprotected by roles 
- [DONE] Store Leaddesk AUTH token (32 bytes) to being able to call the leaddesk API. -> ALSO, add interface for this, and this new step on the connection guide 
- [DONE] create new conversion funnel endpoint and adapt frontend graph to it 
- [DONE] Use the leaddesk auth token to fetch for call data on webhook 
- [DONE] fix Date() displacements (in back)
- [DONE] rewrite test suites for routes and write integration tests 
- [DONE] fix Date() displacements (in front)
- [NO_NEEDED_BY_NOW] Create endpoint to fetch all specific user data to uncomment sections on agent handling page 
- [DONE] Tests for datavis and agent dashboard
- [DONE] get_agents_comparisson is not calculating goals scoring
- create endpoint and frontend view to shared team performance for big screen
- Record video to ask about funnel events setting -> lead desk doesnt send me such info -> i have only raw indexeses and do not now what they mean 

## REMEMBER
- Now funnel is different, you can calculate all using the current webhook -> seeds, watering, harvest  


## Deployment info
- Actually, back and front deployed on vercel. PostgreDB deployed on Supabase. 
- Backend uses env variables to set DB url 
- Frontend uses env variables to set API url


# New Requirements
- [DONE] Modify database structure to track agent_level (gold, silver, bronze -> 1,2,3) and historical counting (how many weeks has being in a certain level)
- [DONE] Modify routes to create a initial agentLevel row for the agent
- [DONE] Modify tests to check initial agentLevel row for the agent
- [DONE] Implement routes to input seeds/sales ids on leaddesk and use them on the webhook handler. 
- Modify the db to track the team "Heat score" -> daily and in a specific time window -> Create a daily team-heat score that updates every day with a pg-cron -> so -> write and test the stored-procedure
- Create endpoint that retrieve the next information (Daily and weekly):
    • Profile picture (upload per agent)
    • Name of the agent
    • Calling time
    • Seeds (new callback appointments from calls longer than 5 minutes)
    • Amount of deals (sales)
    • A "special_status" field, that returns a SpecialStatus, for special status (for example: streak or “on fire”). Default is NONE.
    • Current AgentLevel.level value
- Write and test the stored-procedure to run with pg-cron (use txs for safe-fail-rollbacks, run a backup before update maybe)
- define formulas for "streak", "on fire", etc
- define formulas for order the users on the shared dashboard -> posibbly a weigthed avg

## Ranking system 
**Important note on seeds: these must be new callback appointments, not follow-ups with existing customers. If correct, this should be possible to implement using LeadDesk data.**
- 3 main factors -> calling time, New callback appointments (seeds) from calls longer than 5 minutes and deals. Equal weight (33.33%).
- On the ranking display, show:
    • Profile picture (upload per agent)
    • Name of the agent
    • Calling time
    • Seeds (new callback appointments from calls longer than 5 minutes)
    • Amount of deals
    • A small visual indicator for special status (for example: streak or “on fire”). We can define the exact criteria for this later.
    • Daily and weekly tracking 

- Gold, Silver, Bronze status system
    • Agents with more than 12.5 hours calling time per week achieve Gold status (2.5h per day)
    • Agents below this go to Silver
    • After that Bronze
    • A historical overview (how many weeks an agent has been Gold / Silver / Bronze) should be visible for manager dashboard 

- For the Team Heat Meter:
    • Track the team heat score per day
    • Have fixed time windows (for example 09:00 – 17:00)
    • Reset the heat score daily within that timeframe

------------------
Seed → callback or meaningful first step based on LeadDesk outcome -> FIRST  NEW callback appointments after a long call (5 minutes)
Watering → follow-up calls with the same lead over time -> follow ups
Harvest → successful deal or sale outcome -> SALE



What I'm doing right now is:
- Seed -> First call to a number
- Watering (lead) -> every next call after the first one from an agent to a number, is considered "watering"
- Sale -> When the call's "order_ids" array is not empty

What is supposed to be:
- Seed -> First callback appointment after a call longer than 5 minutes 
- Watering (lead) -> every next call after the first one from an agent to a number, is considered "watering"
- Sale -> When the call's "order_ids" array is not empty

So, let's get into the Seeds:
To a call be considered a "seed" it needs to be longer than 5 minutes (I have this information from the webhook) AND should end up with a callback appointment. 
So, I need a way to know that a call finished with an appointment call. 

Analizing the webhook response, I have the next options:
- The webhook sends a "reason_id", which can be used to call 
- The webhook sends a "last_call_id", which can be used to fetch call's detailed information. In this detailed info is a field "call_ending_reason", which is the id of a reason. So, I suppose that this corresponds to reasons like "callback appointment", "sale", etc. If that's the case, I can use such field to know if a call ended up in a callback appointment. But, we will need the admin the set on the dashboard the meaning of one of this reason ids. For example, we can make a new tab where they see inputs like "Seed reason ids", so anytime the webhook calls us, we compare the call_ending_reason received against this inputs to know if a callback was appointed. 
So for this to work:
- This "reasons" are standard/constant on any leadDesk subscription? or every company can create it's own reasons? 

----
Hi Mike! alsmost all is perfectly suitable except one think:

You mentioned this: "Important note on seeds: these must be new callback appointments, not follow-ups with existing customers. If correct, this should be possible to implement using LeadDesk data."

So, what I'm making right now to consider if a call is a seed is: The databse is tracking the number of calls from an agent to a number, so if it is the first call from that agent to that number, that counts as a seed. 

Now, you tell me that, for a call to be considered a seed, it has to 1) Be longer than 5 minutes (AKA be a long call) 2) Result in a callback appointment. 
So, reading the Leaddesk docs, It mentions this (the highlighted text in blue on the image). 
I suppose that this "outcome" that the agent assigns is what will let use know if a callback was appointed.
If that's true,  I have the next plan:
1. The webhook is triggered, and sends us a "last_call_id" parameter, which can be used to fetch call's detailed information (we are already fetching this data)
2. In this detailed info, is a field "call_ending_reason", which I suppose, is the id of the outcome assigned to the call.
3. So, I can use such field to know if a call ended up in a callback appointment

The problem, is that we have no way to know to what reason that id corresponds (for example, it could correspond to "callback appointment", "sale", "Call ended by callee", etc)

So, to apply this, we will need the admin the set on the dashboard the meaning of each one of this reason ids. For example, we can make a new tab where they see inputs like "Seed reason ids", so anytime the webhook calls us, we compare the call_ending_reason received against this inputs to know if a callback was appointed. 

So I need to confirm that this "call_ending_reason" corresponds to the "outcome" assigned to the call, and if this outcome tells us if a call ended up with a callback appointment. 
