import { QueryClient } from '@tanstack/react-query'

/**
 * Cliente de consulta del plan (sección 8 interacciones): sin reintentos
 * reintentos en bucle; datos activos se sondean cada 30 s, al recuperar foco
 * y mediante la acción manual de actualización.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      staleTime: 10_000
    }
  }
})
