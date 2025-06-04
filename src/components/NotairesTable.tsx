import React, { useState, useMemo } from 'react';
import { Notaire, NotaireStatut } from '../types';
import SearchBar from './SearchBar';

interface Props {
  notaires: Notaire[];
  onNotaireClick: (notaire: Notaire) => void;
  selectedNotaire?: Notaire;
  onStatutChange: (notaire: Notaire, newStatut: NotaireStatut) => void;
}

const statusIcons: Record<NotaireStatut, string> = {
  'favori': '⭐️',
  'envisage': '🤔',
  'non_interesse': '❌',
  'non_defini': '❓'
};

const statusLabels: Record<NotaireStatut, string> = {
  'favori': 'Favori',
  'envisage': 'À envisager',
  'non_interesse': 'Non intéressé',
  'non_defini': 'Non défini'
};

const NotairesTable: React.FC<Props> = ({ notaires, onNotaireClick, selectedNotaire, onStatutChange }) => {
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleStatutClick = (e: React.MouseEvent, notaire: Notaire) => {
    e.stopPropagation();
    setOpenStatusMenu(openStatusMenu === notaire.id ? null : notaire.id);
  };

  const handleStatutChange = (e: React.MouseEvent, notaire: Notaire, newStatut: NotaireStatut) => {
    e.stopPropagation();
    onStatutChange(notaire, newStatut);
    setOpenStatusMenu(null);
  };

  const filteredNotaires = useMemo(() => {
    if (!searchQuery) return notaires;
    
    const searchTerms = searchQuery.toLowerCase().split(' ');
    return notaires.filter(notaire => {
      const searchableText = `
        ${notaire.officeNotarial}
        ${notaire.adresse}
        ${notaire.codePostal}
        ${notaire.ville}
        ${notaire.email || ''}
        ${notaire.notairesAssocies || ''}
        ${notaire.notairesSalaries || ''}
      `.toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }, [notaires, searchQuery]);

  return (
    <div className="space-y-4">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={filteredNotaires.length}
      />

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Office Notarial
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Adresse
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Équipe
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service Négo
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredNotaires.map((notaire) => (
              <tr
                key={notaire.id}
                onClick={() => onNotaireClick(notaire)}
                className={`cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${
                  selectedNotaire?.id === notaire.id ? 'bg-teal-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap relative">
                  <button
                    onClick={(e) => handleStatutClick(e, notaire)}
                    className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors duration-150"
                  >
                    <span className="text-xl" title={statusLabels[notaire.statut]}>
                      {statusIcons[notaire.statut]}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openStatusMenu === notaire.id && (
                    <div className="absolute z-50 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200">
                      {Object.entries(statusIcons).map(([statut, icon]) => (
                        <button
                          key={statut}
                          onClick={(e) => handleStatutChange(e, notaire, statut as NotaireStatut)}
                          className={`w-full flex items-center space-x-3 px-4 py-2 text-sm text-left hover:bg-gray-50 ${
                            notaire.statut === statut ? 'bg-teal-50 text-teal-900' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-xl">{icon}</span>
                          <span>{statusLabels[statut as NotaireStatut]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {notaire.officeNotarial}
                  </div>
                  {notaire.email && (
                    <div className="text-sm text-gray-500">
                      {notaire.email}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {notaire.adresse}
                  </div>
                  <div className="text-sm text-gray-500">
                    {notaire.codePostal} {notaire.ville}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {notaire.nbAssocies} associé{notaire.nbAssocies > 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-gray-500">
                    {notaire.nbSalaries} salarié{notaire.nbSalaries > 1 ? 's' : ''}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    notaire.serviceNego
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {notaire.serviceNego ? 'Oui' : 'Non'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NotairesTable;
