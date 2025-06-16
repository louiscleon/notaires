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
  private readonly REQUEST_TIMEOUT = 30000; // 30 secondes
  public readonly REQUEST_DELAY = 1000; // 1 seconde entre les requêtes

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
        const isNetworkError = error instanceof Error && 
          (error.message.includes('Network Error') || 
           error.message.includes('timeout') ||
           error.message.includes('ECONNABORTED'));
        
        if (isNetworkError) {
          console.log(`Erreur réseau détectée, nouvelle tentative dans ${this.RETRY_DELAY}ms... (${retries} restantes)`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
          return this.retryWithDelay(fn, retries - 1);
        }
      }
      throw error;
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    const cacheKey = this.getCacheKey(address);
    const cached = this.cache[cacheKey];

    console.log('=== DEBUG GEOCODING SERVICE ===');
    console.log('Adresse à géocoder:', address);
    console.log('Cache key:', cacheKey);
    console.log('Cache hit:', !!cached);

    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log('Utilisation du cache pour:', address);
      return cached.result;
    }

    try {
      console.log('Appel API de géocodage pour:', address);
      const response = await this.retryWithDelay(() => 
        axios.get(
          `/api/geocoding?address=${encodeURIComponent(address)}`,
          { 
            timeout: this.REQUEST_TIMEOUT,
            headers: {
              'Accept': 'application/json'
            }
          }
        )
      );

      console.log('Réponse de l\'API de géocodage:', response.data);

      if (response.data.error) {
        console.warn('Erreur de géocodage:', response.data.error);
        return {
          lat: 0,
          lon: 0,
          display_name: '',
          error: response.data.error,
          score: 0
        };
      }

      const result: GeocodingResult = {
        lat: response.data.lat,
        lon: response.data.lon,
        display_name: response.data.display_name,
        score: response.data.score
      };

      // Mettre en cache
      this.cache[cacheKey] = {
        result,
        timestamp: Date.now()
      };
      this.saveCache();

      return result;
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
    // Construire l'adresse à géocoder
    let addressToGeocode = '';
    
    // Si nous avons une adresse complète, l'utiliser
    if (notaire.adresse && notaire.adresse.trim().length > 0) {
      addressToGeocode = `${notaire.adresse}, ${notaire.codePostal} ${notaire.ville}`;
    } else {
      // Sinon, utiliser le code postal et la ville
      addressToGeocode = `${notaire.codePostal} ${notaire.ville}`;
    }

    // Nettoyer l'adresse
    addressToGeocode = addressToGeocode.trim().replace(/\s+/g, ' ');
    
    console.log('Adresse à géocoder:', addressToGeocode);
    return this.geocodeAddress(addressToGeocode);
  }

  async geocodeSingleNotaire(notaire: Notaire): Promise<Notaire> {
    const result = await this.geocodeNotaire(notaire);
    const now = new Date().toISOString();

    // Construire l'adresse complète pour l'historique
    const fullAddress = notaire.adresse 
      ? `${notaire.adresse}, ${notaire.codePostal} ${notaire.ville}`
      : `${notaire.codePostal} ${notaire.ville}`;

    const history: GeocodingHistory = {
      date: now,
      address: fullAddress,
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
  const geocodingService = new GeocodingService();
  
  for (const notaire of notaires) {
    try {
      // Vérifier si le notaire a déjà des coordonnées valides
      if (notaire.latitude && notaire.longitude && !notaire.needsGeocoding) {
        console.log(`Notaire ${notaire.id} a déjà des coordonnées valides, skip du géocodage`);
        results.push(notaire);
        continue;
      }

      const updatedNotaire = await geocodingService.geocodeSingleNotaire(notaire);
      results.push(updatedNotaire);
      
      if (onNotaireGeocoded) {
        onNotaireGeocoded(updatedNotaire);
      }
      
      // Augmenter le délai entre les requêtes
      await new Promise(resolve => setTimeout(resolve, geocodingService.REQUEST_DELAY));
    } catch (error) {
      console.error(`Erreur lors du géocodage du notaire ${notaire.id}:`, error);
      // En cas d'erreur, conserver les coordonnées existantes si elles existent
      results.push({
        ...notaire,
        geoStatus: 'error',
        geocodingHistory: [
          ...(notaire.geocodingHistory || []),
          {
            date: new Date().toISOString(),
            address: `${notaire.adresse}, ${notaire.codePostal} ${notaire.ville}`,
            success: false,
            coordinates: undefined
          }
        ]
      });
    }
  }
  
  return results;
};
