import { Notaire, NotaireStatut, VilleInteret } from '../types';
import { googleSheetsService } from './googleSheets';

// Validation des données
function isValidNotaire(notaire: any): notaire is Notaire {
  return (
    typeof notaire === 'object' &&
    notaire !== null &&
    typeof notaire.id === 'string' &&
    typeof notaire.officeNotarial === 'string' &&
    typeof notaire.adresse === 'string' &&
    typeof notaire.codePostal === 'string' &&
    typeof notaire.ville === 'string' &&
    typeof notaire.statut === 'string' &&
    ['favori', 'envisage', 'non_interesse', 'non_defini'].includes(notaire.statut as NotaireStatut)
  );
}

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

class NotaireService {
  private notaires: Notaire[] = [];
  private villesInteret: VilleInteret[] = [];
  private subscribers: ((notaires: Notaire[], villesInteret: VilleInteret[]) => void)[] = [];
  private isInitialized: boolean = false;
  private pendingUpdates: Set<string> = new Set(); // Pour stocker les IDs des notaires à mettre à jour
  private syncTimeout: NodeJS.Timeout | null = null;
  private readonly SYNC_DELAY = 5000; // 5 secondes de délai entre les synchronisations
  private isSyncing = false; // Pour éviter les synchronisations simultanées
  private lastSyncTime: number = 0;
  private syncAttempts: Map<string, number> = new Map();
  private readonly MAX_SYNC_ATTEMPTS = 3;

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
    callback(this.notaires, this.villesInteret); // Initial call with current data
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // Notify all subscribers
  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.notaires, this.villesInteret));
  }

  // Load initial data
  async loadInitialData(): Promise<void> {
    if (this.isInitialized) {
      console.warn('NotaireService is already initialized');
      return;
    }

    try {
      const data = await googleSheetsService.loadFromSheet();
      
      // Valider les notaires
      const validNotaires = data.notaires.filter(notaire => {
        if (!isValidNotaire(notaire)) {
          console.warn('Invalid notaire data:', notaire);
          return false;
        }
        return true;
      });

      // Valider les villes d'intérêt
      const validVillesInteret = data.villesInteret.filter(ville => {
        if (!isValidVilleInteret(ville)) {
          console.warn('Invalid ville d\'intérêt data:', ville);
          return false;
        }
        return true;
      });

      if (validNotaires.length === 0) {
        throw new Error('No valid notaires found in the data');
      }

      this.notaires = validNotaires;
      this.villesInteret = validVillesInteret;
      this.isInitialized = true;
      this.notifySubscribers();
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  // Get all notaires
  getNotaires(): Notaire[] {
    if (!this.isInitialized) {
      console.warn('NotaireService is not initialized');
    }
    return this.notaires;
  }

  // Get all villes d'intérêt
  getVillesInteret(): VilleInteret[] {
    if (!this.isInitialized) {
      console.warn('NotaireService is not initialized');
    }
    return this.villesInteret;
  }

  // Get a single notaire by ID
  getNotaireById(id: string): Notaire | undefined {
    if (!this.isInitialized) {
      console.warn('NotaireService is not initialized');
    }
    return this.notaires.find(n => n.id === id);
  }

  // Update a notaire
  async updateNotaire(updatedNotaire: Notaire): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    if (!isValidNotaire(updatedNotaire)) {
      console.error('Données de notaire invalides:', updatedNotaire);
      throw new Error('Invalid notaire data');
    }

    const originalNotaire = this.notaires.find(n => n.id === updatedNotaire.id);
    if (!originalNotaire) {
      console.error('Notaire non trouvé:', updatedNotaire.id);
      throw new Error(`Notaire with ID ${updatedNotaire.id} not found`);
    }

    try {
      console.log(`🔄 Début de la mise à jour pour le notaire ${updatedNotaire.id}...`);
      
      // Update the modification date
      updatedNotaire.dateModification = new Date().toISOString();

      // Update local state immediately
      const index = this.notaires.findIndex(n => n.id === updatedNotaire.id);
      this.notaires[index] = updatedNotaire;
      this.notifySubscribers();
      console.log(`✅ État local mis à jour pour ${updatedNotaire.id}`);

      // Synchroniser immédiatement avec Google Sheets
      await this.forceSyncNotaire(updatedNotaire);
      
      console.log(`✨ Mise à jour complète réussie pour ${updatedNotaire.id}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour du notaire ${updatedNotaire.id}:`, {
        error: error instanceof Error ? error.message : error
      });
      // Restore original state
      const index = this.notaires.findIndex(n => n.id === updatedNotaire.id);
      if (index !== -1 && originalNotaire) {
        this.notaires[index] = originalNotaire;
        this.notifySubscribers();
        console.log(`🔄 État local restauré pour ${updatedNotaire.id}`);
      }
      throw error;
    }
  }

  private async forceSyncNotaire(notaire: Notaire): Promise<void> {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    const attempts = this.syncAttempts.get(notaire.id) || 0;

    if (this.isSyncing) {
      console.log(`⏳ Synchronisation déjà en cours pour ${notaire.id}, mise en file d'attente...`);
      this.pendingUpdates.add(notaire.id);
      return;
    }

    if (attempts >= this.MAX_SYNC_ATTEMPTS) {
      console.error(`❌ Nombre maximum de tentatives atteint pour ${notaire.id}`);
      throw new Error(`Maximum sync attempts reached for notaire ${notaire.id}`);
    }

    try {
      this.isSyncing = true;
      this.lastSyncTime = now;
      this.syncAttempts.set(notaire.id, attempts + 1);
      
      console.log(`🔄 Début de la synchronisation forcée pour ${notaire.id} (tentative ${attempts + 1}/${this.MAX_SYNC_ATTEMPTS})`);
      
      // Forcer la synchronisation immédiate
      await googleSheetsService.saveToSheet(notaire);
      
      // Réinitialiser les compteurs après une synchronisation réussie
      this.syncAttempts.delete(notaire.id);
      this.pendingUpdates.delete(notaire.id);
      
      console.log(`✅ Synchronisation forcée réussie pour ${notaire.id}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation forcée de ${notaire.id}:`, error);
      this.pendingUpdates.add(notaire.id);
      throw error;
    } finally {
      this.isSyncing = false;
      
      // Si d'autres mises à jour sont en attente, les traiter
      if (this.pendingUpdates.size > 0) {
        console.log(`⏳ ${this.pendingUpdates.size} mises à jour en attente à traiter`);
        await this.processPendingUpdates();
      }
    }
  }

  private async processPendingUpdates(): Promise<void> {
    if (this.isSyncing || this.pendingUpdates.size === 0) {
      return;
    }

    try {
      this.isSyncing = true;
      console.log(`🔄 Traitement de ${this.pendingUpdates.size} mises à jour en attente...`);
      
      const notairesToSync = this.notaires.filter(n => this.pendingUpdates.has(n.id));
      await googleSheetsService.saveToSheet(notairesToSync);
      
      this.pendingUpdates.clear();
      console.log('✅ Mises à jour en attente traitées avec succès');
    } catch (error) {
      console.error('❌ Erreur lors du traitement des mises à jour en attente:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Force sync with Google Sheets
  async syncWithGoogleSheets(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    if (this.isSyncing) {
      console.log('Synchronisation déjà en cours, ignorée');
      return;
    }

    try {
      this.isSyncing = true;
      console.log('Début de la synchronisation complète avec Google Sheets...');
      
      // Mettre à jour la date de modification pour tous les notaires
      const notairesWithUpdatedDates = this.notaires.map(notaire => ({
        ...notaire,
        dateModification: new Date().toISOString()
      }));

      // Sync all notaires with force sync flag
      await googleSheetsService.saveToSheet(notairesWithUpdatedDates);
      
      // Update local state
      this.notaires = notairesWithUpdatedDates;
      
      // Clear any pending updates since we just synced everything
      this.pendingUpdates.clear();
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
      }
      
      this.notifySubscribers();
      console.log('Synchronisation complète avec Google Sheets réussie');
    } catch (error) {
      console.error('Error syncing with Google Sheets:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // Update villes d'intérêt
  async updateVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    // Valider les données
    const validVillesInteret = villesInteret.filter(isValidVilleInteret);
    if (validVillesInteret.length === 0 && villesInteret.length > 0) {
      throw new Error('No valid villes d\'intérêt in the data');
    }

    const previousVillesInteret = [...this.villesInteret];

    try {
      // Mettre à jour l'état local
      this.villesInteret = validVillesInteret;
      
      // Synchroniser avec Google Sheets
      await googleSheetsService.saveVillesInteret(validVillesInteret);
      
      // Notifier les abonnés après la synchronisation réussie
      this.notifySubscribers();
    } catch (error) {
      // Restaurer l'état précédent en cas d'erreur
      this.villesInteret = previousVillesInteret;
      this.notifySubscribers();
      throw error;
    }
  }

  // Reset service (useful for testing)
  reset(): void {
    this.notaires = [];
    this.villesInteret = [];
    this.subscribers = [];
    this.isInitialized = false;
    this.pendingUpdates.clear();
    this.syncAttempts.clear();
    this.lastSyncTime = 0;
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
}

export const notaireService = NotaireService.getInstance(); 