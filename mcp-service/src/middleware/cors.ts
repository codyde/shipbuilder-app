import cors from 'cors';
import { getFrontendUrl } from '../config/mcp-config.js';

// CORS configuration for MCP service
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests from frontend and development environments
    const allowedOrigins = [
      getFrontendUrl(),
      'http://localhost:5173', // Development frontend
      'http://localhost:3000', // Alternative development port
      'https://shipbuilder.app', // Production frontend
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For MCP clients, be more permissive in development
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'MCP-Protocol-Version',
    'MCP-Session-Id',
    'X-Requested-With',
    'Origin'
  ],
  exposedHeaders: [
    'MCP-Protocol-Version',
    'MCP-Session-Id'
  ]
};

export const corsMiddleware = cors(corsOptions);