export interface Contact {
  nom: string;
  fonction: string;
  telephone?: string;
  email?: string;
  dateContact: string;
  notes?: string;
}

export interface VilleInteret {
  id: string;
  nom: string;
  departement?: string;
  priorite: 'haute' | 'moyenne' | 'basse';
  notes?: string;
}

export interface Notaire {
  id: string;
  officeNotarial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  villeDinteret: string;
  departement: string;
  mail: string;
  notairesAssocies: string;
  notairesSalaries: string;
  nbAssocies: number;
  nbSalaries: number;
  serviceNego: string;
  
  // Champs ajoutés par l'utilisateur
  email?: string;
  adressePrecise?: string;
  datePremierContact?: string;
  reponseRecue?: boolean;
  dateRelance?: string;
  reponseRelance?: boolean;
  
  // Données de géolocalisation
  latitude?: number;
  longitude?: number;
  geoStatus?: 'pending' | 'success' | 'error';
  
  // Nouvelles propriétés
  telephone?: string;
  siteWeb?: string;
  statut: 'prospect' | 'contacte' | 'negocie' | 'signe' | 'abandonne' | 'non_defini';
  
  // Historique des contacts
  contacts?: Contact[];
  notes?: string;
  dateCreation?: string;
  dateModification?: string;
}

export interface Filtres {
  notairesIndividuels: boolean | null;
  nbSalariesMin: number;
  nbSalariesMax: number;
  serviceNego: boolean | null;
  villesInteret: VilleInteret[];
  showOnlyInRadius: boolean;
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
}

export interface NotaireFilters {
  searchTerm: string;
  statut: string[];
  ville: string;
  hasEmail: boolean | null;
  hasContacts: boolean | null;
  hasCoordinates: boolean | null;
  sortBy: 'officeNotarial' | 'ville' | 'statut' | 'dateModification';
  sortOrder: 'asc' | 'desc';
} 