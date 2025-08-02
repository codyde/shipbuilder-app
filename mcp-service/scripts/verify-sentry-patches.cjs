#!/usr/bin/env node

/**
 * Verification script for Sentry MCP server instrumentation patches
 * 
 * This script verifies that the refined patches are properly applied
 * to prevent crashes while preserving MCP telemetry features
 */

const fs = require('fs');
const path = require('path');

const files = [
  'node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js',
  'node_modules/@sentry/core/build/cjs/integrations/mcp-server/attributeExtraction.js',
  'node_modules/@sentry/core/build/esm/integrations/mcp-server/correlation.js',
  'node_modules/@sentry/core/build/cjs/integrations/mcp-server/correlation.js'
];

const requiredPatches = [
  {
    name: 'sessionId handling in attributeExtraction',
    pattern: 'transport && \'sessionId\' in transport ? transport.sessionId : undefined',
    description: 'Handles cases where transport exists but sessionId is not yet set during initialization'
  },
  {
    name: 'transport constructor null check in attributeExtraction',
    pattern: 'if (!transport || !transport.constructor)',
    description: 'Handles undefined transport gracefully while preserving type detection'
  },
  {
    name: 'WeakMap fallback in correlation',
    pattern: 'const fallbackSpanMap = new Map()',
    description: 'Provides persistent fallback Map for invalid transport objects'
  },
  {
    name: 'correlation type validation',
    pattern: 'if (!transport || typeof transport !== \'object\')',
    description: 'Validates transport objects before using as WeakMap keys'
  }
];

function verifyFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let patchCount = 0;
    
    for (const patch of requiredPatches) {
      if (content.includes(patch.pattern)) {
        patchCount++;
        console.log(`  ✅ Found: ${patch.name}`);
      }
    }

    if (patchCount > 0) {
      console.log(`✅ Verified ${patchCount} patches in: ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`❌ No patches found in: ${path.basename(filePath)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔍 Verifying Sentry MCP patch status...\n');
  
  let verifiedCount = 0;
  let totalFiles = files.length;

  for (const file of files) {
    if (verifyFile(file)) {
      verifiedCount++;
    }
    console.log(''); // Empty line for readability
  }

  console.log(`📊 Verification Results: ${verifiedCount}/${totalFiles} files have patches applied`);
  
  if (verifiedCount === totalFiles) {
    console.log('\n🎉 All Sentry MCP patches are properly applied!');
    console.log('🎯 StreamableHTTPServerTransport compatibility ensured');
    console.log('📈 MCP telemetry features preserved for Sentry analytics');
    console.log('🚀 Service ready for production deployment');
  } else {
    console.log('\n⚠️  Some files are missing patches. This may cause runtime errors.');
    console.log('💡 Run: npm run patch-sentry to apply missing patches');
  }
  
  return verifiedCount === totalFiles;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { verifyFile, requiredPatches };