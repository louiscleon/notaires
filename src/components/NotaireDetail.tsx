import React, { useState, useEffect, useRef } from 'react';
import { Notaire, NotaireStatut, Contact, ContactStatut, AdresseSuggestion } from '../types';
import { searchAdresse } from '../services/adresse';
import { geocodeAddress } from '../services/geocoding';
import { googleSheetsService } from '../services/googleSheets';

interface NotaireDetailProps {
  notaire: Notaire;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedNotaire: Notaire) => void;
}

const ContactStatutBadge: React.FC<{ statut: ContactStatut }> = ({ statut }) => {
  const styles = {
    non_contacte: 'bg-gray-100 text-gray-800',
    mail_envoye: 'bg-blue-100 text-blue-800',
    relance_envoyee: 'bg-yellow-100 text-yellow-800',
    reponse_recue: 'bg-green-100 text-green-800',
    cloture: 'bg-purple-100 text-purple-800'
  };

  const labels = {
    non_contacte: '📝 Non contacté',
    mail_envoye: '📧 Mail envoyé',
    relance_envoyee: '🔄 Relance envoyée',
    reponse_recue: '✉️ Réponse reçue',
    cloture: '✅ Clôturé'
  };

  return (
    <span className={`px-3 py-1 inline-flex text-xs font-medium rounded-full ${styles[statut]}`}>
      {labels[statut]}
    </span>
  );
};

export const NotaireDetail: React.FC<NotaireDetailProps> = ({
  notaire,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [editedNotaire, setEditedNotaire] = useState<Notaire>(notaire);
  const [isEditing, setIsEditing] = useState(false);
  const [geocodingStatus, setGeocodingStatus] = useState<string>('');
  const [adresse, setAdresse] = useState(notaire.adresse);
  const [adresseSuggestions, setAdresseSuggestions] = useState<AdresseSuggestion[]>([]);
  const [email, setEmail] = useState(notaire.email);
  const [notes, setNotes] = useState(notaire.notes || '');
  const [statut, setStatut] = useState<NotaireStatut>(notaire.statut);
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    type: 'initial',
    par: 'Fanny',
    statut: 'mail_envoye'
  });
  const hasUnsavedChanges = useRef(false);

  useEffect(() => {
    const searchAdresses = async () => {
      if (adresse.length < 3) {
        setAdresseSuggestions([]);
        return;
      }
      const suggestions = await searchAdresse(adresse);
      setAdresseSuggestions(suggestions);
    };

    const timeoutId = setTimeout(searchAdresses, 300);
    return () => clearTimeout(timeoutId);
  }, [adresse]);

  // Sauvegarder les modifications non enregistrées à la fermeture
  useEffect(() => {
    if (!isOpen && hasUnsavedChanges.current) {
      saveAndSync(editedNotaire);
      hasUnsavedChanges.current = false;
    }
  }, [isOpen]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedNotaire = {
      ...editedNotaire,
      [name]: value,
      dateModification: new Date().toISOString()
    };
    setEditedNotaire(updatedNotaire);
    hasUnsavedChanges.current = true;
    await saveAndSync(updatedNotaire);
  };

  const saveAndSync = async (updatedNotaire: Notaire) => {
    try {
      onUpdate(updatedNotaire);
      await googleSheetsService.saveToSheet(updatedNotaire);
      hasUnsavedChanges.current = false;
    } catch (error) {
      console.error('Erreur lors de la synchronisation avec Google Sheets:', error);
      setGeocodingStatus('Erreur lors de la sauvegarde dans Google Sheets');
      hasUnsavedChanges.current = true;
    }
  };

  const handleSave = async () => {
    if (
      editedNotaire.adresse !== notaire.adresse ||
      editedNotaire.codePostal !== notaire.codePostal ||
      editedNotaire.ville !== notaire.ville
    ) {
      setGeocodingStatus('Géocodage en cours...');
      try {
        const fullAddress = `${editedNotaire.adresse}, ${editedNotaire.codePostal} ${editedNotaire.ville}`;
        const result = await geocodeAddress(fullAddress);
        
        if (result.error) {
          setGeocodingStatus(`Erreur de géocodage : ${result.error}`);
          return;
        }

        const updatedNotaire = {
          ...editedNotaire,
          latitude: result.lat,
          longitude: result.lon,
          display_name: result.display_name,
          dateModification: new Date().toISOString()
        };
        
        await saveAndSync(updatedNotaire);
        setGeocodingStatus('Géocodage réussi !');
        setIsEditing(false);
      } catch (error) {
        console.error('Erreur lors du géocodage ou de la sauvegarde:', error);
        setGeocodingStatus('Erreur lors du géocodage ou de la sauvegarde');
        return;
      }
    } else {
      const updatedNotaire = {
        ...editedNotaire,
        dateModification: new Date().toISOString()
      };
      await saveAndSync(updatedNotaire);
      setIsEditing(false);
    }
  };

  const handleSelectAdresse = async (suggestion: AdresseSuggestion) => {
    setAdresse(suggestion.label);
    const updatedNotaire: Notaire = {
      ...notaire,
      adresse: suggestion.label,
      codePostal: suggestion.postcode,
      ville: suggestion.city,
      latitude: suggestion.coordinates.lat,
      longitude: suggestion.coordinates.lng,
      dateModification: new Date().toISOString()
    };
    await saveAndSync(updatedNotaire);
    setAdresseSuggestions([]);
  };

  const handleAddContact = async () => {
    if (!newContact.date) return;

    const contact: Contact = {
      date: newContact.date,
      type: newContact.type as 'initial' | 'relance',
      par: newContact.par as 'Fanny' | 'Jade',
      statut: newContact.statut as ContactStatut
    };

    const updatedNotaire: Notaire = {
      ...notaire,
      contacts: [...notaire.contacts, contact],
      dateModification: new Date().toISOString()
    };
    
    await saveAndSync(updatedNotaire);
    setShowContactForm(false);
    setNewContact({
      type: 'initial',
      par: 'Fanny',
      statut: 'mail_envoye'
    });
  };

  const handleUpdateContact = async (index: number, updates: Partial<Contact>) => {
    const updatedContacts = [...notaire.contacts];
    const currentContact = updatedContacts[index];
    
    if (updates.reponseRecue) {
      const now = new Date().toISOString();
      const reponseRecue = {
        ...updates.reponseRecue,
        date: now,
        positive: false
      };
      updates = {
        ...updates,
        reponseRecue,
        statut: 'reponse_recue' as ContactStatut
      };
    }

    updatedContacts[index] = { ...currentContact, ...updates };

    const updatedNotaire = {
      ...notaire,
      contacts: updatedContacts,
      dateModification: new Date().toISOString()
    };

    await saveAndSync(updatedNotaire);
  };

  const handleClose = async () => {
    // Sauvegarder les modifications non enregistrées avant de fermer
    if (hasUnsavedChanges.current) {
      try {
        await saveAndSync(editedNotaire);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde finale:', error);
        setGeocodingStatus('Erreur lors de la sauvegarde. Veuillez réessayer avant de fermer.');
        return; // Ne pas fermer si la sauvegarde a échoué
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Détails du Notaire</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Adresse
                </label>
                <input
                  type="text"
                  name="adresse"
                  value={editedNotaire.adresse}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Code Postal
                </label>
                <input
                  type="text"
                  name="codePostal"
                  value={editedNotaire.codePostal}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ville
                </label>
                <input
                  type="text"
                  name="ville"
                  value={editedNotaire.ville}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={editedNotaire.email || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={editedNotaire.notes || ''}
                  onChange={handleInputChange}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <>
              <p><strong>Office Notarial:</strong> {notaire.officeNotarial}</p>
              <p><strong>Adresse:</strong> {notaire.adresse}</p>
              <p><strong>Code Postal:</strong> {notaire.codePostal}</p>
              <p><strong>Ville:</strong> {notaire.ville}</p>
              <p><strong>Email:</strong> {notaire.email || 'Non renseigné'}</p>
              <p><strong>Notes:</strong> {notaire.notes || 'Aucune note'}</p>
              <p><strong>Notaires Associés:</strong> {notaire.notairesAssocies}</p>
              <p><strong>Notaires Salariés:</strong> {notaire.notairesSalaries}</p>
              <p><strong>Service Négociation:</strong> {notaire.serviceNego ? 'Oui' : 'Non'}</p>
            </>
          )}

          {geocodingStatus && (
            <div className={`mt-4 p-2 rounded ${
              geocodingStatus.includes('Erreur') 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              {geocodingStatus}
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditedNotaire(notaire);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Modifier
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotaireDetail; 