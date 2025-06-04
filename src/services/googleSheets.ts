import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;

interface SheetData {
  notaires: any[];
  villesInteret: any[];
}

let loadingCallback: ((loading: boolean) => void) | null = null;

export const setLoadingCallback = (callback: (loading: boolean) => void) => {
  loadingCallback = callback;
};

async function fetchWithError(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function readSheetData(range: string) {
  try {
    return await fetchWithError(`/api/sheets?range=${encodeURIComponent(range)}`);
  } catch (error) {
    console.error('Erreur lors de la lecture des données:', error);
    throw error;
  }
}

export async function writeSheetData(range: string, values: any[][]) {
  try {
    return await fetchWithError('/api/sheets', {
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
    if (!SPREADSHEET_ID) {
      console.error('ID de la feuille Google manquant');
      return { notaires: [], villesInteret: [] };
    }

    try {
      const [notairesResponse, villesResponse] = await Promise.all([
        readSheetData('Notaires!A2:T'),
        readSheetData('VillesInteret!A2:G')
      ]);

      return {
        notaires: notairesResponse || [],
        villesInteret: villesResponse || []
      };
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      throw error;
    }
  },

  async saveToSheet(data: any[]): Promise<void> {
    if (!SPREADSHEET_ID) {
      console.error('ID de la feuille Google manquant');
      return;
    }

    try {
      await writeSheetData('Notaires!A2:T', data);
      console.log('Données sauvegardées avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }
};