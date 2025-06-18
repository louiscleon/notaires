import { useState, useEffect } from 'react';
import { AdresseSuggestion } from '../types';
import { searchAdresse } from '../services/adresse';
import { geocodeSingleNotaire } from '../services/geocoding';

export const useAddressSearch = () => {
  const [adresseSuggestions, setAdresseSuggestions] = useState<AdresseSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchAddresses = async (query: string) => {
    if (query.length < 3) {
      setAdresseSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const suggestions = await searchAdresse(query);
      setAdresseSuggestions(suggestions);
    } catch (error) {
      console.error('Erreur lors de la recherche d\'adresses:', error);
      setAdresseSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSuggestions = () => {
    setAdresseSuggestions([]);
  };

  return {
    adresseSuggestions,
    isSearching,
    searchAddresses,
    clearSuggestions
  };
};

// Hook pour gérer l'autocomplétion d'adresse avec debounce
export const useAddressAutocomplete = (address: string, delay: number = 300) => {
  const { adresseSuggestions, isSearching, searchAddresses, clearSuggestions } = useAddressSearch();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchAddresses(address);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [address, delay]);

  return {
    adresseSuggestions,
    isSearching,
    clearSuggestions
  };
};

// Utilitaire pour géocoder un notaire avec gestion d'erreur
export const geocodeNotaireWithError = async (notaire: any) => {
  try {
    return await geocodeSingleNotaire(notaire);
  } catch (error) {
    console.error('Erreur lors du géocodage:', error);
    return {
      ...notaire,
      latitude: notaire.latitude || 0,
      longitude: notaire.longitude || 0,
      geoStatus: 'error'
    };
  }
}; 