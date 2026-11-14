export type KoiChoice = {
  /** The id of the theme that shows now; absent, none. */
  applied?: string
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
