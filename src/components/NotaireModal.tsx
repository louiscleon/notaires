import React, { useState, useEffect, useRef, Fragment, Dispatch, SetStateAction } from 'react';
import { Notaire, NotaireStatut, AdresseSuggestion } from '../types';
import { geocodeSingleNotaire } from '../services/geocoding';
import { searchAdresse } from '../services/adresse';
import ContactHistory from './ContactHistory';
import { Dialog, Transition, Listbox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { googleSheetsService } from '../services/googleSheets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notaire: Notaire;
  onSave: (notaire: Notaire) => void;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
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

const NotaireModal: React.FC<Props> = ({ isOpen, onClose, notaire, onSave, isEditing, setIsEditing }) => {
  // Vérifier que le notaire a un ID valide
  if (!notaire.id) {
    console.error('Notaire sans ID reçu dans NotaireModal');
    return null;
  }

  const [editedNotaire, setEditedNotaire] = useState<Notaire>(notaire);
  const [activeTab, setActiveTab] = useState<'info' | 'contacts'>('info');
  const [geocodingStatus, setGeocodingStatus] = useState<string>('');
  const [adresseSuggestions, setAdresseSuggestions] = useState<AdresseSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasUnsavedChanges = useRef(false);

  useEffect(() => {
    // Vérifier que le notaire a un ID valide lors des mises à jour
    if (!notaire.id) {
      console.error('Notaire sans ID reçu dans la mise à jour de NotaireModal');
      setSaveError('Erreur : ID du notaire manquant');
      return;
    }
    setEditedNotaire(notaire);
  }, [notaire]);

  useEffect(() => {
    const searchAdresses = async () => {
      if (!editedNotaire.adresse || editedNotaire.adresse.length < 3) {
        setAdresseSuggestions([]);
        return;
      }
      const suggestions = await searchAdresse(editedNotaire.adresse);
      setAdresseSuggestions(suggestions);
    };

    const timeoutId = setTimeout(searchAdresses, 300);
    return () => clearTimeout(timeoutId);
  }, [editedNotaire.adresse]);

  // Sauvegarder les modifications non enregistrées à la fermeture
  useEffect(() => {
    if (!isOpen && hasUnsavedChanges.current) {
      saveAndSync(editedNotaire);
      hasUnsavedChanges.current = false;
    }
  }, [isOpen]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // S'assurer que l'ID est toujours présent
    if (!editedNotaire.id) {
      console.error('ID du notaire manquant');
      setSaveError('Erreur : ID du notaire manquant');
      return;
    }

    const updatedNotaire = {
      ...editedNotaire,
      [name]: value,
      id: editedNotaire.id,
      dateModification: new Date().toISOString()
    };
    setEditedNotaire(updatedNotaire);
    hasUnsavedChanges.current = true;

    // Sauvegarder immédiatement
    await saveAndSync(updatedNotaire);

    if (name === 'adresse') {
      setShowSuggestions(true);
    }
  };

  const handleSelectAdresse = async (suggestion: AdresseSuggestion) => {
    if (!editedNotaire.id) {
      console.error('ID du notaire manquant');
      setSaveError('Erreur : ID du notaire manquant');
      return;
    }

    setGeocodingStatus('Géocodage de la nouvelle adresse...');
    
    const updatedNotaire = {
      ...editedNotaire,
      id: editedNotaire.id,
      adresse: suggestion.label,
      codePostal: suggestion.postcode,
      ville: suggestion.city,
      latitude: suggestion.coordinates.lat,
      longitude: suggestion.coordinates.lng,
      dateModification: new Date().toISOString()
    };

    try {
      const geocodedNotaire = await geocodeSingleNotaire(updatedNotaire);
      if (geocodedNotaire.geoStatus === 'success') {
        setGeocodingStatus('Adresse géocodée avec succès');
        await saveAndSync(geocodedNotaire);
      } else {
        setGeocodingStatus('Erreur lors du géocodage de l\'adresse');
        await saveAndSync(updatedNotaire);
      }
    } catch (error) {
      console.error('Erreur lors du géocodage:', error);
      setGeocodingStatus('Erreur lors du géocodage de l\'adresse');
      await saveAndSync(updatedNotaire);
    } finally {
      setShowSuggestions(false);
    }
  };

  const handleCheckboxChange = async (name: string, checked: boolean) => {
    if (!editedNotaire.id) {
      console.error('ID du notaire manquant');
      setSaveError('Erreur : ID du notaire manquant');
      return;
    }

    const updatedNotaire = {
      ...editedNotaire,
      id: editedNotaire.id,
      [name]: checked,
      dateModification: new Date().toISOString()
    };
    setEditedNotaire(updatedNotaire);
    await saveAndSync(updatedNotaire);
  };

  const handleStatusChange = async (value: NotaireStatut) => {
    if (!editedNotaire.id) {
      console.error('ID du notaire manquant');
      setSaveError('Erreur : ID du notaire manquant');
      return;
    }

    const updatedNotaire = {
      ...editedNotaire,
      id: editedNotaire.id,
      statut: value,
      dateModification: new Date().toISOString()
    };
    setEditedNotaire(updatedNotaire);
    await saveAndSync(updatedNotaire);
  };

  const saveAndSync = async (updatedNotaire: Notaire) => {
    try {
      setSaveError(null);
      onSave(updatedNotaire);
      await googleSheetsService.saveToSheet(updatedNotaire);
      hasUnsavedChanges.current = false;
    } catch (error) {
      console.error('Erreur lors de la synchronisation avec Google Sheets:', error);
      setSaveError('Erreur lors de la sauvegarde. Les modifications seront perdues au rechargement de la page.');
      hasUnsavedChanges.current = true;
    }
  };

  const handleClose = async () => {
    // Sauvegarder les modifications non enregistrées avant de fermer
    if (hasUnsavedChanges.current) {
      await saveAndSync(editedNotaire);
    }
    onClose();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-visible rounded-2xl bg-white shadow-2xl transition-all w-full max-w-4xl">
                <div className="relative bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-xl font-bold text-white">
                      {notaire.officeNotarial}
                    </Dialog.Title>
                    <button
                      onClick={handleClose}
                      className="text-white hover:text-gray-200 transition-colors duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-4 flex space-x-1">
                    <button
                      onClick={() => setActiveTab('info')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors duration-200 ${
                        activeTab === 'info'
                          ? 'bg-white text-teal-600'
                          : 'text-white hover:bg-white hover:bg-opacity-10'
                      }`}
                    >
                      Informations
                    </button>
                    <button
                      onClick={() => setActiveTab('contacts')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors duration-200 ${
                        activeTab === 'contacts'
                          ? 'bg-white text-teal-600'
                          : 'text-white hover:bg-white hover:bg-opacity-10'
                      }`}
                    >
                      Contacts
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {activeTab === 'info' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible hover:border-teal-500 transition-colors duration-200">
                          <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-900">Statut</h3>
                          </div>
                          <div className="p-3">
                            <CustomSelect
                              value={editedNotaire.statut}
                              onChange={handleStatusChange}
                              options={statusOptions}
                              label="Statut actuel"
                            />
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-teal-500 transition-colors duration-200">
                          <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-900">Coordonnées</h3>
                          </div>
                          <div className="p-3 space-y-3">
                            <div className="relative">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Adresse
                              </label>
                              <input
                                type="text"
                                name="adresse"
                                value={editedNotaire.adresse}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
                              />
                              {showSuggestions && adresseSuggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200">
                                  {adresseSuggestions.map((suggestion, index) => (
                                    <button
                                      key={index}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                                      onClick={() => handleSelectAdresse(suggestion)}
                                    >
                                      {suggestion.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Code Postal
                                </label>
                                <input
                                  type="text"
                                  name="codePostal"
                                  value={editedNotaire.codePostal}
                                  onChange={handleInputChange}
                                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Ville
                                </label>
                                <input
                                  type="text"
                                  name="ville"
                                  value={editedNotaire.ville}
                                  onChange={handleInputChange}
                                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={editedNotaire.email || ''}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-teal-500 transition-colors duration-200">
                          <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-900">Informations</h3>
                          </div>
                          <div className="p-3 space-y-4">
                            <div className="bg-gradient-to-br from-teal-50 to-white rounded-lg p-4 border border-teal-100">
                              <div className="text-sm font-medium text-teal-800 mb-2">
                                Notaires associés
                              </div>
                              <input
                                type="number"
                                name="nbAssocies"
                                value={editedNotaire.nbAssocies}
                                onChange={handleInputChange}
                                min="0"
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 mb-2 transition-colors duration-200"
                              />
                              <input
                                type="text"
                                name="notairesAssocies"
                                value={editedNotaire.notairesAssocies}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
                              />
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-4 border border-blue-100">
                              <div className="text-sm font-medium text-blue-800 mb-2">
                                Notaires salariés
                              </div>
                              <input
                                type="number"
                                name="nbSalaries"
                                value={editedNotaire.nbSalaries}
                                onChange={handleInputChange}
                                min="0"
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 mb-2 transition-colors duration-200"
                              />
                              <input
                                type="text"
                                name="notairesSalaries"
                                value={editedNotaire.notairesSalaries}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-teal-500 transition-colors duration-200">
                          <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-900">Service de négociation</h3>
                          </div>
                          <div className="p-3">
                            <label className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={editedNotaire.serviceNego}
                                onChange={(e) => handleCheckboxChange('serviceNego', e.target.checked)}
                                className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded transition-colors duration-200"
                              />
                              <span className="text-gray-900 font-medium">
                                Service de négociation
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-teal-500 transition-colors duration-200">
                        <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                          <h3 className="text-sm font-medium text-gray-900">Notes</h3>
                        </div>
                        <div className="p-3">
                          <textarea
                            name="notes"
                            value={editedNotaire.notes || ''}
                            onChange={handleInputChange}
                            placeholder="Ajouter des notes..."
                            className="w-full h-[calc(100vh-28rem)] rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 resize-none transition-colors duration-200"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ContactHistory
                      notaire={notaire}
                      onUpdate={onSave}
                    />
                  )}

                  {saveError && (
                    <div className="mt-6 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">⚠️</span>
                        <span>{saveError}</span>
                      </div>
                    </div>
                  )}

                  {geocodingStatus && (
                    <div className={`mt-6 p-4 rounded-lg ${
                      geocodingStatus.includes('Erreur') 
                        ? 'bg-red-50 text-red-700 border border-red-200' 
                        : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">
                          {geocodingStatus.includes('Erreur') ? '⚠️' : '✓'}
                        </span>
                        <span>{geocodingStatus}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default NotaireModal; 