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
    <nav className="bg-white shadow-lg sticky top-0 z-40 safe-area-top">
      {/* Barre principale */}
      <div className="px-4 lg:px-8 h-16 flex items-center justify-between">
        {/* Gauche */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuToggle}
            className="touch-button -ml-2 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500"
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
          <div className="flex items-center">
            <div className="h-8 w-8 flex-shrink-0">
              <Logo className="w-full h-full text-teal-600" />
            </div>
            <div className="ml-3">
              <h1 className="text-base md:text-lg font-bold text-teal-600 leading-tight">
                Le château de<br className="md:hidden" /> Greg et Louis
              </h1>
            </div>
          </div>
        </div>

        {/* Droite */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Stats - visible uniquement sur desktop */}
          <span className="hidden md:inline text-sm text-gray-500 whitespace-nowrap">
            {notairesCount} notaire{notairesCount > 1 ? 's' : ''} sur {totalNotaires}
          </span>

          {/* Boutons de vue - desktop */}
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

          {/* Boutons de vue - mobile */}
          <div className="md:hidden flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('carte')}
              className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors duration-200 ${
                viewMode === 'carte'
                  ? 'bg-white text-gray-800 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🗺️
            </button>
            <button
              onClick={() => onViewModeChange('liste')}
              className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors duration-200 ${
                viewMode === 'liste'
                  ? 'bg-white text-gray-800 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋
            </button>
          </div>

          {/* Bouton de synchronisation */}
          <button
            onClick={onSyncClick}
            disabled={isSyncing}
            className={`touch-button w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 flex items-center justify-center rounded-lg transition-colors duration-200 ${
              isSyncing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
            }`}
          >
            <svg
              className={`w-5 h-5 md:w-4 md:h-4 ${isSyncing ? 'animate-spin' : ''} ${!isSyncing ? 'md:mr-2' : ''}`}
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
      <div className="md:hidden px-4 pb-2 text-center">
        <span className="text-sm text-gray-500">
          {notairesCount} notaire{notairesCount > 1 ? 's' : ''} sur {totalNotaires}
        </span>
      </div>
    </nav>
  );
};

export default Navbar; 