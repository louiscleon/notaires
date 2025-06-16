import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sheets, SPREADSHEET_ID } from './config';

// Configuration du rate limiting
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 50,
  BATCH_SIZE: 10,
  DELAY_BETWEEN_REQUESTS: 2000, // 2 secondes entre chaque requête
};

// Gestion du rate limiting
let lastRequestTime = 0;
async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT.DELAY_BETWEEN_REQUESTS) {
    await new Promise(resolve => 
      setTimeout(resolve, RATE_LIMIT.DELAY_BETWEEN_REQUESTS - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = now;
}

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Cannot stringify object]';
  }
}

function validateValues(values: any[][]): boolean {
  if (!Array.isArray(values)) return false;
  if (values.length === 0) return false;
  
  // Vérifier que chaque ligne a le bon nombre de colonnes
  const expectedColumns = 20; // Nombre de colonnes attendu
  return values.every(row => 
    Array.isArray(row) && 
    row.length === expectedColumns &&
    row.every(cell => cell !== undefined && cell !== null)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure we always send JSON responses
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    // Log request details
    console.log('API Request:', {
      method: req.method,
      query: req.query,
      body: req.body
    });

    if (!SPREADSHEET_ID) {
      console.error('SPREADSHEET_ID is missing');
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Spreadsheet ID is not configured'
      });
    }

    // Vérifier le rate limit avant chaque requête
    await checkRateLimit();

    switch (req.method) {
      case 'GET': {
        const range = req.query.range as string;
        if (!range) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Range parameter is required'
          });
        }

        console.log('Fetching data:', { 
          range, 
          spreadsheetId: SPREADSHEET_ID,
          hasSpreadsheetId: !!SPREADSHEET_ID
        });

        try {
          console.log('Calling Google Sheets API...');
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
          });

          console.log('Raw Google Sheets response:', safeStringify(response));

          // Ensure we have valid data
          if (!response.data) {
            console.error('No data in response from Google Sheets');
            return res.status(500).json({
              error: 'Google Sheets API Error',
              message: 'No data in response'
            });
          }

          if (!response.data.values) {
            console.log('No values in response, returning empty array');
            return res.status(200).json([]);
          }

          // Return the values array directly
          return res.status(200).json(response.data.values);
        } catch (e) {
          const error = e as Error;
          
          // Vérifier si c'est une erreur de quota
          if (error.message.includes('Quota exceeded')) {
            return res.status(429).json({
              error: 'Rate Limit Exceeded',
              message: 'Too many requests. Please try again later.',
              retryAfter: RATE_LIMIT.DELAY_BETWEEN_REQUESTS
            });
          }

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

        // Valider les données avant l'écriture
        if (!validateValues(values)) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid data format'
          });
        }

        console.log('Writing data:', {
          range: writeRange,
          valueCount: values.length,
          spreadsheetId: SPREADSHEET_ID,
          firstRow: values[0],
          lastRow: values[values.length - 1]
        });

        try {
          // Vérifier d'abord que la plage existe
          const checkResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
          });

          if (!checkResponse.data) {
            throw new Error('Failed to verify range');
          }

          const writeResponse = await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
          });

          if (!writeResponse.data || !writeResponse.data.updatedCells) {
            throw new Error('No cells were updated');
          }

          console.log('Data written successfully:', safeStringify(writeResponse.data));
          
          // Vérifier que les données ont bien été écrites
          const verifyResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
          });

          if (!verifyResponse.data || !verifyResponse.data.values) {
            throw new Error('Failed to verify written data');
          }

          return res.status(200).json({
            success: true,
            data: writeResponse.data,
            updatedCells: writeResponse.data.updatedCells
          });
        } catch (e) {
          const error = e as Error;

          // Vérifier si c'est une erreur de quota
          if (error.message.includes('Quota exceeded')) {
            return res.status(429).json({
              error: 'Rate Limit Exceeded',
              message: 'Too many requests. Please try again later.',
              retryAfter: RATE_LIMIT.DELAY_BETWEEN_REQUESTS
            });
          }

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
  } catch (e) {
    const error = e as Error;
    console.error('Unexpected error:', {
      message: error.message,
      stack: error.stack,
      error: safeStringify(error)
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    });
  }
} 