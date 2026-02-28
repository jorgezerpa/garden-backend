import { Router, Response } from 'express';
import { handleCallWebhook } from '../controllers/Webhook.controller';
import { BasicAuthRequest } from '../types/request';

const leadDeskWebhookRouter = Router();

// This matches: GET /api/health/check
leadDeskWebhookRouter.get('/webhook', async (req: BasicAuthRequest, res: Response) => {
        try {
            // 3. Get the last_call_id from the query parameters (GET request)
            const lastCallId = req.query.last_call_id as string;

            if (!lastCallId) {
            return res.status(400).send('Missing last_call_id');
            }

            if(!req.user?.companyId) {
                throw("No company id in req.user")
            }

            // 4. Execute the service logic
            const result = await handleCallWebhook(lastCallId, req.user.companyId);

            // 5. Respond to LeadDesk (Documentation says they don't use the return value, but 200 is best)
            res.status(200).json({ status: 'success', callId: result.id });
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
);

export default leadDeskWebhookRouter;