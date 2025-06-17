import { API_BASE_URL } from '../config';
import type { Notaire, VilleInteret, Contact, NotaireStatut, GeocodingHistory } from '../types';

interface SheetData {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
}

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 seconde
const REQUEST_TIMEOUT = 30000; // 30 secondes

// Définition des plages de cellules pour Google Sheets
const SHEET_RANGES = {
  NOTAIRES: 'Notaires!A2:Z',
  VILLES_INTERET: 'VillesInteret!A2:G'
} as const;

// Validation des données
function isValidNotaireData(data: any[]): boolean {
  return Array.isArray(data) && data.length >= 20;
}

function isValidVilleInteretData(data: any[]): boolean {
  return Array.isArray(data) && data.length >= 7;
}

// Types pour la gestion des erreurs
class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

// Fonction utilitaire pour attendre
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Type guard pour les erreurs
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Fonction utilitaire pour créer une erreur
function createError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'An unknown error occurred');
}

// Fonction utilitaire pour retry
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  let attempt = 0;
  let currentDelay = delay;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (attempt === retries) {
        if (isError(error)) {
          throw error;
        }
        throw new Error(String(error));
      }
      
      const message = isError(error) ? error.message : String(error);
      console.log(`Attempt ${attempt + 1}/${retries} failed: ${message}`);
      console.log(`Retrying in ${currentDelay}ms...`);
      
      await wait(currentDelay);
      currentDelay *= 2;
      attempt++;
    }
  }

  throw new Error('Unexpected error in retry logic');
}

async function fetchWithCors(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.trim().startsWith('<!DOCTYPE html>')) {
        throw new Error('API error: Server returned HTML instead of JSON. The server might be down.');
      }
      
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('API error: Request timed out');
    }
    if (error instanceof TypeError && error.message.includes('CORS')) {
      throw new Error('API error: CORS issue - Please check API configuration');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`API error: Invalid JSON response - ${text}`);
  }
}

export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    return withRetry(async () => {
      try {
        // Charger les notaires
        const responseNotaires = await fetchWithCors(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.NOTAIRES}`);
        const dataNotaires = await parseJsonResponse(responseNotaires);
        
        if (!Array.isArray(dataNotaires)) {
          throw new Error('API error: Invalid notaires data format');
        }

        const notaires = dataNotaires.map((row, index) => {
          if (!isValidNotaireData(row)) {
            console.warn(`Invalid notaire data at index ${index}:`, row);
            return null;
          }
          try {
            return parseNotaire(row);
          } catch (error) {
            console.error(`Error parsing notaire at index ${index}:`, error);
            return null;
          }
        }).filter((n): n is Notaire => n !== null);

        // Charger les villes d'intérêt
        const responseVilles = await fetchWithCors(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.VILLES_INTERET}`);
        const dataVilles = await parseJsonResponse(responseVilles);
        
        if (!Array.isArray(dataVilles)) {
          throw new Error('API error: Invalid villes d\'intérêt data format');
        }

        const villesInteret = dataVilles.map((row, index) => {
          if (!isValidVilleInteretData(row)) {
            console.warn(`Invalid ville d'intérêt data at index ${index}:`, row);
            return null;
          }
          try {
            return parseVilleInteret(row);
          } catch (error) {
            console.error(`Error parsing ville d'intérêt at index ${index}:`, error);
            return null;
          }
        }).filter((v): v is VilleInteret => v !== null);

        if (notaires.length === 0) {
          throw new Error('API error: No valid notaires data found');
        }

        return { notaires, villesInteret };
      } catch (error) {
        console.error('Error in loadFromSheet:', error);
        throw error;
      }
    });
  },

  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    try {
      console.log('📥 Début saveToSheet avec:', { notaire });
      const notaires = Array.isArray(notaire) ? notaire : [notaire];

      // Valider les données avant l'envoi
      const validNotaires = notaires.filter(n => {
        if (!n.id || !n.officeNotarial) {
          console.warn('❌ Données invalides:', n);
          return false;
        }
        return true;
      });

      if (validNotaires.length === 0) {
        throw new Error('No valid notaires to save');
      }

      // Convertir les notaires en tableau de valeurs pour Google Sheets
      console.log('🔄 Conversion des données pour Google Sheets...');
      const values = validNotaires.map(notaire => [
        notaire.id,
        notaire.officeNotarial,
        notaire.adresse,
        notaire.codePostal,
        notaire.ville,
        notaire.departement,
        notaire.email || '',
        notaire.notairesAssocies || '',
        notaire.notairesSalaries || '',
        notaire.nbAssocies || 0,
        notaire.nbSalaries || 0,
        notaire.serviceNego === true ? 'oui' : 'non',
        notaire.statut || 'non_defini',
        notaire.notes || '',
        JSON.stringify(notaire.contacts || []),
        notaire.dateModification || new Date().toISOString(),
        notaire.latitude || 0,
        notaire.longitude || 0,
        notaire.geoScore || 0,
        JSON.stringify(notaire.geocodingHistory || [])
      ]);

      console.log('📤 Envoi à l\'API...', {
        range: SHEET_RANGES.NOTAIRES,
        nombreNotaires: values.length,
        exemple: values[0]
      });

      const response = await withRetry(
        () => fetchWithCors(`${API_BASE_URL}/sheets`, {
          method: 'POST',
          body: JSON.stringify({ 
            range: SHEET_RANGES.NOTAIRES,
            values,
            forceSync: true
          }),
        }),
        5,
        2000
      );

      console.log('📥 Réponse reçue de l\'API');
      const data = await parseJsonResponse(response);
      
      if (data.error) {
        console.error('❌ Erreur de réponse API:', data);
        throw new Error(`API error: ${data.message || 'Failed to save to Google Sheets'}`);
      }

      if (!data.data || !data.data.updatedRange) {
        console.warn('⚠️ Format de réponse inattendu:', data);
      } else {
        console.log('✅ Données sauvegardées avec succès');
        console.log('📍 Plage mise à jour:', data.data.updatedRange);
      }

    } catch (err: unknown) {
      const error = createError(err);
      console.error('❌ Erreur dans saveToSheet:', error.message);
      throw error;
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    try {
      const response = await fetchWithCors(`${API_BASE_URL}/sheets/villes-interet`, {
        method: 'POST',
        body: JSON.stringify({ 
          villesInteret,
          range: SHEET_RANGES.VILLES_INTERET
        }),
      });

      const data = await parseJsonResponse(response);
    } catch (error) {
      throw error;
    }
  },

  async testConfig(): Promise<any> {
    try {
      const response = await fetchWithCors(`${API_BASE_URL}/test`);
      const data = await parseJsonResponse(response);
      return data;
    } catch (error) {
      throw error;
    }
  }
};

function parseNotaire(row: any[]): Notaire {
  const [
    id,
    officeNotarial,
    adresse,
    codePostal,
    ville,
    departement,
    email,
    notairesAssocies,
    notairesSalaries,
    nbAssocies,
    nbSalaries,
    serviceNego,
    statut,
    notes,
    contacts,
    dateModification,
    latitude,
    longitude,
    geoScore,
    geocodingHistory
  ] = row;

  // Extraire le nom et le prénom de l'office notarial
  const [prenom, ...nomParts] = (officeNotarial || '').split(' ');
  const nom = nomParts.join(' ');

  // Construire l'adresse complète pour la comparaison
  const adresseComplete = `${adresse}, ${codePostal} ${ville}`.toLowerCase().trim();
  
  // Parser l'historique de géocodage
  let parsedGeocodingHistory: GeocodingHistory[] = [];
  try {
    parsedGeocodingHistory = geocodingHistory ? JSON.parse(geocodingHistory) : [];
  } catch (e) {
    parsedGeocodingHistory = [];
  }
  
  // Vérifier si l'adresse a changé en comparant avec l'historique de géocodage
  const adresseAChange = !parsedGeocodingHistory || parsedGeocodingHistory.length === 0 || 
    (parsedGeocodingHistory[parsedGeocodingHistory.length - 1]?.address?.toLowerCase().trim() !== adresseComplete);

  // Déterminer si le géocodage est nécessaire
  const shouldGeocode = !latitude || !longitude || adresseAChange;

  // Fonction utilitaire pour parser les nombres
  const parseNumber = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const cleanValue = String(value).trim().replace(/,/g, '.');
    const num = Number(cleanValue);
    return isNaN(num) ? undefined : num;
  };

  // Fonction utilitaire pour parser les coordonnées
  const parseCoordinate = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    // Remplacer la virgule par un point pour les nombres au format français
    const cleanValue = String(value).trim().replace(/,/g, '.');
    const num = Number(cleanValue);
    if (!isNaN(num) && num >= -180 && num <= 180) {
      return num;
    }
    return undefined;
  };

  // Fonction utilitaire pour parser les dates
  const parseDate = (value: any): string => {
    if (!value || value === '[]') return new Date().toISOString();
    try {
      return new Date(value).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  // Fonction utilitaire pour parser les contacts
  const parseContacts = (value: any): Contact[] => {
    if (!value || value === '[]') return [];
    try {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return [{
            date: new Date().toISOString(),
            type: 'initial',
            par: 'Fanny',
            statut: 'non_contacte',
            reponseRecue: {
              date: new Date().toISOString(),
              positive: false,
              commentaire: value
            }
          }];
        }
      }
      return [];
    } catch {
      return [];
    }
  };

  const notaire: Notaire = {
    id: id || `notaire_${Date.now()}`,
    officeNotarial: officeNotarial || '',
    departement: departement || '',
    nom: nom || '',
    prenom: prenom || '',
    adresse: adresse || '',
    codePostal: codePostal || '',
    ville: ville || '',
    telephone: '', // Cette colonne n'existe plus dans la nouvelle structure
    email: email || '',
    siteWeb: '', // Cette colonne n'existe plus dans la nouvelle structure
    statut: (() => {
      const normalizedStatut = String(statut || '').toLowerCase().trim();
      
      // Mapping des valeurs possibles vers les statuts valides
      const statutMap: { [key: string]: NotaireStatut } = {
        'favori': 'favori',
        'favoris': 'favori',
        'envisage': 'envisage',
        'à envisager': 'envisage',
        'a envisager': 'envisage',
        'non interesse': 'non_interesse',
        'non intéresse': 'non_interesse',
        'non_interesse': 'non_interesse',
        'non défini': 'non_defini',
        'non defini': 'non_defini',
        'non_defini': 'non_defini'
      };

      const finalStatut = statutMap[normalizedStatut] || 'non_defini';
      return finalStatut;
    })(),
    dateContact: new Date().toISOString(), // Valeur par défaut
    dateRappel: new Date().toISOString(), // Valeur par défaut
    notes: notes || '',
    latitude: parseCoordinate(latitude) ?? 0,
    longitude: parseCoordinate(longitude) ?? 0,
    needsGeocoding: Boolean(shouldGeocode),
    nbAssocies: parseNumber(nbAssocies) || 0,
    nbSalaries: parseNumber(nbSalaries) || 0,
    contacts: parseContacts(contacts),
    dateModification: parseDate(dateModification),
    serviceNego: serviceNego === 'oui',
    notairesAssocies: notairesAssocies || '',
    notairesSalaries: notairesSalaries || '',
    geoScore: parseNumber(geoScore),
    geocodingHistory: parsedGeocodingHistory,
    geoStatus: shouldGeocode ? 'pending' : 'success'
  };

  return notaire;
}

function parseVilleInteret(row: any[]): VilleInteret {
  // Colonnes attendues : ID, Nom, Rayon, Latitude, Longitude, Département, Population
  return {
    id: row[0] || '',
    nom: row[1] || '',
    rayon: Number(row[2]) || 15,
    latitude: row[3] ? Number(String(row[3]).replace(',', '.')) : 0,
    longitude: row[4] ? Number(String(row[4]).replace(',', '.')) : 0,
    departement: row[5] || '',
    population: row[6] ? Number(row[6]) : undefined
  };
}