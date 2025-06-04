import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

console.log('Configuration Firebase:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  // Ne pas logger les valeurs réelles pour des raisons de sécurité
});

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({
  prompt: 'select_account',
  // Forcer l'utilisation du domaine de l'application
  redirect_uri: window.location.origin
});

export const signInWithGoogle = async () => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  console.log('Tentative de connexion Google sur:', isMobile ? 'mobile' : 'desktop');
  
  try {
    if (isMobile) {
      console.log('Démarrage de la redirection mobile...');
      await signInWithRedirect(auth, provider);
      console.log('Redirection initiée');
    } else {
      console.log('Ouverture de la popup de connexion...');
      const result = await signInWithPopup(auth, provider);
      console.log('Connexion popup réussie');
      const credential = GoogleAuthProvider.credentialFromResult(result);
      return credential?.accessToken;
    }
  } catch (error: any) {
    console.error('Erreur détaillée d\'authentification:', {
      code: error.code,
      message: error.message,
      email: error.email,
      credential: error.credential,
      stack: error.stack
    });
    throw error;
  }
};

export const handleRedirectResult = async () => {
  console.log('Vérification du résultat de redirection...');
  try {
    const result = await getRedirectResult(auth);
    console.log('Résultat de redirection reçu:', !!result);
    
    if (result) {
      console.log('Traitement du résultat de redirection...');
      const credential = GoogleAuthProvider.credentialFromResult(result);
      console.log('Credential obtenu:', !!credential);
      return credential?.accessToken;
    }
    return null;
  } catch (error: any) {
    console.error('Erreur détaillée de redirection:', {
      code: error.code,
      message: error.message,
      email: error.email,
      credential: error.credential,
      stack: error.stack
    });
    throw error;
  }
};

export const getCurrentUser = () => {
  const user = auth.currentUser;
  console.log('Utilisateur actuel:', user ? 'connecté' : 'non connecté');
  return user;
};

// Ajouter un listener pour les changements d'état d'authentification
auth.onAuthStateChanged((user) => {
  console.log('Changement d\'état d\'authentification:', user ? 'connecté' : 'déconnecté');
});

export { auth }; 