import { Router, Request, Response } from 'express';
import leadDeskWebhookRouter from './LeadDeskWebHook.route';
import authRouter from './auth.route';
import adminRouter from './admin.route';
import schemaRouter from './schema.route';
import dataVisRouter from './dataVis.route';
//
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

/**
 * You can create separate files for 'userRoutes.ts', 'productRoutes.ts', etc.
 * and import them here.
 */

// Placeholder for your controller functions
//
router.use('/auth', authRouter); // login and register handler
router.use('/admin', authenticateJWT, adminRouter); // login and register handler
router.use('/schema', authenticateJWT, schemaRouter); // login and register handler
router.use('/datavis', authenticateJWT, dataVisRouter); // login and register handler
router.use('/leaddesk', leadDeskWebhookRouter);


export default router;