export function toCache(obj: unknown): string {
  return JSON.stringify(obj, (_, val) => {
    if (val !== null && typeof val === 'object' && val.constructor?.name === 'Decimal') {
      return Number(val)
    }
    return val
  })
}
