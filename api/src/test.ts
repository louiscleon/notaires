import type { VercelRequest, VercelResponse } from '@vercel/node';

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '[Cannot stringify object]';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // Log environment variables (sans les valeurs sensibles)
    const envState = {
      NODE_ENV: process.env.NODE_ENV,
      hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      hasSpreadsheetId: !!process.env.REACT_APP_SPREADSHEET_ID,
      serviceAccountKeyLength: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.length || 0,
      spreadsheetId: process.env.REACT_APP_SPREADSHEET_ID || 'not set'
    };
    console.log('Environment state:', safeStringify(envState));

    // Si nous avons une clé de service, essayons de la parser
    let serviceAccountInfo = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        console.log('Service account parsed successfully');
        
        // Vérifier la structure
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = requiredFields.filter(field => !serviceAccount[field]);
        
        if (missingFields.length > 0) {
          console.error('Missing required fields:', missingFields);
          serviceAccountInfo = {
            error: 'Invalid service account format',
            missingFields,
            availableFields: Object.keys(serviceAccount)
          };
        } else {
          serviceAccountInfo = {
            type: serviceAccount.type,
            projectId: serviceAccount.project_id,
            hasPrivateKey: !!serviceAccount.private_key,
            privateKeyLength: serviceAccount.private_key?.length || 0,
            hasClientEmail: !!serviceAccount.client_email,
            clientEmail: serviceAccount.client_email,
            availableFields: Object.keys(serviceAccount)
          };
        }
      } catch (e) {
        console.error('Failed to parse service account:', e);
        serviceAccountInfo = {
          error: 'Failed to parse service account JSON',
          details: e instanceof Error ? e.message : 'Unknown error',
          keyPreview: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.substring(0, 50) + '...'
        };
      }
    } else {
      console.error('No service account key found');
      serviceAccountInfo = {
        error: 'No service account key found'
      };
    }

    const response = {
      message: 'API is working',
      environment: envState,
      serviceAccount: serviceAccountInfo,
      query: req.query,
      method: req.method,
      timestamp: new Date().toISOString()
    };

    console.log('API response:', safeStringify(response));
    return res.status(200).json(response);
  } catch (error) {
    console.error('Test API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
} 