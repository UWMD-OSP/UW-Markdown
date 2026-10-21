import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ValidatorApp } from './ValidatorApp.js';
import '../styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ValidatorApp />
  </StrictMode>,
);
