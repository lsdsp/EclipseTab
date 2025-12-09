import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { DockProvider } from './context/DockContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DockProvider>
        <App />
      </DockProvider>
    </ThemeProvider>
  </React.StrictMode>
);
