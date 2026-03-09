import { Router, Request, Response, NextFunction } from 'express';
import * as SchemaController from '../controllers/schema.controller';
import { JWTAuthRequest } from '../types/request';
import { allowedRoles } from '../middleware/authJWT.middleware';

const schemaRouter = Router();

// POST /api/admin/schemas/create
schemaRouter.post('/create', async (req: JWTAuthRequest, res: Response) => {
  try {
    const { name, blocks } = req.body;
    const companyId = req.user?.companyId
    const creatorId = req.user?.id

    if (!name || !companyId || !creatorId || !Array.isArray(blocks)) {
      return res.status(400).json({ error: "Missing required schema structure" });
    }
    
    if(blocks.length==0) return res.status(400).json({ error: "Must send at least 1 block" })

    const result = await SchemaController.createSchema({
      name,
      companyId: Number(companyId),
      creatorId: Number(creatorId),
      blocks
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
schemaRouter.get('/individual/:id', checkSchemaBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
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
    console.log(err)
    return res.status(500).json({ error: "Deletion failed" });
  }
});

// PUT /api/admin/schemas/update/:id
schemaRouter.put('/update/:id', checkSchemaBelongsToCompany, async (req: JWTAuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, blocks } = req.body;

    // If 'days' is provided, we perform a full structural update
    if (blocks && Array.isArray(blocks)) {
      const updated = await SchemaController.fullUpdateSchema(id, {
        name,
        blocks
      });
    } 

    // Otherwise, just update the metadata
    const updatedMetadata = await SchemaController.updateSchemaMetadata(id, { name });
    return res.status(200).json(updatedMetadata);
  } catch (err: any) {
    console.error("Schema Update Error:", err);
    return res.status(500).json({ error: "Update failed: " + err.message });
  }
});


/////////////////////////////////////
// schema assignation routes 
/////////////////////////////////////

schemaRouter.get('/assignation', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const companyId = req.user?.companyId
    
    if (!companyId || !from || !to) {
      return res.status(400).json({ error: "Missing companyId, from, or to parameters" });
    }

    const assignations = await SchemaController.getAssignationsByRange(
      Number(companyId),
      new Date(from as string),
      new Date(to as string)
    );

    return res.status(200).json(assignations);
  } catch (err: any) {
    console.log(err)
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/upsert-assignation
schemaRouter.post('/upsert-assignation', allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { date, schemaId } = req.body;
    const companyId = req.user?.companyId

    if (!companyId || !date || !schemaId) {
      return res.status(400).json({ error: "Missing companyId, date, or goalId" });
    }
    const result = await SchemaController.upsertSchemaAssignation(
      Number(companyId),
      date,
      Number(schemaId)
    );

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/delete-assignation/:id
schemaRouter.delete('/delete-assignation-by-id/:id', checkSchemaAssignationBelongsToCompany, allowedRoles(["MAIN_ADMIN", "MANAGER"]), async (req: JWTAuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id) {
      const deleted = await SchemaController.deleteSchemaAssignation(Number(id));
      return res.status(200).json(deleted);
    }

    return res.status(400).json({ error: "Provide either an ID or companyId and date" });
  } catch (err: any) {
    return res.status(500).json({ error: "Deletion failed" });
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


async function checkSchemaAssignationBelongsToCompany(req: JWTAuthRequest, res: Response, next: NextFunction) {
  const companyId = req.user?.companyId
  const schemaId = Number(req.params.id);
  
  if(!companyId) return res.status(400).json({ error: "Missing companyId" });

  if(schemaId) {
    const schema = await SchemaController.getSchemaById(schemaId)
    if(schema?.companyId != companyId) return res.status(401).json({ error: "Manager does not belogn to company" })
    return next()
  }
  
 

  return res.status(500).json({ error: "unexpected error in goal middleware" })
}