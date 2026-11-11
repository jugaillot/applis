# La Suite — applis.rdutemps.fr

Suite d'applis web personnelles de Julien (duo artistique Rdutemps, La Réunion), pour remplacer son usage ciblé d'Adobe et ses outils de travail.
Dépôt GitHub `jugaillot/applis`. Hébergement OVH (mutualisé, PHP) : **Julien publie lui-même en cliquant « Déployer » dans OVH** après chaque push.

## Façon de travailler avec Julien
- Répondre **en français**, brièvement. Pas de narration des étapes techniques ni de jargon : dire ce qui change pour lui.
- En cas de doute ergonomique ou technique, **poser la question (AskUserQuestion) avant de coder** plutôt que de partir sur une hypothèse.
- Après chaque changement : tester (Playwright), commit + push, puis résumer ce qui change et **rappeler de cliquer « Déployer » dans OVH** (et de recharger l'appli deux fois à cause du cache hors ligne).
- Il travaille sur Windows (Firefox/Chrome) et sur un portable Android.

## Les applis (une page HTML autonome par dossier)
| Dossier | Nom affiché | Rôle |
|---|---|---|
| `vecto/` | Vecto | dessin vectoriel (Paper.js), vectorisation de photos (potrace en worker), ouverture PDF/AI/SVG |
| `paysage/` | Paysage insulaire | compositions en calques Dessin / Aquarelle pour découpe laser, format par défaut 40 × 50 cm ; même base de code que Vecto |
| `plan/` | CAD | dessin technique (lignes de commande type AutoCAD : les lettres tapées sont des commandes) |
| `riso/` | Riso | séparation des couleurs pour risographie (formats A3, A4, A5, 30 × 30 sur A3 avec limite, personnalisé) |
| `compil/` | PDF | assembler, annoter, modifier le texte d'un PDF, imposer (n par feuille, livret), imprimer, exporter |
| `photo/` | Photo | retouche (réglages, zones, gomme/tampon, perspective, collage Ctrl+V dans la photo) |
| `mise/` | Mise en page | affiches/flyers, cadres de texte chaînés, import PowerPoint et PDF |
| `dossiers/` | Dossiers | documents Markdown stockés dans le dépôt GitHub `jugaillot/dossiers` (voir le CLAUDE.md de ce dépôt) |
| `envoyer/` | Envoyer un dessin | page mobile : photographier, redresser, (pré)vectoriser et envoyer vers un document Paysage/Vecto ouvert sur l'ordinateur |
| `bd/`, `civco/` | BD, Civco | collection de BD ; petit jeu coopératif |
| `index.html` | Accueil | rubriques Outils / Dessin / Projet / Perso, tuiles avec icône |

## Bibliothèques communes (`lib/`)
- `sync.js` — `AtelierSync` : enregistrement local (IndexedDB) + synchronisation serveur, fenêtre « Mes … » (`openDialog`) avec renommer ✎ et **historique des versions 🕘** (Ouvrir en copie / Revenir). Suit la version réellement ouverte (`seen`, `base`) : un contenu plus ancien ne peut plus écraser le serveur (il devient une copie « conflit »).
- `tabs.js` — onglets de documents (Vecto, Paysage, CAD, Riso) ; à la fermeture d'un document jamais enregistré, propose Enregistrer / Ne pas enregistrer / Annuler.
- `unsaved.js` — fenêtre « Enregistrer ? » + alerte du navigateur à la fermeture.
- `zoom.js` — outil Loupe (Z) et règle commune de la molette : **molette = défilement vertical, Alt + molette = zoom, Ctrl (ou Maj) + molette = horizontal**, pincement = zoom.
- `drop.js` — glisser-déposer de fichiers et fenêtre « Ouvrir avec quelle appli ? », transmission d'une appli à l'autre (`?ouvrir=1`).
- `inbox.js` — bandeau « 📷 photo reçue du portable » (boîte de réception par document).
- `help.js` (aide + réglages, `AtelierHelp.init`), `pptx.js` (lecture PowerPoint), `fonts.css`, et les libs tierces (pdf.js 3.11, pdf-lib, Paper.js, jsPDF, svg2pdf, Toast UI, docx).

## Serveur
- `api.php` : documents (`list`, `get`, `put` avec contrôle de version `base`, blobs), **versions** (`versions`, `getver` ; 30 par document), **boîte de réception** (`inbox_put` par morceaux de 700 Ko, `inbox_list`, `inbox_get`, `inbox_del`, `inbox_all`, `inbox_diag`). Données hors du web dans `ATELIER_DATA` (`../atelier-data`).
- `gate.php` + `.htaccess` : tout passe par la connexion (`login.php`), sauf `p/` (pages publiques) et `icons/`.
- `sw.js` : cache hors ligne. **Incrémenter `VERSION` (atelier-vNNN) à chaque changement** et ajouter tout nouveau fichier à `PRECACHE`.
- `manifest.webmanifest` : appli installable, associations de fichiers (pdf, images, svg/ai/eps, pptx, md/txt, dxf → accueil qui demande l'appli), raccourci « Envoyer un dessin ».

## Pièges déjà rencontrés (à ne pas refaire)
- **PHP OVH en 32 bits** : pas de `(int)` sur des millisecondes (dates en 1969) → `floor(microtime(true)*1000)` / `(float)`.
- Un avertissement PHP affiché avant la réponse force un code 200 : `display_errors` est coupé dans `api.php`, et le client vérifie `{ok:true}` dans la réponse, pas seulement `r.ok`.
- Taille des requêtes limitée chez OVH → envois découpés en morceaux.
- Un élément avec `display:flex` en style inline ignore l'attribut `hidden` : utiliser `style.display`.
- Erreurs « ResizeObserver loop » : ignorées par le gestionnaire d'erreurs de démarrage des applis.
- Paper.js : copier une forme dans l'espace page avec `clone()` puis `transform(parent.globalMatrix)` ; `hitTest` avec `curves:true` pour les formes sans contour.
- Canvas : remettre `setTransform(1,0,0,1,0,0)` avant de composer (certaines fonctions laissent une transformation).
- PDF (compil) : regrouper les morceaux de texte d'une même ligne **sans franchir les grands blancs** (colonnes de tableau).

## Tester
- Pages statiques : `python3 -m http.server` dans le dépôt ; avec l'API : `ATELIER_DATA=<dossier temporaire> php -S localhost:PORT -t .`.
- Playwright (Chromium préinstallé : `require('playwright')`), captures d'écran pour vérifier visuellement. Pas de Firefox disponible pour les tests.

## Git
- Messages de commit en français : `<Appli> : <ce qui change>`.
- Pied de commit (obligatoire) : `Co-Authored-By: Claude …` + `Claude-Session: …` tels que fournis par la session.
