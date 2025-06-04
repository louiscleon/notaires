declare namespace gapi.client.sheets {
  interface Spreadsheet {
    spreadsheetId: string;
    properties: {
      title: string;
    };
    sheets: Sheet[];
  }

  interface Sheet {
    properties: {
      sheetId: number;
      title: string;
      index: number;
      gridProperties: {
        rowCount: number;
        columnCount: number;
      };
    };
  }

  interface ValueRange {
    range: string;
    majorDimension?: string;
    values: any[][];
  }

  interface UpdateValuesResponse {
    spreadsheetId: string;
    updatedRange: string;
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  }

  interface BatchUpdateSpreadsheetRequest {
    requests: object[];
  }

  interface BatchUpdateSpreadsheetResponse {
    spreadsheetId: string;
    replies: object[];
  }
}

declare global {
  interface Window {
    gapi: {
      load(api: string, callback: () => void): void;
      client: {
        init(config?: Record<string, unknown>): Promise<void>;
        load(api: string, version: string): Promise<void>;
        sheets: {
          spreadsheets: {
            values: {
              get(params: { spreadsheetId: string; range: string }): Promise<{ result: gapi.client.sheets.ValueRange }>;
              update(params: {
                spreadsheetId: string;
                range: string;
                valueInputOption: string;
                resource: { values: any[][] };
              }): Promise<{ result: gapi.client.sheets.UpdateValuesResponse }>;
            };
            get(params: { spreadsheetId: string }): Promise<{ result: gapi.client.sheets.Spreadsheet }>;
            batchUpdate(params: {
              spreadsheetId: string;
              resource: gapi.client.sheets.BatchUpdateSpreadsheetRequest;
            }): Promise<{ result: gapi.client.sheets.BatchUpdateSpreadsheetResponse }>;
          };
        };
      };
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string }) => void;
          }): {
            requestAccessToken(options?: { prompt?: string }): void;
          };
        };
      };
    };
  }
} 