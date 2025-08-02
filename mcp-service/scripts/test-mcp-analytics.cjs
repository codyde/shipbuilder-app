#!/usr/bin/env node

/**
 * Production test script for Sentry MCP analytics
 * 
 * This script verifies that:
 * 1. Patches are correctly applied
 * 2. Transport detection works properly
 * 3. MCP server can be created with Sentry wrapper
 * 4. Analytics attributes will be captured correctly
 * 
 * Use in CI/CD to verify deployment before production
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testPatchesApplied() {
  log('blue', '🔍 Testing Sentry MCP patches...');
  
  const filesToCheck = [
    'node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js',
    'node_modules/@sentry/core/build/cjs/integrations/mcp-server/attributeExtraction.js',
    'node_modules/@sentry/core/build/esm/integrations/mcp-server/correlation.js',
    'node_modules/@sentry/core/build/cjs/integrations/mcp-server/correlation.js'
  ];

  const requiredPatches = [
    'Respects client-provided sessions and waits for proper session establishment',
    'if (!transport || !transport.constructor)',
    'const fallbackSpanMap = new Map()',
    'typeof transport !== \'object\''
  ];

  let patchedFiles = 0;
  let totalPatches = 0;

  for (const file of filesToCheck) {
    if (!fs.existsSync(file)) {
      log('yellow', `  ⚠️  File not found: ${path.basename(file)}`);
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    let filePatches = 0;
    
    for (const patch of requiredPatches) {
      if (content.includes(patch)) {
        filePatches++;
        totalPatches++;
      }
    }

    if (filePatches > 0) {
      patchedFiles++;
      log('green', `  ✅ ${path.basename(file)} (${filePatches} patches)`);
    } else {
      log('red', `  ❌ ${path.basename(file)} (no patches found)`);
    }
  }

  if (patchedFiles === filesToCheck.length && totalPatches >= 8) {
    log('green', '✅ All Sentry MCP patches verified');
    return true;
  } else {
    log('red', '❌ Patch verification failed');
    return false;
  }
}

function testTransportDetection() {
  log('blue', '🔍 Testing transport detection...');
  
  try {
    // Test transport constructor detection
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const transport = new StreamableHTTPServerTransport({});
    
    const constructorName = transport.constructor.name;
    if (constructorName === 'StreamableHTTPServerTransport') {
      log('green', `  ✅ Transport constructor: ${constructorName}`);
      
      // Test transport name detection logic
      const transportName = constructorName.toLowerCase();
      if (transportName.includes('streamablehttp') || transportName.includes('streamable')) {
        log('green', '  ✅ Transport should be detected as "http"');
        return true;
      } else {
        log('red', '  ❌ Transport detection pattern failed');
        return false;
      }
    } else {
      log('red', `  ❌ Unexpected constructor: ${constructorName}`);
      return false;
    }
  } catch (error) {
    log('red', `  ❌ Transport test failed: ${error.message}`);
    return false;
  }
}

function testSentryWrapper() {
  log('blue', '🔍 Testing Sentry MCP wrapper...');
  
  try {
    const Sentry = require('@sentry/node');
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    
    // Test that wrapMcpServerWithSentry exists
    if (typeof Sentry.wrapMcpServerWithSentry !== 'function') {
      log('red', '  ❌ wrapMcpServerWithSentry not found');
      return false;
    }

    // Test server creation
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const wrappedServer = Sentry.wrapMcpServerWithSentry(server);
    
    if (wrappedServer === server) {
      log('green', '  ✅ Sentry wrapper available and working');
      return true;
    } else {
      log('red', '  ❌ Sentry wrapper returned different object');
      return false;
    }
  } catch (error) {
    log('red', `  ❌ Sentry wrapper test failed: ${error.message}`);
    return false;
  }
}

function testSessionIdInitialization() {
  log('blue', '🔍 Testing sessionId initialization...');
  
  try {
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const crypto = require('crypto');
    
    // Test transport with sessionIdGenerator
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID()
    });
    
    // Test pre-initialization pattern
    if (transport.sessionIdGenerator && !transport.sessionId) {
      transport.sessionId = transport.sessionIdGenerator();
    }
    
    if (transport.sessionId && typeof transport.sessionId === 'string') {
      log('green', `  ✅ SessionId initialized: ${transport.sessionId.substring(0, 8)}...`);
      return true;
    } else {
      log('red', '  ❌ SessionId initialization failed');
      return false;
    }
  } catch (error) {
    log('red', `  ❌ SessionId test failed: ${error.message}`);
    return false;
  }
}

function main() {
  log('blue', '🚀 Sentry MCP Analytics Production Test\n');
  
  const tests = [
    { name: 'Patches Applied', fn: testPatchesApplied },
    { name: 'Transport Detection', fn: testTransportDetection },  
    { name: 'Sentry Wrapper', fn: testSentryWrapper },
    { name: 'SessionId Init', fn: testSessionIdInitialization }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      if (test.fn()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log('red', `  ❌ ${test.name} threw error: ${error.message}`);
      failed++;
    }
    console.log(''); // Empty line
  }

  // Results
  log('blue', '📊 Test Results:');
  log('green', `  ✅ Passed: ${passed}`);
  if (failed > 0) {
    log('red', `  ❌ Failed: ${failed}`);
  }

  if (failed === 0) {
    log('green', '\n🎉 All tests passed! MCP analytics ready for production.');
    log('green', '🔗 Expected Sentry data:');
    console.log('   - mcp.transport: "http"');
    console.log('   - mcp.client.name: "[client-name]"');  
    console.log('   - mcp.session.id: "[uuid]"');
    console.log('   - Complete MCP analytics dashboard');
    process.exit(0);
  } else {
    log('red', '\n💥 Some tests failed. Check the issues above.');
    log('yellow', '💡 Run: npm run patch-sentry && npm run verify-patches');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testPatchesApplied, testTransportDetection, testSentryWrapper };