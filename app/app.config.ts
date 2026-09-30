export default defineAppConfig({
  ui: {
    colors: {
      primary: 'terracotta',
    },
    toast: {
      slots: {
        root: 'bg-surface-card border border-[--color-border-warm] shadow-md',
      },
    },
  },

  // Contribution lists rendered by the Core shells (see app/core/types/contributions.ts)
  // live in the layer that owns each entry: Core's (E7f), the modules' (E8b) and
  // the project's (C3b). The composition root contributes none.
})
