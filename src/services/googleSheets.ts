import { API_BASE_URL } from '../config';
import type { Notaire, VilleInteret, Contact, NotaireStatut, GeocodingHistory } from '../types';

interface SheetData {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
}

// Définition des plages de cellules pour Google Sheets
const SHEET_RANGES = {
  NOTAIRES: 'Notaires!A2:Z',
  VILLES_INTERET: 'VillesInteret!A2:G'
} as const;

// Configuration du rate limiting
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 50,
  BATCH_SIZE: 20,
  DELAY_BETWEEN_REQUESTS: 500, // 500ms entre chaque requête
};

// File d'attente pour les requêtes
let requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

// Timestamp de la dernière requête
let lastRequestTime = 0;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT.DELAY_BETWEEN_REQUESTS) {
      await new Promise(resolve => 
        setTimeout(resolve, RATE_LIMIT.DELAY_BETWEEN_REQUESTS - timeSinceLastRequest)
      );
    }

    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
        console.error('Error processing queued request:', error);
      }
      lastRequestTime = Date.now();
    }
  }

  isProcessingQueue = false;
}

async function queueRequest<T>(request: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const wrappedRequest = async () => {
      try {
        const result = await request();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    requestQueue.push(wrappedRequest);
    processQueue();
  });
}

async function fetchWithCors(url: string, options?: RequestInit): Promise<Response> {
  const request = async () => {
    try {
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
        if (errorText.trim().startsWith('<!DOCTYPE html>')) {
          throw new Error('Received HTML response instead of JSON. The API endpoint might be incorrect or the server might be down.');
        }
        
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      return response;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('CORS')) {
        throw new Error('Erreur de connexion à l\'API. Veuillez vérifier que l\'API est bien déployée et accessible.');
      }
      throw error;
    }
  };

  return queueRequest(request);
}

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${text}`);
  }
}

export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    try {
      // Charger les notaires
      const responseNotaires = await fetchWithCors(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.NOTAIRES}`);
      const dataNotaires = await parseJsonResponse(responseNotaires);
      if (!Array.isArray(dataNotaires)) {
        throw new Error('Invalid API response format for notaires');
      }
      const notaires = dataNotaires.map(row => parseNotaire(row));

      // Charger les villes d'intérêt
      const responseVilles = await fetchWithCors(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.VILLES_INTERET}`);
      const dataVilles = await parseJsonResponse(responseVilles);
      if (!Array.isArray(dataVilles)) {
        throw new Error('Invalid API response format for villes d\'intérêt');
      }
      const villesInteret = dataVilles.map(row => parseVilleInteret(row));

      return { notaires, villesInteret };
    } catch (error) {
      console.error('Load error:', error);
      throw error;
    }
  },

  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    try {
      const notaires = Array.isArray(notaire) ? notaire : [notaire];

      // Valider les données avant l'envoi
      notaires.forEach(n => {
        if (!n.id) throw new Error('Notaire sans ID');
        if (!n.officeNotarial) throw new Error('Notaire sans nom d\'office');
      });

      // Diviser les notaires en lots pour respecter le rate limiting
      const batches: Notaire[][] = [];
      for (let i = 0; i < notaires.length; i += RATE_LIMIT.BATCH_SIZE) {
        batches.push(notaires.slice(i, i + RATE_LIMIT.BATCH_SIZE));
      }

      // Traiter chaque lot séquentiellement
      for (const batch of batches) {
        const values = batch.map(notaire => {
          const row = [
            notaire.id || '',
            notaire.officeNotarial || '',
            notaire.adresse || '',
            notaire.codePostal || '',
            notaire.ville || '',
            notaire.departement || '',
            notaire.email || '',
            notaire.notairesAssocies || '',
            notaire.notairesSalaries || '',
            notaire.nbAssocies || 0,
            notaire.nbSalaries || 0,
            notaire.serviceNego ? 'oui' : 'non',
            notaire.statut || 'non_defini',
            notaire.notes || '',
            JSON.stringify(notaire.contacts || []),
            notaire.dateModification || new Date().toISOString(),
            notaire.latitude || 0,
            notaire.longitude || 0,
            notaire.geoScore || 0,
            JSON.stringify(notaire.geocodingHistory || [])
          ];

          if (row.some(val => val === undefined || val === null)) {
            throw new Error(`Données invalides pour le notaire ${notaire.id}`);
          }

          return row;
        });

        const response = await fetchWithCors(`${API_BASE_URL}/sheets`, {
          method: 'POST',
          body: JSON.stringify({ 
            range: SHEET_RANGES.NOTAIRES,
            values
          }),
        });

        const data = await parseJsonResponse(response);
        
        if (!data || typeof data !== 'object') {
          throw new Error('Réponse invalide du serveur');
        }

        if (data.error) {
          throw new Error(`Erreur lors de la sauvegarde: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    try {
      // Valider les données avant l'envoi
      villesInteret.forEach(v => {
        if (!v.id) throw new Error('Ville sans ID');
        if (!v.nom) throw new Error('Ville sans nom');
      });

      const response = await fetchWithCors(`${API_BASE_URL}/sheets/villes-interet`, {
        method: 'POST',
        body: JSON.stringify({ 
          villesInteret,
          range: SHEET_RANGES.VILLES_INTERET
        }),
      });

      const data = await parseJsonResponse(response);
      
      if (!data || typeof data !== 'object') {
        throw new Error('Réponse invalide du serveur');
      }

      if (data.error) {
        throw new Error(`Erreur lors de la sauvegarde: ${data.error}`);
      }

      return data;
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  },

  async testConfig(): Promise<any> {
    try {
      const response = await fetchWithCors(`${API_BASE_URL}/test`);
      const data = await parseJsonResponse(response);
      return data;
    } catch (error) {
      console.error('Config test error:', error);
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