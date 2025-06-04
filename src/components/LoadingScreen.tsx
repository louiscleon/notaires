import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 text-lg">Connexion en cours...</p>
        <p className="text-gray-400 text-sm mt-2">Vous allez être redirigé vers Google</p>
      </div>
    </div>
  );
};

export default LoadingScreen; 