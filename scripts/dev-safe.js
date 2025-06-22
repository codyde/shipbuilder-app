#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.cyan) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkPort(port) {
  try {
    await execAsync(`lsof -ti:${port}`);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(port, maxWait = 30000) {
  const startTime = Date.now();
  log(`Waiting for server on port ${port}...`, colors.yellow);
  
  while (Date.now() - startTime < maxWait) {
    if (await checkPort(port)) {
      log(`✅ Server is ready on port ${port}`, colors.green);
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  log(`❌ Server not ready after ${maxWait}ms`, colors.red);
  return false;
}

async function main() {
  log('🚀 Starting safe development mode...', colors.bright);
  
  // Kill any existing processes on our ports
  try {
    await execAsync('pkill -f "tsx --watch server/index.ts"');
    await execAsync('pkill -f "vite"');
    log('Cleaned up existing processes', colors.yellow);
  } catch {
    // Ignore errors if no processes to kill
  }
  
  // Start server
  log('Starting backend server...', colors.blue);
  const server = spawn('npm', ['run', 'dev:server'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
  });
  
  // Wait for server to be ready
  const serverReady = await waitForServer(3001);
  
  if (!serverReady) {
    log('❌ Failed to start server, exiting...', colors.red);
    server.kill();
    process.exit(1);
  }
  
  // Start client
  log('Starting frontend client...', colors.blue);
  const client = spawn('npm', ['run', 'dev:client'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
  });
  
  // Handle cleanup
  process.on('SIGINT', () => {
    log('\n🛑 Shutting down...', colors.yellow);
    server.kill();
    client.kill();
    process.exit(0);
  });
  
  server.on('exit', (code) => {
    if (code !== 0) {
      log(`❌ Server exited with code ${code}`, colors.red);
      client.kill();
      process.exit(1);
    }
  });
  
  client.on('exit', (code) => {
    if (code !== 0) {
      log(`❌ Client exited with code ${code}`, colors.red);
      server.kill();
      process.exit(1);
    }
  });
  
  log('✅ Development servers are running!', colors.green);
  log('Backend: http://localhost:3001', colors.cyan);
  log('Frontend: http://localhost:5173', colors.cyan);
  log('Press Ctrl+C to stop', colors.yellow);
}

main().catch(console.error);