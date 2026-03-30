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
- [DONE] create endpoint and frontend view to shared team performance for big screen

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
- [DONE] Create endpoint that retrieve the next information (Daily and weekly):
    • [DONE] Profile picture (upload per agent)
    • [DONE] Name of the agent
    • [DONE] Calling time
    • [DONE] Seeds (new callback appointments from calls longer than 5 minutes)
    • [DONE] Amount of deals (sales)
    • A "special_status" field, that returns a SpecialStatus, for special status (for example: streak or “on fire”). Default is NONE.
    • [DONE] Current AgentLevel.level value
- [DONE] Build UI of shared screen
- [DONE] backend -> logic to handle profile images -> upload from agent profile and render on shared screen
- [DONE] Add agent profile img to shared screen endpoint
- [DONE] add page on agent profile to upload profile image 
- [DONE] Implement page role permissions on frontend (and correspondant redirections)
- [DONE] Make all frontend and backend and db work with UTC time, so I can apply masks if needed. 
- [DONE] Write team heat calc endpoint and connect to frontend
- Dockerize project and deploy on AWS 
- define formulas for "streak", "on fire", etc
- Implement real time updates of shared-screen -> by now it fetches every 10s to refresh data  
- Implement weekly cron job logic to update agent's level.Make UI and routes for historical level fetching

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
Timezones management:
1. Frontend uses toIsoString which automatically converts time to utc time
2. After sanitization and basic checks, when I store a value on my DB, I should use the exact date sended from the frontend, aka not shift to any other timezone, because i should assume the sended date was ".toIsoString"fied before sending to me, so is in UTC< but converted to this by the browser which does it perfectly. 
3. When I need data grouped/selected by a from-to date for example, I should apply a shift, like receive from the call the client timezone, and use it to calculate the dates

A small cavite:
The only "danger" is if a user’s device clock is manually set to the wrong time. If their computer thinks it's 2024, .toISOString() will send a 2024 timestamp.

The Fix: For critical things like "Transaction Created At," always use the server's time (default(now()) in Prisma). Use the frontend-provided time only for things the user chooses, like "Schedule this meeting for X time."


affected routes:
**should send IANA time zone in params to make convertion**
- dataVis
- SharedScreen
**should use stored "webhookTimeZoneIANA" variable to calculate shifting to UTC so aboves convertion does works differently for each time**
- leadDeskWebHook

# NEW PLAN
- all routes receives the full ISO 8601 date, sended from the frontend. SO front dates are the only source of truth (of course front should make the calculation and always send the correspondant utc time to the dates they what to query)
- for example, if I'm in UTC-4, and I want to query 2026-10-10 data, I should send -> from "2026-10-10T04:00:00:00Z" and "2026-10-11T04:00:00:00Z"
- as rule -> ALL QUERY INFO ENDPOINTS SHOULD RECEIVE FROM AND TO DATES, NOT A SINGLE DATE VALUE (except for future schedules like block schedules and goals schedules)

- for sums/avg/etc: select date -> convert to iso utc -> send that to api -> render values
- for data grouped by days, weeks, etc: select date -> convert to iso utc -> send it and the selected IANA -> back converts dates to the IANA and use IANA on queries

NOTE:
- frontend ALWAYS send dates in utc for "affected routes". backend converts it when necessary



-------------
Final docs report on code:
- Backend expect to always receive UTC dates, so frontend should make conversion from desired UTC to another when fetch datavis, agent dashboard and office display data. 
- The endpoint that returns the last date of registered data, returns the timezoned hour



# NOTES ON SSE SCALABILITY
In 2026, the performance of a single-instance Node.js server for SSE is remarkably high. Because Node.js is event-driven and non-blocking, it doesn't "spawn a thread" for every user like older servers (Apache) used to. Instead, it just keeps a list of open file descriptors.

Here is the "Objective Data" you need to plan your infrastructure.

---

## 📊 The "Break-Even" Numbers
Assuming a standard **2-Core CPU / 4GB RAM** VPS (like an entry-level AWS EC2 or DigitalOcean Droplet):

| Metric | Estimated Limit (Single Instance) | Why? |
| :--- | :--- | :--- |
| **Concurrent Connections** | **~10,000 to 15,000** | Each SSE connection costs ~20KB to 50KB of RAM. 10k users ≈ 500MB RAM. |
| **Events per Second** | **~2,000+** | The bottleneck isn't the number of users, but how many messages you broadcast per second. |
| **Max Listeners Warning** | **10 (Default)** | Node warns you at 11 listeners to prevent leaks. **You must increase this** (see below). |

---

## 🧪 When should you actually migrate?
You don't migrate because of "user count"; you migrate when you hit these three specific walls:

### Wall 1: The "Max Listeners" Warning
By default, an `EventEmitter` thinks having more than 10 listeners on one event is a memory leak. In your case, it’s not—it’s just 100 users. 
**The Fix:** Increase the limit in your `eventHub.ts`.
```typescript
const eventHub = new EventEmitter();
eventHub.setMaxListeners(0); // 0 means "unlimited"
```

### Wall 2: High Availability (The "Red-Phone" Rule)
If your server crashes or you need to update your code, **everyone** disconnects. 
* **Migration Trigger:** When "Zero Downtime" becomes a business requirement. You’ll need two servers behind a Load Balancer.
* **The Catch:** Once you have two servers, your `eventHub` fails (Server A doesn't know what Server B is doing). This is the **exact moment** you need **Redis Pub/Sub**.

### Wall 3: CPU Pressure from Serializing
Every time you `res.write(JSON.stringify(data))`, Node uses a tiny bit of CPU. If you have 10,000 users and you send an update to **all** of them every second, your CPU will spike.
* **Migration Trigger:** If your CPU usage stays above 70% consistently.

---

## 🛠️ Performance Checklist
To ensure your single server lasts as long as possible (easily up to 5,000+ connections):

1.  **Enable HTTP/2:** This is the most important. It allows the browser to handle many streams over one connection and is much more efficient for the server.
2.  **OS Limits (ulimit):** Linux defaults to 1,024 "open files" per process. Since every SSE connection is a "file," your server will crash at 1,025 users. 
    * **Fix:** Increase the `ulimit -n` on your server to `65535`.
3.  **Heartbeats:** Send a `: keep-alive\n\n` comment every 30 seconds. This clears out "zombie" connections that dropped without telling the server.

### Recommendation
For **100 to 1,000 users**, your current `eventHub` singleton is perfect and arguably better/faster than Redis because there’s no network latency between the hub and the route. Stick with it until you need a second server instance for reliability.



**Would you like me to provide the "Redis Pub/Sub" version of your `eventHub.ts` now so you have it ready for when you decide to scale?**



