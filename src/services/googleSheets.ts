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
    geocodingHistory
  ] = row;

  console.log('Raw values:', {
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
    geocodingHistory
  });

  // Fonction utilitaire pour parser les nombres
  const parseNumber = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(String(value).trim().replace(/,/g, '.'));
    return isNaN(num) ? undefined : num;
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
    latitude: parseNumber(latitude),
    longitude: parseNumber(longitude),
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
    geocodingHistory: geocodingHistory ? JSON.parse(geocodingHistory) : []
  };

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
    const url = `${API_URL}/sheets?range=${encodeURIComponent(range)}`;
    console.log('Fetching data from:', url);

    const response = await fetch(url);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    // Vérifier le type de contenu
    const contentType = response.headers.get('content-type');
    console.log('Response content-type:', contentType);

    // Lire le texte brut d'abord
    const rawText = await response.text();
    console.log('Raw API response:', rawText);

    // Essayer de parser le JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError: any) {
      console.error('JSON Parse Error:', parseError);
      console.error('Failed to parse response:', rawText);
      throw new Error(`Failed to parse API response: ${parseError.message}`);
    }

    // Vérifier la structure de la réponse
    if (!data || !data.data) {
      console.error('Invalid API response structure:', data);
      throw new Error('Invalid API response structure: missing data property');
    }

    // Vérifier que data.data est un tableau
    if (!Array.isArray(data.data)) {
      console.error('Invalid data format:', data.data);
      throw new Error('Invalid data format: expected array');
    }

    console.log('Successfully parsed data:', {
      rowCount: data.data.length,
      firstRow: data.data[0],
      lastRow: data.data[data.data.length - 1]
    });

    return data.data;
  } catch (error) {
    console.error('Error in readSheetData:', error);
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
      console.log('Loading data from sheets...');
      
      // Charger les notaires
      const notairesRows = await readSheetData('Notaires!A2:T');
      console.log('Notaires rows loaded:', notairesRows);
      const notaires = (notairesRows || []).map(parseNotaire);
      
      // Charger les villes d'intérêt
      let villesInteret: VilleInteret[] = [];
      try {
        const villesRows = await readSheetData('VillesInteret!A2:G');
        console.log('Villes rows loaded:', villesRows);
        villesInteret = (villesRows || []).map(parseVilleInteret);
      } catch (error) {
        console.error('Error loading villes interet:', error);
        // En cas d'erreur, on continue avec un tableau vide
        villesInteret = [];
      }

      console.log('Data loaded:', {
        notairesCount: notaires.length,
        villesCount: villesInteret.length,
        sampleNotaire: notaires[0],
        sampleVille: villesInteret[0]
      });

      return {
        notaires,
        villesInteret
      };
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      throw error;
    }
  },

  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    try {
      if (Array.isArray(notaire)) {
        // Si c'est un tableau de notaires, sauvegarder tout
        const values = notaire.map(n => [
          n.id,
          n.officeNotarial,
          n.adresse,
          n.codePostal,
          n.ville,
          n.departement,
          n.email || '',
          n.notairesAssocies || '',
          n.notairesSalaries || '',
          n.nbAssocies,
          n.nbSalaries,
          n.serviceNego ? 'oui' : 'non',
          n.statut,
          n.notes || '',
          JSON.stringify(n.contacts || []),
          n.dateModification || new Date().toISOString(),
          n.latitude || '',
          n.longitude || '',
          n.geoScore || '',
          JSON.stringify(n.geocodingHistory || [])
        ]);
        await writeSheetData('Notaires!A2:T', values);
        console.log('Tous les notaires sauvegardés avec succès dans Google Sheets');
      } else {
        // Si c'est un seul notaire, trouver sa ligne et la mettre à jour
        const row = [
          notaire.id,
          notaire.officeNotarial,
          notaire.adresse,
          notaire.codePostal,
          notaire.ville,
          notaire.departement,
          notaire.email || '',
          notaire.notairesAssocies || '',
          notaire.notairesSalaries || '',
          notaire.nbAssocies,
          notaire.nbSalaries,
          notaire.serviceNego ? 'oui' : 'non',
          notaire.statut,
          notaire.notes || '',
          JSON.stringify(notaire.contacts || []),
          notaire.dateModification || new Date().toISOString(),
          notaire.latitude || '',
          notaire.longitude || '',
          notaire.geoScore || '',
          JSON.stringify(notaire.geocodingHistory || [])
        ];

        // Trouver l'index de la ligne correspondante dans la feuille
        const allData = await this.loadFromSheet();
        const notaireIndex = allData.notaires.findIndex(n => n.id === notaire.id);
        
        if (notaireIndex === -1) {
          throw new Error(`Notaire avec l'ID ${notaire.id} non trouvé dans la feuille`);
        }

        // Calculer la ligne réelle dans la feuille (ajouter 2 car la première ligne est l'en-tête)
        const rowIndex = notaireIndex + 2;
        
        // Mettre à jour la ligne spécifique
        await writeSheetData(`Notaires!A${rowIndex}:T${rowIndex}`, [row]);
        console.log('Notaire sauvegardé avec succès dans Google Sheets');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans Google Sheets:', error);
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