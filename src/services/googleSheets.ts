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

async function fetchWithCors(url: string, options?: RequestInit): Promise<Response> {
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
      throw error;
    }
  },

  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    try {
      const notaires = Array.isArray(notaire) ? notaire : [notaire];

      // D'abord, charger tous les notaires existants
      const responseNotaires = await fetchWithCors(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.NOTAIRES}`);
      const dataNotaires = await parseJsonResponse(responseNotaires);
      if (!Array.isArray(dataNotaires)) {
        throw new Error('Invalid API response format for notaires');
      }

      // Créer une map des notaires existants
      const existingNotaires = new Map(dataNotaires.map(row => [row[0], row]));

      // Mettre à jour ou ajouter les nouveaux notaires
      notaires.forEach(notaire => {
        existingNotaires.set(notaire.id, [
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
      });

      // Convertir la map en tableau pour l'envoi
      const values = Array.from(existingNotaires.values());

      const response = await fetchWithCors(`${API_BASE_URL}/sheets`, {
        method: 'POST',
        body: JSON.stringify({ 
          range: SHEET_RANGES.NOTAIRES,
          values
        }),
      });

      const data = await parseJsonResponse(response);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans Google Sheets:', error);
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