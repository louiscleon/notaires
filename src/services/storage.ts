import { Filtres, NotaireStatut, ContactStatut, VilleInteret } from '../types';

const STORAGE_KEY = 'notaires_app_data';
const VERSION = '1.1.0';

interface StorageData {
  version: string;
  filtres: Filtres;
  lastSync?: string;
}

const defaultFiltres: Filtres = {
  typeNotaire: 'tous',
  serviceNego: 'tous',
  minAssocies: 0,
  maxAssocies: 10,
  minSalaries: 0,
  maxSalaries: 10,
  statuts: [],
  showOnlyWithEmail: false,
  contactStatuts: [],
  showNonContactes: false,
  showOnlyInRadius: false,
  villesInteret: [],
};

function isValidVilleInteret(ville: any): ville is VilleInteret {
  return (
    typeof ville === 'object' &&
    ville !== null &&
    typeof ville.id === 'string' &&
    typeof ville.nom === 'string' &&
    typeof ville.rayon === 'number' &&
    typeof ville.latitude === 'number' &&
    typeof ville.longitude === 'number' &&
    typeof ville.departement === 'string'
  );
}

function isValidFiltres(filtres: any): filtres is Filtres {
  if (typeof filtres !== 'object' || filtres === null) {
    return false;
  }

  // Vérifier les types de base
  if (
    typeof filtres.typeNotaire !== 'string' ||
    typeof filtres.serviceNego !== 'string' ||
    typeof filtres.minAssocies !== 'number' ||
    typeof filtres.maxAssocies !== 'number' ||
    typeof filtres.minSalaries !== 'number' ||
    typeof filtres.maxSalaries !== 'number' ||
    typeof filtres.showOnlyWithEmail !== 'boolean' ||
    typeof filtres.showOnlyInRadius !== 'boolean' ||
    !Array.isArray(filtres.statuts) ||
    !Array.isArray(filtres.contactStatuts) ||
    !Array.isArray(filtres.villesInteret)
  ) {
    return false;
  }

  // Vérifier les valeurs des villes d'intérêt
  if (!filtres.villesInteret.every(isValidVilleInteret)) {
    return false;
  }

  return true;
}

function loadData(): StorageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        version: VERSION,
        filtres: defaultFiltres
      };
    }

    const data = JSON.parse(stored);

    // Si la version stockée est différente, réinitialiser
    if (data.version !== VERSION) {
      console.log('Version des données stockées différente, réinitialisation...');
      return {
        version: VERSION,
        filtres: defaultFiltres
      };
    }

    // Valider les filtres et merger avec les defaults pour les nouveaux champs
    const mergedFiltres = {
      ...defaultFiltres,
      ...data.filtres
    };

    if (!isValidFiltres(mergedFiltres)) {
      console.warn('Données de filtres invalides, réinitialisation...');
      return {
        version: VERSION,
        filtres: defaultFiltres
      };
    }

    return {
      version: VERSION,
      filtres: mergedFiltres,
      lastSync: data.lastSync
    };
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    return {
      version: VERSION,
      filtres: defaultFiltres
    };
  }
}

function saveFiltres(filtres: Filtres): void {
  try {
    // Valider les filtres avant la sauvegarde
    if (!isValidFiltres(filtres)) {
      console.error('Tentative de sauvegarde de filtres invalides');
      return;
    }

    const dataToSave: StorageData = {
      version: VERSION,
      filtres: {
        ...defaultFiltres,
        ...filtres
      },
      lastSync: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des filtres:', error);
  }
}

function getDefaultFiltres(): Filtres {
  return { ...defaultFiltres };
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Erreur lors de la suppression des données:', error);
  }
}

export const storageService = {
  loadData,
  saveFiltres,
  getDefaultFiltres,
  clearStorage
}; 