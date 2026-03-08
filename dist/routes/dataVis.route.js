import { Router } from 'express';
import * as DataVisController from '../controllers/DataVis.controller';
const dataVisRouter = Router();
// GET /api/datavis/get-agents-comparisson
dataVisRouter.get('/get-agents-comparisson', async (req, res) => {
    try {
        const { from, to, sortKey, direction, page, pageSize, agents } = req.query;
        const companyId = req.user?.companyId;
        const report = await DataVisController.getAgentsSorted(Number(companyId), from, // e.g., "2026-03-01"
        to, // e.g., "2026-03-07"
        {
            sortKey: sortKey || 'talkTime',
            direction: direction || 'desc',
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 10,
            agentIds: agents ? parseNumberArray(agents) : []
        });
        return res.status(200).json(report);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// GET /api/datavis/get-last-call-date
dataVisRouter.get('/get-last-call-date', async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(400).json({ error: "Missing companyId" });
        }
        const result = await DataVisController.getLastRegister(companyId);
        return res.status(200).json(result);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// GET /api/datavis/general-insights
dataVisRouter.get('/general-insights', async (req, res) => {
    try {
        const { from, to, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !from || !to) {
            return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
        }
        const startDate = new Date(from);
        const endDate = new Date(to);
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        // Set endDate to the very end of that day to capture all evening calls
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        const report = await DataVisController.getGeneralInsights(Number(companyId), startDate, endDate, { agents: parsedAgents });
        return res.status(200).json(report);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// GET /api/datavis/daily-activity?companyId=1&from=2024-05-01&to=2024-05-07
dataVisRouter.get('/daily-activity', async (req, res) => {
    try {
        const { from, to, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !from || !to) {
            return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
        }
        //   // const [year, month, day] = d.date.split('-').map(Number);
        // new Date(year, month - 1, day, 0, 0, 0, 0)
        const startDate = new Date(from);
        const endDate = new Date(to);
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        // Set endDate to the very end of that day to capture all evening calls
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        const report = await DataVisController.getDailyActivity(Number(companyId), startDate, endDate, { agents: parsedAgents });
        return res.status(200).json(report);
    }
    catch (err) {
        console.error("DataVis Error:", err);
        return res.status(500).json({ error: "Internal server error processing visualization" });
    }
});
// BLOCKS VIEWS 
dataVisRouter.get('/block-performance', async (req, res) => {
    try {
        const { schemaId, from, to, days, types, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !schemaId || !from || !to || !days || !types) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof from !== 'string' || !dateRegex.test(from) || typeof to !== 'string' || !dateRegex.test(to)) {
            return res.status(400).json({
                error: "Invalid date format. Please use YYYY-MM-DD"
            });
        }
        const sId = Number(schemaId);
        const parsedDays = parseBoolArray(days);
        const parsedTypes = parseBoolArray(types);
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        const data = await DataVisController.getBlockPerformance(Number(companyId), from, to, sId, { days: parsedDays, types: parsedTypes, agents: parsedAgents });
        return res.status(200).json(data);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// CALL DURATION 
dataVisRouter.get('/long-call-distribution', async (req, res) => {
    try {
        const { from, to, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !from || !to) {
            return res.status(400).json({ error: "Missing required parameters: companyId, from, to" });
        }
        const startDate = new Date(from);
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        const data = await DataVisController.getLongCallDistribution(Number(companyId), startDate, endDate, { agents: parsedAgents });
        return res.status(200).json(data);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// HEATMAP
dataVisRouter.get('/seed-timeline-heatmap', async (req, res) => {
    try {
        const { year, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !year) {
            return res.status(400).json({ error: "Missing companyId, from, or to" });
        }
        if (isNaN(Number(year))) {
            return res.status(400).json({ error: "Invalid year parameter" });
        }
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        const heatmapData = await DataVisController.getSeedTimelineHeatmap(Number(companyId), Number(year), { agents: parsedAgents });
        return res.status(200).json(heatmapData);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
dataVisRouter.get('/seed-timeline-heatmap-per-day', async (req, res) => {
    try {
        const { day, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !day) {
            return res.status(400).json({ error: "Missing companyId or day" });
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (typeof day !== 'string' || !dateRegex.test(day)) {
            return res.status(400).json({
                error: "Invalid date format. Please use YYYY-MM-DD"
            });
        }
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        const heatmapData = await DataVisController.getSeedTimelineHeatmapPerDay(Number(companyId), day, { agents: parsedAgents });
        return res.status(200).json(heatmapData);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// FUNNEL 
dataVisRouter.get('/conversion-funnel', async (req, res) => {
    try {
        const { from, to, agents } = req.query;
        const companyId = req.user?.companyId;
        if (!companyId || !from || !to) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        const start = new Date(from);
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        const funnelData = await DataVisController.getConversionFunnel(Number(companyId), start, end, { agents: parsedAgents });
        return res.status(200).json(funnelData);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// STREAKS
dataVisRouter.get('/consistency-streak', async (req, res) => {
    try {
        const { goalId, from, to, agents, days } = req.query;
        const companyId = req.user?.companyId;
        if (!goalId || !companyId || !from || !to || !days) {
            return res.status(400).json({ error: "Missing required parameters" });
        }
        const start = new Date(from);
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        const parsedAgents = agents ? parseNumberArray(agents) : [];
        const parsedDays = days ? parseBoolArray(days) : [];
        const history = await DataVisController.getConsistencyHistory(Number(goalId), Number(companyId), start, end, { agents: parsedAgents, days: parsedDays });
        return res.status(200).json(history);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
export default dataVisRouter;
/// helpers
// Helper function to ensure we have an array and convert strings to booleans
const parseBoolArray = (val) => {
    // If it's a single value (string), wrap it in an array; if it's already an array, use it.
    const arr = Array.isArray(val) ? val : [val];
    // Convert "true" -> true, others -> false
    return arr.map(item => String(item).toLowerCase() === 'true');
};
// Helper function to ensure we have an array and convert strings to numbers
const parseNumberArray = (val) => {
    // If it's a single value (string), wrap it in an array; if it's already an array, use it.
    const arr = Array.isArray(val) ? val : [val];
    return arr.map(item => {
        const number = Number(item);
        if (isNaN(number))
            throw ("Not numerical value"); // @todo I'm not sure if this is the correct way to check for NaN
        return number;
    });
};
