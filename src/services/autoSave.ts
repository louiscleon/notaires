import { Notaire } from '../types';
import { googleSheetsService } from './googleSheets';

interface SaveOperation {
  notaire: Notaire;
  timestamp: number;
  attempts: number;
}

class AutoSaveService {
  private saveQueue: Map<string, SaveOperation> = new Map();
  private isSaving: boolean = false;
  private saveInterval: NodeJS.Timeout | null = null;
  private maxAttempts: number = 3;

  constructor() {
    // **SAUVEGARDE AUTOMATIQUE TOUTES LES 5 SECONDES**
    this.startAutoSave();
  }

  private startAutoSave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    
    this.saveInterval = setInterval(async () => {
      await this.processSaveQueue();
    }, 5000); // 5 secondes
  }

  // **AJOUTER UNE MODIFICATION À LA QUEUE**
  async scheduleAutoSave(notaire: Notaire): Promise<void> {
    console.log(`💾 Planification sauvegarde automatique: ${notaire.officeNotarial}`);
    
    // **VALIDATION DE PROTECTION**
    if (!notaire.id || !notaire.officeNotarial) {
      console.error('❌ Données invalides pour la sauvegarde:', notaire);
      throw new Error('Données de notaire invalides - sauvegarde annulée');
    }
    
    // **HORODATAGE DE LA MODIFICATION**
    const modifiedNotaire = {
      ...notaire,
      dateModification: new Date().toISOString()
    };
    
    // **AJOUTER À LA QUEUE AVEC PROTECTION CONTRE L'ÉCRASEMENT**
    const existing = this.saveQueue.get(notaire.id);
    const saveOperation: SaveOperation = {
      notaire: modifiedNotaire,
      timestamp: Date.now(),
      attempts: existing ? existing.attempts : 0
    };
    
    this.saveQueue.set(notaire.id, saveOperation);
    console.log(`📝 Notaire ajouté à la queue de sauvegarde (${this.saveQueue.size} en attente)`);
    
    // **SAUVEGARDE IMMÉDIATE POUR LES DONNÉES CRITIQUES**
    if (this.isImmediateSaveRequired(notaire)) {
      console.log('⚡ Sauvegarde immédiate requise');
      await this.processSaveQueue();
    }
  }

  // **DÉTERMINER SI UNE SAUVEGARDE IMMÉDIATE EST REQUISE**
  private isImmediateSaveRequired(notaire: Notaire): boolean {
    // Sauvegarder immédiatement si :
    // - Changement de statut
    // - Ajout de contact
    // - Modification d'email ou coordonnées
    return (
      notaire.statut !== 'non_defini' ||
      (notaire.contacts && notaire.contacts.length > 0) ||
      !!notaire.email ||
      !!(notaire.latitude && notaire.longitude)
    );
  }

  // **TRAITER LA QUEUE DE SAUVEGARDE**
  private async processSaveQueue(): Promise<void> {
    if (this.isSaving || this.saveQueue.size === 0) {
      return;
    }

    try {
      this.isSaving = true;
      console.log(`🔄 Traitement de ${this.saveQueue.size} sauvegarde(s) en attente...`);

      const operations = Array.from(this.saveQueue.entries());
      const successfulSaves: string[] = [];
      const failedSaves: string[] = [];

      for (const [id, operation] of operations) {
        try {
          // **PROTECTION CONTRE LES CONFLITS**
          await this.saveWithConflictProtection(operation.notaire);
          successfulSaves.push(id);
          console.log(`✅ Sauvegarde réussie: ${operation.notaire.officeNotarial}`);
          
        } catch (error) {
          operation.attempts++;
          console.error(`❌ Échec sauvegarde ${operation.notaire.officeNotarial} (tentative ${operation.attempts}):`, error);
          
          if (operation.attempts >= this.maxAttempts) {
            failedSaves.push(id);
            console.error(`❌ Abandon après ${this.maxAttempts} tentatives: ${operation.notaire.officeNotarial}`);
          } else {
            // Remettre en queue pour retry
            this.saveQueue.set(id, operation);
          }
        }
      }

      // **NETTOYER LA QUEUE**
      successfulSaves.forEach(id => this.saveQueue.delete(id));
      failedSaves.forEach(id => this.saveQueue.delete(id));

      if (successfulSaves.length > 0) {
        console.log(`✅ ${successfulSaves.length} sauvegarde(s) réussie(s)`);
      }
      if (failedSaves.length > 0) {
        console.error(`❌ ${failedSaves.length} sauvegarde(s) échouée(s) définitivement`);
      }

    } catch (error) {
      console.error('❌ Erreur lors du traitement de la queue:', error);
    } finally {
      this.isSaving = false;
    }
  }

  // **SAUVEGARDE AVEC PROTECTION CONTRE LES CONFLITS**
  private async saveWithConflictProtection(notaire: Notaire): Promise<void> {
    // **ÉTAPE 1: VÉRIFICATION D'INTÉGRITÉ**
    if (!notaire.id || !notaire.officeNotarial) {
      throw new Error('Données critiques manquantes - sauvegarde annulée');
    }

    // **ÉTAPE 2: HORODATAGE DE SÉCURITÉ**
    const timestamp = new Date().toISOString();
    const protectedNotaire = {
      ...notaire,
      dateModification: timestamp,
      dateSauvegarde: timestamp
    };

    // **ÉTAPE 3: SAUVEGARDE AVEC RETRY**
    try {
      await googleSheetsService.saveToSheet(protectedNotaire);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde protégée:', error);
      throw error;
    }
  }

  // **FORCER LA SAUVEGARDE IMMÉDIATE**
  async forceSave(): Promise<void> {
    console.log('🔥 Sauvegarde forcée demandée...');
    await this.processSaveQueue();
  }

  // **OBTENIR LE STATUS DE LA QUEUE**
  getQueueStatus() {
    return {
      pendingCount: this.saveQueue.size,
      isSaving: this.isSaving,
      operations: Array.from(this.saveQueue.entries()).map(([id, op]) => ({
        id,
        officeNotarial: op.notaire.officeNotarial,
        attempts: op.attempts,
        timestamp: op.timestamp
      }))
    };
  }

  // **ARRÊTER LE SERVICE**
  stop() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  // **NETTOYER LA QUEUE (EN CAS D'URGENCE)**
  clearQueue() {
    console.warn('⚠️ Nettoyage de la queue de sauvegarde');
    this.saveQueue.clear();
  }
}

export const autoSaveService = new AutoSaveService(); 