import { Router, Request, Response } from 'express';
import * as SharedScreenController from '../controllers/SharedScreen.controller';
import { JWTAuthRequest } from '../types/request';

const sharedScreenRoute = Router();

// GET /api/datavis/get_agents_positions
// @todo add validation middleware
sharedScreenRoute.get('/get_agents_positions', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
      date, 
      timegap,
      page, 
      pageSize 
    } = req.query;

    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Company ID not found" });
    }

    // Basic validation for dates
    if (!date) {
      return res.status(400).json({ error: "No date provided (YYYY-MM-DD)" });
    }
    if (!timegap) {
      return res.status(400).json({ error: "No timegap provided" });
    }

    const report = await SharedScreenController.getAgentPerformanceReport(
      Number(companyId),
      date as string,
      timegap as "daily"|"weekly", 
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

// GET /api/datavis/team_heat
sharedScreenRoute.get('/get_team_heat', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
      date,
    } = req.query;

    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ error: "Unauthorized: Company ID not found" });
    }

    // Basic validation for dates
    if (!date) {
      return res.status(400).json({ error: "Parameter 'date' is required (YYYY-MM-DDTHH:MM:SS.MMMZ)" });
    }

    const report = await SharedScreenController.getTeamHeatScore(
      companyId, 
      date as string,
      { IANA: "Europe/Amsterdam" }
    );

    return res.status(200).json(report);
  } catch (err: any) {
    console.error("team heat calculation Error:", err);
    return res.status(500).json({ 
      error: "Internal server error calculating team heat map" 
    });
  }
});

export default sharedScreenRoute