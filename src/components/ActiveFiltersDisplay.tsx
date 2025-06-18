import React from 'react';
import { Filtres } from '../types';

interface Props {
  filtres: Filtres;
  searchQuery: string;
  resultCount: number;
  totalCount: number;
  onClearFilters: () => void;
}

const ActiveFiltersDisplay: React.FC<Props> = ({
  filtres,
  searchQuery,
  resultCount,
  totalCount,
  onClearFilters
}) => {
  const activeFilters: string[] = [];

  // Construire la liste des filtres actifs
  if (searchQuery) {
    activeFilters.push(`Recherche: "${searchQuery}"`);
  }

  if (filtres.showNonContactes) {
    activeFilters.push('Non contactés');
  }

  if (filtres.contactStatuts.length > 0) {
    const statusLabels: Record<string, string> = {
      'mail_envoye': 'Mail envoyé',
      'reponse_recue': 'Réponse reçue',
      'relance_effectuee': 'Relance effectuée'
    };
    const labels = filtres.contactStatuts.map(s => statusLabels[s] || s);
    activeFilters.push(`Contact: ${labels.join(', ')}`);
  }

  if (filtres.showOnlyWithEmail) {
    activeFilters.push('Avec email');
  }

  if (filtres.serviceNego === 'oui') {
    activeFilters.push('Service négociation');
  } else if (filtres.serviceNego === 'non') {
    activeFilters.push('Sans service négociation');
  }

  if (filtres.typeNotaire === 'individuels') {
    activeFilters.push('Notaires individuels');
  } else if (filtres.typeNotaire === 'groupes') {
    activeFilters.push('Groupes de notaires');
  }

  if (filtres.statuts.length > 0) {
    const statusLabels: Record<string, string> = {
      'favori': 'Favoris',
      'envisage': 'À envisager',
      'non_interesse': 'Non intéressé',
      'non_defini': 'Non défini'
    };
    const labels = filtres.statuts.map(s => statusLabels[s] || s);
    activeFilters.push(`Statut: ${labels.join(', ')}`);
  }

  if (filtres.showOnlyInRadius) {
    activeFilters.push('Dans le rayon des villes d\'intérêt');
  }

  if (activeFilters.length === 0) {
    return null; // Pas de filtres actifs
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-blue-800">
          Filtres actifs - {resultCount} résultat{resultCount > 1 ? 's' : ''} sur {totalCount}
        </h4>
        <button
          onClick={onClearFilters}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          Tout effacer
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
          >
            {filter}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ActiveFiltersDisplay; 