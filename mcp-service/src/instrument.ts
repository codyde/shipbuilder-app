import * as Sentry from "@sentry/node"

Sentry.init({
    dsn: "https://56931247983ddfac08f2b1105ea01242@o4508130833793024.ingest.us.sentry.io/4509691874050048",

    tracesSampleRate: 1.0, 
    profileSessionSampleRate: 1.0,

    _experiments: {
        enableLogs: true,
    },

    sendDefaultPii: true,
    debug: true,
  });