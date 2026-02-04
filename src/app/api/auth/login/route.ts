import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
          set(name, value, options) {
            cookieStore.set({
              name,
              value,
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production', // 🔥 SECURE IN PRODUCTION
            })
          },
          remove(name, options) {
            cookieStore.set({
              name,
              value: '',
              ...options,
              path: '/',
            })
          },
        },
      }
    )

    const { email, password } = await req.json()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Login API error:', err)
    return new Response(JSON.stringify({ success: false, error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
