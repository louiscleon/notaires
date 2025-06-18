import { useState, useEffect } from 'react';
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

  // **CHARGEMENT INITIAL SIMPLIFIE**
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🚀 Initialisation du hook useNotaires...');
        setLoading(true);
        setError(null);

        // **S'ABONNER AUX CHANGEMENTS AVANT LE CHARGEMENT**
        const unsubscribe = notaireService.subscribe((updatedNotaires, updatedVillesInteret) => {
          console.log(`📊 Réception de ${updatedNotaires.length} notaires dans le hook`);
          setNotaires(updatedNotaires);
          setFiltres(prevFiltres => ({
            ...prevFiltres,
            villesInteret: updatedVillesInteret
          }));
          
          // **ARRETER LE LOADING QUAND ON REÇOIT LES DONNEES**
          if (updatedNotaires.length > 0) {
            setLoading(false);
            console.log('✅ Données reçues, loading terminé');
          }
        });

        // **CHARGER LES FILTRES SAUVEGARDÉS**
        const savedData = storageService.loadData();
        setFiltres(prevFiltres => ({
          ...prevFiltres,
          ...savedData.filtres,
          // Les villes d'intérêt viendront du service via l'abonnement
        }));

        // **INITIALISER LE SERVICE**
        await notaireService.loadInitialData();

        return unsubscribe;
      } catch (error) {
        console.error('❌ Erreur lors du chargement des données:', error);
        setError(error instanceof Error ? error.message : 'Erreur lors du chargement des données');
        setLoading(false);
      }
    };

    const unsubscribePromise = loadData();
    
    // **CLEANUP**
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, []);

  // **SAUVEGARDER LES FILTRES AUTOMATIQUEMENT**
  useEffect(() => {
    if (Object.keys(filtres).length > 0) {
      storageService.saveFiltres(filtres);
    }
  }, [filtres]);

  // **SYNCHRONISATION PERIODIQUE SIMPLIFIEE**
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        console.log('🔄 Synchronisation automatique...');
        await notaireService.syncWithGoogleSheets();
      } catch (error) {
        console.error('⚠️ Erreur synchronisation automatique (non critique):', error);
        // Ne pas afficher d'erreur à l'utilisateur pour les sync automatiques
      }
    }, 300000); // 5 minutes

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  // **SYNCHRONISATION MANUELLE**
  const synchronize = async () => {
    try {
      setIsSyncing(true);
      console.log('🔄 Synchronisation manuelle demandée...');
      await notaireService.syncWithGoogleSheets();
      return { success: true, message: 'Synchronisation réussie' };
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation manuelle:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erreur lors de la synchronisation' 
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // **MISE A JOUR DU STATUT**
  const handleStatutChange = async (notaire: Notaire, newStatut: NotaireStatut) => {
    try {
      console.log(`🔄 Changement de statut pour ${notaire.officeNotarial}: ${newStatut}`);
      const updatedNotaire = { ...notaire, statut: newStatut };
      await notaireService.updateNotaire(updatedNotaire);
      return { success: true, message: 'Statut mis à jour avec succès' };
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erreur lors de la mise à jour du statut' 
      };
    }
  };

  // **MISE A JOUR D'UN NOTAIRE**
  const handleNotaireUpdate = async (updatedNotaire: Notaire) => {
    try {
      console.log(`💾 Mise à jour du notaire: ${updatedNotaire.officeNotarial}`);
      await notaireService.updateNotaire(updatedNotaire);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du notaire:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erreur lors de la mise à jour du notaire' 
      };
    }
  };

  // **GESTION DES FILTRES**
  const handleFiltresChange = (newFiltres: Filtres) => {
    console.log('🔧 Mise à jour des filtres');
    setFiltres(newFiltres);
    storageService.saveFiltres(newFiltres);
  };

  // **RESET DES FILTRES**
  const clearAllFilters = () => {
    console.log('🧹 Nettoyage de tous les filtres');
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
      villesInteret: filtres.villesInteret, // Garder les villes d'intérêt
    };
    setFiltres(clearedFiltres);
    setSearchQuery('');
    storageService.saveFiltres(clearedFiltres);
  };

  // **INFORMATIONS DE DEBUG**
  useEffect(() => {
    if (!loading && !error) {
      const status = notaireService.getServiceStatus();
      console.log('📊 Status du service:', status);
    }
  }, [loading, error]);

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