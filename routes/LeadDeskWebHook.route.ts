import { Router, Response } from 'express';
import { handleCallWebhook } from '../controllers/Webhook.controller';
import { BasicAuthRequest } from '../types/request';
import { eventHub } from '../eventHub';

const leadDeskWebhookRouter = Router();

// This matches: GET /api/health/check
leadDeskWebhookRouter.get('/webhook', async (req: BasicAuthRequest, res: Response) => {
        try {
            // 3. Get the last_call_id from the query parameters (GET request)
            const lastCallId = req.query.last_call_id as string;
            const companyId = req.user?.companyId

            if (!lastCallId) {
            return res.status(400).send('Missing last_call_id');
            }

            if(!companyId) {
                throw("No company id in req.user")
            }

            // 4. Execute the service logic
            const result = await handleCallWebhook(lastCallId, companyId);

            // 5. Send event to connected frontends 
            eventHub.emit(
                `update:company:${companyId}`, 
                { type:'WEBHOOK_TRIGGERED', performanceNotifications: result.performanceNotifications, agentId: result.agentId, agentName: result.agentName }
            ); // office display
            eventHub.emit(`update:user:${result.userId}`, { type: 'WEBHOOK_TRIGGERED' }); // specific user dashboard

            // 6. Respond to LeadDesk (Documentation says they don't use the return value, but 200 is best)
            res.status(200).json({ status: 'success', callId: result.call.id });
        } catch (error) {
            console.log(error)
            res.status(500).send('Internal Server Error');
        }
    }
);

export default leadDeskWebhookRouter;