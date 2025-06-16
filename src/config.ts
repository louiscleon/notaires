// Configuration pour l'API Google Sheets
export const API_BASE_URL: string = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

// Configuration pour le géocodage
export const GEOCODING_API_URL: string = 'https://api-adresse.data.gouv.fr/search/';

// Configuration pour le stockage local
export const STORAGE_KEYS = {
  FILTRES: 'notaires_filtres',
  DATA: 'notaires_data'
} as const; 