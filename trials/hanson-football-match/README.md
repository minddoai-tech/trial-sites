# First to Three — Pocket Football

Open `index.html` in any modern browser. No installation, build step, internet connection, or server required. Keep `index.html`, `style.css`, and `game.js` together.

- Move: WASD or arrow keys. Hold S for at least 190 ms to move down.
- Shoot: tap S (release within 190 ms), press Space, or use the touch Shoot button. Get within 65 pixels of the ball first.
- Shots aim at the right goal. Hold W / Up to aim high, or Down to aim low. Walk into the ball to dribble.
- Defend the left goal. First to 3 wins; win all ten increasingly fast levels to become champion.
- Pause/resume: P, Escape, or the Pause button. Switching away automatically pauses.
- Start in the Lobby. Select any unlocked level; each win unlocks the next one. Replays also earn points.
- A completed win earns 3 upgrade points; a completed loss earns 1. Restarting or leaving an unfinished match earns nothing.
- Buy speed and shot-power upgrades in the Lobby. Each has five tiers costing 3, 4, 5, 6, and 7 points.
- Speed increases from 255 to 330 pixels/second (+15 per tier, about +29% maximum). Shot power increases from 545 to 870 pixels/second (+65 per tier, about +60% maximum), independent of the selected level.
- Points, upgrades, and unlocked levels save in this browser's local storage. If storage is unavailable, a lobby notice explains that progress lasts only for the current visit. Clearing browser data clears the save.
- Restart begins a fresh match; Lobby / leave match returns to the upgrade shop. After each result, return to the lobby to upgrade, retry, or continue.
- On touch screens, use the on-screen direction and shoot buttons.

The JavaScript contains the level settings, input handling, match state, NPC behavior, ball physics, and canvas rendering. The page and styling are kept in their own files. No external assets or libraries are used.

## Static hosting

Upload the contents of `pocket-football-static.zip`, or extract it into your host's publish directory. The archive contains `index.html`, `style.css`, `game.js`, and this README directly at its root. No build command, package installation, or development server is needed. All asset links are relative, so the game also works in a subdirectory.

Graphics are drawn on the canvas and fonts use the system font stack; there are no image, audio, or font files to upload. Saved progress belongs to the browser and site address where you play; local-file progress does not transfer automatically to the hosted site.
