import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SPREADSHEET_ID) {
    return res.status(500).json({ error: 'Spreadsheet ID not configured' });
  }

  try {
    switch (req.method) {
      case 'GET':
        const range = req.query.range as string;
        if (!range) {
          return res.status(400).json({ error: 'Range parameter is required' });
        }

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range,
        });

        return res.status(200).json(response.data.values);

      case 'POST':
        const { range: writeRange, values } = req.body;
        if (!writeRange || !values) {
          return res.status(400).json({ error: 'Range and values are required' });
        }

        const writeResponse = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: writeRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });

        return res.status(200).json(writeResponse.data);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Google Sheets API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 