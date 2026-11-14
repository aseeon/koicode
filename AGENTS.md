# koicode

A Claude Code desktop mod (a plugin with a hooks module). Its goal is a backdrop of nicely animated koi fish swimming behind the chat.

## Status

One theme so far, picked on the `/koicode` card. The card and the theme handling started from Anthropic's `theme-examples` plugin (Apache-2.0, see `LICENSE`).

- Koi Pond (`hooks/koi-pond.ts`): our own, inspired by a reference video of mosaic koi. Every column of a koi's tiles rides the same closed path (`animateMotion` with `mpath` and `rotate="auto"`), started later by its distance behind the snout. So the body follows the head and bends into a C on turns, which is the main thing to keep. A CSS sway, a beat later per column, adds the swimming wave. Tiles never snap to a grid, which keeps them from flickering. There must be no gaps: tiles touch, and each one reaches a whole tile back under the column behind it, so on a turn a tile stretches up to twice its length instead of opening a hole. That only holds while no turn is tighter than `turnRadius(k)`, so `gentle()` eases every path to that radius. Draw paths as wide loops that do not cross themselves in small loops: easing folds those into cusps. Fins must stay joined to the body: each side and pelvic fin has a solid root block reaching under the body to the spine, drawn before the body, so flapping or bending never opens a gap at the joint. Keep tiles solid, with no opacity: see-through tiles that overlap show darker bands, so a faded tile is a color blended toward the app background (`APP_BG`). The scene has no background of its own: the app's background shows through. The theme's `glass` (blur, tint, opacity) frosts every app panel alike, the composer and chat bubbles included: the app cannot leave single panels out. Tiles are plain squares of color, with no glyph marks on them. The scene is about 97k of the 131,072 character limit, so check its length after changes.

## Layout

- `.claude-plugin/plugin.json`: manifest. The plugin name is `koicode`.
- `hooks/hooks.json`: names the hooks module.
- `hooks/register.tsx`: the `THEMES` list. `/koicode` places a card like `/custom-theme` in theme-examples: Clear and Close at the top, then Project, Session, Global and 20s Preview for each theme. A chosen scope's button shows a ✓.
  - Project stores the choice under `project:<session root>` and drops the session's own.
  - Session stores it under `session:<id>`. The id is `CLAUDE_CODE_HOST_SESSION_ID` (the desktop app's row) or `$.session.id()`.
  - Global stores it under `global`: the default for every project. It respects local choices: a project's or session's own still wins, and the card says so when one does here.
  - Clear deletes this session's, this project's and the global choice and takes the backdrop away now. Other projects' and sessions' choices stay. With nothing stored, no theme shows, so Clear turns koicode off until a theme is picked again.
  - 20s Preview shows a theme for 20 seconds, then goes back to what the session shows.
  - At `session.start` the session's own choice wins, then the project's, then the global one. With none, no theme shows and the engine is asked nothing, so another mod's theme is left alone. Each store value is a theme id.
  - `show()` sets the backdrop in the current shape and falls back to the older one (`id` and `colorScheme` inside the backdrop) that builds before about 2.1.320 take. The `claude` CLI that runs tests can be such an older build.
- `types/index.d.ts`: the contract for the `koicode.choice` state value.
- `hooks/koi-pond.ts`: builds the Koi Pond SVG. A new theme gets its own file and an entry in `THEMES`. Each file builds one SVG. Animate with CSS or SMIL inside the SVG. No scripts, no external loads, under 131,072 characters.

## Checks

```bash
claude plugin validate .
npx -p typescript tsc -p .
node scripts/check-koi-pond.mts
claude plugin test .
```

`check-koi-pond.mts` fails when the Koi Pond scene is over the size limit or a path turns tighter than its koi's gap-free radius. `claude plugin test .` runs `tests/*.test.tsx`, which check which stored choice wins at `session.start` (read from the card's checkmarks) and what Clear deletes.

To preview a scene, render it with Node (it runs `.ts` directly) to a `.svg` inside this folder and open that file in the browser pane. Delete the file afterwards.

## Development loop

`C:\Users\aseeon\.claude\dev-mods\<session-id>\koicode` is a directory junction to this folder, so the desktop app hot reloads edits when a turn ends.
