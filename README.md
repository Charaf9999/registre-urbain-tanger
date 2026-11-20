# Registre urbain de Tanger

**M115 · Smart City & Blockchain**  
Charaf Eddine Ifrinchaou · Master IDIA · FST Tanger

Un citoyen déclare une panne d’éclairage. La municipalité affecte une équipe, suit la réparation et clôt le dossier. Toute personne peut retrouver la fiche et lire l’historique, même sans portefeuille. La démonstration utilise des signalements fictifs situés à Tanger.

**Pour voir le résultat immédiatement**, ouvrez [la vidéo de démonstration](preuves/demonstration.mp4). Les commandes ci-dessous permettent de reproduire le scénario sur un réseau Hardhat neuf.

## Livrables

| Travail demandé | Fichier ou point d’entrée |
|---|---|
| Smart contract Solidity | [UrbanIssueRegistry.sol](contracts/UrbanIssueRegistry.sol) |
| Tests Hardhat | [13 tests du contrat](test/UrbanIssueRegistry.ts) et [résultat d’exécution](preuves/tests.txt) |
| Interface React, Vite, ethers.js et MetaMask | [Sources du frontend](frontend/src/) |
| Import Excel ou CSV avec aperçu et sélection | Onglet **Importer** et [fichier urban_issues.xlsx](frontend/public/urban_issues.xlsx) |
| Adresse et preuve du déploiement | [Configuration et ABI](frontend/src/registry.json) et [reçus de la démonstration](preuves/transactions.json) |
| Captures d’écran | [Déclaration](preuves/01-declaration.png), [affectation](preuves/02-affectation.png), [historique](preuves/03-historique.png), [import](preuves/04-import-excel.png), [registre final](preuves/05-registre.png) |
| Démonstration filmée | [demonstration.mp4](preuves/demonstration.mp4) |

## Installation et lancement

Environnement utilisé pour les tests : Node.js 24.14.0, npm 11.9.0, Hardhat 3.22.0 et Solidity 0.8.34. Ouvrir dans VS Code le dossier qui contient ce README et son package.json. La première installation et le premier téléchargement du compilateur nécessitent Internet.

**Terminal 1 — installer, tester et démarrer le réseau**

```powershell
npm ci
npm --prefix frontend ci
npm test
npm run node
```

Laisser le terminal du nœud ouvert. Il affiche les adresses et les clés des comptes fictifs préfinancés de ce réseau local. Si PowerShell bloque le lancement de npm.ps1, utiliser la commande npm.cmd à la place de npm.

**Terminal 2 — déployer et ouvrir l’interface**

```powershell
npm run deploy
npm run dev
```

Ouvrir **http://127.0.0.1:5175**. La commande de déploiement met à jour automatiquement l’adresse, le compte municipal et l’ABI dans le frontend. Le registre démarre vide. Pour vérifier la compilation de production du frontend, exécuter `npm run build`.

### Comptes MetaMask pour la soutenance

1. Ouvrir la page dans un profil de navigateur de démonstration équipé de MetaMask. La consultation du registre est publique.
2. Dans ce profil de test, importer les comptes Hardhat **#0** et **#1** avec les clés de développement affichées par le terminal du nœud. Les utiliser uniquement sur ce réseau local.
3. Cliquer sur **Connecter MetaMask**. Autoriser la connexion et l’ajout ou le changement de réseau. Pour une configuration manuelle, saisir les valeurs du tableau ci-dessous.
4. Utiliser **#1 comme citoyen** pour déclarer un problème. Passer au **compte #0, municipalité**, pour gérer sa fiche. Si le nouveau compte n’apparaît pas, autoriser ce compte pour le site dans MetaMask. L’en-tête affiche le rôle et la fin de l’adresse active.

| Paramètre | Valeur du déploiement de démonstration |
|---|---|
| Réseau | M115 Tanger · Hardhat local |
| RPC | http://127.0.0.1:8555 |
| Chain ID | 31115 |
| Symbole | ETH |
| Adresse du contrat | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Déployeur / municipalité | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Citoyen utilisé dans la vidéo | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |

Le nœud Hardhat conserve l’état en mémoire. Après un redémarrage du nœud, relancer le déploiement et recréer ou importer les données. Un nouveau déploiement sur un nœud déjà utilisé peut produire une adresse différente. L’interface lit toujours la dernière adresse écrite par le script.

## Rejouer le scénario de la vidéo

1. Avec **#1**, ouvrir **Déclarer**. Saisir `CITY-2026-010`, choisir *Éclairage*, indiquer *Boulevard Pasteur, Tanger*, décrire la panne, choisir une priorité haute et le pseudonyme *Citizen10*. Publier et confirmer dans MetaMask.
2. Avec **#0**, ouvrir la fiche. Affecter *UrbanTeam01* et commenter l’intervention. Valider ensuite les étapes **En cours**, **Résolu**, puis **Clôturé**, chacune avec son propre commentaire.
3. Dans **Importer**, choisir [urban_issues.xlsx](frontend/public/urban_issues.xlsx). Cocher les lignes terminant par **001, 002 et 004**. Laisser **003** décochée, puis confirmer l’enregistrement. Une seule transaction enregistre les trois lignes.
4. Dans **Registre**, rechercher `CITY-2026-010` par son identifiant. Sa fiche montre **cinq entrées** avec l’acteur, l’heure du bloc, le statut ainsi que l’équipe et le commentaire lorsqu’ils existent. Sur un réseau initialement vide, les compteurs finaux sont **4 signalements**, **2 en attente d’affectation** et **2 résolus ou clôturés**.

## Données et règles du contrat

Le parcours normal est **Reported → Assigned → InProgress → Resolved → Closed**. La création est ouverte à tout portefeuille connecté. Le contrat réserve l’affectation, la réaffectation et le changement de statut au déployeur municipal. Une réaffectation pendant une intervention conserve le statut *InProgress*. Une clôture termine le traitement.

L’import lit la première feuille du classeur avec SheetJS, ou un fichier CSV avec en-têtes. Les neuf noms de colonnes du sujet sont obligatoires et leur ordre est libre.

| Colonne | Règle |
|---|---|
| issueId | Identifiant unique de 1 à 32 caractères parmi A–Z, 0–9 et le tiret |
| issueType | Type de problème, par exemple StreetLight, Road ou Water |
| location | Emplacement fictif du problème |
| description | Description du problème |
| reportDate | Date déclarée entre 2000 et 2099, au format AAAA-MM-JJ ou date Excel |
| priority | Low, Medium ou High |
| reportedBy | Pseudonyme fictif du déclarant |
| assignedTo | Nom d’équipe facultatif pour Reported et obligatoire pour les états suivants |
| status | Reported, Assigned, InProgress, Resolved ou Closed |

Un citoyen peut importer des déclarations *Reported* sans équipe. La municipalité peut reprendre un état ou une équipe provenant du fichier. La ligne 001 reproduit le cas du sujet où *Reported* possède déjà une équipe renseignée. L’affectation formelle la fait passer à *Assigned*. Pour une ligne importée déjà résolue, l’historique commence à l’import et indique l’état repris. La date du fichier reste distincte de l’heure de son inscription sur la chaîne.

L’aperçu signale les champs invalides, les dates impossibles, les doublons internes et les identifiants déjà enregistrés. Le contrat vérifie les données à l’écriture. Un lot contient de **1 à 10 lignes** et sa validation est atomique. En cas de conflit, aucune ligne du lot n’est ajoutée. Le frontend affiche les refus du portefeuille, les erreurs de transaction et la confirmation avec le numéro de bloc et le hash.

## Résultats vérifiés

- Les **13 tests du contrat** couvrent la création, les événements, l’identité de l’acteur, la chronologie, les permissions, la réaffectation, les transitions interdites et les imports atomiques.
- La vidéo et les cinq captures proviennent de l’interface React exécutée dans Chromium. Deux comptes de test, via un fournisseur compatible EIP-1193, ont émis **six transactions confirmées** sur un réseau Hardhat local en processus. Les reçus comprennent la déclaration, l’affectation, trois changements de statut et l’import groupé.
- La recherche publique après déconnexion, la lecture du fichier Excel, la détection de doublons sur chaîne et le rejet de lignes CSV invalides ont été contrôlés dans le navigateur.
- L’extension MetaMask réelle a été détectée séparément dans un profil de test. La confirmation manuelle dans sa fenêtre reste à vérifier lors de la répétition sur ordinateur.

## Références

- Énoncé du module M115, *Mini-Projet — Smart City & Blockchain*, « Plateforme décentralisée de gestion des services urbains », pages 1 à 3.
- [Hardhat — Tests avec ethers.js et Mocha](https://hardhat.org/docs/guides/testing/using-ethers)
- [ethers.js — Connexion et interaction avec les contrats](https://docs.ethers.org/v6/getting-started/)
- [MetaMask — API du fournisseur Ethereum](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/)
- [SheetJS — Import de données](https://docs.sheetjs.com/docs/solutions/input/)
