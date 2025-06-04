import React from 'react';
import Logo from './Logo';

interface Props {
  viewMode: 'carte' | 'liste';
  onViewModeChange: (mode: 'carte' | 'liste') => void;
  notairesCount: number;
  totalNotaires: number;
  isSyncing: boolean;
  onSyncClick: () => void;
  onMenuToggle: () => void;
  isMenuOpen?: boolean;
}

const Navbar: React.FC<Props> = ({
  viewMode,
  onViewModeChange,
  notairesCount,
  totalNotaires,
  isSyncing,
  onSyncClick,
  onMenuToggle,
  isMenuOpen = false
}) => {
  return (
    <nav className="bg-white shadow-lg sticky top-0 z-40 mobile-safe-top">
      <div className="px-4 lg:px-8 h-16 flex items-center">
        {/* Gauche */}
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={onMenuToggle}
            className="touch-button p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500"
          >
            <span className="sr-only">{isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
            {isMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <div className="flex items-center ml-3">
            <div className="h-8 w-8">
              <Logo className="w-full h-full text-teal-600" />
            </div>
            <h1 className="ml-3 text-lg font-bold text-teal-600 truncate">
              Le château de Greg et Louis
            </h1>
          </div>
        </div>

        {/* Droite */}
        <div className="flex items-center ml-auto space-x-4">
          <span className="hidden md:inline text-sm text-gray-500 whitespace-nowrap">
            {notairesCount} notaire{notairesCount > 1 ? 's' : ''} sur {totalNotaires}
          </span>

          <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('carte')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap ${
                viewMode === 'carte'
                  ? 'bg-white text-gray-800 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🗺️ Carte
            </button>
            <button
              onClick={() => onViewModeChange('liste')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap ${
                viewMode === 'liste'
                  ? 'bg-white text-gray-800 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 Liste
            </button>
          </div>

          <select
            className="md:hidden touch-button pl-3 pr-10 py-2 text-sm border-gray-300 rounded-md"
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value as 'carte' | 'liste')}
          >
            <option value="carte">🗺️ Carte</option>
            <option value="liste">📋 Liste</option>
          </select>

          <button
            onClick={onSyncClick}
            disabled={isSyncing}
            className={`touch-button flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 whitespace-nowrap ${
              isSyncing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
            }`}
          >
            <svg
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''} ${!isSyncing ? 'mr-2' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="hidden md:inline">
              {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
            </span>
          </button>
        </div>
      </div>

      {/* Stats mobile */}
      <div className="md:hidden px-4 pb-2">
        <span className="text-sm text-gray-500">
          {notairesCount} notaire{notairesCount > 1 ? 's' : ''} sur {totalNotaires}
        </span>
      </div>
    </nav>
  );
};

export default Navbar; 