import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;

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