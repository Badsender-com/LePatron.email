# Plan : Support de l'authentification FTP par clé SSH

## Aperçu

Ajout du support de l'authentification par clé SSH pour l'hébergement des images sur serveur SFTP, en complément de l'authentification par mot de passe existante.

**Branche:** `feat/ftp-ssh-key-auth` (créée depuis `develop`, mergée avec `docs/ai-agent-guidelines`)

---

## 1. Prérequis : Mise à jour des dépendances

### 1.1 Modifications package.json

| Paquet | Ancienne version | Nouvelle version |
| --- | --- | --- |
| ssh2-sftp-client | 5.1.2 | 7.2.3 |

> **Note** : Version fixée sans `^` pour plus de stabilité et éviter des erreurs difficiles à détecter.
> 

**Raison:** La version ssh2 0.8.9 (dépendance de ssh2-sftp-client 5.x) utilise uniquement `ssh-rsa` (SHA-1). Les serveurs OpenSSH 8.8+ (Ubuntu 22.04+, Debian 12+) rejettent SHA-1 et exigent `rsa-sha2-256` ou `rsa-sha2-512`.

### 1.2 Commandes

```bash
yarn upgrade ssh2-sftp-client@7.2.3
yarn install
```

### 1.3 Types de clés supportés (Node 14)

| Type | Status | Notes |
| --- | --- | --- |
| RSA 2048+ | ✅ | Recommandé |
| ECDSA | ✅ | Devrait fonctionner |
| Ed25519 | ❌ | Requiert Node 16+ |

---

## 2. Backend : Modifications Schema Group

### 2.1 Fichier : `packages/server/group/group.schema.js`

**Nouveaux champs à ajouter :**

```jsx
// Après ftpPassword (ligne ~84)
ftpAuthType: {
  type: String,
  enum: ['password', 'ssh_key'],
  default: 'password',
},
ftpSshKey: {
  type: String,
  default: '',
},
```

**Mise à jour encryptionPlugin (ligne ~135) :**

```jsx
GroupSchema.plugin(encryptionPlugin, ['ftpPassword', 'ftpSshKey']);
```

---

## 3. Backend : Modifications FTPClient

### 3.1 Fichier : `packages/server/mailing/ftp-client.service.js`

**Modification du constructeur :**

```jsx
// Avant (lignes 12-28)
constructor(
  host = 'localhost',
  port = 22,
  username = 'anonymous',
  password = 'guest'
) {
  this.client = new Client();
  this.settings = {
    host, port, username, password,
    keepaliveInterval: 2000,
    keepaliveCountMax: 50,
  };
}

// Après
constructor(
  host = 'localhost',
  port = 22,
  username = 'anonymous',
  password = 'guest',
  protocol,
  { authType, sshKey } = {}
) {
  this.client = new Client();
  this.settings = {
    host,
    port,
    username,
    keepaliveInterval: 2000,
    keepaliveCountMax: 50,
  };

  if (authType === 'ssh_key' && sshKey) {
    this.settings.privateKey = sshKey;
  } else {
    this.settings.password = password;
  }
}
```

---

## 4. Backend : Modifications mailing.service.js

### 4.1 Fichier : `packages/server/mailing/mailing.service.js`

**Localiser l'instanciation de FTPClient** (autour de la ligne 882) et ajouter les paramètres SSH key :

```jsx
// Avant
const ftpClient = new Ftp(
  ftpHost,
  ftpPort,
  ftpUsername,
  ftpPassword,
  ftpProtocol
);

// Après
const ftpClient = new Ftp(
  ftpHost,
  ftpPort,
  ftpUsername,
  ftpPassword,
  ftpProtocol,
  { authType: ftpAuthType, sshKey: ftpSshKey }
);
```

**Extraire les nouveaux paramètres du groupe** (chercher où ftpHost, ftpPassword, etc. sont extraits) :

```jsx
const {
  ftpHost,
  ftpPort,
  ftpUsername,
  ftpPassword,
  ftpProtocol,
  ftpPathOnServer,
  ftpAuthType,    // Ajouter
  ftpSshKey,      // Ajouter
  // ... autres champs
} = group;
```

---

## 5. Backend : Modifications Controller

### 5.1 Fichier : `packages/server/group/group.controller.js`

**Ajouter la documentation API** (lignes ~68-70) :

```jsx
* @apiParam (Body) {String} [ftpAuthType] FTP auth type: 'password' (default) or 'ssh_key'
* @apiParam (Body) {String} [ftpSshKey] SSH private key for SFTP authentication
```

**Validation format clé SSH** (avant stockage) :

```jsx
// Fonction de validation
function validateSshKeyFormat(sshKey) {
  if (!sshKey || sshKey === CREDENTIAL_MASK) return { valid: true };

  const trimmed = sshKey.trim();
  const isPEM = trimmed.startsWith('-----BEGIN RSA PRIVATE KEY-----') ||
                trimmed.startsWith('-----BEGIN DSA PRIVATE KEY-----') ||
                trimmed.startsWith('-----BEGIN EC PRIVATE KEY-----');
  const isOpenSSH = trimmed.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----');

  if (!isPEM && !isOpenSSH) {
    return {
      valid: false,
      message: 'Format de clé SSH invalide. Formats acceptés : PEM ou OpenSSH.'
    };
  }

  if (!trimmed.includes('-----END')) {
    return {
      valid: false,
      message: 'Clé SSH incomplète : marqueur de fin manquant.'
    };
  }

  return { valid: true };
}
```

**Ajouter le masquage des credentials FTP** :

```jsx
// Constante en haut du fichier
const CREDENTIAL_MASK = '••••••••';

// Fonction helper
function maskFtpCredentials(group) {
  const groupObj = group.toObject ? group.toObject() : { ...group };
  if (groupObj.ftpPassword) {
    groupObj.ftpPassword = CREDENTIAL_MASK;
  }
  if (groupObj.ftpSshKey) {
    groupObj.ftpSshKey = CREDENTIAL_MASK;
  }
  return groupObj;
}
```

**Appliquer le masquage** dans les fonctions qui renvoient un groupe :

- `readOne()` - GET /groups/:groupId
- `create()` - POST /groups
- `update()` - PUT /groups/:groupId

**Filtrer les valeurs masquées à l'update** (avec support suppression explicite) :

```jsx
// Valeur spéciale pour suppression explicite
const DELETE_CREDENTIAL = '__DELETE__';

// Dans update(), avant de sauvegarder
function processCredentials(body) {
  const processed = { ...body };

  // ftpPassword
  if (processed.ftpPassword === CREDENTIAL_MASK) {
    delete processed.ftpPassword; // Préserver l'existant
  } else if (processed.ftpPassword === DELETE_CREDENTIAL) {
    processed.ftpPassword = ''; // Suppression explicite
  }

  // ftpSshKey
  if (processed.ftpSshKey === CREDENTIAL_MASK) {
    delete processed.ftpSshKey; // Préserver l'existant
  } else if (processed.ftpSshKey === DELETE_CREDENTIAL) {
    processed.ftpSshKey = ''; // Suppression explicite
  }

  return processed;
}
```

> **Stratégie de suppression** : L'utilisateur peut supprimer un credential en envoyant `__DELETE__` comme valeur. Une chaîne vide `''` préserve l'existant (comportement actuel).
> 

---

## 6. Backend : Endpoint Test Connexion FTP

### 6.1 Fichier : `packages/server/group/group.controller.js`

**Nouvel endpoint** :

```jsx
/**
 * @api {post} /groups/:groupId/test-ftp-connection Test FTP connection
 * @apiPermission admin
 */
async function testFtpConnection(req, res) {
  const { groupId } = req.params;
  const group = await Groups.findById(groupId);

  if (!group.downloadMailingWithFtpImages) {
    return res.json({ success: false, message: 'FTP non activé pour ce groupe' });
  }

  try {
    const ftpClient = new Ftp(
      group.ftpHost,
      group.ftpPort,
      group.ftpUsername,
      group.ftpPassword,
      group.ftpProtocol,
      { authType: group.ftpAuthType, sshKey: group.ftpSshKey }
    );

    // Test de connexion simple
    await ftpClient.client.connect(ftpClient.settings);
    const exists = await ftpClient.client.exists(group.ftpPathOnServer || './');
    await ftpClient.client.end();

    if (exists) {
      return res.json({ success: true, message: 'Connexion réussie' });
    } else {
      return res.json({
        success: false,
        message: `Chemin "${group.ftpPathOnServer}" introuvable sur le serveur`
      });
    }
  } catch (error) {
    // Messages d'erreur explicites
    let message = error.message;
    if (error.message.includes('authentication')) {
      message = 'Échec d\\'authentification. Vérifiez vos credentials (mot de passe ou clé SSH).';
    } else if (error.message.includes('getaddrinfo')) {
      message = `Hôte introuvable : ${group.ftpHost}`;
    } else if (error.message.includes('ECONNREFUSED')) {
      message = `Connexion refusée sur ${group.ftpHost}:${group.ftpPort}`;
    } else if (error.message.includes('privateKey')) {
      message = 'Clé SSH invalide ou format non supporté.';
    }
    return res.json({ success: false, message });
  }
}
```

### 6.2 Fichier : `packages/server/group/group.routes.js`

```jsx
router.post('/:groupId/test-ftp-connection', guard.isAdmin, groupController.testFtpConnection);
```

---

## 7. Frontend : Modifications UI

### 7.1 Fichier : `packages/ui/components/group/form.vue`

**Ajouter les options d'authentification** (dans `data()` ou en static) :

```jsx
ftpAuthOptions: [
  { text: 'Mot de passe', value: 'password' },
  { text: 'Clé SSH', value: 'ssh_key' },
],
```

**Modifier le template** (section FTP, lignes ~260-385) :

```html
<!-- Après ftpPort, avant ftpPathOnServer -->

<!-- Méthode d'authentification -->
<v-col cols="3">
  <v-select
    id="ftpAuthType"
    v-model="localModel.ftpAuthType"
    :label="$t('forms.group.ftpAuthType')"
    name="ftpAuthType"
    :disabled="disabled"
    :items="ftpAuthOptions"
  />
</v-col>

<!-- Mot de passe (visible si authType === 'password') -->
<v-col v-if="!localModel.ftpAuthType || localModel.ftpAuthType === 'password'" cols="3">
  <v-text-field
    id="ftpPassword"
    v-model="localModel.ftpPassword"
    type="password"
    :label="$t('global.password')"
    ...
  />
</v-col>

<!-- Clé SSH (visible si authType === 'ssh_key') -->
<v-col v-if="localModel.ftpAuthType === 'ssh_key'" cols="6">
  <v-textarea
    id="ftpSshKey"
    v-model="localModel.ftpSshKey"
    :label="$t('forms.group.ftpSshKey')"
    :placeholder="$t('forms.group.ftpSshKeyPlaceholder')"
    name="ftpSshKey"
    rows="4"
    :error-messages="requiredErrors('ftpSshKey')"
    :disabled="disabled"
    @input="$v.group.ftpSshKey.$touch()"
    @blur="$v.group.ftpSshKey.$touch()"
  />
</v-col>
```

**Modifier les validations** :

```jsx
validations() {
  const ftpValidations = {
    ftpHost: { required },
    ftpUsername: { required },
    // Validation conditionnelle
    ...(this.group.ftpAuthType === 'ssh_key'
      ? { ftpSshKey: { required } }
      : { ftpPassword: { required } }
    ),
    ftpPort: { required },
    ftpPathOnServer: { required },
    ftpEndPoint: { required },
    ftpButtonLabel: { required },
  };
  // ...
}
```

**Ajouter bouton Test Connexion** :

```html
<!-- Après les champs FTP, avant la fin de la section -->
<v-col cols="12">
  <v-btn
    outlined
    color="primary"
    :loading="testingFtpConnection"
    :disabled="!localModel.ftpHost || !localModel.ftpUsername"
    @click="testFtpConnection"
  >
    <v-icon left>mdi-connection</v-icon>
    {{ $t('forms.group.testFtpConnection') }}
  </v-btn>
  <span v-if="ftpConnectionResult" :class="ftpConnectionResult.success ? 'success--text' : 'error--text'" class="ml-3">
    {{ ftpConnectionResult.message }}
  </span>
</v-col>
```

```jsx
// Dans data()
testingFtpConnection: false,
ftpConnectionResult: null,

// Dans methods
async testFtpConnection() {
  this.testingFtpConnection = true;
  this.ftpConnectionResult = null;
  try {
    const response = await this.$axios.post(
      `/groups/${this.group.id}/test-ftp-connection`
    );
    this.ftpConnectionResult = response.data;
  } catch (error) {
    this.ftpConnectionResult = {
      success: false,
      message: error.response?.data?.message || 'Erreur de connexion'
    };
  } finally {
    this.testingFtpConnection = false;
  }
},
```

**Gestion suppression credential** (dans le composant) :

```jsx
// Ajouter un bouton "Supprimer" à côté des champs password/sshKey
// Qui envoie la valeur spéciale '__DELETE__'

clearFtpPassword() {
  this.localModel.ftpPassword = '__DELETE__';
},
clearFtpSshKey() {
  this.localModel.ftpSshKey = '__DELETE__';
},
```

---

## 8. Frontend : Traductions

### 8.1 Fichier : `packages/ui/helpers/locales/fr.js`

```jsx
// Dans forms.group
ftpAuthType: 'Méthode d\\'authentification',
ftpAuthTypePassword: 'Mot de passe',
ftpAuthTypeSshKey: 'Clé SSH',
ftpSshKey: 'Clé SSH privée',
ftpSshKeyPlaceholder: '-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----',
testFtpConnection: 'Tester la connexion',
ftpConnectionSuccess: 'Connexion réussie',
ftpConnectionFailed: 'Échec de connexion',
clearCredential: 'Supprimer',
```

### 8.2 Fichier : `packages/ui/helpers/locales/en.js`

```jsx
// Dans forms.group
ftpAuthType: 'Authentication method',
ftpAuthTypePassword: 'Password',
ftpAuthTypeSshKey: 'SSH Key',
ftpSshKey: 'SSH private key',
ftpSshKeyPlaceholder: '-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----',
testFtpConnection: 'Test connection',
ftpConnectionSuccess: 'Connection successful',
ftpConnectionFailed: 'Connection failed',
clearCredential: 'Clear',
```

---

## 9. Fichiers à modifier (résumé)

| Fichier | Modification |
| --- | --- |
| `package.json` | Upgrade ssh2-sftp-client 5.1.2 → 7.2.3 (version fixe) |
| `packages/server/group/group.schema.js` | Ajouter `ftpAuthType`, `ftpSshKey` + encryption |
| `packages/server/mailing/ftp-client.service.js` | Modifier constructeur pour SSH key |
| `packages/server/mailing/mailing.service.js` | Passer `ftpAuthType`, `ftpSshKey` à FTPClient |
| `packages/server/group/group.controller.js` | Validation SSH, masquage, test connexion, suppression credentials |
| `packages/server/group/group.routes.js` | Route POST test-ftp-connection |
| `packages/ui/components/group/form.vue` | UI auth method, test connexion, suppression credentials |
| `packages/ui/helpers/locales/fr.js` | Traductions FR |
| `packages/ui/helpers/locales/en.js` | Traductions EN |

---

## 10. Phases d'implémentation

### Phase 1 : Dépendances

1. Mettre à jour `package.json` (version fixe 7.2.3)
2. Exécuter `yarn install`
3. Vérifier que le build fonctionne

### Phase 2 : Backend Schema & Services

1. Modifier `group.schema.js` (nouveaux champs + encryption)
2. Modifier `ftp-client.service.js` (constructeur SSH key)
3. Modifier `mailing.service.js` (extraction et passage des params)

### Phase 3 : Backend Controller

1. Validation format clé SSH
2. Masquage credentials (`ftpPassword`, `ftpSshKey`)
3. Filtrage valeurs masquées à l'update + support suppression (`__DELETE__`)
4. Endpoint test connexion FTP
5. Messages d'erreur explicites
6. Route dans `group.routes.js`

### Phase 4 : Frontend

1. Modifier `form.vue` :
    - Sélection méthode auth
    - Champs conditionnels (password / SSH key)
    - Bouton test connexion
    - Bouton suppression credential
2. Ajouter traductions FR/EN
3. Ajuster validations

### Phase 5 : Tests

1. Tester avec authentification mot de passe (non-régression)
2. Tester avec clé RSA 2048
3. Tester validation format clé SSH
4. Tester test connexion (succès + erreurs)
5. Tester suppression credential
6. Vérifier le masquage des credentials
7. Vérifier la préservation des credentials à l'update

---

## 11. Points d'attention sécurité

- [x]  `ftpSshKey` chiffré en base via `encryptionPlugin`
- [x]  **Masquage API** : Masquer `ftpPassword` ET `ftpSshKey` dans les réponses
- [x]  **Validation format** : Valider format clé SSH (PEM/OpenSSH) avant stockage
- [x]  **Filtrage update** : Ne pas écraser si `CREDENTIAL_MASK`, permettre suppression avec `__DELETE__`
- [x]  **Erreurs explicites** : Messages clairs pour les erreurs d'authentification SSH

---

## 12. Hors scope

- Gestion des passphrases (demandé explicitement hors scope)
- Support Ed25519 (limitation Node 14)
