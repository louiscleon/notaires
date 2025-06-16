import axios from 'axios';
import { Notaire, GeocodingResult, GeocodingHistory } from '../types';

export const GEOCODING_CACHE_KEY = 'geocoding_cache';

interface GeocodingCache {
  [key: string]: {
    result: GeocodingResult;
    timestamp: number;
  };
}

export class GeocodingService {
  private cache: GeocodingCache = {};
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 jours
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 secondes
  private readonly REQUEST_TIMEOUT = 10000; // 10 secondes

  constructor() {
    this.loadCache();
  }

  private loadCache() {
    try {
      const cached = localStorage.getItem(GEOCODING_CACHE_KEY);
      if (cached) {
        this.cache = JSON.parse(cached);
        // Nettoyer les entrées expirées
        const now = Date.now();
        Object.keys(this.cache).forEach(key => {
          if (now - this.cache[key].timestamp > this.CACHE_DURATION) {
            delete this.cache[key];
          }
        });
        this.saveCache();
      }
    } catch (error) {
      console.error('Erreur lors du chargement du cache de géocodage:', error);
      this.cache = {};
    }
  }

  private saveCache() {
    try {
      localStorage.setItem(GEOCODING_CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du cache de géocodage:', error);
    }
  }

  private getCacheKey(address: string): string {
    return address.toLowerCase().trim();
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp <= this.CACHE_DURATION;
  }

  private async retryWithDelay<T>(fn: () => Promise<T>, retries: number = this.MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        console.log(`Tentative échouée, nouvelle tentative dans ${this.RETRY_DELAY}ms... (${retries} restantes)`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.retryWithDelay(fn, retries - 1);
      }
      throw error;
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    const cacheKey = this.getCacheKey(address);
    const cached = this.cache[cacheKey];

    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log('Utilisation du cache pour:', address);
      return cached.result;
    }

    try {
      console.log('Géocodage de l\'adresse:', address);
      const response = await this.retryWithDelay(() => 
        axios.get(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1&type=housenumber&autocomplete=0`,
          { timeout: this.REQUEST_TIMEOUT }
        )
      );

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        const [lon, lat] = feature.geometry.coordinates;
        const score = feature.properties.score;

        // Vérifier si le score est suffisant (0.6 est un bon seuil pour les adresses précises)
        if (score < 0.6) {
          console.warn(`Score de géocodage faible (${score}) pour l'adresse: ${address}`);
        }

        const result: GeocodingResult = {
          lat,
          lon,
          display_name: feature.properties.label,
          score: score
        };

        // Mettre en cache
        this.cache[cacheKey] = {
          result,
          timestamp: Date.now()
        };
        this.saveCache();

        return result;
      }

      return {
        lat: 0,
        lon: 0,
        display_name: '',
        error: 'Adresse non trouvée',
        score: 0
      };
    } catch (error) {
      console.error('Erreur de géocodage:', error);
      return {
        lat: 0,
        lon: 0,
        display_name: '',
        error: error instanceof Error ? error.message : 'Erreur lors du géocodage',
        score: 0
      };
    }
  }

  async geocodeNotaire(notaire: Notaire): Promise<GeocodingResult> {
    // Construire l'adresse à géocoder uniquement avec les parties non vides
    const addressParts = [notaire.adresse, notaire.codePostal, notaire.ville]
      .filter(part => part && String(part).trim().length > 0)
      .join(' ')
      .trim();
    return this.geocodeAddress(addressParts);
  }

  async geocodeSingleNotaire(notaire: Notaire): Promise<Notaire> {
    const result = await this.geocodeNotaire(notaire);
    const now = new Date().toISOString();

    const history: GeocodingHistory = {
      date: now,
      address: `${notaire.adresse}, ${notaire.codePostal} ${notaire.ville}`,
      success: !result.error,
      coordinates: result.error ? undefined : { lat: result.lat, lon: result.lon }
    };

    return {
      ...notaire,
      latitude: result.lat,
      longitude: result.lon,
      display_name: result.display_name,
      geoScore: result.score,
      geoStatus: result.error ? 'error' : 'success',
      geocodingHistory: [...(notaire.geocodingHistory || []), history]
    };
  }

  clearCache() {
    this.cache = {};
    localStorage.removeItem(GEOCODING_CACHE_KEY);
  }
}

export const geocodingService = new GeocodingService();

export const geocodeAddress = async (address: string): Promise<GeocodingResult> => {
  return geocodingService.geocodeAddress(address);
};

export const geocodeNotaire = async (notaire: Notaire): Promise<GeocodingResult> => {
  return geocodingService.geocodeNotaire(notaire);
};

export const geocodeSingleNotaire = async (notaire: Notaire): Promise<Notaire> => {
  return geocodingService.geocodeSingleNotaire(notaire);
};

export const geocodeBatch = async (
  notaires: Notaire[],
  onNotaireGeocoded?: (notaire: Notaire) => void
): Promise<Notaire[]> => {
  const results: Notaire[] = [];
  
  for (const notaire of notaires) {
    try {
      const updatedNotaire = await geocodingService.geocodeSingleNotaire(notaire);
      results.push(updatedNotaire);
      
      if (onNotaireGeocoded) {
        onNotaireGeocoded(updatedNotaire);
      }
      
      // Augmenter le délai entre les requêtes pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Erreur lors du géocodage du notaire ${notaire.id}:`, error);
      results.push(notaire);
    }
  }
  
  return results;
};
