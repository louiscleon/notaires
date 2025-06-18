import React, { useState } from 'react';
import { Notaire } from './types';
import MapComponent from './components/MapComponent';
import NotaireModal from './components/NotaireModal';
import SidebarMenu from './components/SidebarMenu';
import Navbar from './components/Navbar';
import NotairesTable from './components/NotairesTable';
import SearchAndFilters from './components/SearchAndFilters';
import ActiveFiltersDisplay from './components/ActiveFiltersDisplay';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import Logo from './components/Logo';
import DebugPanel from './components/DebugPanel';
import { useToast } from './hooks/useToast';
import { useNotaires } from './hooks/useNotaires';
import { useNotairesFilters } from './hooks/useNotairesFilters';
import { testApiConnection } from './debug/testApi';
import './App.css';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'carte' | 'liste'>('carte');
  const [selectedNotaire, setSelectedNotaire] = useState<Notaire | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const { toasts, addToast, removeToast } = useToast();
  
  const {
    notaires,
    filtres,
    loading,
    error,
    isSyncing,
    searchQuery,
    setSearchQuery,
    synchronize,
    handleStatutChange,
    handleNotaireUpdate,
    handleFiltresChange,
    clearAllFilters
  } = useNotaires();

  const notairesFiltres = useNotairesFilters(notaires, filtres, searchQuery);

  const handleSyncClick = async () => {
    const result = await synchronize();
    addToast(result.message, result.success ? 'success' : 'error');
  };

  const handleNotaireClick = (notaire: Notaire) => {
    setSelectedNotaire(notaire);
  };

  const handleStatutChangeWithToast = async (notaire: Notaire, newStatut: any) => {
    const result = await handleStatutChange(notaire, newStatut);
    addToast(result.message, result.success ? 'success' : 'error');
  };

  const handleNotaireUpdateWithToast = async (updatedNotaire: Notaire) => {
    const result = await handleNotaireUpdate(updatedNotaire);
    if (!result.success && result.message) {
      addToast(result.message, 'error');
    }
  };

  const handleCloseModal = () => {
    setSelectedNotaire(null);
  };

  // **TEST API EN CAS D'ERREUR**
  const handleTestApi = async () => {
    console.log('🧪 Test API déclenché manuellement...');
    await testApiConnection();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-white">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="w-24 h-24 mx-auto mb-6">
            <Logo className="w-full h-full text-teal-600 animate-bounce" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Le château de Greg et Louis</h2>
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto"></div>
          </div>
          <p className="mt-6 text-gray-600 text-lg">Chargement de vos données...</p>
          <button 
            onClick={handleTestApi}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Test API (console)
          </button>
        </div>
        <DebugPanel />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="text-6xl mb-6">😕</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Oups !</h2>
          <p className="text-gray-600 text-lg mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Réessayer
            </button>
            <button
              onClick={handleTestApi}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-gray-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Test API
            </button>
          </div>
        </div>
        <DebugPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white">
      {/* Toasts */}
      <div className="fixed top-0 right-0 z-50 p-4 space-y-4 mobile-safe-top">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Overlay pour mobile */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 h-full w-80 bg-white shadow-lg z-40 transform transition-transform duration-300
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full overflow-y-auto">
          <SidebarMenu
            filtres={filtres}
            onFiltresChange={handleFiltresChange}
            notairesCount={notairesFiltres.length}
            isOpen={isMenuOpen}
            onToggle={() => setIsMenuOpen(!isMenuOpen)}
          />
        </div>
      </aside>

      {/* Contenu principal */}
      <main 
        className={`
          min-h-screen transition-all duration-300
          ${isMenuOpen ? 'lg:pl-80' : ''}
        `}
      >
        <Navbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          notairesCount={notairesFiltres.length}
          totalNotaires={notaires.length}
          isSyncing={isSyncing}
          onSyncClick={handleSyncClick}
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
          isMenuOpen={isMenuOpen}
        />

        <div className="p-4 lg:p-8">
          {/* Recherche et filtres centralisés */}
          <SearchAndFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filtres={filtres}
            onFiltresChange={handleFiltresChange}
            resultCount={notairesFiltres.length}
            totalCount={notaires.length}
          />

          {/* Affichage des filtres actifs */}
          <ActiveFiltersDisplay
            filtres={filtres}
            searchQuery={searchQuery}
            resultCount={notairesFiltres.length}
            totalCount={notaires.length}
            onClearFilters={clearAllFilters}
          />

          {viewMode === 'carte' ? (
            <div className="space-y-4 lg:space-y-8">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <Dashboard 
                  notaires={notairesFiltres} 
                  onNotaireClick={handleNotaireClick}
                />
              </div>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="h-[calc(100vh-16rem)] md:h-[600px] lg:h-[600px]">
                  <MapComponent
                    notaires={notairesFiltres}
                    villesInteret={filtres.villesInteret}
                    onNotaireClick={handleNotaireClick}
                    onNotaireUpdate={handleNotaireUpdateWithToast}
                    showOnlyInRadius={filtres.showOnlyInRadius}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-8">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <Dashboard 
                  notaires={notairesFiltres}
                  onNotaireClick={handleNotaireClick}
                />
              </div>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <NotairesTable
                  notaires={notairesFiltres}
                  onNotaireClick={handleNotaireClick}
                  onStatutChange={handleStatutChangeWithToast}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedNotaire && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <NotaireModal
              isOpen={true}
              notaire={selectedNotaire}
              onClose={handleCloseModal}
              onSave={handleNotaireUpdateWithToast}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
            />
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
};

export default App;