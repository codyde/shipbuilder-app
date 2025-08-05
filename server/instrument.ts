import * as Sentry from "@sentry/node"

Sentry.init({
    dsn: "https://305353ce76b0951b0c6f29db84a21173@o4508130833793024.ingest.us.sentry.io/4509530235994112",
    integrations: [
      Sentry.vercelAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
    ],

    tracesSampleRate: 1.0, 
    profileSessionSampleRate: 1.0,

    tracePropagationTargets: ["localhost:3002", "mcp.shipbuilder.app"],

    _experiments: {
        enableLogs: true,
    },

    sendDefaultPii: true,
    debug: false,
  });