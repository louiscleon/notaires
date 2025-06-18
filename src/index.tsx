import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { notaireService } from './services/notaireService';
import { testApiConnection } from './debug/testApi';

// **FONCTIONS GLOBALES POUR DEBUG EN CONSOLE (SÉCURISÉES)**
(window as any).testApi = testApiConnection;
(window as any).notaireService = notaireService;

console.log('⚠️ APPLICATION NOTAIRES EN MODE SÉCURISÉ');
console.log('🔧 Fonctions debug disponibles en console:');
console.log('  • testApi() - Tester la connexion API');
console.log('  • notaireService.getServiceStatus() - Status du service');
console.log('  • notaireService.getNotaires().length - Nombre de notaires');
console.log('⚠️ SYSTÈME DE SAUVEGARDE AUTOMATIQUE DÉSACTIVÉ');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 