import React from 'react';
import { Filtres } from '../types';
import SearchBar from './SearchBar';

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filtres: Filtres;
  onFiltresChange: (filtres: Filtres) => void;
  resultCount: number;
  totalCount: number;
}

const SearchAndFilters: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  filtres,
  onFiltresChange,
  resultCount,
  totalCount
}) => {
  return (
    <div className="space-y-4">
      {/* Barre de recherche globale */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Recherche globale</span>
          <span className="text-xs text-gray-500">
            ({resultCount} résultat{resultCount > 1 ? 's' : ''} sur {totalCount})
          </span>
        </div>
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          resultCount={resultCount}
        />
      </div>

      {/* Filtres rapides */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Filtres rapides</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onFiltresChange({
              ...filtres,
              showNonContactes: !filtres.showNonContactes,
              contactStatuts: []
            })}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtres.showNonContactes
                ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            Non contactés
          </button>
          
          <button
            onClick={() => onFiltresChange({
              ...filtres,
              showNonContactes: false,
              contactStatuts: filtres.contactStatuts.includes('mail_envoye') 
                ? filtres.contactStatuts.filter(s => s !== 'mail_envoye')
                : [...filtres.contactStatuts, 'mail_envoye']
            })}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtres.contactStatuts.includes('mail_envoye')
                ? 'bg-green-100 text-green-800 border-2 border-green-300'
                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            Mail envoyé
          </button>

          <button
            onClick={() => onFiltresChange({
              ...filtres,
              showOnlyWithEmail: !filtres.showOnlyWithEmail
            })}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtres.showOnlyWithEmail
                ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            Avec email
          </button>

          <button
            onClick={() => onFiltresChange({
              ...filtres,
              serviceNego: filtres.serviceNego === 'oui' ? 'tous' : 'oui'
            })}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtres.serviceNego === 'oui'
                ? 'bg-teal-100 text-teal-800 border-2 border-teal-300'
                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            Service négo
          </button>
        </div>

        {/* Bouton de réinitialisation */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            onClick={() => onFiltresChange({
              typeNotaire: 'tous',
              serviceNego: 'tous',
              minAssocies: 0,
              maxAssocies: 10,
              minSalaries: 0,
              maxSalaries: 10,
              statuts: [],
              showOnlyWithEmail: false,
              contactStatuts: [],
              showNonContactes: false,
              showOnlyInRadius: false,
              villesInteret: filtres.villesInteret, // Garder les villes d'intérêt
            })}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            🔄 Réinitialiser les filtres
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilters; 