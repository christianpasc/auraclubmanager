
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { captureUtm } from './utils/utm';

// Before the first render: the landing page's utm_* parameters are in the URL
// now, and HashRouter will have moved on by the time anyone signs up.
captureUtm();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
