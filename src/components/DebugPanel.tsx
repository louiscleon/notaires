import React, { useState, useEffect } from 'react';
import { notaireService } from '../services/notaireService';
import { testApiConnection } from '../debug/testApi';

const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const updateStatus = () => {
      setServiceStatus(notaireService.getServiceStatus());
    };

    const interval = setInterval(updateStatus, 1000);
    updateStatus();

    return () => clearInterval(interval);
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  };

  const handleTestApi = async () => {
    addLog('🧪 Test API lancé...');
    try {
      await testApiConnection();
      addLog('✅ Test API terminé (voir console)');
    } catch (error) {
      addLog(`❌ Test API échoué: ${error}`);
    }
  };

  const handleSyncManual = async () => {
    addLog('🔄 Synchronisation manuelle...');
    try {
      await notaireService.syncWithGoogleSheets();
      addLog('✅ Synchronisation réussie');
    } catch (error) {
      addLog(`❌ Synchronisation échouée: ${error}`);
    }
  };

  const handleForceSave = async () => {
    addLog('💾 Sauvegarde forcée...');
    try {
      await notaireService.forceSaveAll();
      addLog('✅ Sauvegarde forcée terminée');
    } catch (error) {
      addLog(`❌ Sauvegarde forcée échouée: ${error}`);
    }
  };

  const handleResetService = () => {
    addLog('🔄 Réinitialisation du service...');
    notaireService.reset();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-lg z-50 text-xs hover:bg-red-700"
        title="Ouvrir le panel de debug"
      >
        🐛
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-96 z-50 max-h-[32rem] overflow-y-auto text-xs">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm">🐛 Debug Panel</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Status du Service */}
      <div className="mb-3 p-2 bg-gray-50 rounded">
        <div className="font-semibold mb-1">📊 Status Service:</div>
        {serviceStatus && (
          <div className="space-y-1">
            <div>🔧 Initialisé: {serviceStatus.isInitialized ? '✅' : '❌'}</div>
            <div>⏳ Chargement: {serviceStatus.isLoading ? '🔄' : '✅'}</div>
            <div>👥 Notaires: {serviceStatus.notairesCount}</div>
            <div>🏙️ Villes: {serviceStatus.villesInteretCount}</div>
            <div>📡 Abonnés: {serviceStatus.subscribersCount}</div>
          </div>
        )}
      </div>

      {/* Status de Sauvegarde Automatique */}
      {serviceStatus?.autoSave && (
        <div className="mb-3 p-2 bg-green-50 rounded">
          <div className="font-semibold mb-1">💾 Sauvegarde Auto:</div>
          <div className="space-y-1">
            <div>📝 En attente: {serviceStatus.autoSave.pendingSaves}</div>
            <div>🔄 En cours: {serviceStatus.autoSave.isSaving ? '✅' : '❌'}</div>
            {serviceStatus.autoSave.operations.length > 0 && (
              <div className="mt-2">
                <div className="font-medium text-xs">Opérations en cours:</div>
                {serviceStatus.autoSave.operations.slice(0, 3).map((op: any) => (
                  <div key={op.id} className="text-xs text-gray-600 truncate">
                    • {op.officeNotarial} (tentative {op.attempts})
                  </div>
                ))}
                {serviceStatus.autoSave.operations.length > 3 && (
                  <div className="text-xs text-gray-500">
                    ... et {serviceStatus.autoSave.operations.length - 3} autres
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-3 space-y-2">
        <button
          onClick={handleTestApi}
          className="w-full bg-blue-600 text-white p-2 rounded text-xs hover:bg-blue-700"
        >
          🧪 Test API
        </button>
        <button
          onClick={handleSyncManual}
          className="w-full bg-green-600 text-white p-2 rounded text-xs hover:bg-green-700"
        >
          🔄 Sync Manuel
        </button>
        <button
          onClick={handleForceSave}
          className="w-full bg-purple-600 text-white p-2 rounded text-xs hover:bg-purple-700"
          disabled={!serviceStatus?.autoSave?.pendingSaves}
        >
          💾 Force Save ({serviceStatus?.autoSave?.pendingSaves || 0})
        </button>
        <button
          onClick={handleResetService}
          className="w-full bg-red-600 text-white p-2 rounded text-xs hover:bg-red-700"
        >
          🔄 Reset Service
        </button>
      </div>

      {/* Logs */}
      <div className="mb-3">
        <div className="font-semibold mb-1">📝 Logs récents:</div>
        <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">Aucun log...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="text-xs mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Console Shortcuts */}
      <div className="text-xs text-gray-600">
        <div className="font-semibold mb-1">🔧 Console:</div>
        <div>• <code>testApi()</code> - Test API</div>
        <div>• <code>notaireService.getServiceStatus()</code></div>
        <div>• <code>notaireService.forceSaveAll()</code></div>
        <div>• <code>notaireService.getNotaires().length</code></div>
      </div>
    </div>
  );
};

export default DebugPanel; 