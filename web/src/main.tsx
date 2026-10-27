import '@fontsource-variable/hanken-grotesk/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/parts.css';
import './styles/landing.css';
import './styles/auth.css';
import './styles/app.css';
import './styles/legal.css';
import './styles/mock.css';
import './styles/insights.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
