/** The 9 visual themes of the top-down store rooms. `gadgets` is used by two shops (different layouts). */
export const THEMES = ['fashion', 'electronics', 'toys', 'food', 'sports', 'music', 'gadgets', 'novelty', 'games'] as const;
export type ThemeId = (typeof THEMES)[number];
