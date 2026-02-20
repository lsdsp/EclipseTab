import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SpacesProvider } from './context/SpacesContext';
import { DockProvider } from './context/DockContext';
import { ZenShelfProvider } from './context/ZenShelfContext';
import { LanguageProvider } from './context/LanguageContext';
import { UndoProvider } from './context/UndoContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <SpacesProvider>
      <DockProvider>
        <ZenShelfProvider>
          <LanguageProvider>
            <UndoProvider>
              <App />
            </UndoProvider>
          </LanguageProvider>
        </ZenShelfProvider>
      </DockProvider>
    </SpacesProvider>
  </ThemeProvider>
);
