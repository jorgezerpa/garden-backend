// mock.router.ts
import { Router } from 'express';
import { getCurrentZonedIsoString } from '../utils/date';
const mockRouter = Router();

mockRouter.get('/leaddesk-api-mock', (req, res) => {
  const { call_ref_id } = req.query;

  // 1. Generate a random duration in seconds
  const talk_time = Math.floor(Math.random() * 600) + 1; // 1 to 600 seconds

  // 2. Generate a random start time for "today"
  const start = new Date(getCurrentZonedIsoString("Europe/Amsterdam"))
  start.setUTCHours(Math.floor(Math.random() * 24));
  start.setUTCMinutes(Math.floor(Math.random() * 60));
  start.setUTCSeconds(Math.floor(Math.random() * 60));

  // 3. Calculate end time (Start time + talk_time in milliseconds)
  const end = new Date(start.getTime() + talk_time * 1000);

  // Helper to format Date to 'YYYY-MM-DD HH:mm:ss'
  const formatDate = (date: Date) => date.toISOString().replace('T', ' ').split('.')[0];

  const mockCall = {
    id: call_ref_id || "1",
    // agent_id: Math.floor(Math.random() * 25) + 1,
    agent_id: Math.floor(Math.random()*25 + 1),
    agent_username: "Mock_Agent",
    talk_time: talk_time,
    talk_start: formatDate(start),
    talk_end: formatDate(end),
    number: `+358000000${Math.floor(Math.random() * 20) + 1}`,
    order_ids: [],
    call_ending_reason: `${Math.floor(Math.random() * 6) + 1}`,
  };

  // console.log(`[MOCK API] Returning data for Call ID: ${call_ref_id}`);
  res.json(mockCall);
});

export default mockRouter;