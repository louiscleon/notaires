import { AdresseSuggestion } from '../types';

const API_URL = 'https://api-adresse.data.gouv.fr/search';

export const searchAdresse = async (query: string): Promise<AdresseSuggestion[]> => {
  if (!query || query.length < 2) return [];

  try {
    console.log('Recherche d\'adresses pour:', query);
    const response = await fetch(
      `${API_URL}?q=${encodeURIComponent(query)}&limit=5&type=housenumber`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Erreur API:', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Résultats trouvés:', data.features?.length);
    
    return data.features.map((feature: any) => ({
      label: feature.properties.label,
      score: feature.properties.score,
      postcode: feature.properties.postcode,
      city: feature.properties.city,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0]
      }
    }));
  } catch (error) {
    console.error('Erreur détaillée lors de la recherche d\'adresses:', error);
    return [];
  }
}; 