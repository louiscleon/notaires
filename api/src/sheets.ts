import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sheets, SPREADSHEET_ID } from './config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('API Handler called with:', {
    method: req.method,
    query: req.query,
    body: req.body,
    env: {
      hasSpreadsheetId: !!SPREADSHEET_ID,
      hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    }
  });

  if (!SPREADSHEET_ID) {
    console.error('Missing SPREADSHEET_ID');
    return res.status(500).json({ error: 'Spreadsheet ID not configured' });
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
    return res.status(500).json({ error: 'Google Service Account not configured' });
  }

  try {
    switch (req.method) {
      case 'GET':
        const range = req.query.range as string;
        if (!range) {
          return res.status(400).json({ error: 'Range parameter is required' });
        }

        console.log('Fetching data from sheets:', {
          spreadsheetId: SPREADSHEET_ID,
          range
        });

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range,
        });

        console.log('Data fetched successfully:', {
          hasData: !!response.data.values,
          rowCount: response.data.values?.length
        });

        return res.status(200).json(response.data.values);

      case 'POST':
        const { range: writeRange, values } = req.body;
        if (!writeRange || !values) {
          return res.status(400).json({ error: 'Range and values are required' });
        }

        console.log('Writing data to sheets:', {
          spreadsheetId: SPREADSHEET_ID,
          range: writeRange,
          valueCount: values.length
        });

        const writeResponse = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: writeRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });

        console.log('Data written successfully');

        return res.status(200).json(writeResponse.data);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Google Sheets API Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 