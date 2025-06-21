import './instrument.ts'
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { projectRoutes } from './routes/projects.js';
import { chatRoutes } from './routes/chat.js';
import { migrateRoutes } from './routes/migrate.js';
import { aiRoutes } from './routes/ai.js';
import { setupSwagger } from './swagger.js';
import * as Sentry from "@sentry/node";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Setup Swagger documentation
setupSwagger(app);

Sentry.setupExpressErrorHandler(app);

app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});