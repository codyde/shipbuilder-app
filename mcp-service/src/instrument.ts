import * as Sentry from "@sentry/node"

Sentry.init({
    dsn: "https://56931247983ddfac08f2b1105ea01242@o4508130833793024.ingest.us.sentry.io/4509691874050048",

    tracesSampleRate: 1.0,
    
    _experiments: {
        enableLogs: true,
    },
    
    sendDefaultPii: true,
    debug: false,
    
    // Detailed MCP span logging for debugging
    beforeSendSpan: (span) => {
      if (span.op === 'mcp.server' || span.op === 'mcp.notification.client_to_server') {
        console.log('DEBUG: MCP Span being sent to Sentry:', {
          op: span.op,
          description: span.description,
          data: span.data
        });
      }
      return span;
    }
  });
