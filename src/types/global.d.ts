interface GoogleAuthResponse {
  access_token?: string;
}

interface GoogleIdentityClient {
  requestAccessToken(): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleAuthResponse) => void;
  }): GoogleIdentityClient;
}

interface GoogleAccounts {
  oauth2: GoogleOAuth2;
}

interface Google {
  accounts: GoogleAccounts;
}

interface LoadConfig {
  callback: (value: void | PromiseLike<void>) => void;
  onerror: (reason?: any) => void;
  timeout: number;
  ontimeout: () => void;
}

declare global {
  interface Window {
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
    gapi: {
      load(api: string, callback: () => void): void;
      client: {
        init(config?: {
          apiKey?: string;
          discoveryDocs?: string[];
          headers?: {
            Authorization: string;
          };
        }): Promise<void>;
        setConfig(config: {
          headers: {
            Authorization: string;
          };
        }): void;
        load(api: string, version: string): Promise<void>;
        sheets: {
          spreadsheets: {
            values: {
              get(params: {
                spreadsheetId: string;
                range: string;
              }): Promise<{ result: { values: any[][] } }>;
              update(params: {
                spreadsheetId: string;
                range: string;
                valueInputOption: string;
                resource: { values: any[][] };
              }): Promise<{ status: number }>;
            };
          };
        };
      };
      auth2: {
        getAuthInstance(): {
          isSignedIn: {
            get(): boolean;
          };
          signIn(): Promise<void>;
        };
      };
    };
  }
} 