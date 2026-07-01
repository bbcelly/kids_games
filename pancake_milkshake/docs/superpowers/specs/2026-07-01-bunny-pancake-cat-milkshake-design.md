# Bunny Pancake, Cat Milkshake — Design

## Concept

A hypnotically cute one-screen tap game inspired by the in-movie mobile game
from *Wreck-It Ralph 2: Ralph Breaks the Internet*. A **bunny** sits on the
left and a **cat** on the right. Orders pop up and the player taps the correct
animal to feed it: **pancakes → bunny**, **milkshakes → cat**. The tempo
escalates. Three mistakes ends the run.

Ships as a single self-contained `index.html` (inline CSS + JS + Canvas). No
assets, no build step, no network. Works with touch and mouse.

## Platform & Tech

- Single `index.html`. Everything inline.
- `requestAnimationFrame` game loop; Canvas for animation, a little DOM for
  overlays/buttons.
- State machine: `TITLE → PLAYING → GAMEOVER`.
- Emoji-based art (🐰 🐱 🥞 🥤 ❤️ ✨) so it is zero-asset and instantly cute.
- High score persisted in `localStorage`.
- Optional tiny WebAudio blips for feed/miss (synthesized, no files).

## Screen Layout (portrait, mobile-first)

- **Top bar:** score, high score, and 3 hearts for lives.
- **Center:** the current order — a big food item floating above, with a
  countdown ring showing remaining time.
- **Bottom:** two large tap zones — bunny (left) and cat (right), each half the
  screen width, sized big for little fingers.

## Core Loop

1. An order spawns: a random food (pancake or milkshake) with a time limit.
2. Player taps an animal:
   - Correct match (pancake→bunny, milkshake→cat) → feed animation, +points,
     happy bounce, combo increments.
   - Wrong animal, or timer expires → **miss**: lose a heart, sad shake, combo
     resets.
3. Next order spawns immediately after resolution.
4. Difficulty ramp: every few successful feeds the time limit shrinks (down to a
   floor) and points-per-feed grows. This produces the film's giddy speed-up.
5. At 3 misses → GAMEOVER card: final score, high score, "Play Again" button.

## Feel / Juice (the point of this game)

- Squash-and-stretch bounce on the fed animal.
- Floating hearts / sparkles on a correct feed; screen shake + red flash on a
  miss.
- Combo counter for streaks with a small score multiplier.
- Chunky pastel candy palette, big rounded shapes.

## Difficulty Numbers (starting point, tune during build)

- Initial order time limit: ~2.2s.
- Time limit shrinks ~6% per feed, floor ~0.75s.
- Base points 10 per feed; combo adds a mild multiplier.
- 3 lives.

## State Model

- `TITLE`: title card + "Tap to Play".
- `PLAYING`: active loop with score, combo, lives, current order + timer.
- `GAMEOVER`: results + replay. Replay returns to a fresh `PLAYING`.

## Out of Scope (YAGNI)

- Sound files (only synthesized WebAudio blips, if any).
- Multiplayer, accounts, leaderboards beyond local high score.
- Levels/menus beyond title and game-over.
- App store packaging (it is a single HTML file).

## Success Criteria

- Opening `index.html` in a browser starts at the title, plays end-to-end, and
  reaches game-over after 3 misses.
- Correct/incorrect feeds and timeout misses all resolve correctly.
- Difficulty visibly ramps.
- High score persists across reloads.
- Playable with both touch and mouse; responsive in portrait.
