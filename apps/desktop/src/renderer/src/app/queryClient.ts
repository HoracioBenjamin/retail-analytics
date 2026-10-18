import { QueryClient } from '@tanstack/react-query'

/**
 * Cliente de consulta del plan (sección 8 interacciones): sin reintentos
 * en bucle ni polling; el dato se refresca solo con "Actualizar vista" o
 * al cambiar filtros (nueva clave de query).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000
    }
  }
})
