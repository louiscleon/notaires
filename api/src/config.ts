import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Cannot stringify object]';
  }
}

console.log('Initializing Google Sheets API configuration...');

if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  console.error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
}

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  console.log('Service account credentials parsed:', {
    type: credentials.type,
    projectId: credentials.project_id,
    hasPrivateKey: !!credentials.private_key,
    hasClientEmail: !!credentials.client_email
  });
} catch (error) {
  console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', error);
  throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as JSON');
}

if (!credentials.private_key || !credentials.client_email) {
  console.error('Invalid service account format:', {
    hasPrivateKey: !!credentials.private_key,
    hasClientEmail: !!credentials.client_email
  });
  throw new Error('Service account is missing required fields');
}

console.log('Creating Google Auth client...');
const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

console.log('Creating Google Sheets client...');
export const sheets = google.sheets({ version: 'v4', auth });

export const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;
console.log('Configuration complete:', {
  hasSpreadsheetId: !!SPREADSHEET_ID,
  spreadsheetId: SPREADSHEET_ID
}); 