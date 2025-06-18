import { useState, useEffect, useMemo } from 'react';
import { Notaire, Filtres, NotaireStatut } from '../types';
import { notaireService } from '../services/notaireService';
import { storageService } from '../services/storage';

export const useNotaires = () => {
  const [notaires, setNotaires] = useState<Notaire[]>([]);
  const [filtres, setFiltres] = useState<Filtres>(storageService.getDefaultFiltres());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialiser le service notaire
        await notaireService.loadInitialData();
        
        // S'abonner aux changements
        const unsubscribe = notaireService.subscribe((updatedNotaires, updatedVillesInteret) => {
          setNotaires(updatedNotaires);
          setFiltres(prevFiltres => ({
            ...prevFiltres,
            villesInteret: updatedVillesInteret
          }));
        });

        // Charger les filtres (sauf les villes d'intérêt qui viennent du service)
        const savedData = storageService.loadData();
        setFiltres(prevFiltres => ({
          ...prevFiltres,
          ...savedData.filtres,
          villesInteret: notaireService.getVillesInteret()
        }));

        setLoading(false);
        return unsubscribe;
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setError('Une erreur est survenue lors du chargement des données. Veuillez réessayer.');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Sauvegarder les filtres à chaque modification
  useEffect(() => {
    storageService.saveFiltres(filtres);
  }, [filtres]);

  // Synchroniser périodiquement
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        await notaireService.syncWithGoogleSheets();
      } catch (error) {
        console.error('Erreur lors de la synchronisation automatique:', error);
      }
    }, 300000); // 5 minutes

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  const synchronize = async () => {
    try {
      setIsSyncing(true);
      await notaireService.syncWithGoogleSheets();
      return { success: true, message: 'Synchronisation réussie' };
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      return { success: false, message: 'Erreur lors de la synchronisation' };
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatutChange = async (notaire: Notaire, newStatut: NotaireStatut) => {
    try {
      const updatedNotaire = { ...notaire, statut: newStatut };
      await notaireService.updateNotaire(updatedNotaire);
      return { success: true, message: 'Statut mis à jour avec succès' };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      return { success: false, message: 'Erreur lors de la mise à jour du statut' };
    }
  };

  const handleNotaireUpdate = async (updatedNotaire: Notaire) => {
    try {
      // Mettre à jour l'état local immédiatement
      setNotaires(prevNotaires => {
        const index = prevNotaires.findIndex(n => n.id === updatedNotaire.id);
        if (index === -1) return prevNotaires;
        
        const newNotaires = [...prevNotaires];
        newNotaires[index] = updatedNotaire;
        return newNotaires;
      });

      // Synchroniser avec le service
      await notaireService.updateNotaire(updatedNotaire);
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du notaire:', error);
      
      // Restaurer l'état précédent en cas d'erreur
      setNotaires(prevNotaires => {
        const originalNotaire = prevNotaires.find(n => n.id === updatedNotaire.id);
        if (!originalNotaire) return prevNotaires;
        
        const index = prevNotaires.findIndex(n => n.id === updatedNotaire.id);
        if (index === -1) return prevNotaires;
        
        const newNotaires = [...prevNotaires];
        newNotaires[index] = originalNotaire;
        return newNotaires;
      });
      
      return { success: false, message: 'Erreur lors de la mise à jour du notaire' };
    }
  };

  const handleFiltresChange = (newFiltres: Filtres) => {
    setFiltres(newFiltres);
    storageService.saveFiltres(newFiltres);
  };

  const clearAllFilters = () => {
    const clearedFiltres: Filtres = {
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
      villesInteret: filtres.villesInteret,
    };
    setFiltres(clearedFiltres);
    setSearchQuery('');
    storageService.saveFiltres(clearedFiltres);
  };

  return {
    notaires,
    filtres,
    loading,
    error,
    isSyncing,
    searchQuery,
    setSearchQuery,
    synchronize,
    handleStatutChange,
    handleNotaireUpdate,
    handleFiltresChange,
    clearAllFilters
  };
}; 