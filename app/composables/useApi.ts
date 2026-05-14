export const useApi = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  return $fetch.create({
    baseURL: apiBase as string,
    credentials: 'include',
  })
}
