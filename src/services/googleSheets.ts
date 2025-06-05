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

  return {
    id: id || `notaire_${Date.now()}`,
    officeNotarial: officeNotarial || '',
    adresse: adresse || '',
    codePostal: codePostal || '',
    ville: ville || '',
    departement: departement || '',
    email: email || '',
    notairesAssocies: notairesAssocies || '',
    notairesSalaries: notairesSalaries || '',
    nbAssocies: parseInt(nbAssocies) || 0,
    nbSalaries: parseInt(nbSalaries) || 0,
    serviceNego: serviceNego === 'oui',
    statut: statut || 'nouveau',
    notes: notes || '',
    contacts: contacts ? JSON.parse(contacts) : [],
    dateModification: dateModification || new Date().toISOString(),
    latitude: latitude ? parseFloat(latitude) : undefined,
    longitude: longitude ? parseFloat(longitude) : undefined,
    geoScore: geoScore ? parseFloat(geoScore) : undefined,
    geocodingHistory: geocodingHistory ? JSON.parse(geocodingHistory) : []
  };
}

function parseVilleInteret(row: any[]): VilleInteret {
  const [id, nom, rayon, latitude, longitude, departement, population] = row;
  return {
    id: id || `ville_${Date.now()}`,
    nom: nom || '',
    rayon: parseFloat(rayon) || 15,
    latitude: parseFloat(latitude) || 0,
    longitude: parseFloat(longitude) || 0,
    departement: departement || '',
    population: population ? parseInt(population) : undefined
  };
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

async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
    console.log('API Response:', data);
  } catch (e) {
    console.error('Failed to parse response:', e);
    throw new Error('Failed to parse server response');
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

export async function readSheetData(range: string) {
  try {
    console.log('Reading sheet data:', { range });
    const data = await fetchWithError<any[][]>(`/api/sheets?range=${encodeURIComponent(range)}`);
    console.log('Sheet data received:', {
      hasData: !!data,
      rowCount: data?.length || 0,
      firstRow: data?.[0],
      lastRow: data?.[data.length - 1]
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de la lecture des données:', error);
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
      const [notairesRows, villesRows] = await Promise.all([
        readSheetData('Notaires!A2:T'),
        readSheetData('VillesInteret!A2:G')
      ]);

      // Parse les données en objets structurés
      const notaires = (notairesRows || []).map(parseNotaire);
      const villesInteret = (villesRows || []).map(parseVilleInteret);

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

  async saveToSheet(notaire: Notaire): Promise<void> {
    try {
      // Convertir le notaire en format de ligne pour Google Sheets
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