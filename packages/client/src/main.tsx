import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import './index.css';

function reportError(message: string, source?: string, stack?: string, context?: unknown) {
  fetch('/debug/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, source, stack, context }),
  }).catch(() => {/* server offline */});
}

window.onerror = (message, source, _line, _col, error) => {
  reportError(String(message), source, error?.stack);
};
window.onunhandledrejection = (event) => {
  const err = event.reason instanceof Error ? event.reason : null;
  reportError(err?.message ?? String(event.reason), 'unhandledrejection', err?.stack);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,      // data never goes stale on its own — sockets tell us when it's stale
      refetchOnWindowFocus: false, // don't blast the server when the user tabs back in
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
