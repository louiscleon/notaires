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

          // Ensure we have valid data
          if (!response.data || !response.data.values) {
            console.log('No data found in response:', response.data);
            return res.status(200).json({
              data: []
            });
          }

          const result = {
            hasData: true,
            rowCount: response.data.values.length,
            firstRow: response.data.values[0],
            lastRow: response.data.values[response.data.values.length - 1]
          };
          console.log('Data fetched:', safeStringify(result));

          // Ensure we're sending a properly formatted JSON response
          return res.status(200).json({
            data: response.data.values
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
          spreadsheetId: SPREADSHEET_ID,
          firstRow: values[0],
          lastRow: values[values.length - 1]
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