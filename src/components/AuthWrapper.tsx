import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import LoadingScreen from './LoadingScreen';
import { setLoadingCallback } from '../services/googleSheets';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setLoadingCallback(setIsLoading);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('État de l\'authentification:', user ? 'connecté' : 'non connecté');
      if (!user) {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      setLoadingCallback(() => {});
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
};

export default AuthWrapper; 