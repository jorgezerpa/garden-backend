import { Router, Request, Response } from 'express';
import * as SharedScreenController from '../controllers/SharedScreen.controller';
import { JWTAuthRequest } from '../types/request';

const sharedScreenRoute = Router();

// GET /api/datavis/get_agents_positions
sharedScreenRoute.get('/get_agents_positions', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
      from, 
      to, 
      page, 
      pageSize 
    } = req.query;

    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Company ID not found" });
    }

    // Basic validation for dates
    if (!from || !to) {
      return res.status(400).json({ error: "Parameters 'from' and 'to' are required (YYYY-MM-DD)" });
    }

    const report = await SharedScreenController.getAgentPerformanceReport(
      Number(companyId),
      from as string,
      to as string,
      Number(page) || 1,      // Default to page 1
      Number(pageSize) || 10  // Default to 10 items
    );

    return res.status(200).json(report);
  } catch (err: any) {
    console.error("Agent Positions Error:", err);
    return res.status(500).json({ 
      error: "Internal server error calculating agent positions" 
    });
  }
});

export default sharedScreenRoute