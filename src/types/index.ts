// Types principaux pour l'application notaires
export type NotaireStatut = 'favori' | 'envisage' | 'non_interesse' | 'non_defini';

export type ContactStatut = 
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
  departement: string;
  nom: string;
  prenom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  statut: NotaireStatut;
  notes: string;
  latitude: number;
  longitude: number;
  nbAssocies: number;
  nbSalaries: number;
  contacts: Contact[];
  dateModification?: string;
  geocodingHistory?: GeocodingHistory[];
  serviceNego: boolean;
  notairesAssocies: string;
  notairesSalaries: string;
  geoScore?: number;
  geoStatus?: 'pending' | 'success' | 'error';
  needsGeocoding?: boolean; // Garde temporairement pour le géocodage
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
  contactStatuts: ContactStatut[];
  showNonContactes: boolean; // Séparé des statuts de contact
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