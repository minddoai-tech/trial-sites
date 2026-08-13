# Trial Sites

Public gallery for websites students build during Minddo AI Builders trial classes.

Live gallery: [https://minddoai-tech.github.io/trial-sites/trials/](https://minddoai-tech.github.io/trial-sites/trials/)

## How it works

Instructors publish from Lesson 3 on the learn site. The publish step unpacks a ZIP, writes it under `trials/{slug}/`, adds a thumbnail, and updates `trials/sites.json`.

Each `sites.json` entry includes `trialId` (Minddo trial course id) and optional `studentId` (Minddo student account id when assigned). Resubmits for the same trial/student replace that entry. If the site title changes and the slug changes, the old folder is removed from the repo.

Do not edit `trials/sites.json` or student folders by hand unless you are fixing a broken publish.

## Layout

```
index.html              → redirects to trials/
trials/index.html       → gallery (Minddo marketing styling)
trials/css/gallery.css
trials/js/gallery.js
trials/sites.json
trials/john-doe-pixel-party/
  index.html
  thumb.png
.nojekyll
```

## GitHub Pages

Settings → Pages → Deploy from `main` / root (`/`).

Project site URL: `https://minddoai-tech.github.io/trial-sites/`

Student sites must use relative asset paths because they are served under `/trial-sites/trials/{slug}/`.
