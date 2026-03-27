
-----

# Project Guide

## Index

1.  [Overview](https://www.google.com/search?q=%23overview)
2.  [Deployment Guide](https://www.google.com/search?q=%23deployment-guide)
3.  [Timezone Management](https://www.google.com/search?q=%23timezone-management)
4.  [Formulas and Calculations](https://www.google.com/search?q=%23formulas-and-calculations)
5.  [To-Do List](https://www.google.com/search?q=%23to-do-list)
6.  [Completed Features](https://www.google.com/search?q=%23completed-features)

-----

## Overview

The project is architected into four primary clusters:

  * **Frontend Application:** Next.js and Tailwind CSS.
  * **Backend API:** Node.js, Express, and Prisma ORM.
  * **Database:** PostgreSQL (via Supabase).
  * **File Storage:** AWS S3.

Currently, the frontend and backend are deployed on **Vercel**. These tools were selected to prioritize simplicity and development velocity during the MVP phase.

### Future Infrastructure Migration

As the project scales, we anticipate a migration to a dedicated cloud provider (AWS). The proposed architecture includes:

  * **Backend API:** Amazon ECR and App Runner.
  * **Frontend:** AWS Amplify, Amazon ECS (Fargate), or App Runner.
  * **Database:** Amazon Aurora or RDS.
  * **Storage:** Existing S3 integration.

> [\!WARNING]
> **Authentication Security:** The current system uses a basic internal user/password flow. To enhance security, we must migrate to a third-party provider (e.g., Auth0, Clerk, Firebase, or Supabase Auth) as soon as possible.

-----

## Deployment Guide

### 1\. Database Setup

Configure the `DATABASE_URL` environment variable using the following format:
`postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`
*Fetch these credentials from your Supabase project dashboard.*

### 2\. Schema Deployment

**Never** use `npx prisma migrate dev` in production. This command is for local development and may trigger database resets. Instead, use:

```bash
npx prisma migrate deploy
```

This ensures pending migrations are applied safely without data loss.

### 3\. Seed Data (Optional)

To enable automated seeding, add the following to your `prisma.config` under the `migrations` field:

```typescript
seed: "tsx [seedsFolder]/[seedFile].ts"
```

**Example Seed Script:**

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
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

Run the seed using: `npx prisma db seed`.

-----

## Timezone Management

All database timestamps are stored in **UTC-0**. We currently follow these synchronization rules:

  * **Standard Timezone:** The system currently defaults to `Europe/Amsterdam` for conversions.
  * **Data Ingestion:** When LeadDesk triggers a webhook, it sends a "WallTime" date string. This value is shifted from `Europe/Amsterdam` to UTC-0 before database insertion.
  * **API Strategy:** All endpoints accepting time ranges expect parameters in UTC-0.
  * **Frontend Responsibility:** The frontend handles the conversion from the user's local timezone (or the hardcoded `Europe/Amsterdam`) to UTC-0 for queries.
  * **Data Output:** API results are returned in UTC, allowing the frontend to format them based on the viewer's local context.

### Example Scenarios

| Action | Input (Local) | Process | Result (Stored/Sent) |
| :--- | :--- | :--- | :--- |
| **Storing a Call** | `2026-03-27 10:23:43` | Shift UTC+1 to UTC-0 | `2026-03-27T09:23:43.223Z` |
| **Querying March** | `03-01` to `03-31` | Shift boundaries to UTC | `02-28T23:00Z` to `03-31T22:59Z` |

-----

## Formulas and Calculations

### Agent Weekly Growth

For each day of the week ($D_n$), a weighted average is calculated based on activity. $WeekGrowth$ is represented as a vector of length 7.

$$DayGrowth = seeds + (leads \times 2) + (sales \times 3) + calls + (deep\_calls \times 2)$$
$$WeekGrowth = [DayGrowth(D_1), DayGrowth(D_2), \dots, DayGrowth(D_7)]$$

### Current Agent Streak

The streak represents the average completion ratio of daily goals, scaled to a 0–100 range.
*Note: Individual ratios are capped at 1.0 (100%).*

$$R_{seeds} = \frac{CurrentSeeds}{GoalSeeds}, \quad R_{leads} = \frac{CurrentLeads}{GoalLeads}, \quad \dots$$
$$CurrentDayStreak = \left( \frac{R_{seeds} + R_{leads} + R_{sales} + R_{calls}}{4} \right) \times 100$$

### Team Heat

Team Heat is a relative metric that compares current performance against `TemporalGoals`. High-value events (Sales/Seeds) are weighted more heavily than raw call volume.

**The Formula:**
$$HeatScore = \min\left( \sum_{i=1}^{n} (Progress_i \times Weight_i) \times 100, 100 \right)$$

**Component Weights & Constraints:**
| Metric ($i$) | Weight ($W_i$) | Progress Calculation ($P_i$) |
| :--- | :--- | :--- |
| **Sales** | $0.30$ | $\min(\frac{Actual}{Target}, 1.2)$ |
| **Seeds** | $0.25$ | $\min(\frac{Actual}{Target}, 1.2)$ |
| **Talk Time** | $0.20$ | $\min(\frac{Actual}{Target}, 1.2)$ |
| **Leads** | $0.15$ | $\min(\frac{Actual}{Target}, 1.2)$ |
| **Calls** | $0.10$ | $\min(\frac{Actual}{Target}, 1.2)$ |

### Office Display Ranking

Agents are ranked by a performance score calculated via a simple average:
$$PerformanceScore = \frac{CallingTime + Seeds + Sales}{3}$$

-----

## To-Do List

  * [ ] **Payments:** Select and implement a gateway (e.g., Stripe).
  * [ ] **Security:** Implement a third-party Auth provider (Clerk/Auth0).
  * [ ] **DevOps:** Dockerize applications (pending cloud migration).
  * [ ] **UX/UI:** Define logic for "On Fire" animation triggers on the office display.
  * [ ] **Real-time:** Replace polling with WebSockets (Socket.io) for live office display updates.
  * [ ] **Automation:** Implement weekly Cron jobs for agent level updates.
  * [ ] **Reporting:** Build historical level visualization and CSV export functionality.

-----

## Completed Features

  * **Onboarding:** Full company, manager, and user registration flows.
  * **Integrations:** Complete LeadDesk webhook synchronization.
  * **Management:** CRUD operations for Agents, Managers, Goals, and Block Schemas.
  * **Analytics:** Long-term data visualization and agent comparison tables.
  * **Dashboards:** Personal agent dashboard for performance tracking and subjective feeling submissions.
  * **Office Display:** Large-screen ranking system and real-time "Team Heat" indicator.

-----

