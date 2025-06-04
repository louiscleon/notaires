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
}

export interface VilleInteret {
  id: string;
  nom: string;
  rayon: number; // en km
  latitude?: number;
  longitude?: number;
  couleur?: string;
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