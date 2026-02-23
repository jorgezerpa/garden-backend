import { Router, Request, Response } from 'express';
import leadDeskWebhookRouter from './LeadDeskWebHook.route';

const router = Router();

/**
 * You can create separate files for 'userRoutes.ts', 'productRoutes.ts', etc.
 * and import them here.
 */

// Placeholder for your controller functions
router.get('/leaddesk', leadDeskWebhookRouter);

export default router;