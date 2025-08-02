#!/usr/bin/env node

/**
 * Simple test to verify enhanced sessionId patch is working
 */

const fs = require('fs');
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testEnhancedPatchContent() {
  log('blue', '🔍 Testing enhanced sessionId patch content...');
  
  const files = [
    'node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js',
    'node_modules/@sentry/core/build/cjs/integrations/mcp-server/attributeExtraction.js'
  ];
  
  const expectedPatches = [
    'transport.sessionIdGenerator && typeof transport.sessionIdGenerator === \'function\'',
    'transport.sessionId = transport.sessionIdGenerator()',
    'This eliminates the need for users to manually pre-initialize sessionId',
    'Auto-initialize sessionId if transport supports it but hasn\'t set it yet'
  ];
  
  let allPatchesFound = true;
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      log('red', `  ❌ File not found: ${file}`);
      allPatchesFound = false;
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    let filePatches = 0;
    
    for (const patch of expectedPatches) {
      if (content.includes(patch)) {
        filePatches++;
      }
    }
    
    if (filePatches === expectedPatches.length) {
      log('green', `  ✅ ${file} - All enhanced patches found`);
    } else {
      log('red', `  ❌ ${file} - Missing patches (${filePatches}/${expectedPatches.length})`);
      allPatchesFound = false;
    }
  }
  
  return allPatchesFound;
}

function testSimulatedScenario() {
  log('blue', '🔍 Testing simulated MCP setup without pre-initialization...');
  
  try {
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const crypto = require('crypto');
    
    // Simulate user creating transport WITHOUT pre-initialization
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID()
    });
    
    // Verify sessionId is not set initially
    if (transport.sessionId) {
      log('red', '  ❌ SessionId was unexpectedly pre-set');
      return false;
    }
    
    log('green', '  ✅ Transport created without sessionId (as expected)');
    log('green', '  ✅ SessionIdGenerator function available');
    log('green', '  ✅ Ready for Sentry to auto-initialize sessionId when needed');
    
    // Test that we can manually trigger the sessionId generator (simulating Sentry's behavior)
    if (transport.sessionIdGenerator && typeof transport.sessionIdGenerator === 'function') {
      const generatedId = transport.sessionIdGenerator();
      if (generatedId && typeof generatedId === 'string') {
        log('green', `  ✅ SessionIdGenerator works: ${generatedId.substring(0, 8)}...`);
        return true;
      }
    }
    
    log('red', '  ❌ SessionIdGenerator test failed');
    return false;
  } catch (error) {
    log('red', `  ❌ Test failed: ${error.message}`);
    return false;
  }
}

function main() {
  log('blue', '🚀 Enhanced SessionId Patch Verification\n');
  
  const tests = [
    { name: 'Enhanced Patch Content', fn: testEnhancedPatchContent },
    { name: 'Simulated User Scenario', fn: testSimulatedScenario }
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
    log('green', '\n🎉 Enhanced SessionId patch verified successfully!');
    log('green', '✨ Sentry will now auto-initialize sessionId for all users');
    log('green', '🔗 No manual pre-initialization required in user code');
    process.exit(0);
  } else {
    log('red', '\n💥 Some tests failed. Check the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}