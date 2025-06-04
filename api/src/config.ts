import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const sheets = google.sheets({ version: 'v4', auth });
export const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID; 