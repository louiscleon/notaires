import { API_BASE_URL } from '../config';
import type { Notaire, VilleInteret, Contact, NotaireStatut, GeocodingHistory } from '../types';

interface SheetData {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
}

// Définition des plages de cellules pour Google Sheets
const SHEET_RANGES = {
  NOTAIRES: 'Notaires!A2:Z',
  VILLES_INTERET: 'Villes d\'intérêt!A2:D'
} as const;

async function fetchWithCors(url: string, options?: RequestInit): Promise<Response> {
  try {
    console.log('Fetching URL:', url, 'with options:', options);
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText
      });
      
      // Check if the response is HTML instead of JSON
      if (errorText.trim().startsWith('<!DOCTYPE html>')) {
        throw new Error('Received HTML response instead of JSON. The API endpoint might be incorrect or the server might be down.');
      }
      
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    if (error instanceof TypeError && error.message.includes('CORS')) {
      throw new Error('Erreur de connexion à l\'API. Veuillez vérifier que l\'API est bien déployée et accessible.');
    }
    throw error;
  }
}

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  console.log('Raw API response:', text);
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('JSON Parse Error:', error);
    console.error('Failed to parse response:', text);
    throw new Error(`Invalid JSON response: ${text}`);
  }
}

export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    try {
      console.log('=== DEBUG LOAD FROM SHEET ===');
      console.log('API URL:', `${API_BASE_URL}/sheets?range=${SHEET_RANGES.NOTAIRES}`);
      
      const response = await fetchWithCors(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.NOTAIRES}`);
      console.log('API Response status:', response.status);
      
      const data = await parseJsonResponse(response);
      console.log('Raw sheet data:', data);

      if (!Array.isArray(data)) {
        console.error('Invalid API response format:', data);
        throw new Error('Invalid API response format: expected array of rows');
      }

      console.log('Number of rows received:', data.length);
      if (data.length > 0) {
        console.log('First row sample:', data[0]);
      }

      // Convertir les lignes brutes en objets Notaire
      const notaires = data.map(row => parseNotaire(row));
      const villesInteret: VilleInteret[] = []; // Pour l'instant, nous ne chargeons pas les villes d'intérêt

      // Vérifier les données des notaires
      console.log('=== NOTAIRES DATA SUMMARY ===');
      console.log('Total notaires:', notaires.length);
      console.log('Notaires with coordinates:', notaires.filter(n => n.latitude !== 0 && n.longitude !== 0).length);
      console.log('Notaires without coordinates:', notaires.filter(n => n.latitude === 0 || n.longitude === 0).length);
      console.log('Sample notaire:', notaires[0]);

      return { notaires, villesInteret };
    } catch (error) {
      console.error('Error loading from sheet:', error);
      throw error;
    }
  },

  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    try {
      const notaires = Array.isArray(notaire) ? notaire : [notaire];
      console.log('Saving notaires to sheet:', notaires.length);

      // Convertir les notaires en tableau de valeurs pour Google Sheets
      const values = notaires.map(notaire => [
        notaire.id,
        notaire.officeNotarial,
        notaire.adresse,
        notaire.codePostal,
        notaire.ville,
        notaire.departement,
        notaire.email,
        notaire.notairesAssocies,
        notaire.notairesSalaries,
        notaire.nbAssocies,
        notaire.nbSalaries,
        notaire.serviceNego ? 'oui' : 'non',
        notaire.statut,
        notaire.notes,
        JSON.stringify(notaire.contacts),
        notaire.dateModification,
        notaire.latitude,
        notaire.longitude,
        notaire.geoScore,
        JSON.stringify(notaire.geocodingHistory)
      ]);

      const response = await fetchWithCors(`${API_BASE_URL}/sheets`, {
        method: 'POST',
        body: JSON.stringify({ 
          range: SHEET_RANGES.NOTAIRES,
          values
        }),
      });

      const data = await parseJsonResponse(response);
      console.log('Save response:', data);
    } catch (error) {
      console.error('Error saving to sheet:', error);
      throw error;
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    try {
      console.log('Saving villes interet:', villesInteret.length);

      const response = await fetchWithCors(`${API_BASE_URL}/sheets/villes-interet`, {
        method: 'POST',
        body: JSON.stringify({ 
          villesInteret,
          range: SHEET_RANGES.VILLES_INTERET
        }),
      });

      const data = await parseJsonResponse(response);
      console.log('Save response:', data);
    } catch (error) {
      console.error('Error saving villes interet:', error);
      throw error;
    }
  },

  async testConfig(): Promise<any> {
    try {
      console.log('Testing API configuration...');
      const response = await fetchWithCors(`${API_BASE_URL}/test`);
      const data = await parseJsonResponse(response);
      console.log('Test response:', data);
      return data;
    } catch (error) {
      console.error('Error testing config:', error);
      throw error;
    }
  }
};

function parseNotaire(row: any[]): Notaire {
  console.log('Parsing notaire row:', row);
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
    console.warn('Failed to parse geocoding history:', e);
    parsedGeocodingHistory = [];
  }
  
  // Vérifier si l'adresse a changé en comparant avec l'historique de géocodage
  const adresseAChange = !parsedGeocodingHistory || parsedGeocodingHistory.length === 0 || 
    (parsedGeocodingHistory[parsedGeocodingHistory.length - 1]?.address?.toLowerCase().trim() !== adresseComplete);

  console.log('Adresse complète:', adresseComplete);
  console.log('Adresse a changé:', adresseAChange);
  console.log('Coordonnées existantes:', { latitude, longitude });

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
    console.warn('Coordonnée invalide:', value, '->', cleanValue, '->', num);
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
      console.log('Normalizing statut:', { 
        original: statut, 
        normalized: normalizedStatut,
        row: row
      });
      
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
      console.log('Final statut:', finalStatut);
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

  // Log des coordonnées pour debug
  console.log('=== DEBUG COORDINATES PARSING ===');
  console.log('Raw coordinates:', { latitude, longitude });
  console.log('Parsed coordinates:', { 
    latitude: notaire.latitude, 
    longitude: notaire.longitude 
  });
  console.log('Notaire:', {
    id: notaire.id,
    office: notaire.officeNotarial,
    needsGeocoding: notaire.needsGeocoding,
    geoStatus: notaire.geoStatus
  });

  console.log('Parsed notaire:', notaire);
  return notaire;
}