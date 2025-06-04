import React from 'react';
import { Filtres } from '../types';
import FiltersPanel from './FiltersPanel';
import Logo from './Logo';

interface Props {
  filtres: Filtres;
  onFiltresChange: (filtres: Filtres) => void;
  notairesCount: number;
  isOpen: boolean;
  onToggle: () => void;
}

const SidebarMenu: React.FC<Props> = ({ filtres, onFiltresChange, notairesCount, isOpen, onToggle }) => {
  return (
    <div className="fixed left-0 top-0 h-full z-50">
      {/* Bouton pour ouvrir/fermer le menu */}
      <button
        onClick={onToggle}
        className={`absolute top-1/2 -translate-y-1/2 ${isOpen ? 'left-[320px]' : 'left-0'} 
          bg-white shadow-lg rounded-r-xl p-2 transition-all duration-300 hover:bg-gray-50`}
      >
        <svg
          className={`w-6 h-6 text-teal-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
          />
        </svg>
      </button>

      {/* Menu coulissant */}
      <div
        className={`h-full bg-white shadow-xl transition-all duration-300 ease-in-out transform 
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-80`}
      >
        <div className="h-full flex flex-col">
          {/* En-tête du menu */}
          <div className="p-6 bg-teal-700">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10">
                <Logo className="w-full h-full text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Filtres</h2>
                <p className="text-teal-100 text-sm mt-1">
                  {notairesCount} notaires trouvés
                </p>
              </div>
            </div>
          </div>

          {/* Contenu du menu avec défilement */}
          <div className="flex-1 overflow-y-auto p-6">
            <FiltersPanel
              filtres={filtres}
              onFiltresChange={onFiltresChange}
              notairesCount={notairesCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarMenu; 