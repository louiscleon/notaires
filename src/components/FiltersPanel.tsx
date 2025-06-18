import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Filtres, VilleInteret, NotaireStatut, ContactStatut } from '../types';
import { geocodeAddress } from '../services/geocoding';
import { googleSheetsService } from '../services/googleSheets';
import Modal from './Modal';

interface Props {
  filtres: Filtres;
  onFiltresChange: (filtres: Filtres) => void;
  notairesCount: number;
}

interface VilleSuggestion {
  nom: string;
  code: string;
  departement?: string;
  population?: number;
}

const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string }[];
}> = ({ label, value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={selectRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {selectedOption?.icon && (
              <span className="mr-2">{selectedOption.icon}</span>
            )}
            <span>{selectedOption?.label}</span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center ${
                option.value === value ? 'text-teal-600 bg-teal-50' : 'text-gray-700'
              }`}
            >
              {option.icon && <span className="mr-2">{option.icon}</span>}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomNumberInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  icon?: string;
}> = ({ label, value, onChange, min = 0, max = 999, icon }) => {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {icon && <span className="mr-2">{icon}</span>}
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-gray-700"
      />
    </div>
  );
};

interface VillesInteretModalProps {
  isOpen: boolean;
  onClose: () => void;
  filtres: Filtres;
  onFiltresChange: (filtres: Filtres) => void;
  nouveauRayon: number;
  setNouveauRayon: (rayon: number) => void;
  handleRayonGlobalChange: (rayon: number) => void;
}

const VillesInteretModal = React.memo(({
  isOpen,
  onClose,
  filtres,
  onFiltresChange,
  nouveauRayon,
  setNouveauRayon,
  handleRayonGlobalChange,
}: VillesInteretModalProps) => {
  const [nouvelleVille, setNouvelleVille] = useState('');
  const [suggestions, setSuggestions] = useState<VilleSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Gérer la recherche de suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (nouvelleVille.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(nouvelleVille)}&boost=population&limit=5`
        );
        const data = await response.json();
        setSuggestions(
          data.map((ville: any) => ({
            nom: ville.nom,
            code: ville.code,
            departement: ville.departement,
            population: ville.population
          }))
        );
      } catch (error) {
        console.error('Erreur lors de la recherche de villes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [nouvelleVille]);

  // Gérer le focus et le clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchFocus = useCallback(() => {
    if (nouvelleVille.length >= 2) {
      setShowSuggestions(true);
    }
  }, [nouvelleVille.length]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNouvelleVille(e.target.value);
    if (e.target.value.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, []);

  const handleSelectVille = async (suggestion: VilleSuggestion) => {
    try {
      const adresseComplete = `${suggestion.nom} ${suggestion.code.substring(0, 2)}`;
      const coords = await geocodeAddress(adresseComplete);

      if (!coords || coords.error) {
        console.error('Erreur de géocodage:', coords?.error || 'Pas de coordonnées retournées');
        return;
      }

      // Vérifier si la ville existe déjà
      const villeExistante = filtres.villesInteret.find(v => v.id === `ville_${suggestion.code}`);
      if (villeExistante) {
        console.warn('Cette ville est déjà dans la liste');
        return;
      }

      const nouvelleVilleInteret: VilleInteret = {
        id: `ville_${suggestion.code}`,
        nom: suggestion.nom,
        rayon: nouveauRayon,
        latitude: coords.lat,
        longitude: coords.lon,
        departement: suggestion.departement || suggestion.code.substring(0, 2),
        population: suggestion.population
      };

      const newVillesInteret = [...filtres.villesInteret, nouvelleVilleInteret];
      
      try {
        await googleSheetsService.saveVillesInteret(newVillesInteret);
        onFiltresChange({
          ...filtres,
          villesInteret: newVillesInteret
        });
        setNouvelleVille('');
        setShowSuggestions(false);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde dans Google Sheets:', error);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la ville:', error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestion des villes d'intérêt"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Rayon global */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rayon global (km) - Applique à toutes les villes après 2 secondes
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="1"
              max="100"
              value={nouveauRayon}
              onChange={(e) => handleRayonGlobalChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
            <div className="w-16 px-2 py-1 text-center text-sm font-medium text-gray-700 bg-gray-100 rounded-md">
              {nouveauRayon} km
            </div>
          </div>
        </div>

        {/* Recherche de ville */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ajouter une ville
          </label>
          <div className="relative" ref={searchInputRef}>
            <input
              type="text"
              value={nouvelleVille}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              placeholder="Rechercher une ville..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-500 border-t-transparent"></div>
              ) : (
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>

            {/* Liste des suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.code}
                    onClick={() => handleSelectVille(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150"
                  >
                    <div className="font-medium text-gray-900">
                      <span className="mr-2">📍</span>
                      {suggestion.nom}
                    </div>
                    <div className="text-sm text-gray-600">
                      {suggestion.departement ? `Dép. ${suggestion.departement}` : ''} 
                      {suggestion.population ? ` • ${suggestion.population.toLocaleString()} hab.` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Liste des villes sélectionnées */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Villes sélectionnées</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {filtres.villesInteret.map((ville) => (
              <div
                key={`detail-${ville.id}`}
                className="flex items-center justify-between bg-gray-50 p-4 rounded-lg group hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    <span className="mr-2">📍</span>
                    {ville.nom}
                  </div>
                  <div className="text-sm text-gray-600 space-y-2 mt-2">
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={ville.rayon}
                        onChange={async (e) => {
                          const newRayon = parseInt(e.target.value);
                          const updatedVillesInteret = filtres.villesInteret.map(v => 
                            v.id === ville.id ? { ...v, rayon: newRayon } : v
                          );

                          try {
                            await googleSheetsService.saveVillesInteret(updatedVillesInteret);
                            onFiltresChange({
                              ...filtres,
                              villesInteret: updatedVillesInteret
                            });
                          } catch (error) {
                            console.error('Erreur lors de la sauvegarde du rayon:', error);
                          }
                        }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                      />
                      <div className="w-16 px-2 py-1 text-center text-sm font-medium text-gray-700 bg-gray-100 rounded-md">
                        {ville.rayon} km
                      </div>
                    </div>
                    {ville.population && (
                      <div className="text-sm text-gray-500">
                        {ville.population.toLocaleString()} habitants
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const newVillesInteret = filtres.villesInteret.filter(v => v.id !== ville.id);
                    try {
                      await googleSheetsService.saveVillesInteret(newVillesInteret);
                      onFiltresChange({
                        ...filtres,
                        villesInteret: newVillesInteret
                      });
                    } catch (error) {
                      console.error('Erreur lors de la suppression de la ville:', error);
                    }
                  }}
                  className="ml-4 text-gray-400 hover:text-red-500 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
});

const FiltersPanel: React.FC<Props> = ({ filtres, onFiltresChange, notairesCount }) => {
  const [nouveauRayon, setNouveauRayon] = useState(10);
  const [filtresAvances, setFiltresAvances] = useState(false);
  const [isVillesModalOpen, setIsVillesModalOpen] = useState(false);
  const rayonGlobalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRayonGlobalChange = useCallback(async (newRayon: number) => {
    setNouveauRayon(newRayon);

    if (rayonGlobalTimeoutRef.current) {
      clearTimeout(rayonGlobalTimeoutRef.current);
    }

    rayonGlobalTimeoutRef.current = setTimeout(async () => {
      const updatedVillesInteret = filtres.villesInteret.map(ville => ({
        ...ville,
        rayon: newRayon
      }));
      
      try {
        await googleSheetsService.saveVillesInteret(updatedVillesInteret);
        onFiltresChange({
          ...filtres,
          villesInteret: updatedVillesInteret
        });
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des rayons:', error);
      }
    }, 2000);
  }, [filtres, onFiltresChange]);

  useEffect(() => {
    return () => {
      if (rayonGlobalTimeoutRef.current) {
        clearTimeout(rayonGlobalTimeoutRef.current);
      }
    };
  }, []);

  const handleTypeNotaireChange = (value: 'tous' | 'individuels' | 'groupes') => {
    onFiltresChange({
      ...filtres,
      typeNotaire: value
    });
  };

  const handleServiceNegoChange = (value: 'tous' | 'oui' | 'non') => {
    onFiltresChange({
      ...filtres,
      serviceNego: value
    });
  };

  const handleShowOnlyInRadiusChange = (checked: boolean) => {
    onFiltresChange({
      ...filtres,
      showOnlyInRadius: checked
    });
  };

  const toggleStatut = (statut: NotaireStatut) => {
    const newStatuts = filtres.statuts.includes(statut)
      ? filtres.statuts.filter(s => s !== statut)
      : [...filtres.statuts, statut];
    onFiltresChange({
      ...filtres,
      statuts: newStatuts
    });
  };

  const toggleContactStatut = (statut: ContactStatut) => {
    const newStatuts = filtres.contactStatuts?.includes(statut)
      ? filtres.contactStatuts.filter(s => s !== statut)
      : [...(filtres.contactStatuts || []), statut];
    onFiltresChange({
      ...filtres,
      contactStatuts: newStatuts
    });
  };

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Filtres principaux */}
      <div className="space-y-3 md:space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Statut du notaire</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => toggleStatut('favori')}
              className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                filtres.statuts.includes('favori')
                  ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-600'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-teal-50'
              }`}
            >
              ⭐ Favoris
            </button>
            <button
              onClick={() => toggleStatut('envisage')}
              className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                filtres.statuts.includes('envisage')
                  ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-600'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-teal-50'
              }`}
            >
              🤔 À envisager
            </button>
            <button
              onClick={() => toggleStatut('non_interesse')}
              className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                filtres.statuts.includes('non_interesse')
                  ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-600'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              ❌ Non intéressé
            </button>
            <button
              onClick={() => onFiltresChange({ ...filtres, statuts: [] })}
              className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                filtres.statuts.length === 0
                  ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-600'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-teal-50'
              }`}
            >
              👥 Tous
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Statut du contact</h3>
          
          {/* Non contactés - case à cocher séparée */}
          <div className="flex items-center space-x-3 pb-3 border-b border-gray-100">
            <input
              type="checkbox"
              checked={filtres.showNonContactes}
              onChange={(e) => onFiltresChange({
                ...filtres,
                showNonContactes: e.target.checked
              })}
              className="h-5 w-5 text-gray-600 focus:ring-gray-500 border-gray-300 rounded touch-checkbox"
            />
            <label className="text-sm text-gray-700 touch-label">
              📝 Afficher les notaires non contactés
            </label>
          </div>

          {/* Statuts de contact réels */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Statuts de contact :</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toggleContactStatut('mail_envoye')}
                className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  filtres.contactStatuts?.includes('mail_envoye')
                    ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-600'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-blue-50'
                }`}
              >
                📧 Mail envoyé
              </button>
              <button
                onClick={() => toggleContactStatut('relance_envoyee')}
                className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  filtres.contactStatuts?.includes('relance_envoyee')
                    ? 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-600'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-yellow-50'
                }`}
              >
                🔄 Relance envoyée
              </button>
              <button
                onClick={() => toggleContactStatut('reponse_recue')}
                className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  filtres.contactStatuts?.includes('reponse_recue')
                    ? 'bg-green-100 text-green-800 ring-2 ring-green-600'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-green-50'
                }`}
              >
                ✉️ Réponse reçue
              </button>
              <button
                onClick={() => toggleContactStatut('cloture')}
                className={`touch-button px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  filtres.contactStatuts?.includes('cloture')
                    ? 'bg-purple-100 text-purple-800 ring-2 ring-purple-600'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-50'
                }`}
              >
                ✅ Clôturé
              </button>
            </div>
            
            {/* Bouton pour effacer les statuts de contact */}
            {filtres.contactStatuts?.length > 0 && (
              <button
                onClick={() => onFiltresChange({ ...filtres, contactStatuts: [] })}
                className="mt-2 w-full touch-button px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
              >
                Effacer les statuts
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
          <CustomSelect
            label="Type d'étude"
            value={filtres.typeNotaire}
            onChange={(value) => handleTypeNotaireChange(value as 'tous' | 'individuels' | 'groupes')}
            options={[
              { value: 'tous', label: 'Tous les types', icon: '👥' },
              { value: 'individuels', label: 'Étude individuelle', icon: '👤' },
              { value: 'groupes', label: 'Notaires associés', icon: '👥' }
            ]}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
          <CustomSelect
            label="Service négociation"
            value={filtres.serviceNego}
            onChange={(value) => handleServiceNegoChange(value as 'tous' | 'oui' | 'non')}
            options={[
              { value: 'tous', label: 'Tous', icon: '🔄' },
              { value: 'oui', label: 'Oui', icon: '✅' },
              { value: 'non', label: 'Non', icon: '❌' }
            ]}
          />
        </div>
      </div>

      {/* Filtres avancés */}
      <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
        <button
          onClick={() => setFiltresAvances(!filtresAvances)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-900 touch-button"
        >
          <span>Filtres avancés</span>
          <span className="text-teal-600">{filtresAvances ? 'Masquer' : 'Afficher'}</span>
        </button>

        {filtresAvances && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <CustomNumberInput
                label="Nombre d'associés"
                value={filtres.minAssocies}
                onChange={(value) => onFiltresChange({
                  ...filtres,
                  minAssocies: value
                })}
                icon="👥"
              />
              <CustomNumberInput
                label="Nombre de NS"
                value={filtres.minSalaries}
                onChange={(value) => onFiltresChange({
                  ...filtres,
                  minSalaries: value
                })}
                icon="👤"
              />
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={filtres.showOnlyWithEmail}
                onChange={(e) => onFiltresChange({
                  ...filtres,
                  showOnlyWithEmail: e.target.checked
                })}
                className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded touch-checkbox"
              />
              <label className="text-sm text-gray-700 touch-label">
                Afficher uniquement les offices avec email
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Villes d'intérêt */}
      <div className="bg-white rounded-xl shadow-sm p-3 md:p-4">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-sm font-medium text-gray-900">Villes d'intérêt</h3>
          <button
            onClick={() => setIsVillesModalOpen(true)}
            className="touch-button px-3 py-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors duration-200"
          >
            Gérer les villes
          </button>
        </div>

        {/* Résumé des villes sélectionnées */}
        <div className="flex flex-wrap gap-2">
          {filtres.villesInteret.map((ville) => (
            <div
              key={`resume-${ville.id}`}
              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-sm text-gray-700 rounded-full"
            >
              <span className="mr-1">📍</span>
              {ville.nom}
              <span className="ml-2 text-gray-500">{ville.rayon} km</span>
            </div>
          ))}
        </div>

        {/* Option pour filtrer uniquement dans les rayons */}
        <div className="flex items-center space-x-3 mt-4 pt-4 border-t border-gray-200">
          <input
            type="checkbox"
            checked={filtres.showOnlyInRadius}
            onChange={(e) => handleShowOnlyInRadiusChange(e.target.checked)}
            className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded touch-checkbox"
          />
          <label className="text-sm text-gray-700 touch-label">
            Afficher uniquement les offices des villes sélectionnées
          </label>
        </div>
      </div>

      {/* Bouton de réinitialisation */}
      <button
        onClick={() => onFiltresChange({
          villesInteret: [],
          typeNotaire: 'tous',
          serviceNego: 'tous',
          showOnlyInRadius: false,
          minAssocies: 0,
          maxAssocies: 999,
          minSalaries: 0,
          maxSalaries: 999,
          statuts: [],
          showOnlyWithEmail: false,
          contactStatuts: [],
          showNonContactes: false
        })}
        className="w-full touch-button bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
      >
        Réinitialiser les filtres
      </button>

      <VillesInteretModal
        isOpen={isVillesModalOpen}
        onClose={() => setIsVillesModalOpen(false)}
        filtres={filtres}
        onFiltresChange={onFiltresChange}
        nouveauRayon={nouveauRayon}
        setNouveauRayon={setNouveauRayon}
        handleRayonGlobalChange={handleRayonGlobalChange}
      />
    </div>
  );
};

export default FiltersPanel; 