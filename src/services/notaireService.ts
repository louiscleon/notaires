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

  // Update a notaire - simplified version
  async updateNotaire(updatedNotaire: Notaire): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    if (!isValidNotaire(updatedNotaire)) {
      console.error('Données de notaire invalides:', updatedNotaire);
      throw new Error('Invalid notaire data');
    }

    const index = this.notaires.findIndex(n => n.id === updatedNotaire.id);
    if (index === -1) {
      console.error('Notaire non trouvé:', updatedNotaire.id);
      throw new Error(`Notaire with ID ${updatedNotaire.id} not found`);
    }

    try {
      console.log(`🔄 Mise à jour du notaire ${updatedNotaire.id}...`);
      
      // Update the modification date
      updatedNotaire.dateModification = new Date().toISOString();

      // Update local state immediately
      this.notaires[index] = updatedNotaire;
      this.notifySubscribers();
      console.log(`✅ État local mis à jour pour ${updatedNotaire.id}`);

      // Save to Google Sheets (with debounce)
      await googleSheetsService.saveToSheet(updatedNotaire);
      
      console.log(`✨ Mise à jour programmée pour ${updatedNotaire.id}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour du notaire ${updatedNotaire.id}:`, error);
      throw error;
    }
  }

  // Force sync with Google Sheets - simplified
  async syncWithGoogleSheets(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    try {
      console.log('🔄 Synchronisation forcée avec Google Sheets...');
      
      // Force save any pending changes
      await googleSheetsService.forceSave();
      
      console.log('✅ Synchronisation forcée réussie');
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      throw error;
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
  }
}

export const notaireService = NotaireService.getInstance(); 