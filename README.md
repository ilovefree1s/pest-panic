# Pest Panic Online

A 3D bug-swarm survival game for the browser. Squash ants, flies and spiders in a
kitchen with bug-killer gear, survive a new bug boss every 3 minutes (Roach Queen, Spider King, Ant Prince, Fly Lord, then king-and-queen pairs), and play solo
or online co-op with up to 4 friends.

**Play:** https://ilovefree1s.github.io/pest-panic/

## How to play
- Move with WASD / arrow keys, the on-screen stick on phones, or a controller (PS5, Xbox).
- Your gear fires on its own. Bugs drop coins; grab them to level up and pick new gear.
- **Online:** type your name, press **Host online** and share the 5-letter room code.
  Friends type the code and press **Join**. The host's device runs the game.

## How it works
- Rendering: three.js (WebGL) with bloom, shadows and environment reflections.
- Multiplayer: Supabase Realtime broadcast + presence. No database tables are used.
- `index.html` is the whole game. `src/` holds the pieces it is built from
  (`python3 src/build.py` assembles them).
