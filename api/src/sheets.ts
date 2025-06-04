import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sheets, SPREADSHEET_ID } from './config';

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Cannot stringify object]';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure we always send JSON responses
  res.setHeader('Content-Type', 'application/json');

  try {
    // Log environment state
    const envState = {
      NODE_ENV: process.env.NODE_ENV,
      hasSpreadsheetId: !!SPREADSHEET_ID,
      hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      method: req.method,
      query: req.query
    };
    console.log('Environment check:', safeStringify(envState));

    // Validate environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Service account key is not configured'
      });
    }

    if (!SPREADSHEET_ID) {
      console.error('SPREADSHEET_ID is missing');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Spreadsheet ID is not configured'
      });
    }

    // Validate service account JSON
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      console.log('Service account parsed:', {
        type: serviceAccount.type,
        hasPrivateKey: !!serviceAccount.private_key,
        hasClientEmail: !!serviceAccount.client_email,
        projectId: serviceAccount.project_id
      });

      if (!serviceAccount.private_key || !serviceAccount.client_email) {
        console.error('Invalid service account format - missing required fields');
        return res.status(500).json({
          error: 'Configuration Error',
          message: 'Invalid service account format - missing required fields'
        });
      }
    } catch (e) {
      console.error('Failed to parse service account JSON:', e);
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Invalid service account JSON format'
      });
    }

    switch (req.method) {
      case 'GET': {
        const range = req.query.range as string;
        if (!range) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Range parameter is required'
          });
        }

        console.log('Fetching data:', { range, spreadsheetId: SPREADSHEET_ID });
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
          });

          const result = {
            hasData: !!response.data.values,
            rowCount: response.data.values?.length || 0
          };
          console.log('Data fetched:', safeStringify(result));

          return res.status(200).json({
            data: response.data.values || []
          });
        } catch (e) {
          const error = e as Error;
          console.error('Google Sheets API Error:', {
            message: error.message,
            stack: error.stack,
            error: safeStringify(error)
          });
          return res.status(500).json({
            error: 'Google Sheets API Error',
            message: error.message || 'Failed to fetch data'
          });
        }
      }

      case 'POST': {
        const { range: writeRange, values } = req.body;
        if (!writeRange || !values) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Range and values are required'
          });
        }

        console.log('Writing data:', {
          range: writeRange,
          valueCount: values.length,
          spreadsheetId: SPREADSHEET_ID
        });

        try {
          const writeResponse = await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
          });

          console.log('Data written successfully:', safeStringify(writeResponse.data));
          return res.status(200).json({
            data: writeResponse.data
          });
        } catch (e) {
          const error = e as Error;
          console.error('Google Sheets API Error:', {
            message: error.message,
            stack: error.stack,
            error: safeStringify(error)
          });
          return res.status(500).json({
            error: 'Google Sheets API Error',
            message: error.message || 'Failed to write data'
          });
        }
      }

      default:
        return res.status(405).json({
          error: 'Method Not Allowed',
          message: `Method ${req.method} is not supported`
        });
    }
  } catch (error) {
    // Log the full error
    console.error('Unexpected API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: safeStringify(error)
    });

    // Send a detailed error response
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
} 