import { API_BASE_URL } from '../config';

export const testApiConnection = async () => {
  console.log('🔧 Test de connexion API...');
  console.log('API_BASE_URL:', API_BASE_URL);
  
  try {
    // **TEST 1: Configuration**
    console.log('1️⃣ Test configuration...');
    const configResponse = await fetch(`${API_BASE_URL}/test`);
    const configData = await configResponse.json();
    console.log('✅ Configuration OK:', {
      status: configResponse.status,
      hasSpreadsheetId: configData.environment?.hasSpreadsheetId,
      hasServiceAccount: configData.environment?.hasServiceAccountKey
    });
    
    // **TEST 2: Données brutes**
    console.log('2️⃣ Test récupération données...');
    const dataResponse = await fetch(`${API_BASE_URL}/sheets?range=Notaires!A2:E`);
    console.log('Statut réponse:', dataResponse.status, dataResponse.statusText);
    
    if (!dataResponse.ok) {
      const errorText = await dataResponse.text();
      console.error('❌ Erreur API:', errorText);
      return;
    }
    
    const rawData = await dataResponse.json();
    console.log('📊 Données reçues:', {
      type: typeof rawData,
      isArray: Array.isArray(rawData),
      length: Array.isArray(rawData) ? rawData.length : 'N/A',
      firstRow: Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : null,
      sampleData: Array.isArray(rawData) ? rawData.slice(0, 3) : null
    });
    
    // **TEST 3: Validation des données**
    if (Array.isArray(rawData)) {
      console.log('3️⃣ Validation des données...');
      const validRows = rawData.filter(row => Array.isArray(row) && row.length >= 5);
      console.log(`✅ ${validRows.length}/${rawData.length} lignes valides`);
      
      if (validRows.length > 0) {
        console.log('Exemple de ligne valide:', validRows[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test API:', error);
  }
};

// **FONCTION POUR TESTER DEPUIS LA CONSOLE**
(window as any).testApi = testApiConnection; 