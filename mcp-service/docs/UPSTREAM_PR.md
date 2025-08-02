# Upstream Pull Request Guide - Sentry MCP StreamableHTTPServerTransport Fixes

## Repository Information

**Target Repository**: https://github.com/getsentry/sentry-javascript  
**Target Branch**: `develop`  
**Affected Packages**: `@sentry/core`

## Files to Modify

Based on repository analysis, the following source files need patches in the `develop` branch:

### 1. Core Integration Files
```
packages/core/src/integrations/mcp-server/attributeExtraction.ts
packages/core/src/integrations/mcp-server/correlation.ts
```

**Note**: These are TypeScript source files that get compiled to the JavaScript files we've been patching in `node_modules/@sentry/core/build/`.

## Required Changes

### Patch 1: Graceful SessionId Handling
**File**: `packages/core/src/integrations/mcp-server/attributeExtraction.ts`  
**Function**: `buildTransportAttributes()`  
**Location**: Look for sessionId extraction logic

**Current Issue**: Assumes `transport.sessionId` is always accessible
**Required Fix**: Add defensive undefined handling

```typescript
// Current (problematic):
const sessionId = transport.sessionId;

// Required fix:
const sessionId = transport && 'sessionId' in transport ? transport.sessionId : undefined;
```

### Patch 2: Transport Constructor Null Checks  
**File**: `packages/core/src/integrations/mcp-server/attributeExtraction.ts`  
**Function**: `getTransportTypes()`  
**Location**: Beginning of function where constructor is accessed

**Current Issue**: No null checks for transport or constructor
**Required Fix**: Add defensive guard clauses

```typescript
// Add at beginning of getTransportTypes function:
if (!transport || !transport.constructor) {
  return { mcpTransport: 'unknown', networkTransport: 'unknown' };
}
```

### Patch 3: WeakMap Correlation Fallback System
**File**: `packages/core/src/integrations/mcp-server/correlation.ts`  
**Location**: After `transportToSpanMap` declaration

**Current Issue**: WeakMap requires valid object keys
**Required Addition**: Fallback Map for invalid transport objects

```typescript
// Add after existing transportToSpanMap declaration:
// Fallback span map for invalid transport objects
const fallbackSpanMap = new Map();
```

### Patch 4: WeakMap Type Validation
**File**: `packages/core/src/integrations/mcp-server/correlation.ts`  
**Function**: `getOrCreateSpanMap()`  
**Location**: Beginning of function

**Current Issue**: No validation before WeakMap operations
**Required Fix**: Type validation with fallback

```typescript
// Add at beginning of getOrCreateSpanMap function:
// Handle invalid transport values for WeakMap while preserving correlation
if (!transport || typeof transport !== 'object') {
  // Return persistent fallback Map to maintain correlation across calls
  return fallbackSpanMap;
}
```

## Development Environment Setup

### Prerequisites
```bash
# Install Volta for Node/Yarn version management
curl https://get.volta.sh | bash

# Clone repository
git clone https://github.com/getsentry/sentry-javascript.git
cd sentry-javascript

# Checkout develop branch
git checkout develop

# Install dependencies
yarn

# Build packages
yarn build
```

### Testing Requirements

#### 1. Unit Tests
Add tests for edge cases in:
```
packages/core/test/integrations/mcp-server/
```

**Test Cases to Add**:
- `attributeExtraction.test.ts`: Test undefined sessionId handling
- `attributeExtraction.test.ts`: Test null transport constructor  
- `correlation.test.ts`: Test WeakMap with invalid transport objects
- `correlation.test.ts`: Test fallback Map functionality

#### 2. Integration Tests  
Add StreamableHTTPServerTransport compatibility tests in:
```
dev-packages/node-integration-tests/
```

#### 3. Example Test Structure
```typescript
// packages/core/test/integrations/mcp-server/attributeExtraction.test.ts
describe('buildTransportAttributes', () => {
  it('handles undefined sessionId gracefully', () => {
    const transport = { /* no sessionId */ };
    const attributes = buildTransportAttributes(transport, {});
    expect(attributes['mcp.session.id']).toBeUndefined();
    // Should not crash
  });

  it('handles null transport constructor', () => {
    const transport = { constructor: null };
    const result = getTransportTypes(transport);
    expect(result.mcpTransport).toBe('unknown');
  });
});
```

## PR Submission Guidelines

### 1. Branch Strategy
```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b fix/mcp-streamable-http-transport

# Make changes
# Commit with conventional commit format
git commit -m "fix(mcp): add defensive handling for StreamableHTTPServerTransport edge cases

- Add graceful sessionId undefined handling in attributeExtraction
- Add transport constructor null checks  
- Add WeakMap correlation fallback for invalid transport objects
- Fixes crashes with StreamableHTTPServerTransport during initialization

Fixes #[issue-number]"
```

### 2. PR Description Template
```markdown
## Problem
Sentry's MCP server instrumentation crashes when used with `StreamableHTTPServerTransport` due to lack of defensive programming for edge cases during MCP initialization.

## Root Cause
Four specific scenarios cause crashes:
1. `transport.sessionId` is undefined during initialization timing
2. `transport.constructor` can be null in edge cases  
3. WeakMap operations fail with invalid transport objects
4. Correlation system lacks fallback for invalid transports

## Solution
Add defensive handling for all identified edge cases while preserving full MCP analytics functionality.

## Changes
- ✅ Graceful sessionId undefined handling
- ✅ Transport constructor null checks
- ✅ WeakMap correlation fallback system  
- ✅ Type validation before WeakMap operations

## Testing
- [ ] Unit tests for all edge cases
- [ ] Integration tests with StreamableHTTPServerTransport
- [ ] Verified existing functionality preserved
- [ ] No breaking changes

## Compatibility
- Maintains backward compatibility
- Works with all existing MCP transport types
- Preserves full analytics data collection
```

### 3. Pre-PR Checklist
```bash
# Run full test suite
yarn test

# Run linting  
yarn lint

# Build all packages
yarn build

# Verify no breaking changes
yarn test:integration
```

## Expected Files in PR

### Source Changes
1. `packages/core/src/integrations/mcp-server/attributeExtraction.ts`
2. `packages/core/src/integrations/mcp-server/correlation.ts`

### Test Additions  
1. `packages/core/test/integrations/mcp-server/attributeExtraction.test.ts` (new edge case tests)
2. `packages/core/test/integrations/mcp-server/correlation.test.ts` (new edge case tests)
3. `dev-packages/node-integration-tests/suites/mcp-streamable-http.js` (integration test)

### Documentation Updates
1. Update any relevant documentation about MCP transport compatibility
2. Add changelog entry for the fix

## Success Criteria

### Before Patches (Broken)
- ❌ Crashes with `Cannot read properties of undefined (reading 'sessionId')`
- ❌ Transport detection shows `'unknown'` instead of `'http'`  
- ❌ Missing session and client tracking
- ❌ WeakMap key errors in correlation system

### After Patches (Working)
- ✅ No crashes with StreamableHTTPServerTransport
- ✅ Transport correctly detected as `'http'`
- ✅ Complete MCP analytics: sessions, clients, tools
- ✅ Graceful handling of all edge cases

## Implementation Notes

### Key Considerations
1. **Preserve Existing Functionality**: All changes are purely defensive additions
2. **No Breaking Changes**: Backward compatibility maintained for all users
3. **Performance Impact**: Minimal - only adds defensive checks
4. **Protocol Compliance**: Respects MCP protocol session management

### Development Tips
1. **Local Testing**: Use our working patches as reference for expected behavior
2. **Verification**: Our automated test scripts can verify the TypeScript changes work
3. **Real-world Testing**: Test with actual MCP clients like Claude Code

## Contact Information

This fix addresses production issues encountered when integrating Sentry MCP analytics with modern `StreamableHTTPServerTransport`. The patches enable full Sentry MCP analytics without user workarounds while maintaining compatibility with all existing transport types.