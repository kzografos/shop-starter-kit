import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt({
  // The backend is a separate npm project with its own toolchain (tsc, nest,
  // scripts/verify-*.js); the Nuxt/Vue rules do not apply to it.
  ignores: ['backend/**'],
})
