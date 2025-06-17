import React, { useState, useEffect, useRef, Fragment, Dispatch, SetStateAction } from 'react';
import { Notaire, NotaireStatut, AdresseSuggestion } from '../types';
import { geocodeSingleNotaire } from '../services/geocoding';
import { searchAdresse } from '../services/adresse';
import ContactHistory from './ContactHistory';
import { Dialog, Transition, Listbox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { notaireService } from '../services/notaireService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notaire: Notaire;
  onSave: (notaire: Notaire) => void;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  addToast: (message: string, type: 'success' | 'error') => void;
}

interface CustomSelectProps {
  value: NotaireStatut;
  onChange: (value: NotaireStatut) => void;
  options: Array<{
    value: NotaireStatut;
    label: string;
    icon: string;
  }>;
  label: string;
}

const statusOptions: Array<{
  value: NotaireStatut;
  label: string;
  icon: string;
}> = [
  { value: 'non_defini', label: 'Non défini', icon: '❓' },
  { value: 'favori', label: 'Favori', icon: '⭐️' },
  { value: 'envisage', label: 'À envisager', icon: '🤔' },
  { value: 'non_interesse', label: 'Non intéressé', icon: '❌' }
];

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, label }) => {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-3 pr-10 text-left border border-gray-300 hover:border-teal-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-colors duration-200">
          <span className="flex items-center space-x-2">
            <span className="text-xl">{options.find(opt => opt.value === value)?.icon}</span>
            <span className="block truncate text-gray-900">{options.find(opt => opt.value === value)?.label}</span>
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-[9999] w-full mt-1 max-h-60 overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                    active ? 'bg-teal-50 text-teal-900' : 'text-gray-900'
                  }`
                }
                value={option.value}
              >
                {({ selected, active }) => (
                  <div className="flex items-center space-x-2">
                    <span className="text-xl block">{option.icon}</span>
                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                      {option.label}
                    </span>
                    {selected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-teal-600">
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

const NotaireModal: React.FC<Props> = ({ isOpen, onClose, notaire, onSave, isEditing, setIsEditing, addToast }) => {
  const [editedNotaire, setEditedNotaire] = useState<Notaire>(notaire);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mettre à jour l'état local quand le notaire change
  useEffect(() => {
    setEditedNotaire(notaire);
  }, [notaire]);

  // Gérer les changements de champs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedNotaire(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Gérer les changements de statut
  const handleStatusChange = (value: NotaireStatut) => {
    setEditedNotaire(prev => ({
      ...prev,
      statut: value
    }));
  };

  // Gérer les cases à cocher
  const handleCheckboxChange = (name: string, checked: boolean) => {
    setEditedNotaire(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Sauvegarder les modifications
  const handleSave = async () => {
    try {
      // Mettre à jour la date de modification
      const updatedNotaire = {
        ...editedNotaire,
        dateModification: new Date().toISOString()
      };

      // Sauvegarder via le service
      await notaireService.updateNotaire(updatedNotaire);
      
      // Mettre à jour l'état parent
      onSave(updatedNotaire);
      
      addToast('Modifications enregistrées', 'success');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setSaveError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{notaire.officeNotarial}</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
            </div>

            <div className="space-y-4">
              {/* Informations de base */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adresse</label>
                  <input
                    type="text"
                    name="adresse"
                    value={editedNotaire.adresse}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code Postal</label>
                  <input
                    type="text"
                    name="codePostal"
                    value={editedNotaire.codePostal}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ville</label>
                  <input
                    type="text"
                    name="ville"
                    value={editedNotaire.ville}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editedNotaire.email || ''}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Notaires */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre d'associés</label>
                  <input
                    type="number"
                    name="nbAssocies"
                    value={editedNotaire.nbAssocies}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre de salariés</label>
                  <input
                    type="number"
                    name="nbSalaries"
                    value={editedNotaire.nbSalaries}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notaires associés</label>
                  <input
                    type="text"
                    name="notairesAssocies"
                    value={editedNotaire.notairesAssocies}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notaires salariés</label>
                  <input
                    type="text"
                    name="notairesSalaries"
                    value={editedNotaire.notairesSalaries}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Service négo */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editedNotaire.serviceNego}
                    onChange={(e) => handleCheckboxChange('serviceNego', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Service de négociation</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  name="notes"
                  value={editedNotaire.notes || ''}
                  onChange={handleInputChange}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              {/* Boutons */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Fermer
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>

              {/* Message d'erreur */}
              {saveError && (
                <div className="mt-4 rounded-md bg-red-50 p-4 text-red-700">
                  {saveError}
                </div>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default NotaireModal; 