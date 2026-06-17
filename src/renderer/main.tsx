import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

async function bootstrap() {
  // Dev-only: inject a mock backend with demo data so the full UI can be
  // exercised without a live Proxmox host (used for screenshots/QA).
  if (import.meta.env.VITE_MOCK === '1') {
    const { installMock } = await import('./mock/mockBackend');
    installMock();
  }

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
