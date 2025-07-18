# MCP Server Refactoring Roadmap

This document outlines the remaining opportunities for simplifying and improving the MCP server configuration in `server/routes/mcp.ts`.

## ✅ Completed

### 1. Extract Tool Definitions (Complexity: 1/10, Risk: 1/10, Reward: 9/10)
- **Status**: ✅ Complete
- **Implementation**: Created `server/config/mcp-tools.ts` with centralized tool schemas
- **Benefits**: Makes adding new tools trivial, eliminates duplication, single source of truth

### 2. Extract Constants (Complexity: 2/10, Risk: 1/10, Reward: 8/10)
- **Status**: ✅ Complete
- **Implementation**: Created `server/config/mcp-config.ts` with all configuration constants
- **Benefits**: Single source of truth, easier environment-specific configs

### 3. Consolidate Base URL Logic (Complexity: 2/10, Risk: 1/10, Reward: 7/10)
- **Status**: ✅ Complete (included in constants extraction)
- **Implementation**: `getBaseUrl()` helper function eliminates 3+ duplicate code blocks
- **Benefits**: Single change point for URL determination logic

## 🔮 Future Improvements

### 4. Create OAuth Response Helpers
- **Complexity**: 3-4/10
- **Risk**: 1/10
- **Reward**: 6/10
- **Current Issue**: OAuth discovery responses are generated inline in multiple places
- **Proposed Solution**:
  ```typescript
  // server/config/mcp-oauth-helpers.ts
  export function createOAuthDiscoveryResponse(baseUrl: string) {
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/auth/authorize`,
      token_endpoint: `${baseUrl}/mcp/token`,
      // ... standardized OAuth 2.1 metadata
    };
  }
  
  export function createProtectedResourceResponse(baseUrl: string) {
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      // ... standardized protected resource metadata
    };
  }
  ```
- **Benefits**: Cleaner code, easier OAuth spec compliance changes, consistent responses
- **Implementation**: Extract OAuth response generation to helper functions

### 5. Extract MCP Capabilities Object
- **Complexity**: 3-4/10
- **Risk**: 1/10
- **Reward**: 5/10
- **Current Issue**: MCP capabilities are defined in multiple places with slight variations
- **Proposed Solution**:
  ```typescript
  // Already partially done in mcp-config.ts, but could be expanded
  export const MCP_CAPABILITIES_FULL = {
    basic: MCP_CAPABILITIES,
    detailed: MCP_DETAILED_CAPABILITIES,
    // Add more capability variants as needed
  };
  ```
- **Benefits**: Eliminates duplication, single definition point, reduces inconsistency risk
- **Implementation**: Centralize all capability definitions and ensure consistency

### 6. Standardize Error Response Format
- **Complexity**: 3-4/10
- **Risk**: 1/10
- **Reward**: 6/10
- **Current Issue**: Multiple error response patterns throughout the file
- **Proposed Solution**:
  ```typescript
  // server/config/mcp-error-responses.ts
  export function createJSONRPCError(id: string | number, code: number, message: string, data?: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, ...(data && { data }) }
    };
  }
  
  export function createOAuthError(error: string, description?: string, uri?: string) {
    return {
      error,
      ...(description && { error_description: description }),
      ...(uri && { error_uri: uri })
    };
  }
  ```
- **Benefits**: Better debugging, consistent client experience, easier error handling
- **Implementation**: Create error response helpers and standardize usage

### 7. Refactor Session-less MCP Handler
- **Complexity**: 5-6/10
- **Risk**: 5/10
- **Reward**: 4/10
- **Current Issue**: Large 200-line inline function in POST /mcp route (lines 754-961)
- **Proposed Solution**:
  ```typescript
  // server/services/mcp-sessionless-handler.ts
  export class SessionlessMCPHandler {
    constructor(private mcpServer: ShipbuilderMCPServer) {}
    
    async handleRequest(body: any): Promise<any> {
      switch (body.method) {
        case 'initialize':
          return this.handleInitialize(body.id);
        case 'tools/list':
          return this.handleToolsList(body.id);
        case 'tools/call':
          return this.handleToolCall(body.id, body.params);
        // ... other methods
      }
    }
    
    private handleInitialize(id: string | number) { /* ... */ }
    private handleToolsList(id: string | number) { /* ... */ }
    private handleToolCall(id: string | number, params: any) { /* ... */ }
  }
  ```
- **Benefits**: Cleaner code, easier to test, better separation of concerns
- **Implementation**: Extract to separate service class with method-specific handlers
- **⚠️ Risk**: Complex logic with multiple execution paths, security-critical

### 8. Consolidate Authentication Middleware
- **Complexity**: 5-6/10
- **Risk**: 5/10
- **Reward**: 5/10
- **Current Issue**: Two similar auth middlewares with slight differences
- **Proposed Solution**:
  ```typescript
  // server/middleware/mcp-auth.ts
  export function createMCPAuthMiddleware(options: {
    allowSessions?: boolean;
    requireMCPToken?: boolean;
  }) {
    return (req: any, res: any, next: any) => {
      // Unified authentication logic
      if (options.allowSessions && hasValidSession(req)) {
        return next();
      }
      
      if (hasValidBearerToken(req, options.requireMCPToken)) {
        return next();
      }
      
      return res.status(401).json({ error: 'Authentication required' });
    };
  }
  ```
- **Benefits**: Reduces code duplication, easier to modify auth logic, consistent behavior
- **Implementation**: Create configurable auth middleware factory
- **⚠️ Risk**: Authentication logic is security-critical, changes need careful testing

## 🎯 Recommended Implementation Order

1. **OAuth Response Helpers** (Quick win, low risk)
2. **Error Response Standardization** (Improves debugging, low risk)
3. **MCP Capabilities Consolidation** (Minor improvement, very low risk)
4. **Session-less Handler Refactoring** (Larger effort, requires careful testing)
5. **Authentication Middleware Consolidation** (Security-critical, requires thorough testing)

## 📊 Total Potential Impact

- **Completed**: 24/30 reward points with 5/30 complexity and 3/30 risk
- **Remaining**: 26/30 reward points with 20-24/30 complexity and 13-17/30 risk
- **Total Possible**: 50/30 reward points (major improvement in maintainability)

## 🔧 Implementation Notes

- **Testing Strategy**: Each change should include verification that MCP endpoints continue to work
- **Backward Compatibility**: All changes maintain existing API contracts
- **Security Considerations**: Authentication middleware changes require extra scrutiny
- **Performance Impact**: Minimal - mostly code organization improvements

## 📝 Usage Instructions

When implementing these improvements:

1. **Start with lowest risk items** (OAuth helpers, error responses)
2. **Test thoroughly** after each change using the MCP endpoints
3. **Consider incremental commits** for easier review and rollback
4. **Update documentation** as configurations change
5. **Maintain existing behavior** while improving code structure

This roadmap provides a clear path for continued improvement of the MCP server codebase while balancing effort, risk, and reward.