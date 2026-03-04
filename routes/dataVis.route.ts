import { Router, Request, Response } from 'express';
import * as DataVisController from '../controllers/DataVis.controller';
import { prisma } from "../lib/prisma"; // used for validations only. Should not be used to modifies DB
import { JWTAuthRequest } from '../types/request';

const dataVisRouter = Router();

// GET /api/datavis/daily-activity?companyId=1&from=2024-05-01&to=2024-05-07
dataVisRouter.get('/daily-activity', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const companyId = req.user?.companyId

    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
    }

    const startDate = new Date(from as string);
    const endDate = new Date(to as string);
    
    // Set endDate to the very end of that day to capture all evening calls
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const report = await DataVisController.getDailyActivity(
      Number(companyId),
      startDate,
      endDate
    );

    return res.status(200).json(report);
  } catch (err: any) {
    console.error("DataVis Error:", err);
    return res.status(500).json({ error: "Internal server error processing visualization" });
  }
});

// BLOCKS VIEWS 
dataVisRouter.get('/block-performance', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { schemaId, from, to, days, types } = req.query; 
    const companyId = req.user?.companyId

    if (!companyId || !schemaId || !from || !to || !days || !types) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const start = new Date(from as string);
    const end = new Date(to as string);
    const sId = Number(schemaId);

    // Logic Check: Validate date range vs Schema constraints
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // We fetch the schema type to validate
    const schemaMeta = await prisma.schema.findUnique({ where: { id: sId }, select: { type: true } });
    
    if (!schemaMeta) return res.status(404).json({ error: "Schema not found" });

    // Ensure range doesn't exceed 31 days as per instructions
    if (diffDays > 31) {
      return res.status(400).json({ error: "Date range exceeds maximum schema limit of 31 days" });
    }

    const parsedDays = parseBoolArray(days);
    const parsedTypes = parseBoolArray(types);

    const data = await DataVisController.getBlockPerformance(
      Number(companyId),
      start,
      new Date(end.setHours(23, 59, 59, 999)),
      sId, 
      { days: parsedDays, types: parsedTypes }
    );

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});




// CALL DURATION 
dataVisRouter.get('/long-call-distribution', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const companyId = req.user?.companyId

    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing required parameters: companyId, from, to" });
    }

    const startDate = new Date(from as string);
    const endDate = new Date(to as string);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const data = await DataVisController.getLongCallDistribution(
      Number(companyId),
      startDate,
      endDate
    );

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// HEATMAP
dataVisRouter.get('/seed-timeline-heatmap', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const companyId = req.user?.companyId

    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing companyId, from, or to" });
    }

    const start = new Date(from as string);
    const end = new Date(to as string);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date parameters" });
    }

    const heatmapData = await DataVisController.getSeedTimelineHeatmap(
      Number(companyId),
      start,
      end
    );

    return res.status(200).json(heatmapData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// FUNNEL 
dataVisRouter.get('/conversion-funnel', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const companyId = req.user?.companyId

    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const start = new Date(from as string);
    const end = new Date(to as string);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const funnelData = await DataVisController.getConversionFunnel(
      Number(companyId),
      start,
      end
    );

    return res.status(200).json(funnelData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// STREAKS
dataVisRouter.get('/consistency-streak', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { goalId, from, to } = req.query;
    const companyId = req.user?.companyId

    if (!goalId || !companyId || !from || !to) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const start = new Date(from as string);
    const end = new Date(to as string);
    end.setHours(23, 59, 59, 999);

    const history = await DataVisController.getConsistencyHistory(
      Number(goalId),
      Number(companyId),
      start,
      end
    );

    return res.status(200).json(history);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default dataVisRouter;


/// helpers
// 1. Helper function to ensure we have an array and convert strings to booleans
    const parseBoolArray = (val: any): boolean[] => {
      // If it's a single value (string), wrap it in an array; if it's already an array, use it.
      const arr = Array.isArray(val) ? val : [val];
      // Convert "true" -> true, others -> false
      return arr.map(item => String(item).toLowerCase() === 'true');
    };