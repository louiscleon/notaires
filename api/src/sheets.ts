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
    console.log('Rate limit hit, waiting:', RATE_LIMIT.DELAY_BETWEEN_REQUESTS - timeSinceLastRequest, 'ms');
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
  console.log('Validating values:', {
    isArray: Array.isArray(values),
    length: values?.length,
    firstRow: values?.[0]
  });

  if (!Array.isArray(values)) return false;
  if (values.length === 0) return false;
  
  // Vérifier que chaque ligne a le bon nombre de colonnes
  const expectedColumns = 20; // Nombre de colonnes attendu
  const isValid = values.every(row => 
    Array.isArray(row) && 
    row.length === expectedColumns &&
    row.every(cell => cell !== undefined && cell !== null)
  );

  if (!isValid) {
    console.error('Validation failed:', {
      invalidRows: values.filter(row => 
        !Array.isArray(row) || 
        row.length !== expectedColumns ||
        row.some(cell => cell === undefined || cell === null)
      )
    });
  }

  return isValid;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = Date.now().toString();
  console.log(`[${requestId}] Request started:`, {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: req.headers
  });

  // Ensure we always send JSON responses
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    // Log request details
    console.log(`[${requestId}] Request body:`, safeStringify(req.body));

    if (!SPREADSHEET_ID) {
      console.error(`[${requestId}] SPREADSHEET_ID is missing`);
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
          console.error(`[${requestId}] Range parameter missing`);
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Range parameter is required'
          });
        }

        console.log(`[${requestId}] Fetching data:`, { 
          range, 
          spreadsheetId: SPREADSHEET_ID
        });

        try {
          console.log(`[${requestId}] Calling Google Sheets API...`);
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
          });

          console.log(`[${requestId}] Raw Google Sheets response:`, safeStringify(response));

          // Ensure we have valid data
          if (!response.data) {
            console.error(`[${requestId}] No data in response`);
            return res.status(500).json({
              error: 'Google Sheets API Error',
              message: 'No data in response'
            });
          }

          if (!response.data.values) {
            console.log(`[${requestId}] No values in response, returning empty array`);
            return res.status(200).json([]);
          }

          console.log(`[${requestId}] Returning data:`, {
            rowCount: response.data.values.length,
            firstRow: response.data.values[0]
          });

          // Return the values array directly
          return res.status(200).json(response.data.values);
        } catch (e) {
          const error = e as Error;
          
          // Vérifier si c'est une erreur de quota
          if (error.message.includes('Quota exceeded')) {
            console.error(`[${requestId}] Quota exceeded error`);
            return res.status(429).json({
              error: 'Rate Limit Exceeded',
              message: 'Too many requests. Please try again later.',
              retryAfter: RATE_LIMIT.DELAY_BETWEEN_REQUESTS
            });
          }

          console.error(`[${requestId}] Google Sheets API Error:`, {
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
          console.error(`[${requestId}] Missing required parameters`);
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Range and values are required'
          });
        }

        // Valider les données avant l'écriture
        if (!validateValues(values)) {
          console.error(`[${requestId}] Invalid data format`);
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid data format'
          });
        }

        console.log(`[${requestId}] Writing data:`, {
          range: writeRange,
          valueCount: values.length,
          firstRow: values[0],
          lastRow: values[values.length - 1]
        });

        try {
          // Vérifier d'abord que la plage existe
          console.log(`[${requestId}] Verifying range...`);
          const checkResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
          });

          if (!checkResponse.data) {
            console.error(`[${requestId}] Failed to verify range`);
            throw new Error('Failed to verify range');
          }

          console.log(`[${requestId}] Writing data...`);
          const writeResponse = await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
          });

          if (!writeResponse.data || !writeResponse.data.updatedCells) {
            console.error(`[${requestId}] No cells were updated`);
            throw new Error('No cells were updated');
          }

          console.log(`[${requestId}] Data written successfully:`, safeStringify(writeResponse.data));
          
          // Vérifier que les données ont bien été écrites
          console.log(`[${requestId}] Verifying written data...`);
          const verifyResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: writeRange,
          });

          if (!verifyResponse.data || !verifyResponse.data.values) {
            console.error(`[${requestId}] Failed to verify written data`);
            throw new Error('Failed to verify written data');
          }

          console.log(`[${requestId}] Data verified successfully`);
          return res.status(200).json({
            success: true,
            data: writeResponse.data,
            updatedCells: writeResponse.data.updatedCells
          });
        } catch (e) {
          const error = e as Error;

          // Vérifier si c'est une erreur de quota
          if (error.message.includes('Quota exceeded')) {
            console.error(`[${requestId}] Quota exceeded error`);
            return res.status(429).json({
              error: 'Rate Limit Exceeded',
              message: 'Too many requests. Please try again later.',
              retryAfter: RATE_LIMIT.DELAY_BETWEEN_REQUESTS
            });
          }

          console.error(`[${requestId}] Google Sheets API Error:`, {
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
        console.error(`[${requestId}] Method not allowed: ${req.method}`);
        return res.status(405).json({
          error: 'Method Not Allowed',
          message: `Method ${req.method} is not supported`
        });
    }
  } catch (e) {
    const error = e as Error;
    console.error(`[${requestId}] Unexpected error:`, {
      message: error.message,
      stack: error.stack,
      error: safeStringify(error)
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    });
  } finally {
    console.log(`[${requestId}] Request completed`);
  }
} 