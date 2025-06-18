import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { notaireService } from './services/notaireService';
import { testApiConnection } from './debug/testApi';
import { autoSaveService } from './services/autoSave';

// **FONCTIONS GLOBALES POUR DEBUG EN CONSOLE**
(window as any).testApi = testApiConnection;
(window as any).notaireService = notaireService;
(window as any).autoSave = autoSaveService;

console.log('🚀 Application Notaires démarrée');
console.log('🔧 Fonctions debug disponibles en console:');
console.log('  • testApi() - Tester la connexion API');
console.log('  • notaireService.getServiceStatus() - Status du service');
console.log('  • autoSave.getQueueStatus() - Status sauvegarde auto');
console.log('  • notaireService.getNotaires().length - Nombre de notaires');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 