import { Notaire, VilleInteret } from '../types';
import { googleSheetsService } from './googleSheets';
import { autoSaveService } from './autoSave';

// **VALIDATION SIMPLIFIEE ET ROBUSTE**
function isValidNotaire(notaire: any): notaire is Notaire {
  return (
    typeof notaire === 'object' &&
    notaire !== null &&
    typeof notaire.id === 'string' &&
    notaire.id.length > 0 &&
    typeof notaire.officeNotarial === 'string' &&
    notaire.officeNotarial.length > 0
  );
}

function isValidVilleInteret(ville: any): ville is VilleInteret {
  return (
    typeof ville === 'object' &&
    ville !== null &&
    typeof ville.id === 'string' &&
    typeof ville.nom === 'string' &&
    ville.nom.length > 0
  );
}

class NotaireService {
  private notaires: Notaire[] = [];
  private villesInteret: VilleInteret[] = [];
  private subscribers: ((notaires: Notaire[], villesInteret: VilleInteret[]) => void)[] = [];
  private isInitialized: boolean = false;
  private isLoading: boolean = false;

  // Singleton instance
  private static instance: NotaireService;
  public static getInstance(): NotaireService {
    if (!NotaireService.instance) {
      NotaireService.instance = new NotaireService();
    }
    return NotaireService.instance;
  }

  private constructor() {
    // Private constructor to enforce singleton
  }

  // Subscribe to changes
  subscribe(callback: (notaires: Notaire[], villesInteret: VilleInteret[]) => void) {
    this.subscribers.push(callback);
    
    // Si déjà initialisé, appeler immédiatement avec les données actuelles
    if (this.isInitialized) {
      callback(this.notaires, this.villesInteret);
    }
    
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // Notify all subscribers
  private notifySubscribers() {
    console.log(`🔔 Notification de ${this.subscribers.length} abonnés avec ${this.notaires.length} notaires`);
    this.subscribers.forEach(callback => {
      try {
        callback([...this.notaires], [...this.villesInteret]);
      } catch (error) {
        console.error('❌ Erreur lors de la notification d\'un abonné:', error);
      }
    });
  }

  // **CHARGEMENT INITIAL SIMPLIFIE**
  async loadInitialData(): Promise<void> {
    if (this.isInitialized) {
      console.log('📊 Service déjà initialisé, utilisation des données en cache');
      this.notifySubscribers();
      return;
    }

    if (this.isLoading) {
      console.log('⏳ Chargement déjà en cours...');
      return;
    }

    try {
      this.isLoading = true;
      console.log(`🚀 Initialisation du service notaires...`);
      
      const data = await googleSheetsService.loadFromSheet();
      
      console.log(`📊 Données reçues: ${data.notaires.length} notaires, ${data.villesInteret.length} villes`);
      
      // **VALIDATION AVEC LOGS DETAILLES**
      const validNotaires = data.notaires.filter(notaire => {
        if (!isValidNotaire(notaire)) {
          console.warn(`⚠️ Notaire invalide ignoré:`, { 
            id: (notaire as any)?.id, 
            office: (notaire as any)?.officeNotarial 
          });
          return false;
        }
        return true;
      });

      const validVillesInteret = data.villesInteret.filter(ville => {
        if (!isValidVilleInteret(ville)) {
          console.warn(`⚠️ Ville d'intérêt invalide ignorée:`, { 
            id: (ville as any)?.id, 
            nom: (ville as any)?.nom 
          });
          return false;
        }
        return true;
      });

      if (validNotaires.length === 0) {
        throw new Error('❌ Aucun notaire valide trouvé dans les données');
      }

      this.notaires = validNotaires;
      this.villesInteret = validVillesInteret;
      this.isInitialized = true;
      
      console.log(`✅ Service initialisé: ${this.notaires.length} notaires, ${this.villesInteret.length} villes`);
      
      this.notifySubscribers();
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement initial:', error);
      this.isInitialized = false;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Get all notaires
  getNotaires(): Notaire[] {
    if (!this.isInitialized) {
      console.warn('⚠️ Service non initialisé lors de getNotaires()');
      return [];
    }
    return [...this.notaires];
  }

  // Get all villes d'intérêt
  getVillesInteret(): VilleInteret[] {
    if (!this.isInitialized) {
      console.warn('⚠️ Service non initialisé lors de getVillesInteret()');
      return [];
    }
    return [...this.villesInteret];
  }

  // Get a single notaire by ID
  getNotaireById(id: string): Notaire | undefined {
    if (!this.isInitialized) {
      console.warn('⚠️ Service non initialisé lors de getNotaireById()');
      return undefined;
    }
    return this.notaires.find(n => n.id === id);
  }

  // **MISE A JOUR AVEC SAUVEGARDE AUTOMATIQUE PROTÉGÉE**
  async updateNotaire(updatedNotaire: Notaire): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('❌ Service non initialisé');
    }

    if (!isValidNotaire(updatedNotaire)) {
      console.error('❌ Données de notaire invalides:', {
        id: (updatedNotaire as any)?.id,
        office: (updatedNotaire as any)?.officeNotarial
      });
      throw new Error('Données de notaire invalides');
    }

    const index = this.notaires.findIndex(n => n.id === updatedNotaire.id);
    if (index === -1) {
      console.error('❌ Notaire non trouvé:', updatedNotaire.id);
      throw new Error(`Notaire avec l'ID ${updatedNotaire.id} non trouvé`);
    }

    try {
      console.log(`💾 Mise à jour du notaire: ${updatedNotaire.officeNotarial}`);
      
      // **HORODATAGE AUTOMATIQUE**
      const timestampedNotaire = {
        ...updatedNotaire,
        dateModification: new Date().toISOString()
      };
      
      // **MISE A JOUR IMMEDIATE DE L'ETAT LOCAL**
      this.notaires[index] = { ...timestampedNotaire };
      
      // **NOTIFICATION IMMEDIATE POUR UNE MEILLEURE UX**
      this.notifySubscribers();

      // **SAUVEGARDE AUTOMATIQUE PROTÉGÉE**
      try {
        await autoSaveService.scheduleAutoSave(timestampedNotaire);
        console.log(`✅ Sauvegarde planifiée pour: ${timestampedNotaire.officeNotarial}`);
      } catch (saveError) {
        console.error(`❌ Erreur planification sauvegarde (données locales conservées):`, saveError);
        // On ne restaure pas l'ancien état pour une meilleure UX
        throw saveError;
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour du notaire ${updatedNotaire.id}:`, error);
      throw error;
    }
  }

  // **SYNCHRONISATION SIMPLIFIEE**
  async syncWithGoogleSheets(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('❌ Service non initialisé');
    }

    try {
      console.log(`🔄 Synchronisation avec Google Sheets...`);
      
      // **FORCER LA SAUVEGARDE DES MODIFICATIONS EN ATTENTE**
      await autoSaveService.forceSave();
      
      // **RECHARGEMENT COMPLET DES DONNEES**
      const data = await googleSheetsService.loadFromSheet();
      
      const validNotaires = data.notaires.filter(isValidNotaire);
      const validVillesInteret = data.villesInteret.filter(isValidVilleInteret);
      
      this.notaires = validNotaires;
      this.villesInteret = validVillesInteret;
      
      console.log(`✅ Synchronisation terminée: ${this.notaires.length} notaires`);
      
      this.notifySubscribers();
      
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      throw error;
    }
  }

  // **MISE A JOUR VILLES D'INTERET SIMPLIFIEE**
  async updateVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('❌ Service non initialisé');
    }

    console.log(`🏙️ Mise à jour de ${villesInteret.length} villes d'intérêt...`);

    // **VALIDATION SIMPLIFIEE**
    const validVillesInteret = villesInteret.filter(ville => {
      if (!isValidVilleInteret(ville)) {
        console.warn(`⚠️ Ville invalide ignorée:`, ville);
        return false;
      }
      return true;
    });

    const previousVillesInteret = [...this.villesInteret];

    try {
      // **MISE A JOUR LOCALE IMMEDIATE**
      this.villesInteret = validVillesInteret;
      this.notifySubscribers();
      
      // **SAUVEGARDE EN ARRIERE-PLAN**
      await googleSheetsService.saveVillesInteret(validVillesInteret);
      
      console.log(`✅ Villes d'intérêt mises à jour`);
      
    } catch (error) {
      console.error(`❌ Erreur sauvegarde villes d'intérêt:`, error);
      // **RESTAURATION EN CAS D'ERREUR**
      this.villesInteret = previousVillesInteret;
      this.notifySubscribers();
      throw error;
    }
  }

  // **METHODES DE DEBUG ET MAINTENANCE**
  getServiceStatus() {
    const autoSaveStatus = autoSaveService.getQueueStatus();
    return {
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
      notairesCount: this.notaires.length,
      villesInteretCount: this.villesInteret.length,
      subscribersCount: this.subscribers.length,
      autoSave: {
        pendingSaves: autoSaveStatus.pendingCount,
        isSaving: autoSaveStatus.isSaving,
        operations: autoSaveStatus.operations
      }
    };
  }

  // **FORCER LA SAUVEGARDE DE TOUTES LES MODIFICATIONS EN ATTENTE**
  async forceSaveAll(): Promise<void> {
    console.log(`🔥 Sauvegarde forcée de toutes les modifications...`);
    await autoSaveService.forceSave();
  }

  // Reset service (useful for testing)
  reset(): void {
    console.log(`🔄 Réinitialisation du service...`);
    autoSaveService.clearQueue();
    this.notaires = [];
    this.villesInteret = [];
    this.subscribers = [];
    this.isInitialized = false;
    this.isLoading = false;
  }
}

export const notaireService = NotaireService.getInstance(); 