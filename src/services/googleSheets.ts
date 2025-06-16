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
    latitude: latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(Number(String(latitude).trim().replace(/,/g, '.')))
      ? Number(String(latitude).trim().replace(/,/g, '.'))
      : undefined,
    longitude: longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(Number(String(longitude).trim().replace(/,/g, '.')))
      ? Number(String(longitude).trim().replace(/,/g, '.'))
      : undefined,
    statut: statut || 'nouveau',
    notes: notes || '',
    contacts: contacts ? JSON.parse(contacts) : [],
    dateModification: dateModification || new Date().toISOString(),
    nbAssocies: parseInt(nbAssocies) || 0,
    nbSalaries: parseInt(nbSalaries) || 0,
    serviceNego: serviceNego === 'oui',
    notairesAssocies: notairesAssocies || '',
    notairesSalaries: notairesSalaries || '',
    geoScore: geoScore ? parseFloat(geoScore) : undefined,
    geocodingHistory: geocodingHistory ? JSON.parse(geocodingHistory) : []
  };
  // Log détaillé pour debug
  console.log(`[DEBUG][parseNotaire] id: ${notaire.id}, office: ${notaire.officeNotarial}, lat: ${notaire.latitude}, lon: ${notaire.longitude}`);
  return notaire;
}

function parseVilleInteret(row: any[]): VilleInteret {
  const [id, nom, rayon, latitude, longitude, departement, population] = row;
  return {
    id: id || `ville_${Date.now()}`,
    nom: nom || '',
    rayon: parseFloat(rayon) || 15,
    latitude: latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(Number(String(latitude).trim().replace(/,/g, '.')))
      ? Number(String(latitude).trim().replace(/,/g, '.'))
      : 0,
    longitude: longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(Number(String(longitude).trim().replace(/,/g, '.')))
      ? Number(String(longitude).trim().replace(/,/g, '.'))
      : 0,
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

export async function readSheetData(range: string) {
  try {
    console.log('Reading sheet data:', { range });
    const apiUrl = '/api/sheets';
    console.log('API URL:', apiUrl);
    
    const response = await fetch(`${apiUrl}?range=${encodeURIComponent(range)}`);
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const data = await response.json();
    console.log('API response:', data);

    if (!data || !Array.isArray(data.data)) {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format: data should be an array');
    }

    console.log('Sheet data received:', {
      hasData: data.data.length > 0,
      rowCount: data.data.length,
      firstRow: data.data[0],
      lastRow: data.data[data.data.length - 1]
    });

    return data.data;
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

      console.log('Raw data received:', {
        notairesRows,
        villesRows
      });

      // Parse les données en objets structurés
      const notaires = (notairesRows || []).map(parseNotaire);
      const villesInteret = (villesRows || []).map(parseVilleInteret);

      console.log('Parsed data:', {
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