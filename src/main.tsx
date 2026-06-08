import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GomiOfficeApp } from './vs/workbench/contrib/gomi/browser/GomiOfficeApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Gomi IDE root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <GomiOfficeApp />
  </StrictMode>
);
