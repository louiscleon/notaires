# 🗺️ Notaires de Bretagne - Application de Gestion et Visualisation

Application web moderne pour visualiser et gérer les données des notaires de Bretagne avec une interface interactive et des fonctionnalités avancées de filtrage géographique.

## ✨ Fonctionnalités

### 🗺️ Carte Interactive

- **Visualisation géographique** : Carte centrée sur la Bretagne avec tous les notaires géolocalisés
- **Géocodage automatique** : Conversion automatique des adresses en coordonnées GPS
- **Marqueurs interactifs** : Différentes couleurs selon les filtres appliqués
- **Popups informatives** : Détails complets sur chaque notaire au clic

### 🎛️ Filtres Dynamiques

- **Filtres par attributs** :
  - Type de notaires (individuels vs groupes/associés)
  - Nombre de notaires salariés (min/max)
  - Présence d'un service négociation
  
- **Zones d'intérêt géographiques** :
  - Ajout facile de villes d'intérêt
  - Définition de rayons personnalisés (en km)
  - Cercles visuels sur la carte
  - Filtrage par proximité géographique

### 📊 Tableau Éditable

- **Affichage complet** : Toutes les données des notaires
- **Édition en ligne** : Modification directe des informations
- **Champs de suivi** :
  - Email de contact
  - Adresse précise
  - Date de premier contact
  - Réponse reçue (Oui/Non)
  - Date de relance
  - Réponse à la relance (Oui/Non)
- **Tri et recherche** : Colonnes triables
- **Synchronisation** : Modifications immédiatement reflétées sur la carte

### 💾 Gestion des Données

- **Sauvegarde automatique** : Toutes les modifications sont sauvegardées localement
- **Export CSV** : Téléchargement des données filtrées ou complètes
- **Re-géocodage automatique** : Actualisation des positions lors de changement d'adresse

## 🚀 Installation et Démarrage

### Prérequis

- Node.js (version 16 ou supérieure)
- npm ou yarn

### Installation

```bash
# Cloner le projet
cd notaires-app

# Installer les dépendances
npm install

# Lancer l'application
npm start
```

L'application sera accessible à l'adresse : `http://localhost:3000`

## 💡 Guide d'Utilisation

### 1. **Ajout de Villes d'Intérêt**

1. Dans le panneau de filtres à gauche, section "Zones d'intérêt"
2. Saisir le nom de la ville dans le champ "Nom de la ville"
3. Définir le rayon en kilomètres (1-100 km)
4. Cliquer sur "Ajouter"
5. La ville apparaît sur la carte avec un cercle coloré

### 2. **Modification des Rayons**

- Utiliser les champs numériques à côté de chaque ville configurée
- Les cercles se mettent à jour automatiquement

### 3. **Filtrage par Zones**

- Cocher "Afficher uniquement les notaires dans les zones d'intérêt"
- Seuls les notaires dans les rayons définis seront affichés

### 4. **Édition des Données**

- Afficher le tableau avec le bouton "Afficher le tableau"
- Cliquer dans les cellules éditables pour modifier
- Les changements sont sauvegardés automatiquement

### 5. **Export des Données**

- Cliquer sur "Exporter CSV" dans l'en-tête
- Le fichier contient toutes les données filtrées avec les modifications

## 🛠️ Technologies Utilisées

- **Frontend** : React 18 + TypeScript
- **Carte** : Leaflet.js avec OpenStreetMap
- **Styling** : Tailwind CSS
- **Géocodage** : API Nominatim (OpenStreetMap)
- **Traitement CSV** : Papa Parse
- **Stockage** : LocalStorage du navigateur

## 📁 Structure du Projet

```schéma
src/
├── components/           # Composants React
│   ├── MapComponent.tsx     # Carte interactive
│   ├── FiltersPanel.tsx    # Panneau de filtres
│   └── NotairesTable.tsx   # Tableau éditable
├── services/            # Services métier
│   ├── geocoding.ts        # Géocodage et calculs géographiques
│   └── dataService.ts      # Gestion des données CSV
├── types/               # Types TypeScript
│   └── notaire.ts          # Interfaces et types
└── App.tsx              # Application principale
```

## 🔧 Configuration et Personnalisation

### Modification des Couleurs

- Éditer `tailwind.config.js` pour personnaliser la palette
- Les cercles utilisent automatiquement des couleurs distinctes

### Limites du Géocodage

- API Nominatim gratuite avec limitations de taux
- Délai automatique de 100ms entre les requêtes
- Cache intégré pour éviter les requêtes redondantes

### Stockage des Données

- Sauvegarde automatique dans le navigateur
- Données persistantes entre les sessions
- Export CSV pour sauvegarde externe

## 🌐 Déploiement

### Build de Production

```bash
npm run build
```

### Déploiement sur Netlify/Vercel

1. Connecter le repository Git
2. Configuration de build : `npm run build`
3. Dossier de sortie : `build/`
4. Variables d'environnement : aucune requise

### Déploiement sur serveur personnalisé

1. Exécuter `npm run build`
2. Servir le contenu du dossier `build/` avec un serveur web
3. Configurer les redirections pour SPA si nécessaire

## 📋 Données Incluses

L'application est livrée avec un fichier CSV contenant **589 notaires** de Bretagne avec :

- Informations d'office (nom, adresse, code postal, ville)
- Données d'organisation (associés, salariés)
- Services proposés (négociation immobilière)
- Coordonnées de contact

## 🚀 Fonctionnalités Avancées

### Géocodage Intelligent

- Géocodage automatique au premier chargement
- Re-géocodage lors de modification d'adresse
- Gestion des erreurs et statuts de géolocalisation

### Performance Optimisée

- Mise en cache des résultats de géocodage
- Rendu optimisé avec React.memo et useMemo
- Lazy loading des composants lourds

### Interface Responsive

- Adaptée desktop et tablette
- Sidebar repliable sur écrans moyens
- Tableau scrollable avec en-têtes fixes

## 🆘 Dépannage

### Problèmes Courants

### Les notaires n'apparaissent pas sur la carte**

- Vérifier que le géocodage est terminé (barre de progression)
- Certaines adresses peuvent ne pas être géocodables

### Erreurs de géocodage**

- Limitation de l'API Nominatim (1 req/sec)
- Vérifier la connexion internet
- Attendre la fin du processus automatique

### Données non sauvegardées**

- Vérifier que localStorage est activé dans le navigateur
- Utiliser l'export CSV comme sauvegarde

## 📞 Support

Pour toute question ou suggestion d'amélioration, n'hésitez pas à créer une issue dans le repository du projet.

---

### Développé avec ❤️ pour faciliter la gestion des relations avec les notaires de Bretagne**
