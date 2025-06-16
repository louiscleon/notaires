import { NotaireStatut, Contact, GeocodingHistory } from '../types';

interface SheetData {
  notaires: any[];
  villesInteret: any[];
}

interface Notaire {
  id: string;
  officeNotarial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  departement: string;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  latitude?: number;
  longitude?: number;
  statut: NotaireStatut;
  contacts: Contact[];
  dateModification?: string;
  notes?: string;
  nbAssocies: number;
  nbSalaries: number;
  notairesAssocies?: string;
  notairesSalaries?: string;
  serviceNego: boolean;
  geoScore?: number;
  geoStatus?: 'pending' | 'success' | 'error';
  display_name?: string;
  geocodingHistory?: GeocodingHistory[];
  needsGeocoding: boolean;
}

interface VilleInteret {
  id: string;
  nom: string;
  rayon: number;
  latitude: number;
  longitude: number;
  departement: string;
  population?: number;
}

function parseNotaire(row: any[]): Notaire {
  console.log('Parsing notaire row:', row);
  const [
    id,
    officeNotarial,
    adresse,
    codePostal,
    ville,
    departement,
    telephone,
    email,
    siteWeb,
    latitude,
    longitude,
    statut,
    notes,
    contacts,
    dateModification,
    nbAssocies,
    nbSalaries,
    serviceNego,
    notairesAssocies,
    notairesSalaries,
    geoScore,
    geocodingHistory,
    needsGeocoding
  ] = row;

  // Construire l'adresse complète pour la comparaison
  const adresseComplete = `${adresse}, ${codePostal} ${ville}`.toLowerCase().trim();
  
  // Vérifier si l'adresse a changé en comparant avec l'historique de géocodage
  const adresseAChange = !geocodingHistory || geocodingHistory.length === 0 || 
    geocodingHistory[geocodingHistory.length - 1].address.toLowerCase().trim() !== adresseComplete;

  console.log('Adresse complète:', adresseComplete);
  console.log('Adresse a changé:', adresseAChange);

  // Si l'adresse a changé, on réinitialise les coordonnées
  const shouldResetCoordinates = adresseAChange;

  // Fonction utilitaire pour parser les nombres
  const parseNumber = (value: any): number | undefined => {
    console.log('Parsing number value:', value, 'type:', typeof value);
    if (value === undefined || value === null || value === '') {
      console.log('Empty value, returning undefined');
      return undefined;
    }
    // Gérer les cas où la valeur est une chaîne avec des virgules ou des points
    const cleanValue = String(value).trim().replace(/,/g, '.');
    console.log('Cleaned value:', cleanValue);
    const num = Number(cleanValue);
    console.log('Parsed number:', num, 'isNaN:', isNaN(num));
    return isNaN(num) ? undefined : num;
  };

  // Fonction utilitaire pour parser les coordonnées
  const parseCoordinate = (value: any): number | undefined => {
    console.log('Parsing coordinate:', value, 'type:', typeof value);
    const num = parseNumber(value);
    // Vérifier que la coordonnée est dans une plage valide
    if (num !== undefined) {
      if (num >= -180 && num <= 180) {
        console.log('Valid coordinate:', num);
        return num;
      }
      console.warn(`Invalid coordinate value: ${value}, parsed as: ${num}`);
    }
    console.log('Returning undefined for coordinate');
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
      // Si c'est déjà un tableau, le retourner
      if (Array.isArray(value)) return value;
      // Si c'est une chaîne JSON, essayer de la parser
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          // Si ce n'est pas du JSON valide, créer un contact avec le texte comme commentaire
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

  const notaire = {
    id: id || `notaire_${Date.now()}`,
    officeNotarial: officeNotarial || '',
    adresse: adresse || '',
    codePostal: codePostal || '',
    ville: ville || '',
    departement: departement || '',
    telephone: telephone || '',
    email: email || '',
    siteWeb: siteWeb || '',
    // Si l'adresse a changé, on réinitialise les coordonnées
    latitude: shouldResetCoordinates ? undefined : parseCoordinate(latitude),
    longitude: shouldResetCoordinates ? undefined : parseCoordinate(longitude),
    statut: statut || 'nouveau',
    notes: notes || '',
    contacts: parseContacts(contacts),
    dateModification: parseDate(dateModification),
    nbAssocies: parseNumber(nbAssocies) || 0,
    nbSalaries: parseNumber(nbSalaries) || 0,
    serviceNego: serviceNego === 'oui',
    notairesAssocies: notairesAssocies || '',
    notairesSalaries: notairesSalaries || '',
    geoScore: parseNumber(geoScore),
    geocodingHistory: geocodingHistory ? JSON.parse(geocodingHistory) : [],
    // Utiliser la valeur stockée ou déterminer si le géocodage est nécessaire
    needsGeocoding: needsGeocoding === 'true' || shouldResetCoordinates
  };

  // Log des coordonnées pour debug
  console.log('Notaire coordinates:', {
    id: notaire.id,
    office: notaire.officeNotarial,
    rawLatitude: latitude,
    rawLongitude: longitude,
    parsedLatitude: notaire.latitude,
    parsedLongitude: notaire.longitude,
    needsGeocoding: notaire.needsGeocoding
  });

  console.log('Parsed notaire:', notaire);
  return notaire;
}

function parseVilleInteret(row: any[]): VilleInteret {
  console.log('Parsing ville interet row:', row);
  const [id, nom, rayon, latitude, longitude, departement, population] = row;
  
  // Vérification et conversion des valeurs
  const parsedRayon = typeof rayon === 'string' ? parseFloat(rayon.replace(',', '.')) : parseFloat(rayon);
  const parsedLatitude = typeof latitude === 'string' ? parseFloat(latitude.replace(',', '.')) : parseFloat(latitude);
  const parsedLongitude = typeof longitude === 'string' ? parseFloat(longitude.replace(',', '.')) : parseFloat(longitude);
  const parsedPopulation = population ? parseInt(population.toString()) : undefined;

  const ville = {
    id: id || `ville_${Date.now()}`,
    nom: nom || '',
    rayon: isNaN(parsedRayon) ? 15 : parsedRayon,
    latitude: isNaN(parsedLatitude) ? 0 : parsedLatitude,
    longitude: isNaN(parsedLongitude) ? 0 : parsedLongitude,
    departement: departement || '',
    population: parsedPopulation
  };

  console.log('Parsed ville interet:', ville);
  return ville;
}

let loadingCallback: ((loading: boolean) => void) | null = null;

export const setLoadingCallback = (callback: (loading: boolean) => void) => {
  loadingCallback = callback;
};

interface APIError {
  error: string;
  message: string;
}

interface APIResponse<T> {
  data: T;
}

const API_URL = '/api';

async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  let data;
  try {
    const text = await response.text();
    console.log('API Raw Response:', text);
    try {
      data = JSON.parse(text);
      console.log('API Parsed Response:', data);
    } catch (parseError: any) {
      console.error('Failed to parse JSON:', parseError);
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }
  } catch (e) {
    console.error('Failed to read response:', e);
    throw new Error('Failed to read server response');
  }

  if (!response.ok) {
    const error = data as APIError;
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  if (!data.data) {
    console.error('Invalid response format:', data);
    throw new Error('Invalid response format: missing data property');
  }

  return data.data as T;
}

export async function testConfig() {
  try {
    const response = await fetch('/api/test');
    const data = await response.json();
    console.log('API Test Response:', data);
    return data;
  } catch (error) {
    console.error('API Test Error:', error);
    throw error;
  }
}

async function readSheetData(range: string): Promise<any[][]> {
  try {
    console.log('Reading sheet data for range:', range);
    const response = await fetchWithError<APIResponse<any[][]>>(`${API_URL}/sheets?range=${encodeURIComponent(range)}`);
    console.log('Sheet data response:', response);
    
    if (!response.data) {
      console.error('No data in response');
      throw new Error('No data received from API');
    }
    
    console.log('Sheet data rows:', response.data.length);
    console.log('First row:', response.data[0]);
    
    return response.data;
  } catch (error) {
    console.error('Error reading sheet data:', error);
    throw error;
  }
}

export async function writeSheetData(range: string, values: any[][]) {
  try {
    console.log('Writing sheet data:', {
      range,
      valueCount: values.length,
      firstRow: values[0],
      lastRow: values[values.length - 1]
    });
    return await fetchWithError<any>('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, values }),
    });
  } catch (error) {
    console.error('Erreur lors de l\'écriture des données:', error);
    throw error;
  }
}

export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    try {
      console.log('Loading data from sheet');
      const [notairesData, villesInteretData] = await Promise.all([
        readSheetData('Notaires!A2:V'),
        readSheetData('VillesInteret!A2:G')
      ]);

      console.log('Notaires data rows:', notairesData.length);
      console.log('Villes interet data rows:', villesInteretData.length);

      const notaires = notairesData.map(row => parseNotaire(row));
      const villesInteret = villesInteretData.map(row => parseVilleInteret(row));

      console.log('Parsed notaires:', notaires.length);
      console.log('Parsed villes interet:', villesInteret.length);

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

      // Préparer les données pour Google Sheets
      const rows = notaires.map(n => [
        n.id,
        n.officeNotarial,
        n.adresse,
        n.codePostal,
        n.ville,
        n.departement,
        n.telephone || '',
        n.email || '',
        n.siteWeb || '',
        n.latitude || '',
        n.longitude || '',
        n.statut,
        n.notes || '',
        JSON.stringify(n.contacts),
        n.dateModification,
        n.nbAssocies,
        n.nbSalaries,
        n.serviceNego ? 'oui' : 'non',
        n.notairesAssocies || '',
        n.notairesSalaries || '',
        n.geoScore || '',
        JSON.stringify(n.geocodingHistory || []),
        n.needsGeocoding || false // Assurer que needsGeocoding est toujours un booléen
      ]);

      // Trouver les lignes existantes
      const existingData = await readSheetData('Notaires!A2:W');
      const existingIds = new Set(existingData.map(row => row[0]));

      // Séparer les nouvelles lignes et les mises à jour
      const newRows: any[][] = [];
      const updateRows: { range: string; values: any[][] }[] = [];

      rows.forEach((row, index) => {
        const id = row[0];
        if (existingIds.has(id)) {
          // Trouver l'index de la ligne existante
          const existingIndex = existingData.findIndex(r => r[0] === id);
          if (existingIndex !== -1) {
            updateRows.push({
              range: `Notaires!A${existingIndex + 2}:W${existingIndex + 2}`,
              values: [row]
            });
          }
        } else {
          newRows.push(row);
        }
      });

      // Ajouter les nouvelles lignes
      if (newRows.length > 0) {
        console.log('Adding new rows:', newRows.length);
        await writeSheetData('Notaires!A2:W', newRows);
      }

      // Mettre à jour les lignes existantes
      for (const update of updateRows) {
        console.log('Updating row:', update.range);
        await writeSheetData(update.range, update.values);
      }

      console.log('Save completed successfully');
    } catch (error) {
      console.error('Error saving to sheet:', error);
      throw error;
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    try {
      const values = villesInteret.map(ville => [
        ville.id,
        ville.nom,
        ville.rayon,
        ville.latitude,
        ville.longitude,
        ville.departement,
        ville.population
      ]);
      await writeSheetData('VillesInteret!A2:G', values);
      console.log('Villes d\'intérêt sauvegardées avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des villes d\'intérêt:', error);
      throw error;
    }
  }
};