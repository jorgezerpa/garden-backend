import { Router, Response } from 'express';
import { JWTAuthRequest } from '../types/request';
import { eventHub } from '../eventHub';

const eventRouter = Router();

eventRouter.get('/event', (req: JWTAuthRequest, res: Response) => {
    // 1. Extract and Validate
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    const { screen } = req.query;

    if (!companyId || !userId) {
        return res.status(401).json({ error: "Invalid connection credentials" });
    }

    const allowedScreens = ["office-display", "agent-dashboard"];

    if (typeof screen !== "string" || !allowedScreens.includes(screen)) {
        return res.status(403).json({ error: "Invalid screen type" });
    }

    // 2. Set Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 3. Define the Listener
    const onUpdate = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 4. Identify the Event Name (Moving outside the IF for scope access)
    const eventName = screen === "office-display" 
        ? `update:company:${companyId}` 
        : `update:user:${userId}`;

    // Subscribe
    eventHub.on(eventName, onUpdate);

    // 5. Setup Heartbeat (Crucial for preventing timeouts)
    // Sends a comment line every 30s to keep the TCP connection warm
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n'); // If fails, triggers `closed` (handle cases like connection loss on the client side of the connection)
    }, 30000);

    // 6. Handle Disconnection
    req.on('close', () => {        
        // Clean up everything!
        clearInterval(heartbeat);
        eventHub.removeListener(eventName, onUpdate);
        res.end();
    });
});

export default eventRouter;