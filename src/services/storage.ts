import { Filtres, NotaireStatut, ContactStatut } from '../types';

const FILTRES_KEY = 'notaires-filtres';

interface StorageData {
  filtres: Filtres;
}

const getDefaultFiltres = (): Filtres => ({
  typeNotaire: 'tous',
  serviceNego: 'tous',
  minAssocies: 0,
  maxAssocies: 10,
  minSalaries: 0,
  maxSalaries: 100,
  statuts: [] as NotaireStatut[],
  villesInteret: [],
  showOnlyInRadius: false,
  showOnlyWithEmail: false,
  contactStatuts: [] as ContactStatut[]
});

const loadData = (): StorageData => {
  try {
    const savedFiltres = localStorage.getItem(FILTRES_KEY);
    return {
      filtres: savedFiltres ? JSON.parse(savedFiltres) : getDefaultFiltres()
    };
  } catch (error) {
    console.error('Erreur lors du chargement des données du stockage local:', error);
    return {
      filtres: getDefaultFiltres()
    };
  }
};

const saveFiltres = (filtres: Filtres): void => {
  try {
    localStorage.setItem(FILTRES_KEY, JSON.stringify(filtres));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des filtres:', error);
  }
};

export const storageService = {
  loadData,
  saveFiltres,
  getDefaultFiltres
}; 