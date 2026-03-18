import { Router, Request, Response } from 'express';
import * as AgentDashboardController from '../controllers/agentDashboard.controller';
import { JWTAuthRequest } from '../types/request';

const agentDashboardRouter = Router();

agentDashboardRouter.get('/get-agent-day-insights', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
    date, 
  } = req.query;

  const userId = req.user?.id

  if(!userId) return res.status(400).json({ error: "Missing userId" });
  if(!date) return res.status(400).json({ error: "Missing date" });

  const report = await AgentDashboardController.getAgentDayInsights(userId, date as string)

    return res.status(200).json(report);
  } catch (err: any) {
    console.error("DataVis Error:", err);
    return res.status(500).json({ error: "Internal server error processing visualization" });
  }
});

// GET /api/datavis/get-agent-weekly-growth
agentDashboardRouter.get('/get-agent-weekly-growth', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
    date, 
  } = req.query;

  const userId = req.user?.id

  if(!userId) return res.status(400).json({ error: "Missing agentId" });
  if(!date) return res.status(400).json({ error: "Missing date" });

  const report = await AgentDashboardController.getAgentWeeklyGrowth(userId, date as string)

    return res.status(200).json(report);
  } catch (err: any) {
    console.error("DataVis Error:", err);
    return res.status(500).json({ error: "Internal server error processing visualization" });
  }
});

// GET /api/datavis/get-assigned-block?date=YYYY-MM-DD
agentDashboardRouter.get('/get-assigned-schema', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
    date, 
  } = req.query;
  const userId = req.user?.id // userId

  if(!userId) return res.status(400).json({ error: "Missing agentId" });
  if(!date) return res.status(400).json({ error: "Missing date" });

  const result = await AgentDashboardController.getAssignedSchema(userId, date as string)

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("DataVis Error:", err);
    return res.status(500).json({ error: "Internal server error processing visualization" });
  }
});

// GET /api/datavis/get-agent-weekly-growth
agentDashboardRouter.post('/register-agent-state', async (req: JWTAuthRequest, res: Response) => {
  try {
    const {
      energy,
      focus,
      motivation 
  } = req.body;

  const userId = req.user?.id


  if(!userId) return res.status(400).json({ error: "Missing agentId" });

    const result =  await AgentDashboardController.registerAgentState(userId, Number(energy), Number(focus), Number(motivation))
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("DataVis Error:", err);
    return res.status(500).json({ error: "Internal server error processing visualization" });
  }
});

export default agentDashboardRouter;

