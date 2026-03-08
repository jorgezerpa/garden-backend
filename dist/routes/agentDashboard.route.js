import { Router } from 'express';
import * as AgentDashboardController from '../controllers/agentDashboard.controller';
const agentDashboardRouter = Router();
// GET /api/datavis/get-agents-comparisson
agentDashboardRouter.get('/get-agent-day-insights', async (req, res) => {
    try {
        const { date, } = req.query;
        const agentId = req.user?.id;
        if (!agentId)
            return res.status(400).json({ error: "Missing agentId" });
        if (!date)
            return res.status(400).json({ error: "Missing date" });
        const report = await AgentDashboardController.getAgentDayInsights(agentId, date);
        return res.status(200).json(report);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// GET /api/datavis/get-agent-weekly-growth
agentDashboardRouter.get('/get-agent-weekly-growth', async (req, res) => {
    try {
        const { date, } = req.query;
        const agentId = req.user?.id;
        if (!agentId)
            return res.status(400).json({ error: "Missing agentId" });
        if (!date)
            return res.status(400).json({ error: "Missing date" });
        const report = await AgentDashboardController.getAgentWeeklyGrowth(agentId, date);
        return res.status(200).json(report);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// GET /api/datavis/get-assigned-block?date=YYYY-MM-DD
agentDashboardRouter.get('/get-assigned-schema', async (req, res) => {
    try {
        const { date, } = req.query;
        const agentId = req.user?.id; // userId
        if (!agentId)
            return res.status(400).json({ error: "Missing agentId" });
        if (!date)
            return res.status(400).json({ error: "Missing date" });
        const result = await AgentDashboardController.getAssignedSchema(agentId, date);
        return res.status(200).json(result);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// GET /api/datavis/get-agent-weekly-growth
agentDashboardRouter.post('/register-agent-state', async (req, res) => {
    try {
        const { energy, focus, motivation } = req.body;
        const agentId = req.user?.id;
        if (!agentId)
            return res.status(400).json({ error: "Missing agentId" });
        const result = await AgentDashboardController.registerAgentState(agentId, Number(energy), Number(focus), Number(motivation));
        return res.status(200).json(result);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
export default agentDashboardRouter;
