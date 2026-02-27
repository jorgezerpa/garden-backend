import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as ManagerController from '../controllers/manager.controller';
import * as GoalsController from '../controllers/goals.controller';

const adminRouter = Router();

// POST /api/admin/addManager -> handles manager CRUD
adminRouter.post('/addManager', async (req: Request, res: Response) => {
  try {
    const { email, name, password, companyId } = req.body;
    
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
adminRouter.put('/editManager/:id', async (req: Request, res: Response) => {
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
adminRouter.get('/getManager', async (req: Request, res: Response) => {
  try {
    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ error: "ID is required" });

    const manager = await ManagerController.getManagerById(id);
    return manager ? res.status(200).json(manager) : res.status(404).json({ error: "Not found" });
  } catch (err) {
    return res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/admin/getManagersList?page=1&limit=10
adminRouter.get('/getManagersList', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const result = await ManagerController.getManagersPaginated(skip, limit);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: "Fetch failed" });
  }
});

// DELETE /api/admin/removeManagers/:id
adminRouter.delete('/removeManagers/:id', async (req: Request, res: Response) => {
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
adminRouter.post('/goals/create', async (req: Request, res: Response) => {
  try {
    const { 
      startTime, endTime, talkTimeMinutes, seeds, 
      callbacks, leads, sales, numberOfCalls, 
      numberOfLongCalls, companyId, creatorId, name
    } = req.body;

    // Basic validation
    if (!startTime || !endTime || !companyId || !creatorId) {
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
adminRouter.get('/goals/company/:companyId', async (req: Request, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const goals = await GoalsController.findGoalsByCompany(companyId);
    return res.status(200).json(goals);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// PUT /api/admin/goals/update/:id
adminRouter.put('/goals/update/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updateData = req.body;

    // Convert date strings to Date objects if they are present in the update
    if (updateData.startTime) updateData.startTime = new Date(updateData.startTime);
    if (updateData.endTime) updateData.endTime = new Date(updateData.endTime);

    const updatedGoal = await GoalsController.updateTemporalGoal(id, updateData);
    return res.status(200).json(updatedGoal);
  } catch (err: any) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// DELETE /api/admin/goals/delete/:id
adminRouter.delete('/goals/delete/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await GoalsController.deleteTemporalGoal(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});


/////////////////////////////////////
/////////////////////////////////////

// GET /api/admin/assignation?companyId=1&from=2023-01-01&to=2023-01-31
adminRouter.get('/assignation', async (req: Request, res: Response) => {
  try {
    const { companyId, from, to } = req.query;

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
adminRouter.post('/upsert-assignation', async (req: Request, res: Response) => {
  try {
    const { companyId, date, goalId } = req.body;

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
// OR DELETE /api/admin/delete-assignation?companyId=1&date=2023-01-01
adminRouter.delete('/delete-assignation/:id?', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { companyId, date } = req.query;

    // Logic for deleting by Primary Key ID
    if (id) {
      const deleted = await GoalsController.deleteGoalAssignation(Number(id));
      return res.status(200).json(deleted);
    }

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
