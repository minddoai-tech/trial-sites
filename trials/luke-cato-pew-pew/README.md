# Cato pew pew

Open `index.html` in a desktop browser. All game code is included; no build, installation, network connection, or external assets are needed. Fonts use the system font stack. For static hosting, upload the contents of this folder so that `index.html` is at the hosting root.

Move with WASD or arrows in first person. Point and hold click to shoot (or hold F). Turn with Q/R or hold the right mouse button and drag to look around. Space jumps, E dances, Escape pauses. Optional L captures the mouse for standard FPS aiming; gameplay also works when embedded browsers block mouse lock. Choose movement keys in Settings. All three maps use daytime skies.

Knock out 10 computer-controlled cats to win. Hits earn 10 XP; knockouts add 25 XP; a win adds 100 XP. Spend XP in the shop and map menu. Progress is saved in browser local storage. Every hit applies physical knockback; knockouts launch cats into the air. Maps are fictional real-world-inspired water park, hotel, and beach locations.

This is a solo game with bots, not online multiplayer. The lightweight renderer projects 3D geometry to Canvas without external game dependencies.

Five green health packs spawn around each map. Walk into one to restore up to 35 health; used packs respawn after 20 seconds of active gameplay. Full-health players leave packs available. Maps are now 48 units across (formerly 40), with three open-front hiding shelters and extra cover. Enemy sight and shots are blocked by solid cover. Shallow water uses animated tiles with matching ground boundaries. Rounded cat meshes have fur markings, whiskers, eyes, ears, and tails. WebGL depth testing resolves scenery overlaps, with a Canvas fallback when WebGL is unavailable.

Settings offer Easy (1× XP), Normal (1.5× XP), and Hard (2× XP). Higher difficulty increases enemy speed, firing frequency, and damage. Each reward is rounded to a whole XP point. Map structures are solid; jump onto low platforms and climb the waterpark/hotel stairs by jumping. Solid structures also stop shots.

Six guns are available: Paw Blaster, Zoomies SMG, Big Booper, Bubble Blaster (500 XP, fast fire), Purrcision Sniper (700 XP, 100 damage and long range), and Paw Cannon (950 XP, heavy knockback).
