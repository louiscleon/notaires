// Service pour la gestion des données des notaires
export interface Notaire {
  id: string;
  officeNotarial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  villeInteret: string;
  departement: string;
  serviceNego: string;
}

export const DataService = {
  // Placeholder pour futures fonctionnalités
  parseCSV: (csvText: string) => {
    // Fonction simple pour parser CSV
    return [];
  }
}; 