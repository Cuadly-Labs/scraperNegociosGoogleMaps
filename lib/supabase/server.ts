import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const toCookieValue = (cookie?: { value: string }) => cookie?.value

function buildCookieHelpers(cookieStore: ReturnType<typeof cookies>, writable: boolean) {
  const base = {
    get: async (name: string) => toCookieValue(cookieStore.get(name)),
  }

  if (!writable) {
    return {
      ...base,
      set: async () => {},
      remove: async () => {},
    }
  }

  return {
    ...base,
    set: async (name: string, value: string, options?: Parameters<typeof cookieStore.set>[2]) => {
      // Accessing set is allowed inside Server Actions or Route Handlers
      cookieStore.set(name, value, options)
    },
    remove: async (name: string, options?: Parameters<typeof cookieStore.delete>[1]) => {
      cookieStore.delete(name, { ...options, path: options?.path ?? '/' })
    },
  }
}

type CreateClientOptions = { allowCookieWrites?: boolean }

export function createClient(options: CreateClientOptions = {}) {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: buildCookieHelpers(cookieStore, Boolean(options.allowCookieWrites)),
    }
  )
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: async () => undefined,
        set: async () => {},
        remove: async () => {},
      },
    }
  )
}
