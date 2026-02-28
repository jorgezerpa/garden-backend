import { Router, Request, Response, NextFunction } from 'express';
import * as SchemaController from '../controllers/schema.controller';
import { JWTAuthRequest } from '../types/request';

const schemaRouter = Router();

// POST /api/admin/schemas/create
schemaRouter.post('/create', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { name, type, days } = req.body;
    const companyId = req.user?.companyId
    const creatorId = req.user?.id

    if (!name || !type || !companyId || !creatorId || !Array.isArray(days)) {
      return res.status(400).json({ error: "Missing required schema structure" });
    }

    const result = await SchemaController.createSchema({
      name,
      type,
      companyId: Number(companyId),
      creatorId: Number(creatorId),
      days
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/schemas/list/:companyId?page=1&limit=10
schemaRouter.get('/list', async (req: JWTAuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    if(!companyId) return res.status(404).json({ error: "missing companyId" })
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const result = await SchemaController.getSchemasPaginated(companyId, skip, limit);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "Fetch failed" });
  }
});

// GET /api/admin/schemas/:id
schemaRouter.get('/:id', checkSchemaBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const schema = await SchemaController.getSchemaById(id);
    return schema ? res.status(200).json(schema) : res.status(404).json({ error: "Schema not found" });
  } catch (err: any) {
    return res.status(500).json({ error: "Fetch failed" });
  }
});


// DELETE /api/admin/schemas/:id
schemaRouter.delete('/:id', checkSchemaBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await SchemaController.deleteSchema(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: "Deletion failed" });
  }
});

// PUT /api/admin/schemas/update/:id
schemaRouter.put('/update/:id', checkSchemaBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
// @todo add input checks -> type matches sended days, etc
// @todo make another route just for metadata, SRP and KISS -> optional inputs makes this more complex unnecesarly 
// @dev@q fullUpdateSchema should update name and type? 
// @dev@q metadata should not update type, write?
  try {
    const id = Number(req.params.id);
    const { name, type, days } = req.body;

    // If 'days' is provided, we perform a full structural update
    if (days && Array.isArray(days)) {
      const updated = await SchemaController.fullUpdateSchema(id, {
        name,
        type,
        days
      });
      return res.status(200).json(updated);
    } 

    // Otherwise, just update the metadata
    const updatedMetadata = await SchemaController.updateSchemaMetadata(id, { name });
    return res.status(200).json(updatedMetadata);
    
  } catch (err: any) {
    console.error("Schema Update Error:", err);
    return res.status(500).json({ error: "Update failed: " + err.message });
  }
});

export default schemaRouter;


async function checkSchemaBelongsToCompany(req: JWTAuthRequest, res: Response, next: NextFunction) {
  const companyId = req.user?.companyId
  const id = Number(req.params.id);
  const schema = await SchemaController.getSchemaById(id)

  if(!schema) return res.status(404).json({ error: "Manager not found" })
  if(schema.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" })
  next()
}