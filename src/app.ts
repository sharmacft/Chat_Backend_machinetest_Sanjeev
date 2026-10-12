import 'dotenv/config';
import express from 'express';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use(chatRoutes);
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Chat API listening on port ${port}`);
  });
}

export default app;
