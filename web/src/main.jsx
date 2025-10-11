import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';

import './styles.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  const integrations = [];
  if (typeof Sentry.browserTracingIntegration === 'function') {
    integrations.push(Sentry.browserTracingIntegration());
  }
  if (typeof Sentry.replayIntegration === 'function') {
    const sessionSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? '0');
    const errorSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE ?? '1');
    integrations.push(
      Sentry.replayIntegration({
        sessionSampleRate,
        errorSampleRate,
      })
    );
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    enabled:
      import.meta.env.MODE !== 'development' ||
      import.meta.env.VITE_SENTRY_ENABLE_IN_DEV?.toLowerCase() === 'true',
    integrations,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  });

  Sentry.setTag(
    'realtime_url',
    import.meta.env.VITE_REALTIME_URL ?? import.meta.env.VITE_WS_URL ?? 'auto'
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
