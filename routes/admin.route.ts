import { Router, Response, NextFunction } from 'express';
import * as bcrypt from 'bcrypt';
import * as ManagerController from '../controllers/manager.controller';
import * as GoalsController from '../controllers/goals.controller';
import { JWTAuthRequest } from '../types/request';

const adminRouter = Router();

// POST /api/admin/addManager -> handles manager CRUD
adminRouter.post('/addManager', async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.put('/editManager/:id', checkManagerBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, email } = req.body;

    const updated = await ManagerController.updateManagerData(id, { name, email });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// GET /api/admin/getManager?id=X
adminRouter.get('/getManager/:id', checkManagerBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.get('/getManagersList', async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.delete('/removeManagers/:id', checkManagerBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await ManagerController.deleteManagerAndUser(id);
    return res.status(204).send(); // No content
  } catch (err) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});

export default adminRouter;

/////// GOALS ROUTES /////////

// POST /api/admin/goals/create
adminRouter.post('/goals/create', async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.get('/goals/company', async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.put('/goals/update/:id', checkGoalBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.delete('/goals/delete/:id', checkGoalBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
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
adminRouter.get('/assignation', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const companyId = req.user?.companyId
    
    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
    }

    const assignations = await GoalsController.getAssignationsByRange(
      Number(companyId),
      new Date(from as string),
      new Date(to as string)
    );

    return res.status(200).json(assignations);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/upsert-assignation
adminRouter.post('/upsert-assignation', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { date, goalId } = req.body;
    const companyId = req.user?.companyId

    if (!companyId || !date || !goalId) {
      return res.status(400).json({ error: "Missing companyId, date, or goalId" });
    }

    const result = await GoalsController.upsertGoalAssignation(
      Number(companyId),
      new Date(date),
      Number(goalId)
    );

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/delete-assignation/:id
adminRouter.delete('/delete-assignation-by-id/:id', checkGoalAssignationBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // @todo sanitization of id  (if needed)

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
adminRouter.delete('/delete-assignation-by-date', checkGoalAssignationBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    const companyId = req.user?.companyId

    // Logic for deleting by composite Unique (Company + Date)
    if (companyId && date) {
      const deleted = await GoalsController.deleteGoalAssignationByDate(
        Number(companyId),
        new Date(date as string)
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
    const goalsArray = await GoalsController.getAssignationsByRange(companyId, new Date(date as string), new Date(date as string))
    const goal = goalsArray[0]
    
    if(goal?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" })
    return next()
  }

  return res.status(500).json({ error: "unexpected error in goal middleware" })
}

