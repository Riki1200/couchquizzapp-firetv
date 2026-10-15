import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { endpoints } from './useGameSocket';
import './styles.css';

// config.json only exists in the AWS deployment; locally the defaults are used.
fetch('/config.json')
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)
  .then((config) => {
    if (config?.httpUrl && config?.wsUrl) Object.assign(endpoints, { httpUrl: config.httpUrl, wsUrl: config.wsUrl });
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
