import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://d6d1bd6442ae67b7e80bd37270a3b5ef@o4508130833793024.ingest.us.sentry.io/4509530227277825",

  sendDefaultPii: true,

  integrations: [
    
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
  ],

  _experiments: { enableLogs: true },

  tracesSampleRate: 1.0,

  tracePropagationTargets: ["localhost:3001"],


  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
});

