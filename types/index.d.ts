export type KoiChoice = {
  /** The id of the theme this session shows by its choice or its project's; absent, none. */
  applied?: string
  /** Whose choice `applied` is: this session's own, its project's, or the global one (also the default). */
  scope?: 'session' | 'project' | 'global'
  /** A theme shown for a look only, until the preview ends or a theme is applied. */
  preview?: string
  /** The card shows above the prompt: the surface draws no placed rows. */
  cardInBand?: boolean
  /** The placed card was closed: its hook passes until /koicode shows it again. */
  cardAway?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    koicode: { choice: Shaped<KoiChoice> }
  }
}