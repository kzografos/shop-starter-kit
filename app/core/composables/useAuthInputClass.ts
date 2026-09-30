// Shared warm-themed styling for auth form inputs (login, register, forgot, reset).
// Single source of truth — keeps every auth screen visually identical.
export const useAuthInputClass = () =>
  'w-full [&_input]:h-14 [&_input]:px-4 [&_input]:text-base [&_input]:bg-cream [&_input]:border [&_input]:border-[--color-border-warm] [&_input]:rounded-xl [&_input]:text-bark [&_input]:placeholder-[--color-bark-light] [&_input]:focus:border-terracotta [&_input]:focus:ring-0'
