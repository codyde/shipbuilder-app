import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://d6d1bd6442ae67b7e80bd37270a3b5ef@o4508130833793024.ingest.us.sentry.io/4509530227277825",

  sendDefaultPii: true,

  integrations: [

    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({
      autoInject: false, // Disable automatic widget injection
      colorScheme: "system",
      enableScreenshot: true,
      showBranding: true,
      formTitle: "Send Feedback",
      submitButtonLabel: "Send Feedback",
      cancelButtonLabel: "Cancel",
    }),
  ],

  _experiments: { enableLogs: true },

  tracesSampleRate: 1.0,

  tracePropagationTargets: ["localhost:3001", "api.shipbuilder.app"],


  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
});

