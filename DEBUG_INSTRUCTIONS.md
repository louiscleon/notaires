# 🔍 Instructions de Débogage - Problème de Données

## 🚀 **Étapes de Diagnostic**

### **1. Ouvrir l'Application**

```bash
npm start
```

### **2. Ouvrir la Console du Navigateur**

- `F12` ou `Cmd+Option+I`
- Onglet "Console"

### **3. Tester l'API Manuellement**

Dans la console du navigateur, tapez :

```javascript
// Test direct de l'API
testApi()
```

### **4. Analyser les Logs**

Cherchez ces messages dans la console :

#### **✅ Logs de Succès attendus :**

```arbre
🚀 Initialisation du hook useNotaires...
🚀 Chargement des données depuis Google Sheets...
📊 Chargement des notaires...
📊 Données brutes reçues: {type: "object", isArray: true, length: X}
✅ X notaires chargés avec succès
📊 Réception de X notaires dans le hook
✅ Données reçues, loading terminé
```

#### **❌ Logs d'Erreur à chercher :**

```arbre
❌ Erreur API XXX: ...
❌ Format de données invalide pour les notaires
❌ Erreur lors du chargement des données
⚠️ Ligne X ignorée (données insuffisantes)
```

### **5. Vérifications Spécifiques**

#### **Test de Configuration API :**

```javascript
fetch('https://notaires.cleon.app/api/test')
  .then(r => r.json())
  .then(d => console.log('Config:', d))
```

#### **Test des Données Brutes :**

```javascript
fetch('https://notaires.cleon.app/api/sheets?range=Notaires!A2:E')
  .then(r => r.json())
  .then(d => console.log('Données:', d.slice(0, 3)))
```

### **6. Problèmes Courants et Solutions**

#### **Problème : "Format de données invalide"**

**Cause :** Google Sheets renvoie un format inattendu
**Solution :** Vérifier la structure des données dans les logs

#### **Problème : "Aucun notaire valide"**

**Cause :** Validation trop stricte ou données manquantes
**Solution :** Vérifier les 5 premières colonnes du Google Sheet

#### **Problème : "API Error 500"**

**Cause :** Problème côté serveur
**Solution :** Vérifier la configuration Google Sheets

### **7. Actions Correctives Immédiates**

Si vous voyez des erreurs, essayez dans l'ordre :

1. **Rafraîchir la page** (`Cmd+R`)
2. **Vider le cache** (`Cmd+Shift+R`)
3. **Test API manuel** (`testApi()`)
4. **Réinitialiser le service** (code ci-dessous)

```javascript
// Réinitialisation manuelle du service
notaireService.reset()
location.reload()
```

## 🎯 **Diagnostics Avancés**

### **Vérifier le Service Status :**

```javascript
// Dans la console
notaireService.getServiceStatus()
```

### **Inspecter les Données Reçues :**

```javascript
// Voir les notaires en mémoire
notaireService.getNotaires().slice(0, 3)
```

### **Forcer une Synchronisation :**

```javascript
// Synchronisation manuelle
notaireService.syncWithGoogleSheets()
```

## 📋 **Rapport d'Erreur**

Si le problème persiste, notez :

1. **Messages d'erreur exacts** dans la console
2. **Données reçues de l'API** (`testApi()`)
3. **Status du service** (`getServiceStatus()`)
4. **Navigateur et version** utilisés

---

**⚡ Objectif :** Identifier rapidement où le pipeline de données se casse entre Google Sheets et l'affichage.
