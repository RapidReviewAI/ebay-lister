import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  if (url.pathname === '/signin' || url.pathname.startsWith('/signin')) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/signup') ||
    url.pathname.startsWith('/auth')
  ) {
    return supabaseResponse
  }

  const isProtectedRoute =
    url.pathname === '/' ||
    url.pathname.startsWith('/batch') ||
    (url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/auth'))

  if (isProtectedRoute && !user) {
    if (url.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
