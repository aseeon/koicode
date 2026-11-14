import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeBackdropGlass } from 'claude-code'

import { koiPondSvg } from './koi-pond'
import type { KoiChoice } from '../types'

const PLUGIN = 'koicode'
const COMMAND = 'koicode'
const CARD = 'koicode-card'
// Holds the picked theme's id, or 'off' once the person picked No theme. Absent: the first theme. One key for every session.
const THEME_KEY = 'theme'

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

const built = new Map<string, string>()
function sceneOf(theme: Theme): string {
  const ready = built.get(theme.id) ?? theme.scene()
  built.set(theme.id, ready)
  return ready
}

// The loader's scan reads this reference: both names are written as string literals.
const choice = atom({ plugin: 'koicode', key: 'choice' } as const, {}, { shape: 'choice-2' })

type CardElements = Pick<ReturnType<EngineInterface['ui']['resolve']>, 'Box' | 'Text' | 'Button'>

/** Shows a theme, or with none clears the backdrop, and keeps the choice. Answers why nothing draws it, if so. */
async function applyTheme($: EngineInterface, theme: Theme | undefined): Promise<string | undefined> {
  if (theme !== undefined) {
    const set = await $.theme.set({ backdrop: { scene: theme.id, glass: theme.glass }, overrideColorScheme: 'dark' })
    await $.store.set(THEME_KEY, theme.id)
    await update($, choice, was => ({ ...was, applied: theme.id }))
    return set.isDrawn ? undefined : set.reason
  }
  // Clears whatever theme stands, any mod's: called only on the person's ask.
  await $.theme.clear()
  await $.store.set(THEME_KEY, 'off')
  await update($, choice, was => ({ ...was, applied: undefined }))
  return undefined
}

async function pick($: EngineInterface, theme: Theme | undefined): Promise<void> {
  try {
    const unshown = await applyTheme($, theme)
    if (unshown !== undefined) void $.ui.toast(unshown)
    await update($, choice, was => ({ ...was, cardInBand: false, cardAway: true }))
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
        <Button key="off" label="No theme" onPress={() => pick($, undefined)}>No theme</Button>
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
        const word = isOn ? 'Applied' : 'Apply'
        return (
          <Box key={`theme-${theme.id}`} flexDirection="column" gap="xs">
            <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="md" rowGap="xs">
              <Text bold={isOn}>{isOn ? `✓ ${theme.title}` : theme.title}</Text>
              <Button key={`apply-${theme.id}`} label={word} onPress={() => pick($, theme)}>{word}</Button>
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
      await $.command.register({ name: COMMAND, description: 'Koi behind the chat: shows a card to pick a theme or No theme.' })
    } catch (error) {
      void $.ui.toast(`koicode: /${COMMAND} is not available (${String(error)})`)
    }
    try {
      const stored = await $.store.get(THEME_KEY)
      if (stored !== 'off') {
        const unshown = await applyTheme($, THEMES.find(theme => theme.id === stored) ?? THEMES[0])
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
    const theme = THEMES.find(t => t.id === e.props.scene)
    if (theme === undefined || e.surface !== 'desktop') return next(e)
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