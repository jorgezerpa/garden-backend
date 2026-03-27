

# Project developer guide

## Index
- overview
- deployment guide
- timezones management
- Formulas and calculations
- To do list
- Already builded

### Overview
The project is divided in 4 main clusters:
- Frontend application -> NextJS and Tailwind
- Backend api -> NodeJS+express and PrismaORM
- Database -> PostgreSQL
- File Storage -> AWS S3 storage

The frontend application and the backend API are deployed in Vercel. The PostgreSQL database is setted up with Supabase. 
This tools where choosen to keep simplicity and speed-of-changes during the earlier developer phase of the project. 
In near future, is very probable that the project will need to be migrated to a cloud service provider for better scalability and management. For example, using Amazon Web Services:
- Use ECR and App Runner for the backend API
- Amplify Hosting, Amazon ECS (Fargate) or App runner for the frontend
- Aurora And RDS for Database 
- S3 for file storage (already in use) 

Also, all the authentication and authorization system is based on a classic user/password flow, stored in our own database. This is simple to setup and manage, so we choose it during this earlier development phase, **however**, is by far not the most secure option, so is almost an obligation to migrate the project's auth logic to a third-party auth provider as soon as possible (like auth0, Clerk, Firebase authentication or supabase auth).



### Deployment guide
Let's start with the Database setup.

First, configure the `DATABASE_URL` environment variable. 
Your URL should follow this format `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`. To get such address, you must create a new Supabase project, and get the URL from the project's dashboard. 
 
Second, Deploy the Schema (Create Tables).
On production, you should **NEVER** use `npx prisma migrate dev`. That command is designed for development and may attempt to reset the database and possibly erase existant data. Instead, use migrate deploy:
`npx prisma migrate deploy`
This command compares the migrations folder in your project to the database and applies any pending migrations or stops the operation if detects danger (like data loss due to tables modification, creation of required columns without default values, etc). 

(Optional) Seed data generation
Add the next field to your prisma.config under the `migrations` field:
```typescript
    seed: "tsx [seedsFolder]/[seedFile].ts"
```

An example of a seed file:
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
    },
  })
  console.log({ user })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

Finally, run the command `npx prisma db seed` to execute the seed. 


### Timezones management
Every timestamp in the database is stored in UTC-0 time, following next rules:
- By now, we work only with Europe/Amsterdam timezone to perform the convertions.
- When the LeadDesk triggers the webhook, it sends a WallTime formated date string. This date/hour is shifted from Europe/Amsterdam timezone to UTC-0, and that result is the one stored on the database. 
- Every endpoint that accepts a time range (almost any endpoint related with datavis, agent dashboard and office-display) is designed to receive these date parameters in UTC-0. This means that the frontend is the one in charge of perform the conversion from the user timezone to UTC-0. This gives flexibility to the system to adapt to different timezones, and, in future (if necessary) allow the user to select a timezone to work with (so the system can be used from any part of the world). 
- The results of the endpoints mentioned in the previous point, return the date/hour adapted to the user's timezone, for better and simpler visualization. 

Here are a couple of example of all the aboves points for better understanding:

**When a new call is stored:**
1. LeadDesk triggers the webhook for a call with date `2026-03-27 10:23:43.223`. This time is assumed to be in `Europe/Amsterdam` timezone
2. The system converts this date to the correspondant UTC absolute point in time. Since `Europe/Amsterdam` is in `UTC+1` (variates depending on DST) the receive call date `2026-03-27 10:23:43.223` is converted to `2026-03-27T09:23:43.223Z` considering that when in UTC+1 the hour was is X, the equivalent hour in UTC-0 time is X-1. 

**When we want to query date:**
1. From the frontend, a manager wants to query the calls' data that happend between 2026-03-01 and 2026-03-31 (the whole march month)
2. On the date pickers, the manager select such dates
3. Under the hood, before this query is sended to the api, this dates are converted from `Europe/Amsterdam` to UTC time. So, instead of send the boundaries `2026-03-01T00:00:00.000` as from date, and `2026-03-31T23:59:59.999` as the to date, we perform the convertion to UTC, and send `2026-02-28T23:00:00.000` and `2026-03-01T22:59:59.999` correspondly, because this is the equivalent in UTC to the start and end of the month for the selected timezone.  

NOTICE: By now, the used timezone in frontend and backend is hardcoded to `Europe/Amsterdam`. Also this is stored by default in the database entity `Company.LeadDeskCustomData.IANATimeZone`. So, if in the future is required to work with more timezones (i.e the product extends to more Europe countries) it will be relatively simple to allow the user to pick their desired timezones from the admin dashboard. 



### Formulas and calculations

**Agent Weekly Growth**
For each day of the weeek, a weighted average is calculated considering the seeds, leads, sales, calls and deep calls performed by the agent. The resulting `WeekGrowth` is a vector of length 7 where each item represents the `DayGrowth` result for each week day `Dn`.
```
DayGrowth = seeds + (leads * 2) + (sales * 3) + number_of_calls + (number_of_deep_calls * 2);
```
```
WeekGrowth = [DayGrowth(D1), DayGrowth(D2), ... , DayGrowth(DN), ... , DayGrowth(D7)]
```

**Current Agent Streak**
Calculate the completion ratio of seeds, leads, sales and number of calls related with the current day's assigned goals. Then we take the normal average of the the ratios and scale it to a range between 0 and 100, to get the current streak for the day
    
```
seedsRatio = (currentDaySeeds / goalSeeds),
leadsRatio = (currentDayLeads / goalLeads),
salesRatio = (currentDaySales / goalSales),
callsRatio = (currentDayCalls / goalCalls),
```
```
currentDayStreak = ( (seedsRatio + leadsRatio + salesRatio + callsRatio)/4 ) * 100
```    
NOTICE: On the code, the ratio values are capped to be less or equal than 100. 
    
**Team heat**
A couple considerations:
- Relative vs. Absolute: A team of 50 making 100 calls is "cold," but a team of 2 making 100 calls is "on fire." By using the `TemporalGoals` table, the score is always relative to what the Manager expected for that day and group of agents.
- Weighting: I've assigned higher weights to Sales (30%) and Seeds (25%) because those are high-value events. Raw Call Count (10%) matters less than the quality of the outcomes.
- The "Cap": I capped individual metrics at 1.2 (120%). This prevents a massive over-performance in just one area (like making 1,000 short calls) from artificially inflating the heat score to 100 if no sales were made.

The Heat Score is calculated as a weighted average of performance percentages across five key metrics. Each metric's progress is calculated by dividing the actual performance by the target, capped at 120% to ensure one metric doesn't overshadow the others.

The final score is expressed as a percentage:
$$HeatScore = \min\left( \sum_{i=1}^{n} (Progress_i \times Weight_i) \times 100, 100 \right)$$

Where the specific components are:
Metric (i)Weight (Wi​)Progress Calculation (Pi​)Sales0.30$\min(\frac{ActualSales}{TargetSales}, 1.2)$Seeds0.25$\min(\frac{ActualSeeds}{TargetSeeds}, 1.2)$Talk Time0.20$\min(\frac{ActualMinutes}{TargetMinutes}, 1.2)$Leads0.15$\min(\frac{ActualLeads}{TargetLeads}, 1.2)$Calls0.10$\min(\frac{ActualCalls}{TargetCalls}, 1.2)$

**Agents Ranking on office display screen**
The index of each agent is calculated by ordering in descending order the `performanceScore` of each agent, calculated as follows:
```
performanceScore = (CallingTime + Seeds + Sales) / 3
```


## To Do list 
- Choose a payment gateway provider (like Stripe) and implement it on the system
- Implement a secure third-party auth provider
- (only if migrate to cloud) Dockerize frontend and backend for better/secure deployments and updates flows
- define formulas to show/detect events for office display screen -> for example, we must determine where to send a "streak" or "on fire" animation trigger
- Implement real time updates for the office display screen, every time a new call is recorded -> by now it re-fetches the info every X seconds to refresh data  
- Implement weekly automated cron job to update agent's level based on previous week performance. OR we can allow the the managers to trigger this updates whenever they want from the admin dashboard
- Make UI and routes for visualization of historical level of agents from the admin dashboard.
- Implement `download .CSV` button on the admin dashboard to allow managers to export their data

## Already builded
- Full company/managers/users registration flow
- Full LeadDesk webhook integration flow
- Agents and managers CRUD
- Goals and goals assignation CRUD
- Block schemas and block schemas assignation CRUD
- Long term data visualization 
- Agents comparisson table 
- Agent dashboard that allows each agent to see their current day performance, current week growth, assigned block schema, goals completion and submit their subjetive feeling every time they want. 
- Office display big screen, that renders ranking lists of agents based on the current day and current week performance. And an indicator of the current heat of the team for the current day.  