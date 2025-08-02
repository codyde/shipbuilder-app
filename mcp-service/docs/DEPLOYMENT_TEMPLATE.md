# Sentry MCP Analytics - Deployment Template

This template provides everything needed to replicate the working Sentry MCP analytics setup in new projects.

## Quick Setup (5 minutes)

### 1. Copy Required Files

```bash
# Copy patch scripts
mkdir -p scripts
cp /path/to/working/project/scripts/patch-sentry-mcp.cjs scripts/
cp /path/to/working/project/scripts/verify-sentry-patches.cjs scripts/

# Make executable
chmod +x scripts/*.cjs
```

### 2. Update package.json

Add these scripts to your package.json:

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

### 3. Install Dependencies

```bash
npm install @sentry/node @modelcontextprotocol/sdk
npm run verify-patches  # Should show "All patches applied!"
```

## MCP Server Implementation

### ✅ CORRECT Pattern (Full Analytics)

```typescript
// instrument.ts - Initialize BEFORE other imports
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  tracesSampleRate: 1.0,
  debug: true,
  sendDefaultPii: true,
  
  // Optional: Log MCP spans for debugging
  beforeSendSpan: (span) => {
    if (span.op === 'mcp.server' || span.op?.includes('mcp.notification')) {
      console.log('MCP Analytics:', {
        op: span.op,
        method: span.description,
        transport: span.data?.['mcp.transport'],        // Should be 'http'
        client: span.data?.['mcp.client.name'],         // Should be client name
        session: span.data?.['mcp.session.id']          // Should be UUID
      });
    }
    return span;
  }
});
```

```typescript
// server.ts - MCP Server Setup
import './instrument.js';  // MUST be first import
import * as Sentry from '@sentry/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export async function createMCPServer() {
  // 1. Create Sentry-wrapped server
  const server = Sentry.wrapMcpServerWithSentry(new McpServer({
    name: "my-server",
    version: "1.0.0"
  }));

  // 2. Create transport (sessionId managed by MCP protocol)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID()  // For stateful mode
  });

  // SessionId is properly managed by MCP protocol flow
  // Sentry gracefully handles undefined sessionId during initialization

  // 3. Connect server to transport (Sentry instruments here)
  await server.connect(transport);

  // 4. ❌ CRITICAL: Never override onmessage after connect()
  // transport.onmessage = customHandler;  // This breaks everything!

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

  console.log('✅ MCP Server ready with full Sentry analytics');
  return { server, transport };
}
```

### ❌ BROKEN Pattern (No Analytics)

```typescript
// This will break MCP analytics:
await server.connect(transport);
transport.onmessage = async (message, extra) => {
  // Custom logic here
  await originalHandler(message, extra);
};
// Result: transport shows as 'unknown', no client tracking
```

## Verification Checklist

### Local Development

```bash
# 1. Verify patches applied
npm run verify-patches
# Expected: "🎉 All Sentry MCP patches are properly applied!"

# 2. Test transport detection
node -e "
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const t = new StreamableHTTPServerTransport();
console.log('Constructor:', t.constructor.name);  // Should be 'StreamableHTTPServerTransport'
"

# 3. Start server and check logs
npm start
# Look for: "✅ MCP Server ready with full Sentry analytics"
```

### Production Deployment

1. **CI/CD Pipeline**: Ensure `npm run patch-sentry` runs after `npm install`
2. **Health Check**: Verify MCP spans appear in Sentry with correct attributes
3. **Monitor Dashboard**: Check Sentry for MCP analytics sections

### Expected Sentry Data

After client connection, you should see spans with:

```javascript
{
  op: 'mcp.server',
  description: 'initialize',  // or 'tools/list', etc.
  data: {
    'mcp.transport': 'http',           // ✅ Not 'unknown'
    'mcp.client.name': 'claude-code',  // ✅ Actual client
    'mcp.client.version': '1.0.67',    // ✅ Client version  
    'mcp.session.id': 'uuid-here',     // ✅ Session tracking
    'mcp.protocol.version': '2025-06-18' // ✅ Protocol version
  }
}
```

## Troubleshooting

### Transport Shows 'unknown'
- **Cause**: Patches not applied or `onmessage` override
- **Fix**: Run `npm run verify-patches`, remove `onmessage` overrides

### Missing Client Info
- **Cause**: `initialize` message not processed correctly
- **Fix**: Check client sends proper `clientInfo` in `initialize` params

### No Session Tracking  
- **Cause**: Enhanced patches not applied or transport missing sessionIdGenerator
- **Fix**: Run `npm run verify-patches` and ensure sessionIdGenerator is provided

### Analytics Broken After Update
- **Cause**: New Sentry version removed patches
- **Fix**: Run `npm run patch-sentry` after any @sentry/core updates

## File Checklist

Required files for replication:
- ✅ `scripts/patch-sentry-mcp.cjs` (with enhanced sessionId auto-initialization)
- ✅ `scripts/verify-sentry-patches.cjs`
- ✅ Updated `package.json` scripts
- ✅ Proper `instrument.ts` setup
- ✅ Simplified MCP server pattern (no manual sessionId handling)

## Success Metrics

Your setup is working when:
- ✅ No crashes during MCP initialization
- ✅ Sentry shows MCP transport as 'http' (not 'unknown')
- ✅ Client identification working in Sentry dashboard
- ✅ MCP analytics sections populated in Sentry
- ✅ Session and tool usage tracking visible

## Support

If issues persist:
1. Check this deployment template is followed exactly
2. Verify patch script output shows all patches applied
3. Confirm no `onmessage` overrides after `connect()`
4. Test with minimal reproduction case

---

**Last Updated**: Based on successful production deployment with full MCP analytics working.