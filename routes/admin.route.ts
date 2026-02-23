import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as ManagerController from '../controllers/manager.controller';

const adminRouter = Router();

// POST /api/admin/addManager
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