# Bauhaus Visual Generator 🎨

Éditeur graphique vectoriel (SVG) dans le navigateur pour composer des affiches et
visuels inspirés du **Bauhaus**. Glisse, aligne et exporte — 100 % côté client,
aucune installation côté serveur, tout est sauvegardé localement dans ton navigateur.

![Bauhaus](docs/Gemini_Generated_Image_wt0a5qwt0a5qwt0a.png)

## Fonctionnalités

- **Éléments** : texte, rectangle, cercle, triangle.
- **Manipulation directe sur le canvas** : déplacement, redimensionnement par 8 poignées.
- **Smart guides** : lignes d'alignement automatiques (bords + centres) pendant le drag.
- **Cotes de mesure dynamiques** : distances aux bords/voisins affichées en temps réel,
  détection d'espacement égal (distribution).
- **Alignement & distribution** automatiques depuis la barre latérale.
- **Z-order** : premier plan / arrière-plan.
- **Couleurs** : sélecteur + saisie hex + palette Bauhaus + couleurs mémorisées.
- **Polices** : Google Fonts (Montserrat, Outfit, Space Grotesk, Syne) + import de tes
  propres polices (OTF/TTF/WOFF).
- **Clavier** : flèches pour déplacer (Maj = pas de 10 px), Suppr/Backspace pour supprimer.
- **Export** : SVG, PNG, JPG.
- **Persistance** : ta composition est sauvegardée automatiquement (localStorage).

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Commande          | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Serveur de développement (HMR)       |
| `npm run build`   | Build de production (`tsc -b` + Vite)|
| `npm run lint`    | Analyse ESLint                       |
| `npm run preview` | Prévisualise le build de production  |

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react

## Documentation

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour le détail technique
(modèle de données, flux d'état, fonctionnement des smart guides, export).
