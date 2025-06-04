import { Notaire, VilleInteret, NotaireStatut } from '../types';
import { signInWithGoogle, handleRedirectResult, auth } from './firebaseConfig';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';

// Variables d'environnement avec valeurs par défaut pour le développement
if (process.env.NODE_ENV === 'development') {
  console.log('Variables d\'environnement configurées');
}

const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID || '16b_CqogHI5-L-nHQ4gGI0e8vS8kp9xhGJQnyxQLXgVQ';
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY || '';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const REDIRECT_URI = window.location.origin;

const HEADERS = [
  'ID',
  'Office Notarial',
  'Adresse',
  'Code Postal',
  'Ville',
  'Département',
  'Email',
  'Notaires Associés',
  'Notaires Salariés',
  'Nb Associés',
  'Nb Salariés',
  'Service Négociation',
  'Statut',
  'Notes',
  'Contacts',
  'Date Modification',
  'Latitude',
  'Longitude',
  'Score Géocodage',
  'Historique Géocodage'
];

const VILLES_INTERET_HEADERS = [
  'ID',
  'Nom',
  'Rayon',
  'Latitude',
  'Longitude',
  'Département',
  'Population'
];

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface Sheet {
  properties: {
    title: string;
    gridProperties?: {
      rowCount: number;
      columnCount: number;
    };
  };
}

interface SpreadsheetsGetResponse {
  result: {
    sheets: Sheet[];
  };
}

interface TokenClient {
  requestAccessToken(options?: { 
    prompt?: string;
  }): void;
}

// Types essentiels uniquement
interface SheetData {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
}

let loadingCallback: ((loading: boolean) => void) | null = null;

export const setLoadingCallback = (callback: (loading: boolean) => void) => {
  loadingCallback = callback;
};

export const googleSheetsService = {
  isConfigured: false,
  gapiLoaded: false,
  tokenClient: null as TokenClient | null,
  accessToken: null as string | null,
  authInProgress: false,
  authPromise: null as Promise<void> | null,
  saveInProgress: false,
  cachedData: new Map<string, Notaire>(),
  authRetryCount: 0,
  MAX_AUTH_RETRIES: 3,
  AUTH_TIMEOUT: 60000, // 60 secondes
  redirectInProgress: false,

  checkConfiguration() {
    if (!SPREADSHEET_ID || !CLIENT_ID || !API_KEY) {
      console.error('❌ Configuration Google Sheets incomplète');
      return false;
    }
    return true;
  },

  loadGapiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.gapiLoaded) {
        resolve();
        return;
      }

      console.log('Chargement des scripts Google...');
      
      // Load the GIS script first
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.async = true;
      gisScript.defer = true;
      
      // Then load the GAPI script
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.async = true;
      gapiScript.defer = true;
      
      gisScript.onload = () => {
        gapiScript.onload = () => {
          window.gapi.load('client', async () => {
            try {
              await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
              });
              console.log('Scripts Google chargés et initialisés avec succès');
              this.gapiLoaded = true;
              resolve();
            } catch (error) {
              console.error('Erreur lors du chargement des scripts Google:', error);
              reject(error);
            }
          });
        };

        gapiScript.onerror = (error) => {
          console.error('Erreur lors du chargement du script GAPI:', error);
          reject(new Error('Impossible de charger le script Google API'));
        };

        document.body.appendChild(gapiScript);
      };

      gisScript.onerror = (error) => {
        console.error('Erreur lors du chargement du script GIS:', error);
        reject(new Error('Impossible de charger le script Google Identity Services'));
      };

      document.body.appendChild(gisScript);
    });
  },

  saveTokenToLocalStorage(token: string) {
    try {
      localStorage.setItem('googleAccessToken', token);
      localStorage.setItem('tokenTimestamp', Date.now().toString());
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du token:', error);
    }
  },

  getTokenFromLocalStorage(): string | null {
    try {
      const token = localStorage.getItem('googleAccessToken');
      const timestamp = localStorage.getItem('tokenTimestamp');
      
      if (!token || !timestamp) {
        return null;
      }

      // Vérifier si le token a moins d'une heure
      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge > 3600000) { // 1 heure en millisecondes
        this.clearTokens();
        return null;
      }

      return token;
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  },

  clearTokens() {
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('tokenTimestamp');
    this.accessToken = null;
  },

  handleRedirectCallback() {
    // Vérifier si nous revenons d'une redirection OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      this.redirectInProgress = true;
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    return false;
  },

  async initAuth() {
    if (loadingCallback) loadingCallback(true);
    console.log('Démarrage de l\'authentification...');

    try {
      if (!this.checkConfiguration()) {
        throw new Error('Configuration Google Sheets incomplète');
      }

      await this.loadGapiScript();
      console.log('Scripts Google chargés');

      const authResult = await getRedirectResult(auth);
      if (authResult?.user) {
        console.log('Utilisateur authentifié après redirection');
        const credential = GoogleAuthProvider.credentialFromResult(authResult);
        if (credential?.accessToken) {
          this.accessToken = credential.accessToken;
          this.saveTokenToLocalStorage(credential.accessToken);
          if (loadingCallback) loadingCallback(false);
          return;
        }
      }

      // Si pas de résultat de redirection, vérifier le token stocké
      const storedToken = this.getTokenFromLocalStorage();
      if (storedToken) {
        console.log('Token stocké trouvé');
        this.accessToken = storedToken;
        if (loadingCallback) loadingCallback(false);
        return;
      }

      // Si pas de token stocké, démarrer l'authentification
      console.log('Démarrage de l\'authentification Google...');
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      await signInWithRedirect(auth, provider);
      
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      if (loadingCallback) loadingCallback(false);
      throw error;
    }
  },

  async ensureAuth() {
    try {
      if (!this.gapiLoaded || !this.accessToken) {
        await this.initAuth();
        return;
      }

      // Test the current token
      try {
        await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A1'
        });
      } catch (error) {
        console.log('Token invalide ou expiré, renouvellement...');
        this.clearTokens();
        await this.initAuth();
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'authentification:', error);
      throw error;
    }
  },

  async loadFromSheet(): Promise<SheetData> {
    if (!this.checkConfiguration()) {
      return { notaires: [], villesInteret: [] };
    }

    try {
      await this.ensureAuth();
      await this.ensureVillesInteretSheet();

      // Charger les notaires
      const notairesResponse = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Notaires!A2:T',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      // Charger les villes d'intérêt
      const villesResponse = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'VillesInteret!A2:G',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const notairesRows = notairesResponse.result.values || [];
      const villesRows = villesResponse.result.values || [];
      
      // Vérifier les lignes vides ou invalides
      const lignesInvalides = notairesRows.map((row, index) => {
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
          return {
            ligne: index + 2,
            erreur: 'Ligne vide',
            valide: false
          };
        }

        const validation = {
          ligne: index + 2,
          erreurs: [] as string[]
        };

        // Validation détaillée
        row.slice(0, 5).forEach((val, idx) => {
          const colName = ['ID', 'Office', 'Adresse', 'Code Postal', 'Ville'][idx];
          const valStr = String(val || '').trim();

          // Tous les champs sont obligatoires sauf l'adresse (idx === 2)
          if (idx !== 2) { // Tout sauf l'adresse
            if (!valStr) {
              validation.erreurs.push(`${colName} manquant`);
            }
            // Validation spécifique pour le code postal
            if (idx === 3 && !/^\d{5}$/.test(valStr)) {
              validation.erreurs.push(`Code postal invalide: "${valStr}"`);
            }
          }
        });

        return {
          ...validation,
          valide: validation.erreurs.length === 0
        };
      }).filter(ligne => !ligne.valide);

      if (lignesInvalides.length > 0) {
        console.warn(`⚠️ ${lignesInvalides.length}/${notairesRows.length} lignes invalides`);
        const erreurParType = lignesInvalides.reduce((acc, ligne) => {
          if ('erreurs' in ligne) {
            ligne.erreurs.forEach(erreur => {
              const typeErreur = erreur.split(':')[0];
              acc[typeErreur] = (acc[typeErreur] || 0) + 1;
            });
          }
          return acc;
        }, {} as Record<string, number>);
        console.table(erreurParType);
      }

      // Filtrer les lignes valides
      const lignesValides = notairesRows.filter((row) => {
        return row && 
               row[0]?.trim() && 
               row[1]?.trim() && 
               row[3]?.trim() && 
               row[4]?.trim() &&
               /^\d{5}$/.test(row[3].trim());
      });

      const notaires = this.parseNotairesFromRows(lignesValides);

      // Parser les villes d'intérêt
      const villesInteret = villesRows.map(row => ({
        id: row[0] || `ville_${Date.now()}`,
        nom: row[1],
        rayon: parseFloat(row[2]) || 0,
        latitude: parseFloat(row[3]),
        longitude: parseFloat(row[4]),
        departement: row[5],
        population: row[6] ? parseInt(row[6]) : undefined
      })).filter(ville => 
        ville.nom && 
        !isNaN(ville.latitude) && 
        !isNaN(ville.longitude) && 
        ville.rayon > 0
      );

      return {
        notaires,
        villesInteret
      };

    } catch (error) {
      console.error('❌ Erreur lors du chargement:', error);
      throw error;
    }
  },

  async saveToSheet(notaires: Notaire[]) {
    if (this.saveInProgress) {
      console.log('Sauvegarde déjà en cours, ignorée');
      return;
    }

    if (!this.checkConfiguration()) {
      console.warn('Sauvegarde impossible : configuration Google Sheets manquante');
      return;
    }

    this.saveInProgress = true;
    let currentSheetData: Notaire[] = [];

    try {
      console.log('Début de la sauvegarde dans Google Sheets...');
      
      // TOUJOURS charger les données existantes avant de sauvegarder
      try {
        const response = await this.loadFromSheet();
        currentSheetData = response.notaires;
        console.log(`${currentSheetData.length} notaires trouvés dans Google Sheets`);
      } catch (error) {
        console.error('ERREUR CRITIQUE: Impossible de charger les données existantes, sauvegarde annulée', error);
        return; // On ne sauvegarde PAS si on ne peut pas charger les données existantes
      }

      // Créer une Map des données existantes pour référence rapide
      const existingDataMap = new Map(currentSheetData.map(n => [n.id, n]));

      // Préparer les données à sauvegarder en préservant les coordonnées existantes
      const notairesAMettreAJour = notaires.map(notaire => {
        const existing = existingDataMap.get(notaire.id);
        
        // Si le notaire existe avec des coordonnées et que l'adresse n'a pas changé
        if (existing?.latitude && existing?.longitude) {
          if (existing.adresse === notaire.adresse &&
              existing.codePostal === notaire.codePostal &&
              existing.ville === notaire.ville) {
            console.log(`Préservation des coordonnées pour ${notaire.officeNotarial}`);
            return {
              ...notaire,
              latitude: existing.latitude,
              longitude: existing.longitude,
              display_name: existing.display_name,
              geoStatus: existing.geoStatus,
              geoScore: existing.geoScore,
              geocodingHistory: existing.geocodingHistory
            };
          } else {
            console.log(`Adresse modifiée pour ${notaire.officeNotarial}, nouvelles coordonnées conservées`);
          }
        }
        return notaire;
      });

      // Vérification finale avant sauvegarde
      const notairesGeocodes = notairesAMettreAJour.filter(n => n.latitude && n.longitude);
      console.log(`Préparation de la sauvegarde : ${notairesGeocodes.length} notaires avec coordonnées`);
      
      if (notairesGeocodes.length < currentSheetData.filter(n => n.latitude && n.longitude).length) {
        console.error('ALERTE : La nouvelle sauvegarde contient moins de notaires géocodés que les données existantes !');
        console.error('Sauvegarde annulée par sécurité.');
        return;
      }

      // Log détaillé des modifications
      notairesAMettreAJour.forEach(notaire => {
        const existing = existingDataMap.get(notaire.id);
        if (existing) {
          if (notaire.latitude !== existing.latitude || notaire.longitude !== existing.longitude) {
            console.log(`Modification des coordonnées pour ${notaire.officeNotarial}:`, {
              avant: existing.latitude && existing.longitude ? `${existing.latitude},${existing.longitude}` : 'pas de coordonnées',
              après: notaire.latitude && notaire.longitude ? `${notaire.latitude},${notaire.longitude}` : 'pas de coordonnées'
            });
          }
        }
      });

      const values = [
        HEADERS,
        ...notairesAMettreAJour.map(notaire => [
          notaire.id,
          notaire.officeNotarial,
          notaire.adresse,
          notaire.codePostal,
          notaire.ville,
          notaire.departement,
          notaire.email,
          notaire.notairesAssocies,
          notaire.notairesSalaries,
          notaire.nbAssocies,
          notaire.nbSalaries,
          notaire.serviceNego ? 'oui' : 'non',
          notaire.statut,
          notaire.notes || '',
          JSON.stringify(notaire.contacts),
          notaire.dateModification || '',
          notaire.latitude ? notaire.latitude.toString() : '',
          notaire.longitude ? notaire.longitude.toString() : '',
          notaire.geoScore ? notaire.geoScore.toString() : '',
          JSON.stringify(notaire.geocodingHistory || [])
        ])
      ];

      console.log('Envoi des données vers Google Sheets...', {
        nombreLignes: values.length,
        range: `Notaires!A1:T${values.length}`
      });

      try {
        const response = await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Notaires!A1:T${values.length}`,
          valueInputOption: 'RAW',
          resource: { values }
        });

        if (response.status !== 200) {
          throw new Error(`Erreur lors de la sauvegarde dans Google Sheets: status ${response.status}`);
        }

        console.log('Sauvegarde réussie dans Google Sheets', {
          status: response.status,
          result: response.result
        });
        localStorage.setItem('lastSync', new Date().toISOString());
      } catch (error) {
        console.error('Erreur lors de l\'appel API Google Sheets:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error;
    } finally {
      this.saveInProgress = false;
    }
  },

  async ensureVillesInteretSheet() {
    try {
      await this.ensureAuth();

      // Vérifier si l'onglet existe déjà
      const response = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      }) as SpreadsheetsGetResponse;

      const sheets = response.result.sheets || [];
      const villesInteretSheet = sheets.find((sheet: Sheet) => 
        sheet.properties?.title === 'VillesInteret'
      );

      if (!villesInteretSheet) {
        console.log('Création de l\'onglet VillesInteret...');
        await (window.gapi.client as any).sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'VillesInteret',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 7
                    }
                  }
                }
              }
            ]
          }
        });

        // Ajouter les en-têtes
        await (window.gapi.client as any).sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: 'VillesInteret!A1:G1',
          valueInputOption: 'RAW',
          resource: {
            values: [VILLES_INTERET_HEADERS]
          }
        });
      }
    } catch (error) {
      console.error('Erreur lors de la création de l\'onglet VillesInteret:', error);
      throw error;
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<VilleInteret[]> {
    if (!this.checkConfiguration()) {
      console.warn('Sauvegarde impossible : configuration Google Sheets manquante');
      return villesInteret;
    }

    try {
      await this.ensureAuth();
      await this.ensureVillesInteretSheet();

      // Vérifier et corriger les IDs dupliqués
      const seenIds = new Set<string>();
      const villesCorrigees: VilleInteret[] = [];

      for (const ville of villesInteret) {
        // On ne garde que les villes avec des coordonnées valides
        if (!ville.latitude || !ville.longitude) {
          console.warn(`Ville ignorée car coordonnées manquantes: ${ville.nom}`);
          continue;
        }

        const newVille: VilleInteret = {
          ...ville,
          id: seenIds.has(ville.id)
            ? `ville_${ville.nom.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${ville.departement || 'unknown'}`
            : ville.id
        };

        if (seenIds.has(ville.id)) {
          console.warn(`ID dupliqué détecté pour ${ville.nom}, nouvel ID généré: ${newVille.id}`);
        }

        seenIds.add(newVille.id);
        villesCorrigees.push(newVille);
      }

      const values = [
        VILLES_INTERET_HEADERS,
        ...villesCorrigees.map(ville => [
          ville.id,
          ville.nom,
          ville.rayon,
          ville.latitude.toString(),
          ville.longitude.toString(),
          ville.departement || '',
          ville.population?.toString() || ''
        ])
      ];

      const response = await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `VillesInteret!A1:G${values.length}`,
        valueInputOption: 'RAW',
        resource: { values }
      });

      if (response.status !== 200) {
        throw new Error('Erreur lors de la sauvegarde des villes d\'intérêt');
      }

      console.log('Villes d\'intérêt sauvegardées avec succès');
      return villesCorrigees;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des villes d\'intérêt:', error);
      throw error;
    }
  },

  // Helper function to parse notaires from rows
  parseNotairesFromRows(rows: any[]): Notaire[] {
    const baseTimestamp = Date.now();
    
    // Map pour détecter les doublons basés sur l'office et l'adresse
    const uniqueOffices = new Map<string, Notaire>();
    const duplicates = new Set<string>();

    // Fonction pour créer une clé unique pour chaque office
    const createOfficeKey = (office: string, adresse: string, codePostal: string, ville: string) => {
      return `${office.toLowerCase().trim()}_${adresse.toLowerCase().trim()}_${codePostal.trim()}_${ville.toLowerCase().trim()}`;
    };

    // Helper pour parser les coordonnées avec précision
    const parseCoordinate = (value: string): number | undefined => {
      if (!value || value.trim() === '') return undefined;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed;
    };

    // Première passe : créer tous les notaires et détecter les doublons
    const notaires = rows.map((row: string[], index: number) => {
      const id = row[0] || `${baseTimestamp + index}`;
      return {
        id,
        officeNotarial: row[1],
        adresse: row[2],
        codePostal: row[3],
        ville: row[4],
        departement: row[5],
        email: row[6],
        notairesAssocies: row[7],
        notairesSalaries: row[8],
        nbAssocies: parseInt(row[9]) || 0,
        nbSalaries: parseInt(row[10]) || 0,
        serviceNego: row[11] === 'oui',
        statut: row[12] as NotaireStatut,
        notes: row[13],
        contacts: JSON.parse(row[14] || '[]'),
        dateModification: row[15],
        latitude: parseCoordinate(row[16]),
        longitude: parseCoordinate(row[17]),
        geoScore: parseCoordinate(row[18]),
        geocodingHistory: JSON.parse(row[19] || '[]')
      };
    });

    // Deuxième passe : identifier et fusionner les doublons
    notaires.forEach(notaire => {
      const key = createOfficeKey(notaire.officeNotarial, notaire.adresse, notaire.codePostal, notaire.ville);
      
      if (uniqueOffices.has(key)) {
        duplicates.add(key);
        const existing = uniqueOffices.get(key)!;
        
        // Si le doublon a des coordonnées plus précises, on les garde
        if (notaire.latitude && notaire.longitude && 
            (!existing.latitude || !existing.longitude || 
             (notaire.geoScore && existing.geoScore && notaire.geoScore > existing.geoScore))) {
          uniqueOffices.set(key, notaire);
        }
        
        console.log(`Doublon détecté:`, {
          key,
          office: notaire.officeNotarial,
          adresse: notaire.adresse,
          existingId: existing.id,
          newId: notaire.id,
          action: uniqueOffices.get(key)!.id === notaire.id ? 'Remplacé' : 'Conservé l\'existant'
        });
      } else {
        uniqueOffices.set(key, notaire);
      }
    });

    console.log(`Analyse des doublons:`, {
      total: notaires.length,
      uniques: uniqueOffices.size,
      doublons: duplicates.size
    });

    return Array.from(uniqueOffices.values());
  },

  async synchronize(localNotaires: Notaire[]): Promise<Notaire[]> {
    if (!this.checkConfiguration()) {
      console.warn('Synchronisation impossible : configuration Google Sheets manquante');
      return localNotaires;
    }

    try {
      await this.saveToSheet(localNotaires);
      return localNotaires;
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      throw error;
    }
  },

  async cleanupGoogleSheet(): Promise<void> {
    try {
      console.log('Début du nettoyage de Google Sheets...');
      
      // Charger toutes les données
      const response = await this.loadFromSheet();
      const notaires = response.notaires;
      
      // Utiliser une Map pour garder uniquement la dernière occurrence de chaque notaire
      const uniqueNotaires = new Map();
      notaires.forEach(notaire => {
        // Si le notaire existe déjà, ne le remplacer que s'il a des coordonnées
        const existing = uniqueNotaires.get(notaire.id);
        if (!existing || (notaire.latitude && notaire.longitude)) {
          uniqueNotaires.set(notaire.id, notaire);
        }
      });

      const cleanedNotaires = Array.from(uniqueNotaires.values());
      console.log(`Nettoyage : ${notaires.length} -> ${cleanedNotaires.length} notaires`);

      // Sauvegarder les données nettoyées
      await this.saveToSheet(cleanedNotaires);
      console.log('Nettoyage de Google Sheets terminé avec succès');

    } catch (error) {
      console.error('Erreur lors du nettoyage de Google Sheets:', error);
      throw error;
    }
  },

  async deepCleanSheet(): Promise<void> {
    try {
      console.log('Début du nettoyage profond de Google Sheets...');
      
      // 1. Charger toutes les données
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Notaires!A2:T'
      });

      const rows = response.result.values || [];
      console.log(`${rows.length} lignes trouvées dans Google Sheets`);

      // 2. Analyser les données brutes
      const idFrequency = new Map<string, number>();
      const idToOffices = new Map<string, Set<string>>();
      const idToRows = new Map<string, any[][]>();

      rows.forEach((row, index) => {
        const id = row[0];
        const officeNotarial = row[1];
        const coords = [row[16], row[17]];
        
        if (!id) {
          console.error(`ERREUR: Ligne ${index + 2} - ID manquant pour l'office "${officeNotarial}"`);
          return;
        }

        // Compter la fréquence des IDs
        idFrequency.set(id, (idFrequency.get(id) || 0) + 1);

        // Enregistrer les différents noms d'offices pour chaque ID
        if (!idToOffices.has(id)) {
          idToOffices.set(id, new Set());
          idToRows.set(id, []);
        }
        idToOffices.get(id)?.add(officeNotarial);
        idToRows.get(id)?.push(row);

        // Log détaillé pour chaque ligne
        console.log(`Ligne ${index + 2}:`, {
          id,
          office: officeNotarial,
          coords: coords.join(', '),
          hasCoords: coords[0] && coords[1] && coords[0].trim() !== '' && coords[1].trim() !== ''
        });
      });

      // 3. Analyser les doublons
      console.log('\nAnalyse des doublons:');
      idFrequency.forEach((count, id) => {
        if (count > 1) {
          const offices = Array.from(idToOffices.get(id) || []);
          const rows = idToRows.get(id) || [];
          console.log(`\nID ${id} apparaît ${count} fois:`);
          console.log('Offices:', offices);
          rows.forEach((row, idx) => {
            console.log(`Version ${idx + 1}:`, {
              office: row[1],
              adresse: row[2],
              coords: [row[16], row[17]].join(', '),
              dateModif: row[15]
            });
          });
        }
      });

      // 4. Créer une Map pour les notaires uniques
      const uniqueNotairesMap = new Map();
      const duplicates = new Set();

      rows.forEach((row, index) => {
        const id = row[0];
        const officeNotarial = row[1];
        
        if (!id) return;

        if (uniqueNotairesMap.has(id)) {
          console.log(`Doublon trouvé - ID ${id}:`, {
            existant: {
              office: uniqueNotairesMap.get(id)[1],
              coords: [uniqueNotairesMap.get(id)[16], uniqueNotairesMap.get(id)[17]].join(', ')
            },
            nouveau: {
              office: officeNotarial,
              coords: [row[16], row[17]].join(', ')
            }
          });
          duplicates.add(id);
        } else {
          uniqueNotairesMap.set(id, row);
        }
      });

      // 5. Traiter les doublons
      duplicates.forEach(id => {
        const duplicateRows = rows.filter(row => row[0] === id);
        console.log(`\nRésolution du doublon ID ${id}:`);
        
        duplicateRows.forEach((row, idx) => {
          console.log(`Version ${idx + 1}:`, {
            office: row[1],
            coords: [row[16], row[17]].join(', '),
            dateModif: row[15]
          });
        });

        const bestRow = duplicateRows.reduce((best: any[] | null, current: any[]) => {
          const hasCoords = (row: any[]) => row[16] && row[17] && row[16].trim() !== '' && row[17].trim() !== '';
          if (!best || (hasCoords(current) && !hasCoords(best))) {
            return current;
          }
          return best;
        }, null);

        if (bestRow) {
          console.log('Version choisie:', {
            office: bestRow[1],
            coords: [bestRow[16], bestRow[17]].join(', ')
          });
          uniqueNotairesMap.set(id, bestRow);
        }
      });

      // 6. Sauvegarder les données nettoyées
      const cleanedRows = Array.from(uniqueNotairesMap.values());
      console.log(`\nRésumé final:`);
      console.log(`- Lignes initiales: ${rows.length}`);
      console.log(`- IDs uniques: ${uniqueNotairesMap.size}`);
      console.log(`- Doublons trouvés: ${duplicates.size}`);
      console.log(`- Lignes après nettoyage: ${cleanedRows.length}`);

      const values = [
        HEADERS,
        ...cleanedRows
      ];

      console.log('\nSauvegarde des données nettoyées...');
      const updateResponse = await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Notaires!A1:T${values.length}`,
        valueInputOption: 'RAW',
        resource: { values }
      });

      if (updateResponse.status !== 200) {
        throw new Error('Erreur lors de la sauvegarde des données nettoyées');
      }

      console.log('Nettoyage profond terminé avec succès');

    } catch (error) {
      console.error('Erreur lors du nettoyage profond:', error);
      throw error;
    }
  },
};