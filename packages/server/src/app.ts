import './config/index.js';
import { createServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter }     from './api/auth/routes.js';
import { empireRouter }   from './api/empire/routes.js';
import { exchangeRouter } from './api/exchange/routes.js';
import { chatRouter }     from './api/chat/routes.js';
import { publicRouter }   from './api/public/routes.js';
import { keepRouter }     from './api/keep/routes.js';
import { regionRouter }   from './api/region/routes.js';
import { caravanRouter }  from './api/caravan/routes.js';
import { adminRouter }    from './api/admin/routes.js';
import { createSocketServer } from './ws/index.js';
import { startTickJob }   from './jobs/tick-job.js';
import { startControlJob } from './jobs/control-job.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env['VITE_API_URL'] ?? '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',       authRouter);
app.use('/api/empire',     empireRouter);
app.use('/api/exchange',   exchangeRouter);
app.use('/api/chat',       chatRouter);
app.use('/api/keeps',      keepRouter);
app.use('/api/regions',    regionRouter);
app.use('/api/caravans',   caravanRouter);
app.use('/api/public/v1',  publicRouter);
app.use('/admin',          adminRouter);

if (config.ENABLE_DEBUG_ENDPOINTS) {
  const { Router } = await import('express');
  const dbg = Router();
  dbg.get('/ping', (_req, res) => res.json({ ok: true }));
  app.use('/debug', dbg);
}

app.use(errorHandler);

const httpServer = createServer(app);
const io = createSocketServer(httpServer);

void startTickJob(io);
startControlJob();

httpServer.listen(config.PORT, config.HOST, () => {
  console.warn(`🚀 Merchant Realms server on ${config.HOST}:${config.PORT} [${config.NODE_ENV}]`);
});

export { app, io };
