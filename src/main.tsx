import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SpacesProvider } from './context/SpacesContext';
import { DockProvider } from './context/DockContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <SpacesProvider>
        <DockProvider>
          <App />
        </DockProvider>
      </SpacesProvider>
    </ThemeProvider>
  </React.StrictMode>
);
