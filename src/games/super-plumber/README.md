# Super Plumber

A small platformer after the first level of the classic plumber game: run right,
jump over pits and pipes, stomp walkers and reach the flagpole before the clock
runs out. There is one level.

## How to play

- **Left / right arrows** or **A / D** to run, **up arrow**, **W** or **Space** to
  jump. Let go of jump early for a short hop.
- Jump into a **?** block from below to get its coin. Brick and used blocks are
  just solid.
- Land on a walker to stomp it. Touching a walker any other way costs a life.
- Falling into a pit, or the clock reaching 0, also costs a life. You have 3
  lives, and after losing one the level starts again from the beginning. Your
  score and coins carry over, and the ? blocks fill up again.
- The screen only scrolls right, so you can't walk back.
- The round ends when you touch the flagpole or lose your last life. Press Enter
  or click to play again.

## Scoring

| What                  | Points                              |
| --------------------- | ----------------------------------- |
| Coin from a ? block   | 200                                 |
| Stomping a walker     | 100                                 |
| Reaching the flagpole | 100 to 5000, more the higher up     |
| Time left at the flag | 50 for every unit left on the clock |

The clock starts at 300 and loses a unit every 0.4 seconds. Your final score is
saved to the carnival's score board when the round ends, whether you won or not.

## Files

- `game.ts`: the level (`buildLevel`), the game logic (`createState`, `step`,
  `bump`, `flagBonus`, `isSolid`) and the `superPlumber` entry, the default
  export the midway finds.
- `game.test.ts`: tests for the game logic.
