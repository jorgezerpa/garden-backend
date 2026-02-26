import { Router, Request, Response } from 'express';
import { handleCallWebhook } from '../controllers/Webhook.controller';
import { randomBytes, createHash, randomUUID, privateDecrypt } from "crypto";

const leadDeskWebhookRouter = Router();

// This matches: GET /api/health/check
leadDeskWebhookRouter.get('/webhook', async (req: Request, res: Response) => {
        try {
            // 1. Extract Basic Auth Header
            const authHeader = req.headers.authorization;
            if (!authHeader) {
            return res.status(401).send('Authentication required');
            }

            // 2. Decode Base64 (Format is "Basic base64(username:password)")
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');

            // Values will be checked on controller
            // @TODO this could be a middleware 
            const [publicKey, secretKey] = credentials.split(':'); // apiKey is the "username" 
            const secretHash = createHash("sha256").update(secretKey).digest("hex");

            // 3. Get the last_call_id from the query parameters (GET request)
            const lastCallId = req.query.last_call_id as string;

            if (!lastCallId) {
            return res.status(400).send('Missing last_call_id');
            }

            // 4. Execute the service logic
            const result = await handleCallWebhook(lastCallId, publicKey, secretHash);

            // 5. Respond to LeadDesk (Documentation says they don't use the return value, but 200 is best)
            res.status(200).json({ status: 'success', callId: result.id });
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
);

export default leadDeskWebhookRouter;