import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sheets, SPREADSHEET_ID } from './config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Log environment state
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasSpreadsheetId: !!SPREADSHEET_ID,
      hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      method: req.method,
      query: req.query
    });

    // Validate environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
    }

    if (!SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID is not set');
    }

    // Validate service account JSON
    try {
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      if (!serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Invalid service account format');
      }
    } catch (e) {
      throw new Error('Failed to parse service account JSON: ' + (e as Error).message);
    }

    switch (req.method) {
      case 'GET': {
        const range = req.query.range as string;
        if (!range) {
          return res.status(400).json({ error: 'Range parameter is required' });
        }

        console.log('Fetching data:', { range });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range,
        });
        console.log('Data fetched:', { 
          hasData: !!response.data.values,
          rowCount: response.data.values?.length || 0
        });

        return res.status(200).json(response.data.values);
      }

      case 'POST': {
        const { range: writeRange, values } = req.body;
        if (!writeRange || !values) {
          return res.status(400).json({ error: 'Range and values are required' });
        }

        console.log('Writing data:', { range: writeRange, valueCount: values.length });
        const writeResponse = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: writeRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values },
        });
        console.log('Data written successfully');

        return res.status(200).json(writeResponse.data);
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    // Log the full error
    console.error('API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    });

    // Send a detailed error response
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
  }
} 