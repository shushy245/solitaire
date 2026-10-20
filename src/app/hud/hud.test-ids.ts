// Dependency-free so the Cypress drivers can import it.
export const HudTestIds = {
    Root: 'HudTestIds.Root',
    Score: 'HudTestIds.Score',
    Moves: 'HudTestIds.Moves',
    Time: 'HudTestIds.Time',
    Undo: 'HudTestIds.Undo',
    NewGame: 'HudTestIds.NewGame',
    Mode: (mode: string): string => `HudTestIds.Mode.${mode}`,
    AutoComplete: 'HudTestIds.AutoComplete',
    Confirm: 'HudTestIds.Confirm',
    ConfirmLeave: 'HudTestIds.ConfirmLeave',
    ConfirmStay: 'HudTestIds.ConfirmStay',
} as const;
