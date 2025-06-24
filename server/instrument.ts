import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
    dsn: "https://305353ce76b0951b0c6f29db84a21173@o4508130833793024.ingest.us.sentry.io/4509530235994112",
    integrations: [
      nodeProfilingIntegration(),
      Sentry.vercelAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
    ],
    tracesSampleRate: 1.0, 
    profileSessionSampleRate: 1.0,
    profileLifecycle: 'trace',

    _experiments: {
        enableLogs: true,
    },

    sendDefaultPii: true,
    debug: false,
  });