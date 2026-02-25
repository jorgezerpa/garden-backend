import express, { Application, } from 'express';
import mainRouter from './routes';

const app: Application = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Main Router
app.use('/api', mainRouter);

export default app