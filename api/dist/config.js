"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPREADSHEET_ID = exports.sheets = void 0;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
function safeStringify(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    }
    catch (e) {
        return '[Cannot stringify object]';
    }
}
console.log('Initializing Google Sheets API configuration...');
const SERVICE_ACCOUNT_KEY = process.env.REACT_APP_GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!SERVICE_ACCOUNT_KEY) {
    console.error('SERVICE_ACCOUNT_KEY is not set');
    throw new Error('SERVICE_ACCOUNT_KEY environment variable is not set');
}
let credentials;
try {
    credentials = JSON.parse(SERVICE_ACCOUNT_KEY);
    console.log('Service account credentials parsed:', {
        type: credentials.type,
        projectId: credentials.project_id,
        hasPrivateKey: !!credentials.private_key,
        hasClientEmail: !!credentials.client_email,
        clientEmail: credentials.client_email
    });
}
catch (error) {
    console.error('Failed to parse SERVICE_ACCOUNT_KEY:', error);
    throw new Error('Failed to parse SERVICE_ACCOUNT_KEY as JSON');
}
if (!credentials.private_key || !credentials.client_email) {
    console.error('Invalid service account format:', {
        hasPrivateKey: !!credentials.private_key,
        hasClientEmail: !!credentials.client_email
    });
    throw new Error('Service account is missing required fields');
}
console.log('Creating Google Auth client...');
const auth = new google_auth_library_1.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
console.log('Creating Google Sheets client...');
exports.sheets = googleapis_1.google.sheets({ version: 'v4', auth });
exports.SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID || process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
console.log('Configuration complete:', {
    hasSpreadsheetId: !!exports.SPREADSHEET_ID,
    spreadsheetId: exports.SPREADSHEET_ID,
    hasAuth: !!auth,
    hasSheets: !!exports.sheets
});
