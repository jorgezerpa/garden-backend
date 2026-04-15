import { Router, Request, Response } from 'express';
import leadDeskWebhookRouter from './LeadDeskWebHook.route';
import authRouter from './auth.route';
import adminRouter from './admin.route';
import schemaRouter from './schema.route';
import dataVisRouter from './dataVis.route';
import agentDashboardRouter from './agentDashboard.route';
import sharedScreenRouter from './SharedScreen.route';
import uploadRouter from './upload.route';
import eventRouter from './event.route'
import mockRouter from './mock.route';
//
import { authenticateJWT, allowedRoles, authenticateJWTInQuery } from '../middleware/authJWT.middleware';
import { authenticateBasic } from '../middleware/authBasic.middleware';

const router = Router();

/**
 * You can create separate files for 'userRoutes.ts', 'productRoutes.ts', etc.
 * and import them here.
 */

// Placeholder for your controller functions
//
router.use('/auth', authRouter); 
router.use('/admin', authenticateJWT, adminRouter); 
router.use('/schema', authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER"]), schemaRouter); 
router.use('/datavis', authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER"]), dataVisRouter); 
router.use('/agent-dashboard', authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER", "AGENT"]), agentDashboardRouter); 
router.use('/shared-screen', authenticateJWT, allowedRoles(["MAIN_ADMIN", "MANAGER", "AGENT"]), sharedScreenRouter); 
router.use('/upload', authenticateJWT, allowedRoles(["AGENT"]), uploadRouter); 
router.use('/events', authenticateJWTInQuery, eventRouter)
router.use('/leaddesk', authenticateBasic, leadDeskWebhookRouter);
// mock and dev helpers 
router.use('/mock', mockRouter);


export default router;