import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { endpoints } from './useGameSocket';
import './styles.css';

// Which backend to talk to, in order of preference:
// 1. the join link (QR code) — `api` and `ws` point at the backend that created the room;
// 2. /config.json, written next to the page by the CDK deployment;
// 3. the local server on the machine that served this page (the defaults in useGameSocket).
async function resolveEndpoints() {
  const params = new URLSearchParams(location.search);
  const api = params.get('api');
  const ws = params.get('ws');
  if (api && ws) return Object.assign(endpoints, { httpUrl: api, wsUrl: ws });
  const config = await fetch('/config.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (config?.httpUrl && config?.wsUrl) Object.assign(endpoints, { httpUrl: config.httpUrl, wsUrl: config.wsUrl });
}

resolveEndpoints().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
