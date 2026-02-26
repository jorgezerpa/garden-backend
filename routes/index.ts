import { Router, Request, Response } from 'express';
import leadDeskWebhookRouter from './LeadDeskWebHook.route';
import authRouter from './auth.route';
import adminRouter from './admin.route';
import schemaRouter from './schema.route';

const router = Router();

/**
 * You can create separate files for 'userRoutes.ts', 'productRoutes.ts', etc.
 * and import them here.
 */

// Placeholder for your controller functions
router.use('/leaddesk', leadDeskWebhookRouter);
//
router.use('/auth', authRouter); // login and register handler
router.use('/admin', adminRouter); // login and register handler
router.use('/schema', schemaRouter); // login and register handler
// router.get('/datavis', leadDeskWebhookRouter); // login and register handler


export default router;