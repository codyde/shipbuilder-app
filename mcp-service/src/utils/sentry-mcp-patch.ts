/**
 * Temporary monkey patch for Sentry MCP instrumentation sessionId issue
 * 
 * This patches the buildTransportAttributes function to handle undefined sessionId
 * gracefully until the upstream fix is available in @sentry/core
 * 
 * Issue: Cannot read properties of undefined (reading 'sessionId')
 * Location: @sentry/core/src/integrations/mcp-server/attributeExtraction.ts:~268
 * 
 * TODO: Remove this patch once Sentry fixes the upstream issue
 */

import { logger } from './logger.js';

// Define the attribute constant (from Sentry's internal constants)
const MCP_SESSION_ID_ATTRIBUTE = 'mcp.session.id';

/**
 * Patch the buildTransportAttributes function to handle undefined sessionId
 */
export function applySentryMCPPatch(): void {
  try {
    // Try to access Sentry's internal module
    const sentryCore = require('@sentry/core');
    const sentryIntegrations = sentryCore.getIntegrations?.() || {};
    
    // Find the MCP server integration
    const mcpIntegration = Object.values(sentryIntegrations).find((integration: any) => 
      integration.name === 'McpServerIntegration' || 
      integration.constructor?.name === 'McpServerIntegration'
    ) as any;

    if (!mcpIntegration) {
      logger.warn('Sentry MCP integration not found - patch not applied');
      return;
    }

    // Patch the attribution extraction if we can access it
    const originalBuildTransportAttributes = mcpIntegration.buildTransportAttributes;
    
    if (typeof originalBuildTransportAttributes === 'function') {
      mcpIntegration.buildTransportAttributes = function patchedBuildTransportAttributes(
        transport: any, 
        extra: any
      ) {
        try {
          // Ensure sessionId is safely accessible
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

          logger.debug('Patched buildTransportAttributes executed', {
            hasSessionId: sessionId !== undefined,
            sessionId: sessionId ? sessionId.substring(0, 8) + '...' : 'undefined',
            transportType: mcpTransport
          });

          return attributes;
        } catch (error) {
          logger.error('Error in patched buildTransportAttributes', {
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Fallback to minimal attributes to prevent total failure
          return {
            [MCP_TRANSPORT_TYPE_ATTRIBUTE]: 'unknown',
            [NETWORK_TRANSPORT_ATTRIBUTE]: 'unknown',
            [MCP_PROTOCOL_VERSION_ATTRIBUTE]: 'unknown'
          };
        }
      };

      logger.info('Sentry MCP transport attributes patch applied successfully');
    } else {
      logger.warn('buildTransportAttributes function not found - using alternative patch');
      applyAlternativePatch();
    }

  } catch (error) {
    logger.error('Failed to apply Sentry MCP patch', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Try alternative patching approach
    applyAlternativePatch();
  }
}

/**
 * Alternative patching approach - patch at module level
 */
function applyAlternativePatch(): void {
  try {
    // Try to patch the actual attribution module
    const attributionModule = require('@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js');
    
    if (attributionModule && attributionModule.buildTransportAttributes) {
      const original = attributionModule.buildTransportAttributes;
      
      attributionModule.buildTransportAttributes = function(transport: any, extra: any) {
        // Pre-check sessionId and set to undefined if accessing would fail
        if (transport && transport.sessionId === undefined) {
          // Create a proxy that safely returns undefined for sessionId access
          const safeTransport = new Proxy(transport, {
            get(target, prop) {
              if (prop === 'sessionId') {
                return undefined;
              }
              return target[prop];
            }
          });
          
          return original.call(this, safeTransport, extra);
        }
        
        return original.call(this, transport, extra);
      };
      
      logger.info('Alternative Sentry MCP patch applied at module level');
    } else {
      logger.warn('Could not find attribution module for alternative patch');
    }
  } catch (error) {
    logger.error('Alternative patch failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Remove the patch (for cleanup or testing)
 */
export function removeSentryMCPPatch(): void {
  logger.info('Sentry MCP patch removal not implemented - restart service to remove patch');
}

// Helper functions that may be needed (copied from Sentry internals)
function extractClientInfo(extra: any) {
  // Implementation would depend on Sentry's actual extractClientInfo function
  return {};
}

function getTransportTypes(transport: any) {
  // Detect transport type
  const transportName = transport.constructor?.name || 'unknown';
  
  if (transportName.includes('StreamableHTTP')) {
    return {
      mcpTransport: 'streamable-http',
      networkTransport: 'http'
    };
  } else if (transportName.includes('SSE')) {
    return {
      mcpTransport: 'sse',
      networkTransport: 'http'
    };
  }
  
  return {
    mcpTransport: 'unknown',
    networkTransport: 'unknown'
  };
}

function getClientAttributes(transport: any) {
  // Extract client-specific attributes
  return {};
}

function getServerAttributes(transport: any) {
  // Extract server-specific attributes
  return {};
}

function getProtocolVersionForTransport(transport: any) {
  // Try to determine MCP protocol version
  return '2025-06-18'; // Default to current version
}

// Constants that might be needed
const MCP_TRANSPORT_TYPE_ATTRIBUTE = 'mcp.transport.type';
const NETWORK_TRANSPORT_ATTRIBUTE = 'network.transport';
const MCP_PROTOCOL_VERSION_ATTRIBUTE = 'mcp.protocol.version';