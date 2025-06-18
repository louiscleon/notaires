"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
// Mécanisme de verrouillage simple
let isWriteLocked = false;
let writeQueue = [];
const LOCK_TIMEOUT = 10000; // 10 secondes maximum de verrouillage
function safeStringify(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    }
    catch (e) {
        return '[Cannot stringify object]';
    }
}
async function processWriteQueue() {
    if (isWriteLocked || writeQueue.length === 0)
        return;
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
    }
    catch (error) {
        console.error('Error processing write queue:', error);
    }
    finally {
        clearTimeout(timeoutId);
        isWriteLocked = false;
        if (writeQueue.length > 0) {
            // Wait a bit before processing next item
            setTimeout(processWriteQueue, 1000);
        }
    }
}
// **NOUVELLE FONCTION : TROUVER LA LIGNE D'UN NOTAIRE SPECIFIQUE**
async function findNotaireRow(notaireId) {
    try {
        console.log(`🔍 Recherche de la ligne pour le notaire ID: ${notaireId}`);
        // Récupérer seulement la colonne des IDs (colonne A)
        const response = await config_1.sheets.spreadsheets.values.get({
            spreadsheetId: config_1.SPREADSHEET_ID,
            range: 'Notaires!A2:A', // Seulement la colonne des IDs
        });
        if (!response.data.values) {
            console.log('Aucune donnée trouvée');
            return null;
        }
        // Chercher l'ID dans les données
        const rows = response.data.values;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === notaireId) {
                const rowNumber = i + 2; // +2 car on commence à la ligne 2
                console.log(`✅ Notaire trouvé à la ligne ${rowNumber}`);
                return rowNumber;
            }
        }
        console.log(`❌ Notaire avec ID ${notaireId} non trouvé`);
        return null;
    }
    catch (error) {
        console.error('Erreur lors de la recherche de ligne:', error);
        throw error;
    }
}
// **NOUVELLE FONCTION : MODIFIER UNE LIGNE SPECIFIQUE**
async function updateSpecificRow(rowNumber, values) {
    try {
        console.log(`💾 Modification de la ligne ${rowNumber} avec ${values.length} colonnes`);
        // Construire la plage pour cette ligne spécifique (ex: "Notaires!A15:T15")  
        const range = `Notaires!A${rowNumber}:T${rowNumber}`;
        const response = await config_1.sheets.spreadsheets.values.update({
            spreadsheetId: config_1.SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values] // Tableau de tableaux, même pour une seule ligne
            },
        });
        console.log(`✅ Ligne ${rowNumber} modifiée avec succès`);
        return response.data;
    }
    catch (error) {
        console.error(`❌ Erreur modification ligne ${rowNumber}:`, error);
        throw error;
    }
}
async function handler(req, res) {
    // Ensure we always send JSON responses
    res.setHeader('Content-Type', 'application/json');
    try {
        // Log request details
        console.log('API Request:', {
            method: req.method,
            query: req.query,
            body: req.body
        });
        if (!config_1.SPREADSHEET_ID) {
            console.error('SPREADSHEET_ID is missing');
            return res.status(500).json({
                error: true,
                message: 'Configuration Error: Spreadsheet ID is not configured'
            });
        }
        switch (req.method) {
            case 'GET': {
                const range = req.query.range;
                if (!range) {
                    return res.status(400).json({
                        error: true,
                        message: 'Validation Error: Range parameter is required'
                    });
                }
                console.log('Fetching data:', {
                    range,
                    spreadsheetId: config_1.SPREADSHEET_ID,
                    hasSpreadsheetId: !!config_1.SPREADSHEET_ID
                });
                try {
                    console.log('Calling Google Sheets API...');
                    const response = await config_1.sheets.spreadsheets.values.get({
                        spreadsheetId: config_1.SPREADSHEET_ID,
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
                }
                catch (e) {
                    const error = e;
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
                const { range: writeRange, values, notaireId, mode } = req.body;
                // **NOUVEAU : Mode de modification spécifique par notaire**
                if (mode === 'update-single' && notaireId && values && values.length === 1) {
                    return new Promise((resolve) => {
                        const operation = async () => {
                            try {
                                console.log(`🎯 Mode modification spécifique pour notaire: ${notaireId}`);
                                // Trouver la ligne du notaire
                                const rowNumber = await findNotaireRow(notaireId);
                                if (!rowNumber) {
                                    resolve(res.status(404).json({
                                        error: true,
                                        message: `Notaire avec ID ${notaireId} non trouvé`
                                    }));
                                    return;
                                }
                                // Modifier seulement cette ligne
                                const result = await updateSpecificRow(rowNumber, values[0]);
                                resolve(res.status(200).json({
                                    error: false,
                                    data: result,
                                    rowNumber: rowNumber,
                                    message: `Ligne ${rowNumber} modifiée avec succès`
                                }));
                            }
                            catch (e) {
                                const error = e;
                                console.error('Erreur modification spécifique:', error);
                                resolve(res.status(500).json({
                                    error: true,
                                    message: `Erreur modification: ${error.message}`
                                }));
                            }
                        };
                        writeQueue.push(operation);
                        processWriteQueue();
                    });
                }
                // **MODE CLASSIQUE (DANGEREUX) - Seulement pour compatibilité**
                if (!writeRange || !values) {
                    return res.status(400).json({
                        error: true,
                        message: 'Validation Error: Range and values are required'
                    });
                }
                return new Promise((resolve) => {
                    const operation = async () => {
                        try {
                            console.log('⚠️ ATTENTION: Mode écriture globale (potentiellement dangereux)');
                            console.log('Writing data:', {
                                range: writeRange,
                                valueCount: values.length,
                                spreadsheetId: config_1.SPREADSHEET_ID,
                                firstRow: values[0],
                                lastRow: values[values.length - 1]
                            });
                            const writeResponse = await config_1.sheets.spreadsheets.values.update({
                                spreadsheetId: config_1.SPREADSHEET_ID,
                                range: writeRange,
                                valueInputOption: 'USER_ENTERED',
                                requestBody: { values },
                            });
                            console.log('Data written successfully:', safeStringify(writeResponse.data));
                            resolve(res.status(200).json({
                                error: false,
                                data: writeResponse.data
                            }));
                        }
                        catch (e) {
                            const error = e;
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
    }
    catch (error) {
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
exports.default = handler;
