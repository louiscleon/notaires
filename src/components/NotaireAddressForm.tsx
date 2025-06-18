import React, { useState, useEffect } from 'react';
import { AdresseSuggestion } from '../types';
import { useAddressAutocomplete } from '../utils/addressUtils';

interface NotaireAddressFormProps {
  adresse: string;
  codePostal: string;
  ville: string;
  onAddressChange: (field: 'adresse' | 'codePostal' | 'ville', value: string) => void;
  onAddressSelect: (suggestion: AdresseSuggestion) => void;
  showSuggestions: boolean;
}

const NotaireAddressForm: React.FC<NotaireAddressFormProps> = ({
  adresse,
  codePostal,
  ville,
  onAddressChange,
  onAddressSelect,
  showSuggestions
}) => {
  const { adresseSuggestions, clearSuggestions } = useAddressAutocomplete(adresse);

  const handleAddressChange = (value: string) => {
    onAddressChange('adresse', value);
  };

  const handleSuggestionClick = (suggestion: AdresseSuggestion) => {
    onAddressSelect(suggestion);
    clearSuggestions();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Adresse
        </label>
        <div className="relative">
          <input
            type="text"
            name="adresse"
            value={adresse}
            onChange={(e) => handleAddressChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          {showSuggestions && adresseSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {adresseSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="font-medium">{suggestion.label}</div>
                  <div className="text-sm text-gray-500">
                    {suggestion.postcode} {suggestion.city}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Code postal
          </label>
          <input
            type="text"
            name="codePostal"
            value={codePostal}
            onChange={(e) => onAddressChange('codePostal', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ville
          </label>
          <input
            type="text"
            name="ville"
            value={ville}
            onChange={(e) => onAddressChange('ville', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>
    </div>
  );
};

export default NotaireAddressForm; 