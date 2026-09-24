# LOLbrawl

A top-down brawler where every fighter is the word **`lol`**: the `o` is the head, and each `l` is an arm. You punch with the arms, kick with them and hold guns in them. Bullets are `*`.

Everything is drawn with text on a canvas: `#` walls and rocks, `~` water and the storm edge, and letters that fly apart when a lol goes down.

## Modes

- **Solo:** waves of angry lols, including fast ones, big ones, ones that throw their own arm, shield lols, gunner lols, and a HUGE LOL boss every 5th wave.
- **Co-op:** two lols against the horde, on one screen or online.
- **Versus:** lol vs lol, best of 3 rounds, on one screen or online.
- **Battle royale:** 16 lols on a big scrolling map with rocks for cover and a closing storm. You can play solo or in duos with knock and revive, against bots or online with a friend.

## Fighting

| Move | What it does |
|---|---|
| Punch | Fast jabs. Every 3rd punch in a row is a **hook** that launches, and launched lols (even dead ones) smash into others. |
| Kick | Slow, launches, drains guard. 1.1 s cooldown (pink ring). |
| Block | Hold it to take only chip damage from the front. An empty guard meter means **guard break**. |
| Parry | Start blocking right before a hit to stun the attacker. Bullets and thrown `l`s bounce back. |
| Dash | A quick burst. Nothing can hit you mid-dash. |
| Guns | Walk over a floating `l`. Types: pistol, shotgun, smg (hold to fire), sniper (goes through enemies), rocket (explodes). |

## Controls

| | Keyboard + mouse | Controller |
|---|---|---|
| Move | WASD | Left stick / d-pad |
| Aim | Mouse | Right stick |
| Punch / shoot | Left click or F | A / X |
| Kick | E | B / Y |
| Block (hold) | Right click or Q | RB / RT |
| Dash | Space | LB / LT |
| Pause | Tab | Start |
| Sound on/off | M | |

On phones you get a touch joystick and buttons. Local two-player needs a controller for P2.

## Playing it

- **In a browser:** open `index.html`, or the GitHub Pages link if it's turned on. Solo, local co-op and versus, and battle royale against bots all work there.
- **On claude.ai (as a Claude artifact):** everything above, plus **online play** (co-op, versus and battle royale via Quick Play) and a shared **leaderboard**. Those two use the artifact's live room and database, which only exist on claude.ai.

## Editing

- `lolbrawl.html` is the source. It's written for Claude artifacts, so it has no `<!doctype>`/`<head>` of its own.
- After editing it, run `bash build.sh` to regenerate `index.html`, the standalone copy.
- `bash tests/run.sh` runs the game headlessly with fake canvas, input, room and database stubs. It covers every mode, the online sync between a simulated host and guest, and the leaderboard. You need [Node.js](https://nodejs.org).
