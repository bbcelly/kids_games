# Goal: Bunny Pancake, Cat Milkshake

Build a small, joyful arcade game inspired by the hypnotically cute mobile
game that Vanellope plays in *Wreck-It Ralph 2: Ralph Breaks the Internet*
("Bunny pancake… kitty milkshake…"). The whole point is charm and giddy
escalating speed — it should make a young kid (and an adult) grin.

> This brief describes **what** to build and **how it should feel**, not how to
> build it. All technology choices — engine, language, platform, how it's
> packaged or distributed — are intentionally left open and should be decided
> fresh at rebuild time based on what's available and what fits best.

## The Experience

- A **bunny** lives on one side of the screen and a **cat** on the other.
- Orders appear one at a time: a **pancake** or a **milkshake**, each with a
  shrinking time limit shown as a visible countdown.
- The player feeds the order to the correct animal: **pancakes go to the
  bunny, milkshakes go to the cat.**
- Feeding the right animal in time = a happy feed, points, and a satisfying
  reaction. Feeding the wrong animal, or letting the timer run out = a miss.
- The next order appears immediately, so play is continuous and rhythmic.

## Progression

- **Endless**, and it **speeds up** the longer you last: the time limit shrinks
  and points grow, building to a frantic, funny tempo.
- Reward streaks — consecutive correct feeds should feel better and score more
  (a combo of some kind).
- **Three misses ends the run.** Show the final score and a personal best that
  survives between sessions, and let the player instantly play again.

## Look & Feel (the most important part)

- **Adorable, candy-colored, hyper-cute.** Soft pastels, rounded chunky shapes,
  a sugary world. Commit fully to the cuteness — this is the memorable thing.
- The bunny and cat should have **personality**: idle movement, a delighted
  reaction when fed, a sad reaction on a miss.
- Lots of **juice**: bouncy animations, sparkles/hearts on a good feed, a bit of
  screen feedback on a miss, a lively background rather than a flat color.
- Cheerful, chunky, playful presentation for the title, score, lives, and
  game-over — matching the film's giddy tone.
- Small, friendly sound feedback for feeds and misses is a plus.

## Controls

- **Primary: touch/tap** — big, forgiving targets on each side, sized for small
  fingers. It must feel great on a phone or tablet.
- Also support an equivalent **keyboard** way to play on desktop (e.g. left/right
  for the two animals; a key to start / restart).

## Audience & Scope

- **Audience:** young kids first, but instantly fun for anyone.
- **Keep it tight (YAGNI):** just a title screen, the core play loop, and a
  game-over/replay screen. No accounts, no menus beyond those, no levels, no
  multiplayer. A local high score is enough.

## Done When

- It opens to a title, plays end-to-end, and reaches game-over after three
  misses.
- Correct feeds, wrong-animal misses, and timeouts all resolve correctly.
- Difficulty visibly ramps up.
- The personal best persists across restarts.
- It's genuinely cute and fun to play with touch, and playable on desktop too.
