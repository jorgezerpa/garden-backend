src/
├── controllers/    # Express req/res handling (entry points)
├── services/       # Business logic (where the "magic" happens)
├── middleware/     # Auth, validation, error handling
├── routes/         # Route definitions mapping to controllers
├── types/          # Shared TypeScript interfaces
└── index.ts        # App entry point




------------

I have the next basic entities: 

- Company: The callcenter company
- Agents: The employees of the callcenter that perform the calls. 
- Teams: a certain group of employees
- Managers: The admins of the callcenter team (you can see them as gerents, supervisors, etc)
- company-configuration: a series of companies specific fields, setted by the manager. 
- Block-configuration: Blocks are timegaps in which a working turn is divided. For example, an 8h turn can be divided within 5 blocks of 45 minutes with 15 minutes rest. Or only 8 consecutive blocks of 1 hour. This table should store multiple block schemas that the manager can CRUD. A block can be either a "working" or a "resting" block (like lunch).

(this is what I can think of, probably you will have to create new entities depending on what written below, for example, maybe a "call" entity, a "phoneNumber" entity who tracks the historial/funnel-state of a specific number, etc. You have total freedom here to create what you consider necesary.)


the basic relationships are:
- A company can have many managers, many users, many teams
- A team has many agents. Notice: a "team" is just a way the manager have to group agents easily and bulk assign to them block schedules. But you should also directly relate block schedules with specific users per day. 
- Every company has only one company-configuration
- a manager has many teams 


The system needs to track a series of specific parameters (KPIs and others) divided in multiple categories:

A. Activity Metrics (Core Call Performance)
Per agent, per day:
• Total effective talk time
• Number of logged calls
• Number of calls longer than 5 minutes
• Average call duration
• Calls per hour
• Active time vs idle time
• Long call ratio
These metrics establish baseline productivity.

B. Block-Based Performance Tracking
Because the system uses defined calling blocks, each block becomes a performance container. A block is a specified timelaps in which the working day is divided (in example, a 8h turn for agent can have 8 blocks of 45min). Blocks can variate for the same company, because they probably have different turns/agents groups, this blocks are stored on the company config file. Also, 
Track per block:
• Start time / end time
• Talk time inside block
• Calls inside block
• Seeds logged inside block
• Focus / energy score (if used)
• Completion rate of block
This allows the company to answer:
• Which blocks are most productive?
• When is performance strongest?
• Where do agents lose consistency?


C. Manual Progress Logging Data (Core Behavioral Layer)
Manual inputs:
• Seeds -> Agents have a list of numbers to call, once a call is performed to a number (person), it becames a seed.
• Callbacks -> The objetive of a first call is the agend a new callback call to talk in detail about the sale. Once this new call is performed, it counts as a callback.
• Leads -> People who is almost near to buy, or that accepts a kind of lead magnet (a free ebook, a cheaper version of the product, a free trail period, etc)
• Sales -> every time a purchase is made (directly, or after the person (number) goes to previous steps funnel)
These should be timestamped and linked to:
• Agent
• Day
• Block
• Time
From this, the system can calculate:
• Seed per day
• Seed per block
• Callback ratio
• Lead conversion ratio
• Seed-to-sale ratio
• Daily consistency trend
This is a unique data layer that traditional dialers do not provide.


D. Time-Based Pattern Analysis
Track performance across:
• Hour of day
• Day of week
• Week of month
• Month of year
• Seasonal trends
Insights:
• Best performing hours
• Weakest periods
• Long-term growth patterns
• Burnout signals

E. Behavioral & Motivation Insights (Optional Expansion)
If mindset logging is used:
• Energy per block
• Focus per block
• Correlation: energy ↔ productivity
• Correlation: motivation ↔ long calls
This creates a behavioral performance profile.


So, I think this will be the better approach to manage this data:
- We have a `dayLog` table, that records 

--- ----------------------
entities:
- companies
- managers 
- agents
- calls 
- dayLogs
--
- Block schemas and

relations:
- A company has many managers and many agents and many calls 
- A agent has many calls 
- An agent has many dayLogs

How does it work:
- Each time a call is performed, we register it and relate it to a certain agent. 
- Every day, an agent has a new dayLog row. This row is where we store the next stats:
    A. Activity Metrics (Core Call Performance):
        • Total effective talk time
        • Number of logged calls
        • Number of calls longer than 5 minutes
        • Average call duration
        • Calls per hour
        • Active time vs idle time
        • Long call ratio


-------------
-------------
-------------
-------------
This is a database that will record useful data for callcenters, related with calls and agents performance. 

When I fetch the data, I should by able to select it as follows:
- Per agent, per time 
- Per agent, per block 
- Per team, per time 
- Per team, per block 
- Per all agents per time
- Per All Agents per block

What data does this have to track?:
--- Objective values
- Total effective talk time
- Number of logged calls (even if not answered, is recorded)
- Number of calls longer than 5 minute
- Average call duration
- Active time vs idle time
- Long call ratio (long calls/total calls)
--- Manual Inputs
- Seeds -> Agents have a list of numbers to call, once a call is performed to a number (person), it becames a seed.
- Callbacks -> The objetive of a first call is the agend a new callback call to talk in detail about the sale. Once this new call is performed, it counts as a callback.
- Leads -> People who is almost near to buy, or that accepts a kind of lead magnet (a free ebook, a cheaper version of the product, a free trail period, etc)
- Sales -> every time a purchase is made (directly, or after the person (number) goes to previous steps funnel)
These should be timestamped and linked to:
--- Agent feelings
- Energy
- Focus 
- Motivation

For example, I'm gonna make queries to get:
- total effective talk time for of an agent in the last 5 days
- Avg. call duration of team A in the blocks inside the range 8am to 12pm of 12 of october of 2024
- Long call ratio of all the agents during today
(Notice this are examples of query only 1 property, but in reality I will query multiple props at once, maybe we have to prepare some db views, but dont focus on this by now)


Now, theres a tricky part, blocks are not fixed timelaps, instead, are irregular time schedules created by manager per day or session, and can be exposed to "hot updates" (AKA modifications to block schema while such schema is running.) 
To handle this, we will proceed as follows:
- each block has a start and end timestamp and could be "working blocks" or "rest blocks"
- A manager can create many block schemas (this is another table). Also assign to it a name/identifier. Also manager can assign this schemas to a specific team of agent to for a certain day. Can also assign current/future days, like the sunday manager sits on computer and says "ok, I'm gonna assign the schemas for the teams for the next week" or "Today we have some changes, so I will modify today schema". Also, past days cannot be modified. And for the same day, we can not create/assign blocks to past times, only for future.
- There will be a table "blocksPerAgent" -> every time a user performs a call, we check block schedule the user has assigned for that day, and using "now() time" we relate the call to the correspondant block. If no block schedule is assigned, we register it with a tag "extraBlock" or "extraTime" or something like that.  
- If the block schema is updated during the day (example we are in a middle block of the schema) then it will not affect anything since the previous blocks where already recorded on the blocksPerAgent Table.
- A similar logic will be used for a table "blocksPerTeam" and "Blocks" ("blocks per company") 
 -> @IMPORTANT we should handle block joins some way, for example, if 2 blocks matches after modifications, what we should do? I think in the next solution: not allow to modify past blocks or current blocks in this hot update mode, only future blocks and starting time of the very next block have to match the end time of the actual one. Also, instead of "modify the block" each hot modification creates a brand new blocks schema and assigns it to the real correspondant group, also we should flag this new blocks schema row with a "isHotModification" boolean column, and if this is true, a fk for "originalSchema". 

 Considering all this, I think this are the entities/tables we need:
 - Company: stores basic company data like name, register date, etc.
 - Manager: gerents, supervisors, etc in charge of the teams and agents
 - team: group of agents
 - agent: employees which perform calls to callees
 - Call: this tracks important properties of the call like duration, caller, callee number, etc
 - Callee: phone number used as id, and registers number of times called (total) and for each agent. 
 - blockSchema: pre-defined block schemas.
 - block -> tracks the block general properties (for all the company)
 - blockPerTeam: tracks the block properties/performance of a team 
 - blockPerAgent: tracks the block props/performance for a team

Relations:
- A Company has many managers, many teams and many agents many calls and many callees
- Team-agents is 1 to many
- agents-call is 1 to many
- call to callee is: 1 call is related to 1 callee, but 1 callee can be related to calls. 
- block, blockPerTeam and blockPerAgent are separated entities, should be updated individually. Also, from the name you can infer the correspondant relationship. 

Give me a better report of this. I want to have a nice textual description about what this database will be, so imporve the aboves description. I want to be more detailed and specific about relations, also feel free to improve/create tables, entities and structures. Try to improve it to try to have a normalized database, that follows nf1,2,3.