import { Router, Request, Response } from 'express';
import leadDeskWebhookRouter from './LeadDeskWebHook.route';
import authRouter from './auth.route';
import adminRouter from './admin.route';
import schemaRouter from './schema.route';
import dataVisRouter from './dataVis.route';
//
import { authenticateJWT, allowedRoles } from '../middleware/authJWT.middleware';
import { authenticateBasic } from '../middleware/authBasic.middleware';

const router = Router();

/**
 * You can create separate files for 'userRoutes.ts', 'productRoutes.ts', etc.
 * and import them here.
 */

// Placeholder for your controller functions
//
router.use('/auth', authRouter); // login and register handler
router.use('/admin', authenticateJWT, allowedRoles(["MAIN_ADMIN"]), adminRouter); // login and register handler
router.use('/schema', authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER"]), schemaRouter); // login and register handler
router.use('/datavis', authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER"]), dataVisRouter); // login and register handler
// @todo create routes for agent visualization of data on agent dashboard and also for big screen dashboard
router.use('/leaddesk', authenticateBasic, leadDeskWebhookRouter);

export default router;