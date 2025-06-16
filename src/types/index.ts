// Types principaux pour l'application notaires
export type NotaireStatut = 'favori' | 'envisage' | 'non_interesse' | 'non_defini';

export type ContactStatut = 
  | 'non_contacte'
  | 'mail_envoye'
  | 'relance_envoyee'
  | 'reponse_recue'
  | 'cloture';

export interface Contact {
  date: string;
  type: 'initial' | 'relance';
  par: 'Fanny' | 'Jade';
  statut: ContactStatut;
  reponseRecue?: {
    date: string;
    positive: boolean;
    commentaire?: string;
  };
}

export interface GeocodingHistory {
  date: string;
  address: string;
  success: boolean;
  coordinates?: {
    lat: number;
    lon: number;
  };
}

export interface Notaire {
  id: string;
  officeNotarial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  departement: string;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  latitude?: number;
  longitude?: number;
  statut: NotaireStatut;
  contacts: Contact[];
  dateModification?: string;
  notes?: string;
  nbAssocies: number;
  nbSalaries: number;
  notairesAssocies?: string;
  notairesSalaries?: string;
  serviceNego: boolean;
  geoScore?: number;
  geoStatus?: 'pending' | 'success' | 'error';
  display_name?: string;
  geocodingHistory?: GeocodingHistory[];
}

export interface VilleInteret {
  id: string;
  nom: string;
  rayon: number;
  latitude: number;
  longitude: number;
  departement: string;
  population?: number;
}

export interface Filtres {
  villesInteret: VilleInteret[];
  typeNotaire: 'tous' | 'individuels' | 'groupes';
  serviceNego: 'tous' | 'oui' | 'non';
  showOnlyInRadius: boolean;
  minAssocies: number;
  maxAssocies: number;
  minSalaries: number;
  maxSalaries: number;
  statuts: NotaireStatut[];
  showOnlyWithEmail: boolean;
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
  error?: string;
  score?: number;
}

// Types pour les vues
export type ViewMode = 'carte' | 'liste';

// Types pour les statuts
export type StatutContact = 'non_contacte' | 'envoye' | 'repondu' | 'relance' | 'cloture';

export interface ContactInfo {
  statut: StatutContact;
  dateEnvoi?: Date;
  reponse?: boolean;
  reponsePositive?: boolean;
  dateRelance?: Date;
  reponseRelance?: boolean;
  notes?: string;
}

// Service pour la persistance des données
export interface StoredData {
  villesInteret: VilleInteret[];
  filtres: Filtres;
}

export interface AdresseSuggestion {
  label: string;
  score: number;
  housenumber?: string;
  street?: string;
  postcode: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
} 