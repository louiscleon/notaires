import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // Log environment variables (sans les valeurs sensibles)
    const envState = {
      NODE_ENV: process.env.NODE_ENV,
      hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      hasSpreadsheetId: !!process.env.REACT_APP_SPREADSHEET_ID,
    };

    // Si nous avons une clé de service, essayons de la parser
    let serviceAccountInfo = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        serviceAccountInfo = {
          type: serviceAccount.type,
          projectId: serviceAccount.project_id,
          hasPrivateKey: !!serviceAccount.private_key,
          hasClientEmail: !!serviceAccount.client_email,
          clientEmail: serviceAccount.client_email
        };
      } catch (e) {
        serviceAccountInfo = {
          error: 'Failed to parse service account JSON',
          details: e instanceof Error ? e.message : 'Unknown error'
        };
      }
    }

    return res.status(200).json({
      message: 'API is working',
      environment: envState,
      serviceAccount: serviceAccountInfo,
      query: req.query,
      method: req.method
    });
  } catch (error) {
    console.error('Test API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
} 