import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeBackdropGlass, ThemeSetArgs, Timer } from 'claude-code'

import { koiPondSvg } from './koi-pond'
import type { KoiChoice } from '../types'

const PLUGIN = 'koicode'
const COMMAND = 'koicode'
const CARD = 'koicode-card'
const PREVIEW_MS = 20_000
// Store keys, each holding a theme id. A session's own choice wins over its project's, a project's over the global
// one; with none, no theme shows.
const GLOBAL_KEY = 'global'
const PROJECT_PREFIX = 'project:'
const SESSION_PREFIX = 'session:'

type Theme = { id: string; title: string; blurb: string; alt: string; glass: ThemeBackdropGlass; scene: () => string }

const THEMES: readonly Theme[] = [
  {
    id: 'koi-pond',
    title: 'Koi Pond',
    blurb: 'Tile mosaic koi swimming slow, bending loops over a dark pond',
    alt: 'Mosaic koi swimming through a dark pond',
    glass: { blur: 10, tint: '#191917', opacity: 0.36 },
    scene: koiPondSvg,
  },
]

const themeOf = (id: unknown): Theme | undefined => THEMES.find(theme => theme.id === id)

const built = new Map<string, string>()
function sceneOf(theme: Theme): string {
  const ready = built.get(theme.id) ?? theme.scene()
  built.set(theme.id, ready)
  return ready
}

// The loader's scan reads this reference: both names are written as string literals.
const choice = atom({ plugin: 'koicode', key: 'choice' } as const, {}, { shape: 'choice-3' })

// A preview's end: the module's own, so a reload drops it (session.start clears a preview left in the state).
let previewEnding: Timer | undefined

type CardElements = Pick<ReturnType<EngineInterface['ui']['resolve']>, 'Box' | 'Text' | 'Button'>

// ponytail: the project is the session's root folder, so a git worktree counts as its own project.
// theme-examples' project-key.ts maps worktrees to the main tree, if that ever matters.
async function projectKey($: EngineInterface): Promise<string> {
  return `${PROJECT_PREFIX}${await $.session.root()}`
}

/** One per row in the desktop app (it outlives /clear), else one per Claude Code session. */
// ponytail: one store key per session that picks "Session", never pruned. Cap it if the store grows.
async function sessionKey($: EngineInterface): Promise<string> {
  const host = await $.env.get('CLAUDE_CODE_HOST_SESSION_ID').catch(() => undefined)
  return `${SESSION_PREFIX}${host || (await $.session.id())}`
}

/** Puts a theme behind the chat, or with none clears it. Answers why nothing draws it, if so. */
async function show($: EngineInterface, theme: Theme | undefined): Promise<string | undefined> {
  if (theme === undefined) {
    // Clears whatever theme stands, any mod's: called only on the person's ask or to end our own preview.
    await $.theme.clear()
    return undefined
  }
  // The scene is made for a dark window. Builds before about 2.1.320 refuse `overrideColorScheme` and take the
  // older shape: the scene's name as `id`, the window's kind inside the backdrop. So that shape is the fallback.
  const set = await $.theme
    .set({ backdrop: { scene: theme.id, glass: theme.glass }, overrideColorScheme: 'dark' })
    .catch(error => {
      if (!String(error).includes('overrideColorScheme')) throw error
      const older = { backdrop: { id: theme.id, glass: theme.glass, colorScheme: 'dark' } }
      return $.theme.set(older as unknown as ThemeSetArgs)
    })
  return set.isDrawn ? undefined : set.reason
}

type Scope = 'session' | 'project' | 'global'

/** What this session is due: its own choice, else its project's, else the global one; with none, nothing. */
async function stored($: EngineInterface): Promise<{ theme: Theme; scope: Scope } | undefined> {
  const keys: [Scope, string][] = [['session', await sessionKey($)], ['project', await projectKey($)], ['global', GLOBAL_KEY]]
  for (const [scope, key] of keys) {
    const value = await $.store.get(key)
    const theme = themeOf(value)
    if (theme !== undefined) return { theme, scope }
  }
  return undefined
}

/**
 * Applies a theme to this session alone, to the project (dropping the session's own choice), or globally.
 * Global sets only the default for every project: a project's or a session's own choice still wins over it.
 * Answers a line for the person when there is one: why nothing draws, or that a local choice still wins here.
 */
async function apply($: EngineInterface, theme: Theme, scope: Scope): Promise<string | undefined> {
  previewEnding?.cancel()
  const value = theme.id
  if (scope === 'global') {
    await $.store.set(GLOBAL_KEY, value)
    // The global choice was just stored, so something is due.
    const due = (await stored($)) ?? { theme, scope }
    const unshown = await show($, due.theme)
    await update($, choice, was => ({ ...was, applied: due.theme.id, scope: due.scope, preview: undefined }))
    return due.scope === 'global' ? unshown : `Saved as the global theme. This ${due.scope} has its own choice, which still wins here.`
  }
  const unshown = await show($, theme)
  if (scope === 'session') {
    await $.store.set(await sessionKey($), value)
  } else {
    await $.store.delete(await sessionKey($))
    await $.store.set(await projectKey($), value)
  }
  await update($, choice, was => ({ ...was, applied: theme.id, scope, preview: undefined }))
  return unshown
}

/**
 * Clears this session's, this project's and the global choice, and takes the backdrop away now.
 * Other projects' and sessions' own choices stay. With nothing stored, no theme shows until one is picked.
 */
async function clear($: EngineInterface): Promise<string | undefined> {
  previewEnding?.cancel()
  for (const key of [await sessionKey($), await projectKey($), GLOBAL_KEY]) await $.store.delete(key)
  await show($, undefined)
  await update($, choice, was => ({ ...was, applied: undefined, scope: undefined, preview: undefined }))
  return undefined
}

/** Shows a theme for a while, then goes back to what the session shows. */
async function preview($: EngineInterface, theme: Theme): Promise<string | undefined> {
  previewEnding?.cancel()
  const unshown = await show($, theme)
  await update($, choice, was => ({ ...was, preview: theme.id }))
  previewEnding = $.clock.after(PREVIEW_MS, () => void endPreview($, theme.id))
  return unshown
}

async function endPreview($: EngineInterface, id: string): Promise<void> {
  const now = await read($, choice)
  if (now.preview !== id) return
  try {
    await show($, themeOf(now.applied))
  } catch (error) {
    void $.ui.log(`koicode: the preview could not end (${String(error)})`)
  }
  await update($, choice, was => ({ ...was, preview: undefined }))
}

/** A press on the card: runs the step, tells the person its line if any, and closes the card unless asked to stay. */
async function press($: EngineInterface, step: () => Promise<string | undefined>, close = true): Promise<void> {
  try {
    const said = await step()
    if (said !== undefined) void $.ui.toast(said)
    if (close) await update($, choice, was => ({ ...was, cardInBand: false, cardAway: true }))
  } catch (error) {
    // The card stays for another try.
    void $.ui.toast(`koicode: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function card($: EngineInterface, { Box, Text, Button }: CardElements, now: KoiChoice) {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} gap="md">
      <Box flexDirection="row" gap={1}>
        <Text bold>Koicode</Text>
        <Button key="clear" label="Clear" onPress={() => press($, () => clear($))}>Clear</Button>
        <Button
          key="close"
          label="Close"
          role="dismiss"
          autoFocus
          onPress={() => update($, choice, was => ({ ...was, cardInBand: false, cardAway: true }))}
        >
          Close
        </Button>
      </Box>
      {THEMES.map(theme => {
        const isOn = now.applied === theme.id
        // The desktop draws a button's label, not its children: each word carries the state.
        const applyWord = isOn && now.scope === 'project' ? '✓ Project' : 'Project'
        const sessionWord = isOn && now.scope === 'session' ? '✓ Session' : 'Session'
        const globalWord = isOn && now.scope === 'global' ? '✓ Global' : 'Global'
        const previewWord = now.preview === theme.id ? 'Previewing' : '20s Preview'
        return (
          <Box key={`theme-${theme.id}`} flexDirection="column" gap="xs">
            <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="md" rowGap="xs">
              <Text bold={isOn}>{isOn ? `✓ ${theme.title}` : theme.title}</Text>
              <Box flexDirection="row" gap={1}>
                <Button key={`apply-${theme.id}`} label={applyWord} onPress={() => press($, () => apply($, theme, 'project'))}>{applyWord}</Button>
                <Button key={`session-${theme.id}`} label={sessionWord} onPress={() => press($, () => apply($, theme, 'session'))}>{sessionWord}</Button>
                <Button key={`global-${theme.id}`} label={globalWord} onPress={() => press($, () => apply($, theme, 'global'))}>{globalWord}</Button>
                <Button key={`preview-${theme.id}`} label={previewWord} onPress={() => press($, () => preview($, theme), false)}>{previewWord}</Button>
              </Box>
            </Box>
            <Text dimColor>{theme.blurb}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND,
        description: 'Koi behind the chat: a card to apply a theme to this project, this session or as the global default, preview it, or clear the choices.',
      })
    } catch (error) {
      void $.ui.toast(`koicode: /${COMMAND} is not available (${String(error)})`)
    }
    try {
      const due = await stored($)
      // A preview left in the state has no timer in this load: drop it.
      await update($, choice, was => ({ ...was, applied: due?.theme.id, scope: due?.scope, preview: undefined }))
      // Nothing chosen: ask the engine nothing, or a clear would take another mod's theme away.
      if (due !== undefined) {
        const unshown = await show($, due.theme)
        if (unshown !== undefined) $.ui.status(unshown)
      }
    } catch (error) {
      void $.ui.log(`koicode: theme not set (${String(error)})`)
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    // A surface that draws no placed rows gets the card above the prompt.
    try {
      const placed = await $.ui.place({ id: CARD })
      await update($, choice, was => ({ ...was, cardInBand: !placed.isPlaced, cardAway: false }))
      return { text: 'Pick on the card.' }
    } catch (error) {
      return { text: `koicode: the card could not be shown (${String(error)})` }
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Older builds name the scene `id`.
    const theme = themeOf(e.props.scene ?? (e.props as { id?: unknown }).id)
    if (e.props.plugin !== PLUGIN || theme === undefined || e.surface !== 'desktop') return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg isInteractive alt={theme.alt} source={sceneOf(theme)} />
  })

  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (e.props.plugin !== PLUGIN || e.props.id !== CARD) return next(e)
    const now = await read($, choice)
    if (now.cardAway === true) return next(e)
    return card($, $.ui.resolve(e), now)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, choice)
    if (now.cardInBand !== true) return next(e)
    return card($, $.ui.resolve(e), now)
  })
}