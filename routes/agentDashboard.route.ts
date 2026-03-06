import { Router, Request, Response } from 'express';
import * as AgentDashboardController from '../controllers/agentDashboard.controller';
import { JWTAuthRequest } from '../types/request';

const agentDashboardRouter = Router();

// GET /api/datavis/get-agents-comparisson
agentDashboardRouter.get('/get-agent-day-insights', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
    date, 
  } = req.query;

  const agentId = req.user?.id

  if(!agentId) return res.status(400).json({ error: "Missing agentId" });
  if(!date) return res.status(400).json({ error: "Missing date" });

  const report = await AgentDashboardController.getAgentDayInsights(agentId, date as string)

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

  const agentId = req.user?.id

  if(!agentId) return res.status(400).json({ error: "Missing agentId" });
  if(!date) return res.status(400).json({ error: "Missing date" });

  const report = await AgentDashboardController.getAgentWeeklyGrowth(agentId, date as string)

    return res.status(200).json(report);
  } catch (err: any) {
    console.error("DataVis Error:", err);
    return res.status(500).json({ error: "Internal server error processing visualization" });
  }
});

export default agentDashboardRouter;

