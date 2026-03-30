// mock.router.ts
import { Router } from 'express';
const mockRouter = Router();

mockRouter.get('/leaddesk-api-mock', (req, res) => {
  const { call_ref_id } = req.query;
  
  // The exact structure LeadDesk returns
  const mockCall = {
    id: call_ref_id || "1",
    agent_id: "2",
    agent_username: "Mock_Agent",
    talk_time: "45",
    talk_start: "2026-03-30 10:00:00",
    talk_end: "2026-03-30 10:00:45",
    number: "+35800000000",
    order_ids: [],
    call_ending_reason: "1",
  };

  console.log(`[MOCK API] Returning data for Call ID: ${call_ref_id}`);
  res.json(mockCall);
});

export default mockRouter;