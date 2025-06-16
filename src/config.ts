// Configuration pour l'API Google Sheets
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://notaires.cleon.app/api';

// Configuration pour le géocodage
export const GEOCODING_API_URL = 'https://api-adresse.data.gouv.fr/search/';

// Configuration pour le stockage local
export const STORAGE_KEYS = {
  FILTRES: 'notaires_filtres',
  DATA: 'notaires_data'
} as const; 