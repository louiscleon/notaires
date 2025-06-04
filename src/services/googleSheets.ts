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

export async function readSheetData(range: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    return response.data.values;
    } catch (error) {
    console.error('Erreur lors de la lecture des données:', error);
    throw error;
  }
}

export async function writeSheetData(range: string, values: any[][]) {
  try {
    const response = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
        });
    return response.data;
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
      // Charger les notaires
      const notairesResponse = await readSheetData('Notaires!A2:T');
      const villesResponse = await readSheetData('VillesInteret!A2:G');

      const notaires = notairesResponse || [];
      const villesInteret = villesResponse || [];

      return {
        notaires,
        villesInteret
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