import { expect, test } from 'claude-code/testing'

type On = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1]

// Stands in for the engine: one project and one session, a store holding `kept`, and a record of what happened.
function engine(on: On, kept: Record<string, string>, said: string[]) {
  on('command.register', () => ({ value: { command: 'koicode' } }))
  on('session.root', () => ({ value: '/pond' }))
  on('session.id', () => ({ value: 's1' }))
  on('env.get', () => ({ value: undefined }))
  on('store.get', (_, e) => ({ value: kept[e.key] }))
  on('store.set', (_, e) => {
    kept[e.key] = String(e.value)
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    said.push(`delete ${e.key}`)
    delete kept[e.key]
    return { value: undefined }
  })
  on('theme.set', (_, e) => {
    // Either shape: `scene` in this build, `id` in older ones.
    const backdrop = e.backdrop as { scene?: string; id?: string } | undefined
    said.push(`set ${backdrop?.scene ?? backdrop?.id}`)
    return { value: { isDrawn: true, requestId: 'r' } }
  })
  on('theme.clear', () => {
    said.push('clear')
    return { value: { isDrawn: true, requestId: 'r' } }
  })
  on('ui.log', (_, e) => {
    said.push(`log ${JSON.stringify(e)}`)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

const start = { cwd: '/pond', surface: 'desktop', isInteractive: true } as const
const CARD = { plugin: 'koicode', component: 'Placed', surface: 'desktop', props: { id: 'koicode-card', plugin: 'koicode' } } as const

/** The card's button labels for the one theme, after a session starts over `kept`. */
async function labels($: Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[0], on: On, kept: Record<string, string>) {
  const said: string[] = []
  engine(on, kept, said)
  await $.session.start(start)
  expect(said).toEqual(Object.keys(kept).length === 0 ? [] : ['set koi-pond'])
  const ui = await $.ui.mount(CARD)
  const out: string[] = []
  for (const key of ['apply-koi-pond', 'session-koi-pond', 'global-koi-pond']) {
    const button = await ui.find({ type: 'Button', key })
    out.push(String(button?.props.label))
  }
  await ui.unmount()
  return out
}

test('with nothing stored, no theme shows and the engine is asked nothing', async ($, on) => {
  expect(await labels($, on, {})).toEqual(['Project', 'Session', 'Global'])
})

test('the global choice shows where no project or session chose', async ($, on) => {
  expect(await labels($, on, { global: 'koi-pond' })).toEqual(['Project', 'Session', '✓ Global'])
})

test("a session's own choice wins over its project's and the global one", async ($, on) => {
  const kept = { global: 'koi-pond', 'project:/pond': 'koi-pond', 'session:s1': 'koi-pond' }
  expect(await labels($, on, kept)).toEqual(['Project', '✓ Session', 'Global'])
})

test("a project's choice wins over the global one", async ($, on) => {
  const kept = { global: 'koi-pond', 'project:/pond': 'koi-pond' }
  expect(await labels($, on, kept)).toEqual(['✓ Project', 'Session', 'Global'])
})

test("Clear deletes this session's, this project's and the global choice, and takes the backdrop away", async ($, on) => {
  const said: string[] = []
  const kept: Record<string, string> = { global: 'koi-pond', 'project:/pond': 'koi-pond', 'session:s1': 'koi-pond', 'project:/other': 'koi-pond' }
  engine(on, kept, said)
  await $.session.start(start)
  const ui = await $.ui.mount(CARD)
  await ui.press({ key: 'clear' })
  await ui.unmount()
  expect(said.filter(line => line.startsWith('delete') || line === 'clear').sort()).toEqual(['clear', 'delete global', 'delete project:/pond', 'delete session:s1'])
  expect(Object.keys(kept)).toEqual(['project:/other'])
})
