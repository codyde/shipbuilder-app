# Sentry MCP Instrumentation Fix: StreamableHTTPServerTransport Compatibility Issues

## Current Status

✅ **FULLY RESOLVED** - Complete fix implemented with working MCP analytics in production.

### Root Cause Identified

The primary issue was **user code breaking Sentry's transport instrumentation** by overriding the `onmessage` handler after `server.connect()`. This caused:

1. **Transport context loss**: `this` became `undefined` in Sentry's attribute extraction
2. **Broken analytics**: All transport attributes showed as `'unknown'` instead of proper values  
3. **Missing telemetry**: No client identification, session tracking, or transport distribution data

### Complete Solution

#### 1. **User Code Fix** (Primary Solution)
```typescript
// ❌ WRONG - This breaks Sentry's MCP instrumentation
await server.connect(transport);
transport.onmessage = customHandler; // Overwrites Sentry's wrapper!

// ✅ CORRECT - Let Sentry's instrumentation work
await server.connect(transport);
// Don't override onmessage - Sentry wraps it during connect()
```

#### 2. **Sentry SDK Patches** (Defensive Programming)
Applied defensive patches to handle edge cases:
- **SessionId validation**: `transport && 'sessionId' in transport ? transport.sessionId : undefined`
- **Constructor null checks**: `if (!transport || !transport.constructor)`
- **WeakMap correlation fallback**: Persistent Map for invalid transport objects

### Verified Results
- ✅ `mcp.transport: "http"` (correct detection of StreamableHTTPServerTransport)
- ✅ `mcp.client.name: "claude-code"` (proper client identification) 
- ✅ `mcp.session.id: "uuid"` (session tracking working)
- ✅ **Complete MCP analytics in Sentry**: Traffic, Traffic by Client, Transport Distribution, tool usage metrics

---

## Replication Guide for New Deployments

### Quick Fix Checklist

1. **✅ Primary Fix**: Never override `transport.onmessage` after `server.connect()`
2. **✅ Apply defensive patches**: Use automated patch script for Sentry SDK
3. **✅ Verify MCP analytics**: Check Sentry dashboard for transport detection
4. **✅ Test with real clients**: Confirm client identification and session tracking

### Enhanced Automated Patch Application

The patch script applies **4 critical fixes** to Sentry's MCP instrumentation:

1. **Graceful SessionId Handling** - Gracefully handles undefined sessionId during MCP setup (NEW v2 enhancement)
2. **Transport Constructor Null Checks** - Prevents crashes on undefined transport objects  
3. **WeakMap Correlation Fallback** - Handles invalid transport objects in correlation system
4. **Defensive Error Handling** - Graceful fallback for all edge cases

#### 1. Copy Patch Script
```bash
# Copy the working patch script
cp scripts/patch-sentry-mcp.cjs /your/new/project/scripts/
cp scripts/verify-sentry-patches.cjs /your/new/project/scripts/
```

#### 2. Update package.json
```json
{
  "scripts": {
    "postinstall": "node scripts/patch-sentry-mcp.cjs",
    "patch-sentry": "node scripts/patch-sentry-mcp.cjs", 
    "verify-patches": "node scripts/verify-sentry-patches.cjs"
  }
}
```

#### 3. Install and Patch
```bash
npm install
npm run verify-patches  # Confirm all patches applied
```

### MCP Server Implementation Pattern

```typescript
// ✅ CORRECT PATTERN - Full Sentry MCP Analytics
import * as Sentry from '@sentry/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// 1. Create Sentry-wrapped server
const server = Sentry.wrapMcpServerWithSentry(new McpServer({
  name: "my-server",
  version: "1.0.0"
}));

// 2. Create transport with pre-initialized sessionId (optional but recommended)
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID()
});

// Pre-initialize sessionId to prevent timing issues
if (transport.sessionIdGenerator && !transport.sessionId) {
  transport.sessionId = transport.sessionIdGenerator();
}

// 3. Connect server to transport (Sentry instruments onmessage here)
await server.connect(transport);

// 4. ❌ NEVER DO THIS - Breaks Sentry instrumentation
// transport.onmessage = customHandler; 

// 5. ✅ For custom logging, use Sentry's beforeSendSpan hook instead
Sentry.init({
  beforeSendSpan: (span) => {
    if (span.op === 'mcp.server' || span.op === 'mcp.notification.client_to_server') {
      console.log('MCP Span:', {
        op: span.op,
        description: span.description,
        transport: span.data?.['mcp.transport'],
        client: span.data?.['mcp.client.name']
      });
    }
    return span;
  }
});
```

### Verification Commands

```bash
# 1. Check patches are applied
npm run verify-patches

# 2. Test transport detection during development
node -e "
const transport = new (require('@modelcontextprotocol/sdk/server/streamableHttp.js')).StreamableHTTPServerTransport();
console.log('Transport constructor:', transport.constructor.name);
console.log('Should detect as StreamableHTTPServerTransport');
"

# 3. Monitor Sentry spans in production
# Look for spans with op: 'mcp.server' and data.mcp.transport: 'http'
```

### Common Deployment Issues

1. **Transport still shows 'unknown'**: Check that patches are applied in production
2. **Missing client info**: Verify `initialize` message contains `clientInfo` parameter  
3. **No session tracking**: Ensure enhanced patches are applied (gracefully handles undefined sessionId)
4. **Broken after Sentry updates**: Re-run patch script after any @sentry/core updates

### Enhanced Features (v2)

✨ **Graceful Undefined SessionId Handling**: Enhanced patches now gracefully handle undefined sessionId during MCP initialization, respecting proper MCP protocol session management.

- **Before**: Crashes when sessionId was undefined during setup
- **After**: Sentry gracefully handles undefined sessionId, waits for proper MCP session establishment  
- **Benefit**: Respects MCP protocol session flow, works with both stateful and stateless modes

---

## Original Problem Analysis (Historical)

The Sentry MCP server instrumentation (`@sentry/node` v10.0.0+) has multiple compatibility issues when used with `StreamableHTTPServerTransport` from the MCP TypeScript SDK. These cause the `initialize` message to fail with various TypeErrors, preventing MCP servers from starting.

## Root Cause Analysis

### Issue 1: SessionId Undefined
1. **StreamableHTTPServerTransport** only sets `sessionId` **after** processing the first message during initialization
2. **Sentry's instrumentation** tries to access `transport.sessionId` **during** the `initialize` message processing
3. This creates a race condition where `sessionId` is `undefined` when Sentry's `buildTransportAttributes()` function executes

### Issue 2: Transport Parameter Undefined
1. **Sentry's instrumentation** sometimes receives `undefined` as the `transport` parameter
2. **getTransportTypes()** function tries to access `transport.constructor.name` without null checks
3. Results in `Cannot read properties of undefined (reading 'constructor')` errors

### Issue 3: Invalid WeakMap Key
1. **Sentry's correlation system** uses a WeakMap to track spans per transport
2. **getOrCreateSpanMap()** function receives invalid transport objects (null/undefined/primitives)
3. WeakMap requires object keys, causing `Invalid value used as weak map key` errors

### Error Examples

#### Error 1: SessionId Access
```
TypeError: Cannot read properties of undefined (reading 'sessionId')
    at buildTransportAttributes (/node_modules/@sentry/core/src/integrations/mcp-server/attributeExtraction.ts:268:31)
```

#### Error 2: Transport Constructor Access  
```
TypeError: Cannot read properties of undefined (reading 'constructor')
    at getTransportTypes (/node_modules/@sentry/core/src/integrations/mcp-server/attributeExtraction.ts:48:35)
```

#### Error 3: WeakMap Key Error
```
TypeError: Invalid value used as weak map key
    at WeakMap.set (<anonymous>)
    at getOrCreateSpanMap (/node_modules/@sentry/core/src/integrations/mcp-server/correlation.ts:32:24)
```

### Affected Code Locations

#### Issue 1: attributeExtraction.ts (Line ~268)
```typescript
function buildTransportAttributes(transport, extra) {
  const sessionId = transport.sessionId; // ❌ Can be undefined
  // ...
}
```

#### Issue 2: attributeExtraction.ts (Line ~17)
```typescript
function getTransportTypes(transport) {
  const transportName = transport.constructor?.name?.toLowerCase() || ''; // ❌ transport can be undefined
  // ...
}
```

#### Issue 3: correlation.ts (Line ~31)
```typescript
function getOrCreateSpanMap(transport) {
  let spanMap = transportToSpanMap.get(transport);
  if (!spanMap) {
    spanMap = new Map();
    transportToSpanMap.set(transport, spanMap); // ❌ transport can be invalid WeakMap key
  }
  return spanMap;
}
```

## Impact Assessment

### Affected Components
- **Transport Type**: `StreamableHTTPServerTransport` (primary)
- **Message Type**: `initialize` (always fails)
- **Sentry Version**: `@sentry/node` v10.0.0+
- **MCP SDK Version**: `@modelcontextprotocol/sdk` v1.16.0+

### Symptoms
- MCP client connections fail with "server reconnection failed"
- `initialize` handshake never completes
- Error in logs: `Cannot read properties of undefined (reading 'sessionId')`
- All MCP functionality becomes unavailable

### Business Impact
- **Critical**: Blocks all MCP server functionality when Sentry instrumentation is enabled
- **Workaround Required**: Forces choice between Sentry monitoring or MCP functionality
- **Production Blocker**: Cannot deploy MCP servers with Sentry in production

## Technical Solution

### Comprehensive Fix: Defensive Programming for All Issues

#### Fix 1: buildTransportAttributes() - SessionId Handling
```typescript
function buildTransportAttributes(transport, extra) {
  // FIXED: Handle optional sessionId for StreamableHTTPServerTransport
  const sessionId = transport?.sessionId;
  const clientInfo = extra ? extractClientInfo(extra) : {};
  const { mcpTransport, networkTransport } = getTransportTypes(transport);
  const clientAttributes = getClientAttributes(transport);
  const serverAttributes = getServerAttributes(transport);
  const protocolVersion = getProtocolVersionForTransport(transport);

  const attributes = {
    // Only include sessionId if it exists and is not undefined
    ...(sessionId !== undefined && { [MCP_SESSION_ID_ATTRIBUTE]: sessionId }),
    [MCP_TRANSPORT_TYPE_ATTRIBUTE]: mcpTransport,
    [NETWORK_TRANSPORT_ATTRIBUTE]: networkTransport,
    [MCP_PROTOCOL_VERSION_ATTRIBUTE]: protocolVersion,
    ...clientAttributes,
    ...serverAttributes,
  };

  return attributes;
}
```

#### Fix 2: getTransportTypes() - Transport Undefined Handling
```typescript
function getTransportTypes(transport) {
  // FIXED: Handle undefined transport gracefully
  if (!transport) {
    return { mcpTransport: 'unknown', networkTransport: 'unknown' };
  }
  const transportName = transport.constructor?.name?.toLowerCase() || '';

  if (transportName.includes('stdio')) {
    return { mcpTransport: 'stdio', networkTransport: 'pipe' };
  }

  if (transportName.includes('streamablehttp') || transportName.includes('streamable')) {
    return { mcpTransport: 'http', networkTransport: 'tcp' };
  }

  if (transportName.includes('sse')) {
    return { mcpTransport: 'sse', networkTransport: 'tcp' };
  }

  return { mcpTransport: 'unknown', networkTransport: 'unknown' };
}
```

#### Fix 3: getOrCreateSpanMap() - WeakMap Key Validation
```typescript
function getOrCreateSpanMap(transport) {
  // FIXED: Handle invalid transport values for WeakMap
  if (!transport || typeof transport !== 'object') {
    // Return a fallback Map for invalid transports
    return new Map();
  }
  
  let spanMap = transportToSpanMap.get(transport);
  if (!spanMap) {
    spanMap = new Map();
    transportToSpanMap.set(transport, spanMap);
  }
  return spanMap;
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('buildTransportAttributes', () => {
  it('should handle undefined sessionId gracefully', () => {
    const transport = {
      sessionId: undefined,
      // ... other transport properties
    };
    
    const result = buildTransportAttributes(transport, {});
    
    expect(result).not.toHaveProperty(MCP_SESSION_ID_ATTRIBUTE);
    expect(() => buildTransportAttributes(transport, {})).not.toThrow();
  });

  it('should include sessionId when available', () => {
    const transport = {
      sessionId: 'test-session-123',
      // ... other transport properties  
    };
    
    const result = buildTransportAttributes(transport, {});
    
    expect(result[MCP_SESSION_ID_ATTRIBUTE]).toBe('test-session-123');
  });
});
```

### Integration Tests
```typescript
describe('StreamableHTTPServerTransport with Sentry', () => {
  it('should handle initialize message without sessionId error', async () => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => 'test-session',
    });
    
    const server = Sentry.wrapMcpServerWithSentry(new McpServer(/* ... */));
    
    // Should not throw during connection
    await expect(server.connect(transport)).resolves.not.toThrow();
  });
});
```

## Backwards Compatibility

### Safe Changes
- Adding optional chaining (`?.`) is backwards compatible
- Adding undefined checks doesn't break existing functionality
- Conditional attribute inclusion maintains existing behavior when sessionId exists

### Version Support
- Fix should work across all MCP SDK versions
- No breaking changes to Sentry's public API
- Maintains existing instrumentation behavior for other transport types

## Implementation Plan

### Phase 1: Core Fix
1. Update `buildTransportAttributes()` function with defensive programming
2. Add comprehensive unit tests for undefined sessionId scenarios
3. Test with both stateful and stateless transport configurations

### Phase 2: Enhanced Support  
1. Add specific StreamableHTTPServerTransport detection
2. Implement transport-specific session handling logic
3. Add performance monitoring for session timing

### Phase 3: Documentation
1. Update MCP server instrumentation docs
2. Add StreamableHTTPServerTransport-specific guidance
3. Document best practices for session management

## Alternative Workarounds (Temporary)

### 1. Pre-initialization Fix
```typescript
// In user code before server.connect()
if (transport.sessionIdGenerator) {
  transport.sessionId = transport.sessionIdGenerator();
}
await server.connect(transport);
```

### 2. Monkey Patch (Not Recommended)
```typescript
// Patch Sentry's attribution function temporarily
const originalBuildTransportAttributes = require('@sentry/core').buildTransportAttributes;
require('@sentry/core').buildTransportAttributes = function(transport, extra) {
  if (!transport.sessionId) {
    transport.sessionId = undefined; // Ensure it's explicitly undefined
  }
  return originalBuildTransportAttributes(transport, extra);
};
```

### 3. Remove Sentry Wrapper (Loses Functionality)
```typescript
// Not recommended - loses all MCP instrumentation
const server = new McpServer(/* ... */); // Without Sentry.wrapMcpServerWithSentry()
```

## Files to Modify

### Primary Changes
- `packages/core/src/integrations/mcp-server/attributeExtraction.ts` - Fix Issues 1 & 2
- `packages/core/src/integrations/mcp-server/correlation.ts` - Fix Issue 3
- `packages/core/src/integrations/mcp-server/spans.ts` (if similar issues exist)

### Built Files (for immediate patching)
- `packages/core/build/esm/integrations/mcp-server/attributeExtraction.js`
- `packages/core/build/cjs/integrations/mcp-server/attributeExtraction.js`
- `packages/core/build/esm/integrations/mcp-server/correlation.js`
- `packages/core/build/cjs/integrations/mcp-server/correlation.js`

### Test Files  
- `packages/core/test/integrations/mcp-server/attributeExtraction.test.ts`
- `packages/core/test/integrations/mcp-server/correlation.test.ts`
- `packages/node/test/integrations/mcp-server.test.ts`

### Documentation
- `docs/platforms/javascript/guides/node/instrumentation/mcp-server.mdx`
- `CHANGELOG.md`

## Success Criteria

1. **Functional**: MCP servers with StreamableHTTPServerTransport can initialize successfully with Sentry instrumentation
2. **Error-Free**: No more `Cannot read properties of undefined (reading 'sessionId')` errors
3. **Performance**: No performance degradation in session handling
4. **Backwards Compatible**: Existing MCP servers continue working unchanged
5. **Test Coverage**: 100% test coverage for sessionId edge cases

## Release Notes

### Bug Fix
- Fixed `TypeError` in MCP server instrumentation when using `StreamableHTTPServerTransport` with undefined `sessionId`
- Added defensive programming to handle optional session identifiers gracefully
- Improved compatibility with MCP SDK v1.16.0+ transport initialization timing

### Migration Guide
- No migration required - fix is backwards compatible
- Remove any temporary workarounds once upgraded
- Verify MCP server initialization completes successfully

## Production Deployment Instructions

### Ensuring Patches Apply in Production

#### 1. Automated Patch Application
The most reliable approach is to automatically apply patches during the deployment process:

```json
// package.json
{
  "scripts": {
    "postinstall": "node scripts/patch-sentry-mcp.js",
    "patch-sentry": "node scripts/patch-sentry-mcp.js",
    "build": "npm run patch-sentry && tsc",
    "deploy": "npm ci && npm run build"
  }
}
```

#### 2. Docker Deployment
For containerized deployments, ensure patches are applied during image build:

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and apply patches
RUN npm ci && npm run patch-sentry

# Copy source code and build
COPY . .
RUN npm run build

CMD ["npm", "start"]
```

#### 3. CI/CD Pipeline Integration
Add patch verification to your CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Install dependencies
  run: npm ci

- name: Apply Sentry patches
  run: npm run patch-sentry

- name: Verify patches applied
  run: |
    grep -q "transport?.sessionId" node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js
    grep -q "typeof transport !== 'object'" node_modules/@sentry/core/build/esm/integrations/mcp-server/correlation.js

- name: Build application
  run: npm run build
```

#### 4. Health Check Validation
Add MCP connection validation to your deployment health checks:

```typescript
// health-check.ts
async function validateMCPInstrumentation() {
  try {
    // Attempt to create MCP server with Sentry wrapper
    const server = Sentry.wrapMcpServerWithSentry(new McpServer(/* ... */));
    
    // Test transport connection
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => 'test-session'
    });
    
    await server.connect(transport);
    
    console.log('✅ MCP Sentry instrumentation working correctly');
    return true;
  } catch (error) {
    console.error('❌ MCP Sentry instrumentation failed:', error.message);
    return false;
  }
}
```

#### 5. Version Lock Strategy
Lock Sentry version to prevent unexpected updates breaking patches:

```json
// package.json
{
  "dependencies": {
    "@sentry/node": "=10.0.0"
  }
}
```

#### 6. Monitoring and Alerting
Set up monitoring to detect if patches become ineffective:

```typescript
// monitoring.ts
import * as Sentry from '@sentry/node';

// Custom error tracking for MCP issues
Sentry.addGlobalEventProcessor((event) => {
  if (event.exception?.values?.[0]?.value?.includes('sessionId') ||
      event.exception?.values?.[0]?.value?.includes('constructor') ||
      event.exception?.values?.[0]?.value?.includes('WeakMap')) {
    
    // Tag MCP-related Sentry errors
    event.tags = { ...event.tags, 'mcp-patch-failure': true };
    
    // Alert on patch failures
    console.error('🚨 MCP Sentry patch may have failed:', event.exception.values[0].value);
  }
  
  return event;
});
```

### Verification Commands

Run these commands to verify patches are applied correctly:

```bash
# Check sessionId fix
grep -n "transport?.sessionId" node_modules/@sentry/core/build/*/integrations/mcp-server/attributeExtraction.js

# Check transport undefined fix  
grep -n "if (!transport)" node_modules/@sentry/core/build/*/integrations/mcp-server/attributeExtraction.js

# Check WeakMap fix
grep -n "typeof transport !== 'object'" node_modules/@sentry/core/build/*/integrations/mcp-server/correlation.js

# Verify all patches applied
npm run patch-sentry
```

Expected output should show patched code in all four files (ESM + CJS versions).

## Related Issues

- MCP TypeScript SDK initialization timing with StreamableHTTPServerTransport
- Session management patterns in distributed MCP architectures  
- Transport abstraction layer compatibility across different MCP implementations
- Sentry MCP instrumentation compatibility with modern transport protocols