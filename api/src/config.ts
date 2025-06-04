import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
}

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
} catch (error) {
  throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON');
}

const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const sheets = google.sheets({ version: 'v4', auth });
export const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID; 