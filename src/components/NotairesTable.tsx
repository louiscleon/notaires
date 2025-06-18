import React, { useState, useMemo } from 'react';
import { Notaire, NotaireStatut } from '../types';

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

  const handleStatutClick = (e: React.MouseEvent, notaire: Notaire) => {
    e.stopPropagation();
    setOpenStatusMenu(openStatusMenu === notaire.id ? null : notaire.id);
  };

  const handleStatutChange = (e: React.MouseEvent, notaire: Notaire, newStatut: NotaireStatut) => {
    e.stopPropagation();
    onStatutChange(notaire, newStatut);
    setOpenStatusMenu(null);
  };

  const renderStatusButton = (notaire: Notaire) => (
    <button
      onClick={(e) => handleStatutClick(e, notaire)}
      className="touch-button flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors duration-150"
    >
      <span className="text-xl" title={statusLabels[notaire.statut]}>
        {statusIcons[notaire.statut]}
      </span>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const renderStatusMenu = (notaire: Notaire) => (
    openStatusMenu === notaire.id && (
      <div className="absolute z-50 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-200">
        {Object.entries(statusLabels).map(([value, label]) => (
          <button
            key={value}
            onClick={(e) => handleStatutChange(e, notaire, value as NotaireStatut)}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
          >
            <span>{statusIcons[value as NotaireStatut]}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    )
  );

  const renderMobileCard = (notaire: Notaire) => (
    <div
      onClick={() => onNotaireClick(notaire)}
      className={`bg-white rounded-xl shadow-sm p-4 space-y-3 touch-card ${
        selectedNotaire?.id === notaire.id ? 'ring-2 ring-teal-500' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{notaire.officeNotarial}</h3>
          <p className="text-sm text-gray-500 mt-1">{notaire.ville}</p>
        </div>
        <div className="relative">
          {renderStatusButton(notaire)}
          {renderStatusMenu(notaire)}
        </div>
      </div>
      
      <div className="text-sm text-gray-600 space-y-2">
        <p>{notaire.adresse}</p>
        <p>{notaire.codePostal} {notaire.ville}</p>
        {notaire.email && (
          <p className="text-teal-600">{notaire.email}</p>
        )}
      </div>

      <div className="flex items-center space-x-4 text-sm text-gray-500">
        <div>
          <span className="font-medium">{notaire.nbAssocies}</span> associé{notaire.nbAssocies > 1 ? 's' : ''}
        </div>
        <div>
          <span className="font-medium">{notaire.nbSalaries}</span> salarié{notaire.nbSalaries > 1 ? 's' : ''}
        </div>
        {notaire.serviceNego && (
          <div className="text-teal-600">
            Service négo ✓
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Vue mobile en cartes */}
      <div className="md:hidden space-y-3">
        {notaires.map((notaire, index) => (
          <div key={`mobile-${notaire.id}`}>
            {renderMobileCard(notaire)}
          </div>
        ))}
      </div>

      {/* Vue desktop en tableau */}
      <div className="hidden md:block overflow-x-auto">
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
            {notaires.map((notaire) => (
              <tr
                key={notaire.id}
                onClick={() => onNotaireClick(notaire)}
                className={`cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${
                  selectedNotaire?.id === notaire.id ? 'bg-teal-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap relative">
                  {renderStatusButton(notaire)}
                  {renderStatusMenu(notaire)}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {notaire.officeNotarial}
                  </div>
                  {notaire.email && (
                    <div className="text-sm text-teal-600">
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {notaire.serviceNego ? (
                    <span className="text-teal-600">Oui ✓</span>
                  ) : (
                    <span>Non</span>
                  )}
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
