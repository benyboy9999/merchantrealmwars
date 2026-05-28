import './config/index.js'; // validate env vars at startup before anything else
import { createServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './api/auth/routes.js';
import { empireRouter } from './api/empire/routes.js';
import { exchangeRouter } from './api/exchange/routes.js';
import { chatRouter } from './api/chat/routes.js';
import { publicRouter } from './api/public/routes.js';
import { createSocketServer } from './ws/index.js';
import { startTickJob } from './jobs/tick-job.js';
import { startControlJob } from './jobs/control-job.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env['VITE_API_URL'] ?? '*', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/empire', empireRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/public/v1', publicRouter);

// Debug endpoints — dev only
if (config.ENABLE_DEBUG_ENDPOINTS) {
  const { Router } = await import('express');
  const debugRouter = Router();
  debugRouter.post('/tick', (_req, res) => {
    res.json({ message: 'Manual tick endpoint — TODO: wire up to tick runner' });
  });
  app.use('/debug', debugRouter);
}

app.use(errorHandler);

const httpServer = createServer(app);
const io = createSocketServer(httpServer);

startTickJob(io);
startControlJob();

httpServer.listen(config.PORT, config.HOST, () => {
  console.warn(`🚀 Artemis server listening on ${config.HOST}:${config.PORT}`);
  console.warn(`   Environment: ${config.NODE_ENV}`);
});

export { app, io };
