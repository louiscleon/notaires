import { Notaire, NotaireStatut } from '../types';
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

class NotaireService {
  private notaires: Notaire[] = [];
  private subscribers: ((notaires: Notaire[]) => void)[] = [];
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
  subscribe(callback: (notaires: Notaire[]) => void) {
    this.subscribers.push(callback);
    callback(this.notaires); // Initial call with current data
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // Notify all subscribers
  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.notaires));
  }

  // Load initial data
  async loadInitialData(): Promise<void> {
    if (this.isInitialized) {
      console.warn('NotaireService is already initialized');
      return;
    }

    try {
      const data = await googleSheetsService.loadFromSheet();
      
      // Valider les données
      const validNotaires = data.notaires.filter(notaire => {
        if (!isValidNotaire(notaire)) {
          console.warn('Invalid notaire data:', notaire);
          return false;
        }
        return true;
      });

      if (validNotaires.length === 0) {
        throw new Error('No valid notaires found in the data');
      }

      this.notaires = validNotaires;
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
      throw new Error('Invalid notaire data');
    }

    try {
      // Update local state
      const index = this.notaires.findIndex(n => n.id === updatedNotaire.id);
      if (index === -1) {
        throw new Error(`Notaire with ID ${updatedNotaire.id} not found`);
      }

      // Update the modification date
      updatedNotaire.dateModification = new Date().toISOString();

      // Update local state
      this.notaires[index] = updatedNotaire;
      this.notifySubscribers();

      // Sync with Google Sheets
      await googleSheetsService.saveToSheet(updatedNotaire);
    } catch (error) {
      // Restaurer l'état précédent en cas d'erreur
      const originalNotaire = this.notaires.find(n => n.id === updatedNotaire.id);
      if (originalNotaire) {
        const index = this.notaires.findIndex(n => n.id === updatedNotaire.id);
        this.notaires[index] = originalNotaire;
        this.notifySubscribers();
      }

      console.error('Error updating notaire:', error);
      throw error;
    }
  }

  // Add a new notaire
  async addNotaire(newNotaire: Notaire): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    if (!isValidNotaire(newNotaire)) {
      throw new Error('Invalid notaire data');
    }

    try {
      // Ensure the notaire has an ID
      if (!newNotaire.id) {
        newNotaire.id = `notaire_${Date.now()}`;
      }

      // Vérifier que l'ID n'existe pas déjà
      if (this.notaires.some(n => n.id === newNotaire.id)) {
        throw new Error(`A notaire with ID ${newNotaire.id} already exists`);
      }

      // Set the modification date
      newNotaire.dateModification = new Date().toISOString();

      // Update local state
      this.notaires.push(newNotaire);
      this.notifySubscribers();

      // Sync with Google Sheets
      await googleSheetsService.saveToSheet(newNotaire);
    } catch (error) {
      // Restaurer l'état précédent en cas d'erreur
      this.notaires = this.notaires.filter(n => n.id !== newNotaire.id);
      this.notifySubscribers();

      console.error('Error adding notaire:', error);
      throw error;
    }
  }

  // Delete a notaire
  async deleteNotaire(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    const index = this.notaires.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Notaire with ID ${id} not found`);
    }

    const deletedNotaire = this.notaires[index];

    try {
      // Update local state
      this.notaires.splice(index, 1);
      this.notifySubscribers();

      // Sync with Google Sheets
      await googleSheetsService.saveToSheet(this.notaires);
    } catch (error) {
      // Restaurer l'état précédent en cas d'erreur
      this.notaires.splice(index, 0, deletedNotaire);
      this.notifySubscribers();

      console.error('Error deleting notaire:', error);
      throw error;
    }
  }

  // Force sync with Google Sheets
  async syncWithGoogleSheets(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('NotaireService is not initialized');
    }

    try {
      // Valider toutes les données avant la synchronisation
      const validNotaires = this.notaires.filter(notaire => {
        if (!isValidNotaire(notaire)) {
          console.warn('Invalid notaire data:', notaire);
          return false;
        }
        return true;
      });

      if (validNotaires.length === 0) {
        throw new Error('No valid notaires to sync');
      }

      await googleSheetsService.saveToSheet(validNotaires);
    } catch (error) {
      console.error('Error syncing with Google Sheets:', error);
      throw error;
    }
  }

  // Reset service (useful for testing)
  reset(): void {
    this.notaires = [];
    this.subscribers = [];
    this.isInitialized = false;
  }
}

export const notaireService = NotaireService.getInstance(); 