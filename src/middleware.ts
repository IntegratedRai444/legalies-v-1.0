import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  const { supabaseResponse, user } = await updateSession(request)
  
  const protectedRoutes = ['/dashboard', '/cases', '/diary', '/billing', '/expenses', '/parties', '/tasks', '/calendar', '/notifications', '/admin']
  const adminRoutes = ['/admin', '/admin/users']
  const authRoutes = ['/login', '/register']
  
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !user) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    // We already have the user from updateSession, but we might need their role.
    // However, fetching the profile in EVERY middleware call is expensive.
    // For now, let's just use the user object if possible, or only fetch for admin routes.
    if (isAdminRoute) {
      const { createServerClient } = await import('@supabase/ssr')
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: () => {},
          },
        }
      )
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    if (isAuthRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
