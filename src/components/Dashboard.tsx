import React, { useState, useMemo } from 'react';
import { Notaire } from '../types';

interface Props {
  notaires: Notaire[];
  onNotaireClick?: (notaire: Notaire) => void;
}

interface StatCard {
  title: string;
  value: number;
  description: string;
  color: string;
}

const StatCard: React.FC<{
  title: string;
  value: number;
  subtitle: string;
  color: string;
  textColor?: string;
}> = ({ title, value, subtitle, color, textColor = 'text-gray-800' }) => (
  <div className={`rounded-xl p-6 shadow-lg ${color} transition-transform duration-200 hover:scale-105`}>
    <h3 className={`text-lg font-medium mb-2 ${textColor}`}>{title}</h3>
    <p className={`text-4xl font-bold mb-1 ${textColor}`}>{value}</p>
    <p className={`text-sm ${textColor} opacity-80`}>{subtitle}</p>
  </div>
);

const Dashboard: React.FC<Props> = ({ notaires, onNotaireClick }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // CORRECTION : Dédupliquer les notaires par ID dès le début
  const notairesUniques = useMemo(() => {
    const uniqueMap = new Map<string, Notaire>();
    let duplicatesFound = 0;
    
    notaires.forEach(notaire => {
      if (uniqueMap.has(notaire.id)) {
        duplicatesFound++;
        console.warn(`🔍 Doublon détecté pour ${notaire.officeNotarial} (ID: ${notaire.id})`);
      } else {
        uniqueMap.set(notaire.id, notaire);
      }
    });
    
    if (duplicatesFound > 0) {
      console.warn(`⚠️ ${duplicatesFound} doublon(s) détecté(s) dans les données - dédupliqués automatiquement`);
    }
    
    return Array.from(uniqueMap.values());
  }, [notaires]);

  // Calcul des statistiques avec les notaires dédupliqués
  const stats: StatCard[] = [
    {
      title: 'Total Notaires',
      value: notairesUniques.length,
      description: 'Nombre total d\'études',
      color: 'bg-emerald-50'
    },
    {
      title: 'Favoris',
      value: notairesUniques.filter(n => n.statut === 'favori').length,
      description: 'Études favorites',
      color: 'bg-amber-50'
    },
    {
      title: 'À envisager',
      value: notairesUniques.filter(n => n.statut === 'envisage').length,
      description: 'Études à étudier',
      color: 'bg-blue-50'
    },
    {
      title: 'Contactés',
      value: notairesUniques.filter(n => n.contacts?.length > 0).length,
      description: 'Études déjà contactées',
      color: 'bg-purple-50'
    }
  ];

  const contactStats = {
    total: notairesUniques.filter(n => n.contacts?.length > 0).length,
    reponses: notairesUniques.filter(n => n.contacts?.some(c => c.reponseRecue)).length,
    positives: notairesUniques.filter(n => n.contacts?.some(c => c.reponseRecue?.positive)).length
  };

  const tauxReponse = contactStats.total > 0
    ? Math.round((contactStats.reponses / contactStats.total) * 100)
    : 0;

  const prochaines = notairesUniques
    .filter(n => n.contacts?.length > 0)
    .sort((a, b) => {
      const dateA = new Date(a.contacts[a.contacts.length - 1].date);
      const dateB = new Date(b.contacts[b.contacts.length - 1].date);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:bg-gray-50 transition-colors duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="font-medium text-gray-900">Afficher le tableau de bord</span>
          </div>
          <div className="text-sm text-gray-500">
            {notairesUniques.length} notaires • {stats[1].value} favoris • {stats[2].value} à envisager
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Tableau de bord</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span>Replier</span>
        </button>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            subtitle={stat.description}
            color={stat.color}
          />
        ))}
      </div>

      {/* Statistiques de contact */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Statistiques de contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-teal-600">
              {contactStats.total}
            </div>
            <div className="text-sm text-gray-600">Études contactées</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-teal-600">
              {tauxReponse}%
            </div>
            <div className="text-sm text-gray-600">Taux de réponse</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-teal-600">
              {contactStats.positives}
            </div>
            <div className="text-sm text-gray-600">Réponses positives</div>
          </div>
        </div>
      </div>

      {/* Derniers contacts */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Derniers contacts
        </h3>
        <div className="space-y-4">
          {prochaines.map((notaire) => {
            const dernierContact = notaire.contacts[notaire.contacts.length - 1];
            return (
              <button
                key={notaire.id}
                onClick={() => onNotaireClick?.(notaire)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-left"
              >
                <div>
                  <div className="font-medium text-gray-900 hover:text-teal-600 transition-colors duration-200">
                    {notaire.officeNotarial}
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(dernierContact.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })} - {dernierContact.type === 'initial' ? 'Premier contact' : 'Relance'}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  !dernierContact.reponseRecue
                    ? 'bg-yellow-100 text-yellow-800'
                    : dernierContact.reponseRecue.positive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {!dernierContact.reponseRecue
                    ? 'En attente'
                    : dernierContact.reponseRecue.positive
                      ? 'Réponse positive'
                      : 'Réponse négative'}
                </div>
              </button>
            );
          })}
          {prochaines.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              Aucun contact récent
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 