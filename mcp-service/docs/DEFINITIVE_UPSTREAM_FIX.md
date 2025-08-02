# Definitive Sentry MCP StreamableHTTPServerTransport Fix

## Executive Summary

**Primary Issue**: Sentry's MCP server instrumentation crashes when used with `StreamableHTTPServerTransport` due to defensive programming gaps in edge case handling.

**Root Cause**: While the main cause was user code overriding `onmessage` handlers (now fixed), Sentry's MCP instrumentation lacks defensive handling for common edge cases during MCP initialization flow.

**Solution**: Apply 4 defensive patches to Sentry's MCP instrumentation that gracefully handle edge cases while preserving full MCP analytics functionality.

**Impact**: Enables production-ready Sentry MCP analytics with StreamableHTTPServerTransport without requiring user workarounds.

---

## Required Upstream Sentry SDK Changes

### Files to Modify

1. `@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js`
2. `@sentry/core/build/cjs/integrations/mcp-server/attributeExtraction.js` 
3. `@sentry/core/build/esm/integrations/mcp-server/correlation.js`
4. `@sentry/core/build/cjs/integrations/mcp-server/correlation.js`

### Patch 1: Graceful SessionId Handling

**File**: `attributeExtraction.js` (both ESM and CJS)
**Function**: `buildTransportAttributes()`

**Current Code** (causes crashes):
```javascript
const sessionId = transport.sessionId;
```

**Required Fix**:
```javascript
// PATCHED: Gracefully handle undefined sessionId during MCP initialization
// Respects client-provided sessions and waits for proper session establishment  
const sessionId = transport && 'sessionId' in transport ? transport.sessionId : undefined;

// Note: sessionId may be undefined during initial setup - this is expected behavior
// The actual session should be established by the client during the initialize flow
```

**Issue**: StreamableHTTPServerTransport sets `sessionId` during initialization flow, but Sentry tries to access it before it's set.
**Fix**: Gracefully handle undefined sessionId without forcing initialization.

### Patch 2: Transport Constructor Null Checks

**File**: `attributeExtraction.js` (both ESM and CJS)  
**Function**: `getTransportTypes()`

**Current Code** (causes crashes):
```javascript
function getTransportTypes(transport) {
  const transportName = transport.constructor.name?.toLowerCase() || '';
```

**Required Fix**:
```javascript
function getTransportTypes(transport) {
  // PATCHED: Handle undefined transport gracefully while preserving type detection
  if (!transport || !transport.constructor) {
    return { mcpTransport: 'unknown', networkTransport: 'unknown' };
  }
  const transportName = transport.constructor.name?.toLowerCase() || '';
```

**Issue**: Sentry assumes transport and transport.constructor are always defined.
**Fix**: Add defensive null checks with graceful fallback.

### Patch 3: WeakMap Correlation Fallback System

**File**: `correlation.js` (both ESM and CJS)
**Location**: After `transportToSpanMap` declaration

**Current Code** (causes WeakMap errors):
```javascript
const transportToSpanMap = new WeakMap();
```

**Required Addition**:
```javascript
const transportToSpanMap = new WeakMap();

// PATCHED: Fallback span map for invalid transport objects
const fallbackSpanMap = new Map();
```

**Issue**: WeakMap requires valid object keys, but invalid transport objects cause crashes.
**Fix**: Add persistent fallback Map for invalid transport objects.

### Patch 4: WeakMap Type Validation

**File**: `correlation.js` (both ESM and CJS)
**Function**: `getOrCreateSpanMap()`

**Current Code** (causes WeakMap key errors):
```javascript
function getOrCreateSpanMap(transport) {
  let spanMap = transportToSpanMap.get(transport);
```

**Required Fix**:
```javascript
function getOrCreateSpanMap(transport) {
  // PATCHED: Handle invalid transport values for WeakMap while preserving correlation
  if (!transport || typeof transport !== 'object') {
    // Return persistent fallback Map to maintain correlation across calls
    return fallbackSpanMap;
  }
  
  let spanMap = transportToSpanMap.get(transport);
```

**Issue**: Invalid transport objects cannot be used as WeakMap keys.
**Fix**: Validate transport type before WeakMap operations, use fallback for invalid objects.

---

## Expected Results After Patches

### Before Patches (Broken):
- Crashes: `Cannot read properties of undefined (reading 'sessionId')`
- Transport detection: `'unknown'` (should be `'http'`)
- Missing client identification and session tracking
- WeakMap key errors in correlation system

### After Patches (Working):
```javascript
// Expected Sentry span data:
{
  op: 'mcp.server',
  description: 'initialize',
  data: {
    'mcp.transport': 'http',           // ✅ Correct detection
    'mcp.client.name': 'claude-code',  // ✅ Client identification  
    'mcp.session.id': 'uuid-here',     // ✅ Session tracking (when available)
    'mcp.protocol.version': '2025-06-18'
  }
}
```

### Verification Commands:
```bash
# 1. Check transport detection
node -e "
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const transport = new StreamableHTTPServerTransport();
console.log('Constructor:', transport.constructor.name);
// Should log: Constructor: StreamableHTTPServerTransport
"

# 2. Verify Sentry wrapper exists
node -e "
const Sentry = require('@sentry/node');
console.log('Wrapper available:', typeof Sentry.wrapMcpServerWithSentry === 'function');
// Should log: Wrapper available: true
"
```

---

## User Implementation Requirements

### ✅ Correct Pattern (Works with patches):
```typescript
import * as Sentry from '@sentry/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// 1. Initialize Sentry before other imports
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  tracesSampleRate: 1.0
});

// 2. Create Sentry-wrapped server
const server = Sentry.wrapMcpServerWithSentry(new McpServer({
  name: "my-server",
  version: "1.0.0"
}));

// 3. Create transport (sessionId managed by MCP protocol)
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID()  // For stateful mode
});

// 4. Connect server to transport (Sentry instruments here)
await server.connect(transport);

// 5. ✅ CRITICAL: Never override onmessage after connect()
// This was the original root cause of instrumentation failures
```

### ❌ Broken Pattern (Causes issues):
```typescript
await server.connect(transport);

// This breaks Sentry's instrumentation context:
transport.onmessage = async (message, extra) => {
  // Custom logic here breaks Sentry's transport context
  await originalHandler(message, extra);
};
```

---

## Compatibility & Testing

### Supported Versions:
- **Sentry**: `@sentry/node v10.0.0+`
- **MCP SDK**: `@modelcontextprotocol/sdk v1.16.0+`  
- **Node.js**: 18+

### Test Matrix:
| Transport Mode | SessionId Behavior | Expected Result |
|----------------|-------------------|------------------|
| Stateful | Generated by server | ✅ Full session tracking |
| Stateless | No sessionId | ✅ Graceful handling, no crashes |
| Client-provided | Set by client | ✅ Respects client session |

### Automated Testing:
```bash
# Verify patches applied correctly
npm run verify-patches

# Test transport detection  
npm run test-mcp-analytics

# Test session flow
npm run test-session-flow
```

---

## Production Deployment

### CI/CD Integration:
```yaml
# .github/workflows/test-mcp-analytics.yml
steps:
  - name: Install dependencies
    run: npm ci
    
  - name: Apply Sentry patches  
    run: npm run patch-sentry
    
  - name: Verify MCP analytics
    run: npm run test-mcp-analytics
```

### Package.json Scripts:
```json
{
  "scripts": {
    "postinstall": "node scripts/patch-sentry-mcp.cjs",
    "patch-sentry": "node scripts/patch-sentry-mcp.cjs", 
    "verify-patches": "node scripts/verify-sentry-patches.cjs",
    "test-session-flow": "node scripts/test-session-flow.cjs"
  }
}
```

---

## Impact Assessment

### For Sentry Users:
- **Before**: Crashes with StreamableHTTPServerTransport, forced to use deprecated SSEServerTransport
- **After**: Production-ready MCP analytics with modern transport, no user workarounds needed

### For Sentry SDK:
- **Risk**: Low - purely defensive patches, no breaking changes
- **Benefit**: Enables MCP analytics for modern transport implementations  
- **Compatibility**: Maintains backward compatibility with existing implementations

### For MCP Ecosystem:
- **Standards Compliance**: Respects MCP protocol session management
- **Transport Support**: Enables analytics for all MCP transport types
- **Future-Proof**: Works with both current and future MCP transport implementations

---

## Appendix: Original Investigation

### Timeline of Issues:
1. **Initial Problem**: StreamableHTTPServerTransport caused Sentry crashes
2. **Root Cause Discovery**: User code `onmessage` override broke Sentry context  
3. **Defensive Gaps Found**: Sentry lacked edge case handling during investigation
4. **Comprehensive Solution**: Fixed user code + added defensive SDK patches

### Key Learnings:
- Primary issues often have secondary defensive programming opportunities
- MCP instrumentation requires careful handling of async initialization flows
- Transport diversity necessitates robust type detection and graceful fallbacks
- Session management should respect protocol specifications, not force implementation details

### References:
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [StreamableHTTPServerTransport Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Sentry MCP Integration Documentation](https://docs.sentry.io/)