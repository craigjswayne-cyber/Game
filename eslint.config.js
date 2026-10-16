// Accessibility lint for the interface (WCAG 2.1 AA pass).
//
// Scoped to src/ui on purpose: the engine in src/game draws nothing, and the
// scripts are harnesses. The rules are jsx-a11y's recommended set, which is
// where "a div with an onClick that a keyboard cannot reach" and "a select
// with no label" get caught before a person has to find them by hand.
//
// Run: npm run lint
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'jsx-a11y': jsxA11y },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    settings: {
      'jsx-a11y': {
        // the game's own wrappers that render a real control underneath
        components: {},
      },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // a field may be labelled by aria-label (translated) as well as by a
      // <label>; depth 3 covers a label wrapping a span wrapping the control
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }],
      // jsx-a11y reads <tr> and <th> as interactive (their implied roles are
      // widget-like), so a bare onClick on a table row sails past every rule
      // above. Nearly every tappable list in the game is a table row, so this
      // closes the gap: a row or cell that acts spreads rowNav() (src/ui/rowNav.ts)
      // and a sortable header holds a real <button>.
      'no-restricted-syntax': ['error', {
        selector: "JSXOpeningElement[name.name=/^(tr|th|td|li)$/] > JSXAttribute[name.name='onClick']",
        message: 'A tappable row or cell needs a keyboard and a role: spread rowNav(handler) from src/ui/rowNav.ts, or put a <button> inside.',
      }],
    },
  },
)
