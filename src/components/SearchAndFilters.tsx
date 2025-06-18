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
    </div>
  );
};

export default SearchAndFilters; 