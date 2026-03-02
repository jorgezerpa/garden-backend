import express, { Application, } from 'express';
import mainRouter from './routes';
import cors from 'cors'; // 1. Import cors

const app: Application = express();

app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Main Router
app.use('/api', mainRouter);

export default app