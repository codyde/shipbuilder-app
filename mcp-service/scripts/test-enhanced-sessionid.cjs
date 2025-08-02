#!/usr/bin/env node

/**
 * Test enhanced sessionId automatic initialization
 * 
 * This test verifies that Sentry's enhanced patch automatically
 * initializes sessionId when needed, eliminating the need for
 * manual pre-initialization by users.
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testAutomaticSessionIdInitialization() {
  log('blue', '🔍 Testing automatic sessionId initialization by Sentry...');
  
  try {
    // Import Sentry's patched attribute extraction
    const { buildTransportAttributes } = require('@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js');
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const crypto = require('crypto');
    
    // Create transport WITHOUT pre-initializing sessionId (simulating user code)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID()
    });
    
    // Verify sessionId is not set initially
    if (transport.sessionId) {
      log('red', '  ❌ SessionId was already set (test setup issue)');
      return false;
    }
    
    log('blue', '  🎯 Transport created without sessionId (simulating real usage)');
    
    // Call Sentry's buildTransportAttributes (this would happen during MCP instrumentation)
    const attributes = buildTransportAttributes(transport, {});
    
    // Verify that sessionId was automatically initialized
    if (!transport.sessionId) {
      log('red', '  ❌ SessionId was not automatically initialized');
      return false;
    }
    
    if (!attributes['mcp.session.id']) {
      log('red', '  ❌ SessionId not included in attributes');
      return false;
    }
    
    if (attributes['mcp.session.id'] !== transport.sessionId) {
      log('red', '  ❌ SessionId mismatch between transport and attributes');
      return false;
    }
    
    log('green', `  ✅ SessionId automatically initialized: ${transport.sessionId.substring(0, 8)}...`);
    log('green', `  ✅ SessionId included in Sentry attributes: ${attributes['mcp.session.id'].substring(0, 8)}...`);
    log('green', '  ✅ Transport type detected: ' + attributes['mcp.transport']);
    
    return true;
  } catch (error) {
    log('red', `  ❌ Test failed: ${error.message}`);
    return false;
  }
}

function testWithPreInitializedSessionId() {
  log('blue', '🔍 Testing compatibility with pre-initialized sessionId...');
  
  try {
    const { buildTransportAttributes } = require('@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js');
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const crypto = require('crypto');
    
    // Create transport and pre-initialize sessionId (legacy pattern)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID()
    });
    
    const preInitializedId = transport.sessionIdGenerator();
    transport.sessionId = preInitializedId;
    
    log('blue', `  🎯 SessionId pre-initialized: ${preInitializedId.substring(0, 8)}...`);
    
    // Call Sentry's buildTransportAttributes
    const attributes = buildTransportAttributes(transport, {});
    
    // Verify that pre-initialized sessionId was preserved
    if (transport.sessionId !== preInitializedId) {
      log('red', '  ❌ Pre-initialized sessionId was overwritten');
      return false;
    }
    
    if (attributes['mcp.session.id'] !== preInitializedId) {
      log('red', '  ❌ Pre-initialized sessionId not used in attributes');
      return false;
    }
    
    log('green', '  ✅ Pre-initialized sessionId preserved');
    log('green', '  ✅ Backward compatibility maintained');
    
    return true;
  } catch (error) {
    log('red', `  ❌ Test failed: ${error.message}`);
    return false;
  }
}

function main() {
  log('blue', '🚀 Enhanced SessionId Initialization Test\n');
  
  const tests = [
    { name: 'Automatic SessionId Init', fn: testAutomaticSessionIdInitialization },
    { name: 'Pre-initialized Compat', fn: testWithPreInitializedSessionId }
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
    log('green', '\n🎉 Enhanced SessionId initialization working perfectly!');
    log('green', '✨ Users no longer need manual sessionId pre-initialization');
    log('green', '🔗 Complete session tracking available from first MCP operation');
    process.exit(0);
  } else {
    log('red', '\n💥 Some tests failed. Check the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testAutomaticSessionIdInitialization, testWithPreInitializedSessionId };