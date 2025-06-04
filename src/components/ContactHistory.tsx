import React, { useState, useEffect, Fragment } from 'react';
import { Notaire, Contact, ContactStatut } from '../types';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { googleSheetsService } from '../services/googleSheets';

interface Props {
  notaire: Notaire;
  onUpdate: (notaire: Notaire) => void;
}

interface SelectOption {
  value: string;
  label: string;
}

const typeOptions: SelectOption[] = [
  { value: 'initial', label: 'Premier contact' },
  { value: 'relance', label: 'Relance' }
];

const parOptions: SelectOption[] = [
  { value: 'Fanny', label: 'Fanny' },
  { value: 'Jade', label: 'Jade' }
];

const statutOptions: SelectOption[] = [
  { value: 'mail_envoye', label: 'Mail envoyé' },
  { value: 'relance_envoyee', label: 'Relance envoyée' },
  { value: 'reponse_recue', label: 'Réponse reçue' },
  { value: 'cloture', label: 'Clôturé' }
];

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, label }) => {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-3 pr-10 text-left border border-gray-300 hover:border-teal-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-colors duration-200">
          <span className="block truncate text-gray-900">
            {options.find(opt => opt.value === value)?.label}
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
          <Listbox.Options className="absolute z-[9999] w-full mt-1 max-h-60 overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
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
                  <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                    {option.label}
                  </span>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

const ContactHistory: React.FC<Props> = ({ notaire, onUpdate }) => {
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    type: 'initial',
    par: 'Fanny',
    statut: 'mail_envoye',
    date: new Date().toISOString().split('T')[0]
  });
  const [localContacts, setLocalContacts] = useState<Contact[]>(notaire.contacts || []);

  // Mettre à jour les contacts locaux quand notaire change
  useEffect(() => {
    setLocalContacts(notaire.contacts || []);
  }, [notaire.contacts]);

  const saveAndSync = async (updatedNotaire: Notaire) => {
    try {
      // Vérifier la configuration Google Sheets
      if (!googleSheetsService.checkConfiguration()) {
        console.error('Configuration Google Sheets manquante');
        // On continue quand même avec la mise à jour locale
        setLocalContacts(updatedNotaire.contacts || []);
        onUpdate(updatedNotaire);
        return;
      }

      // Mettre à jour l'état local immédiatement
      setLocalContacts(updatedNotaire.contacts || []);
      
      // Mettre à jour l'état parent
      onUpdate(updatedNotaire);

      // S'assurer que l'authentification est valide
      await googleSheetsService.ensureAuth();

      // Synchroniser avec Google Sheets
      console.log('Tentative de synchronisation avec Google Sheets...', {
        notaireId: updatedNotaire.id,
        officeNotarial: updatedNotaire.officeNotarial,
        contacts: updatedNotaire.contacts
      });

      // Charger les données existantes
      const response = await googleSheetsService.loadFromSheet();
      const existingNotaires = response.notaires;
      
      // Mettre à jour le notaire dans les données existantes
      const updatedNotaires = existingNotaires.map(n => 
        n.id === updatedNotaire.id ? updatedNotaire : n
      );

      // Sauvegarder toutes les données
      await googleSheetsService.saveToSheet(updatedNotaires);
      console.log('Synchronisation avec Google Sheets réussie');
    } catch (error) {
      console.error('Erreur lors de la synchronisation avec Google Sheets:', error);
      // En cas d'erreur, on garde quand même la mise à jour locale
      // et on affiche un message à l'utilisateur
      alert('La mise à jour a été sauvegardée localement mais la synchronisation avec Google Sheets a échoué. Veuillez réessayer plus tard.');
    }
  };

  const handleAddContact = async () => {
    if (!newContact.date) return;

    const contact: Contact = {
      date: newContact.date,
      type: newContact.type || 'initial',
      par: newContact.par || 'Fanny',
      statut: newContact.statut || 'mail_envoye'
    };

    const newContacts = [...localContacts, contact];
    
    const updatedNotaire = {
      ...notaire,
      contacts: newContacts,
      dateModification: new Date().toISOString()
    };

    await saveAndSync(updatedNotaire);

    // Réinitialiser le formulaire avec la date d'aujourd'hui
    setNewContact({
      type: 'initial',
      par: 'Fanny',
      statut: 'mail_envoye',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleDeleteContact = async (index: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      return;
    }

    const newContacts = [...localContacts];
    newContacts.splice(index, 1);

    const updatedNotaire = {
      ...notaire,
      contacts: newContacts,
      dateModification: new Date().toISOString()
    };

    await saveAndSync(updatedNotaire);
  };

  const handleUpdateContact = async (index: number, updates: Partial<Contact>) => {
    const newContacts = [...localContacts];
    newContacts[index] = { ...newContacts[index], ...updates };

    const updatedNotaire = {
      ...notaire,
      contacts: newContacts,
      dateModification: new Date().toISOString()
    };

    await saveAndSync(updatedNotaire);
  };

  const getStatusStyle = (statut: ContactStatut) => {
    switch (statut) {
      case 'mail_envoye':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'relance_envoyee':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'reponse_recue':
        return 'bg-green-50 text-green-700 border-green-100';
      case 'cloture':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout de contact */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible hover:border-teal-500 transition-colors duration-200">
        <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Nouveau contact</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={newContact.date || ''}
                onChange={(e) => setNewContact({ ...newContact, date: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <CustomSelect
                value={newContact.type || 'initial'}
                onChange={(value) => setNewContact({ ...newContact, type: value as 'initial' | 'relance' })}
                options={typeOptions}
                label="Type de contact"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Par
              </label>
              <CustomSelect
                value={newContact.par || 'Fanny'}
                onChange={(value) => setNewContact({ ...newContact, par: value as 'Fanny' | 'Jade' })}
                options={parOptions}
                label="Contact par"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <CustomSelect
                value={newContact.statut || 'mail_envoye'}
                onChange={(value) => setNewContact({ ...newContact, statut: value as ContactStatut })}
                options={statutOptions}
                label="Statut du contact"
              />
            </div>
          </div>
          <button
            onClick={handleAddContact}
            className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Ajouter le contact</span>
          </button>
        </div>
      </div>

      {/* Historique des contacts */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-teal-500 transition-colors duration-200">
        <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Historique des contacts</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {localContacts.map((contact, index) => (
            <div key={`${contact.date}-${index}`} className="p-4 hover:bg-gray-50 transition-colors duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(contact.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="text-sm text-gray-500">
                    par {contact.par}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(contact.statut)}`}>
                    {contact.statut === 'mail_envoye' ? 'Mail envoyé'
                      : contact.statut === 'relance_envoyee' ? 'Relance envoyée'
                      : contact.statut === 'reponse_recue' ? 'Réponse reçue'
                      : 'Clôturé'}
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
                        handleDeleteContact(index);
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                    title="Supprimer ce contact"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{contact.type === 'initial' ? 'Premier contact' : 'Relance'}</span>
              </div>
              {contact.statut === 'reponse_recue' && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={contact.reponseRecue?.positive}
                        onChange={() => handleUpdateContact(index, {
                          reponseRecue: { date: new Date().toISOString(), positive: true }
                        })}
                        className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">Positive</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={contact.reponseRecue?.positive === false}
                        onChange={() => handleUpdateContact(index, {
                          reponseRecue: { date: new Date().toISOString(), positive: false }
                        })}
                        className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700">Négative</span>
                    </label>
                  </div>
                  <textarea
                    value={contact.reponseRecue?.commentaire || ''}
                    onChange={(e) => handleUpdateContact(index, {
                      reponseRecue: { ...contact.reponseRecue!, commentaire: e.target.value }
                    })}
                    placeholder="Commentaire sur la réponse..."
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 transition-colors duration-200 text-sm"
                    rows={3}
                  />
                </div>
              )}
            </div>
          ))}
          {localContacts.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4-4-4z" />
              </svg>
              <p className="mt-2">Aucun contact enregistré</p>
              <p className="text-sm">Utilisez le formulaire ci-dessus pour ajouter un contact</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactHistory; 