import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sheets, SPREADSHEET_ID } from './config';

// Mécanisme de verrouillage simple
let isWriteLocked = false;
let writeQueue: Array<() => Promise<any>> = [];
const LOCK_TIMEOUT = 10000; // 10 secondes maximum de verrouillage

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Cannot stringify object]';
  }
}

async function processWriteQueue() {
  if (isWriteLocked || writeQueue.length === 0) return;
  
  isWriteLocked = true;
  console.log(`Processing write queue (${writeQueue.length} items)`);
  
  // Set a timeout to release the lock in case of errors
  const timeoutId = setTimeout(() => {
    console.log('Write lock timeout reached, releasing lock');
    isWriteLocked = false;
    processWriteQueue();
  }, LOCK_TIMEOUT);
  
  try {
    const operation = writeQueue[0];
    await operation();
    writeQueue.shift();
  } catch (error) {
    console.error('Error processing write queue:', error);
  } finally {
    clearTimeout(timeoutId);
    isWriteLocked = false;
    if (writeQueue.length > 0) {
      // Wait a bit before processing next item
      setTimeout(processWriteQueue, 1000);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure we always send JSON responses
  res.setHeader('Content-Type', 'application/json');

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
        error: true,
        message: 'Configuration Error: Spreadsheet ID is not configured'
      });
    }

    switch (req.method) {
      case 'GET': {
        const range = req.query.range as string;
        if (!range) {
          return res.status(400).json({
            error: true,
            message: 'Validation Error: Range parameter is required'
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
              error: true,
              message: 'Google Sheets API Error: No data in response'
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
          console.error('Google Sheets API Error:', {
            message: error.message,
            stack: error.stack,
            error: safeStringify(error)
          });
          return res.status(500).json({
            error: true,
            message: `Google Sheets API Error: ${error.message || 'Failed to fetch data'}`
          });
        }
      }

      case 'POST': {
        const { range: writeRange, values } = req.body;
        if (!writeRange || !values) {
          return res.status(400).json({
            error: true,
            message: 'Validation Error: Range and values are required'
          });
        }

        return new Promise((resolve) => {
          const operation = async () => {
            try {
              console.log('Writing data:', {
                range: writeRange,
                valueCount: values.length,
                spreadsheetId: SPREADSHEET_ID,
                firstRow: values[0],
                lastRow: values[values.length - 1]
              });

              const writeResponse = await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: writeRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values },
              });

              console.log('Data written successfully:', safeStringify(writeResponse.data));
              resolve(res.status(200).json({
                error: false,
                data: writeResponse.data
              }));
            } catch (e) {
              const error = e as Error;
              console.error('Google Sheets API Error:', {
                message: error.message,
                stack: error.stack,
                error: safeStringify(error)
              });
              resolve(res.status(500).json({
                error: true,
                message: `Google Sheets API Error: ${error.message || 'Failed to write data'}`
              }));
            }
          };

          writeQueue.push(operation);
          processWriteQueue();
        });
      }

      default:
        return res.status(405).json({
          error: true,
          message: `Method Not Allowed: Method ${req.method} is not supported`
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
      error: true,
      message: `Internal Server Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`
    });
  }
} 