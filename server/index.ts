import './instrument.ts'
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { projectRoutes } from './routes/projects.js';
import { chatRoutes } from './routes/chat.js';
import { migrateRoutes } from './routes/migrate.js';
import { aiRoutes } from './routes/ai.js';
import authRoutes from './routes/auth.js';
import { authenticateUser } from './middleware/auth.js';
import { apiRateLimit } from './middleware/rate-limit.js';
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/logging.js';
import { setupSwagger } from './swagger.js';
import { logger } from './lib/logger.js';
import * as Sentry from "@sentry/node";

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for proper IP detection in rate limiting
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'baggage', 
    'sentry-trace',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
}));
app.use(express.json());

// Add request logging middleware
app.use(loggingMiddleware);

// Setup Swagger documentation
setupSwagger(app);

Sentry.setupExpressErrorHandler(app);

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication and rate limiting)
app.use('/api/projects', apiRateLimit, authenticateUser, projectRoutes);
app.use('/api/chat', apiRateLimit, authenticateUser, chatRoutes);
app.use('/api/ai', apiRateLimit, authenticateUser, aiRoutes);

// Public routes
app.use('/api/migrate', migrateRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add error logging middleware (should be last)
app.use(errorLoggingMiddleware);

app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
  console.log(`Server running on http://localhost:${PORT}`);
});