/// <reference types="gapi" />
/// <reference types="gapi.client.sheets" />

declare interface Window {
  gapi: typeof gapi;
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