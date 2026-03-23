import { Router, Response, NextFunction } from 'express';
import * as bcrypt from 'bcrypt';
import * as ManagerController from '../controllers/manager.controller';
import * as GoalsController from '../controllers/goals.controller';
import { JWTAuthRequest } from '../types/request';
import { THIRD_PARTY_SERVICES, UserStatus } from '../generated/prisma/enums';
import { allowedRoles } from '../middleware/authJWT.middleware';

const adminRouter = Router();

adminRouter.post('/upsertLeadDeskEventIds', allowedRoles(["MAIN_ADMIN"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { seedEventIds, saleEventIds } = req.body; // ids -> array of strings
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const parsedSeedEventIds = parseStringArray(seedEventIds)
    const parsedSaleEventIds = parseStringArray(saleEventIds)

    if(parsedSeedEventIds.length == 0 && parsedSaleEventIds.length == 0) {
      return res.status(400).json({ error: "No event ids sended" });
    }

    const result = await ManagerController.upsertLeadDeskEventIds(
      Number(companyId),
      parsedSeedEventIds,
      parsedSaleEventIds
    );

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/getLeadDeskEventIds', allowedRoles(["MAIN_ADMIN"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await ManagerController.getLeadDeskEventIds(companyId)

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin//addLeadDeskAPIAuthString -> allow admin to set the leadDesk api auth token 
adminRouter.post('/upsertLeadDeskAPIAuthString', allowedRoles(["MAIN_ADMIN"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { authString } = req.body;
    const companyId = req.user?.companyId

    if (!authString || !companyId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await ManagerController.upsertLeadDeskAPIAuthString(
      authString,
      Number(companyId)
    );

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 
adminRouter.get('/getLeadDeskAPIAuthString', allowedRoles(["MAIN_ADMIN"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId

    if (!companyId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await ManagerController.getLeadDeskAuthString(companyId)

    return res.status(201).json({ authString: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/addManager', allowedRoles(["MAIN_ADMIN"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { email, name, password } = req.body;
    const companyId = req.user?.companyId

    if (!email || !name || !password || !companyId) {
      return res.status(400).json({ error: "Missing required manager fields" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await ManagerController.createManagerWithUser({
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      companyId: Number(companyId)
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/editManager
adminRouter.put('/editManager/:id', allowedRoles(["MAIN_ADMIN"]), checkManagerBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id); // manager Id 
    const { name, email, password } = req.body;

    const updateObject: {name?:string, email?:string, password?: string, thirdPartyService?: { agentServiceIdentifier: string, serviceIdentifier:THIRD_PARTY_SERVICES } } = {}
    if(name) updateObject.name = name
    if(email) updateObject.email = email
    if(password) updateObject.password = password

    const updated = await ManagerController.updateManagerData(id, updateObject);
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// GET /api/admin/getManager?id=X
adminRouter.get('/getManager/:id', allowedRoles(["MAIN_ADMIN"]), checkManagerBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID is required" });

    const manager = await ManagerController.getManagerById(id);
    return manager ? res.status(200).json(manager) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    return res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/admin/getManagersList?page=1&limit=10
adminRouter.get('/getManagersList', allowedRoles(["MAIN_ADMIN"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const companyId = req.user?.companyId
    if(!companyId) return res.status(400).json({ error: "Missing companyId" });

    const result = await ManagerController.getManagersPaginated(skip, limit, companyId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: "Fetch failed" });
  }
});

// DELETE /api/admin/removeManagers/:id
adminRouter.delete('/removeManagers/:id', allowedRoles(["MAIN_ADMIN"]), checkManagerBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await ManagerController.deleteManagerAndUser(id);
    return res.status(204).send(); // No content
  } catch (err) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});


////////////////////////////////////
//////////////////////////////////// AGENTS CRUD
////////////////////////////////////

adminRouter.post('/addAgent', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { email, name, password, leadDeskId } = req.body;
    const companyId = req.user?.companyId

    const isMissingLeadDesk = leadDeskId === undefined || leadDeskId === null || String(leadDeskId).trim() === "";
    if (!email || !name || !password || !companyId || isMissingLeadDesk) {
      return res.status(400).json({ error: "Missing required agent fields" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await ManagerController.createAgentWithUser({
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      companyId: Number(companyId)
    });

    // relate user with a Leaddesk profile
    await ManagerController.upsertAgentThirdParty(result.agentId, { agentServiceIdentifier: leadDeskId, serviceIdentifier:"LEADDESK" })

    return res.status(201).json(result);
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/editAgent/:id', checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, email, leadDeskId, password } = req.body;

    const updateObject: {name?:string, email?:string, password?: string, thirdPartyService?: { agentServiceIdentifier: string, serviceIdentifier:THIRD_PARTY_SERVICES } } = {}
    if(name) updateObject.name = name
    if(email) updateObject.email = email
    if(password) updateObject.password = password

    if(leadDeskId) updateObject.thirdPartyService = { agentServiceIdentifier: leadDeskId, serviceIdentifier:"LEADDESK" }

    const updated = await ManagerController.updateAgentData(id, updateObject);
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// optional queries: includePaused, includeRemoved
adminRouter.get('/getAgent/:id', checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    
    if (!id) return res.status(400).json({ error: "ID is required" });
    
    // finish this filter implementation, I only write this commented 4 lines of below 
    // const query = req.query;
    // const statusToInclude:UserStatus[] = ["ACTIVE"] // by default only active
    // if(query?.includePaused) statusToInclude.push("PAUSED") 
    // if(query?.includeRemoved) statusToInclude.push("REMOVED") 

    const agent = await ManagerController.getAgentById(id);
    return (agent && agent.user?.status=="ACTIVE") ? res.status(200).json(agent) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    return res.status(500).json({ error: "Search failed" });
  }
});

adminRouter.get('/getAgentsList', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const companyId = req.user?.companyId
    if(!companyId) return res.status(400).json({ error: "Missing companyId" });

    const result = await ManagerController.getAgentsPaginated(skip, limit, companyId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: "Fetch failed" });
  }
});

adminRouter.delete('/removeAgent/:id', checkAgentBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await ManagerController.deleteAgentAndUser(id);
    return res.status(204).send(); // No content
  } catch (err) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});

/////// GOALS ROUTES /////////

// POST /api/admin/goals/create
adminRouter.post('/goals/create', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { 
      talkTimeMinutes, seeds, 
      callbacks, leads, sales, numberOfCalls, 
      numberOfLongCalls, name
    } = req.body;

    // Basic validation
    const companyId = req.user?.companyId
    const creatorId = req.user?.id
    if (!companyId || !creatorId) {
      return res.status(400).json({ error: "Missing required timing or relation fields" });
    }

    const goal = await GoalsController.createTemporalGoal({
      name,
      talkTimeMinutes: Number(talkTimeMinutes) || 0,
      seeds: Number(seeds) || 0,
      callbacks: Number(callbacks) || 0,
      leads: Number(leads) || 0,
      sales: Number(sales) || 0,
      numberOfCalls: Number(numberOfCalls) || 0,
      numberOfLongCalls: Number(numberOfLongCalls) || 0,
      companyId: Number(companyId),
      creatorId: Number(creatorId)
    });

    return res.status(201).json(goal);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/goals/company/:companyId
adminRouter.get('/goals/company', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if(!companyId) return res.status(400).json({ error: "Missing required timing or relation fields" });
    const goals = await GoalsController.findGoalsByCompany(companyId);
    return res.status(200).json(goals);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// PUT /api/admin/goals/update/:id
adminRouter.put('/goals/update/:id', checkGoalBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updateData = req.body;


    const updatedGoal = await GoalsController.updateTemporalGoal(id, updateData);
    return res.status(200).json(updatedGoal);
  } catch (err: any) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// DELETE /api/admin/goals/delete/:id
adminRouter.delete('/goals/delete/:id', checkGoalBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await GoalsController.deleteTemporalGoal(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});


/////////////////////////////////////
// goals assignation routes 
/////////////////////////////////////

// GET /api/admin/assignation?companyId=1&from=2023-01-01&to=2023-01-31
adminRouter.get('/assignation', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query; 
    const companyId = req.user?.companyId
    
    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
    }

    const assignations = await GoalsController.getAssignationsByRange(
      Number(companyId),
      from as string,
      to as string
    );

    return res.status(200).json(assignations);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/upsert-assignation
adminRouter.post('/upsert-assignation', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { date, goalId } = req.body;
    const companyId = req.user?.companyId

    if (!companyId || !date || !goalId) {
      return res.status(400).json({ error: "Missing companyId, date, or goalId" });
    }
    const result = await GoalsController.upsertGoalAssignation(
      Number(companyId),
      date,
      Number(goalId)
    );

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/delete-assignation/:id
adminRouter.delete('/delete-assignation-by-id/:id', checkGoalAssignationBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Logic for deleting by Primary Key ID
    if (id) {
      const deleted = await GoalsController.deleteGoalAssignation(Number(id));
      return res.status(200).json(deleted);
    }

    return res.status(400).json({ error: "Provide either an ID or companyId and date" });
  } catch (err: any) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});

// OR DELETE /api/admin/delete-assignation?companyId=1&date=2023-01-01
adminRouter.delete('/delete-assignation-by-date', checkGoalAssignationBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    const companyId = req.user?.companyId

    // Logic for deleting by composite Unique (Company + Date)
    if (companyId && date) {
      const deleted = await GoalsController.deleteGoalAssignationByDate(
        Number(companyId),
        date as string
      );
      return res.status(200).json(deleted);
    }

    return res.status(400).json({ error: "Provide either an ID or companyId and date" });
  } catch (err: any) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});



/////////////////
// MIDDLEWARES
/////////////////

// @todo@Important add test for this
async function checkManagerBelongsToCompany(req: JWTAuthRequest, res: Response, next: NextFunction) {
  const companyId = req.user?.companyId
  const id = Number(req.params.id);
  const manager = await ManagerController.getManagerById(id)

  if(!manager) return res.status(404).json({ error: "Manager not found" })
  if(manager.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" })
  next()
}

async function checkAgentBelongsToCompany(req: JWTAuthRequest, res: Response, next: NextFunction) {
  const companyId = req.user?.companyId
  const id = Number(req.params.id);
  const agent = await ManagerController.getAgentById(id)

  if(!agent) return res.status(404).json({ error: "agent not found" })
  if(agent.companyId != companyId) return res.status(401).json({ error: "agent does not belogn to company" })
  next()
}

async function checkGoalBelongsToCompany(req: JWTAuthRequest, res: Response, next: NextFunction) {
  const companyId = req.user?.companyId
  const id = Number(req.params.id);
  const goal = await GoalsController.findGoalById(id)

  if(!goal) return res.status(404).json({ error: "Goal not found" })
  if(goal.companyId != companyId) return res.status(401).json({ error: "Goal does not belogn to company" })
  next()
}

async function checkGoalAssignationBelongsToCompany(req: JWTAuthRequest, res: Response, next: NextFunction) {
  const companyId = req.user?.companyId
  const goalId = Number(req.params.id);
  const date = req.query.date
  
  if(!companyId) return res.status(400).json({ error: "Missing companyId" });

  if(goalId) {
    const goal = await GoalsController.findGoalById(goalId)
    if(goal?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" })
    return next()
  }
  
  if(date) {
    const goalsArray = await GoalsController.getAssignationsByRange(companyId, date as string, date as string)
    const goal = goalsArray[0]
    
    if(goal?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" })
    return next()
  }

  return res.status(500).json({ error: "unexpected error in goal middleware" })
}

export default adminRouter;


// HELPERS 
const parseStringArray = (val: any): string[] => {
  // If val is null/undefined, return an empty array
  if (val === null || val === undefined) return [];

  // If it's a single value, wrap it; if it's already an array, use it.
  const arr = Array.isArray(val) ? val : [val];

  return arr.map(item => {
    // Convert to string and trim whitespace
    const str = String(item).trim();
    
    // Optional: Throw if the resulting string is empty (equivalent to your NaN check)
    if (!str) {
      throw new Error("Invalid or empty string value provided in array");
    }
    
    return str;
  });
};