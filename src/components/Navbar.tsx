'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import { Package, Check, Home, Upload, Settings, LogOut, Loader2 } from 'lucide-react'

interface NavbarProps {
  mode: 'single' | 'batch'
  onSettingsClick: () => void
}

export function Navbar({ mode, onSettingsClick }: NavbarProps) {
  const supabase = createClient()
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setEmail(user.email || null)

      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single()

      if (data && data.username) {
        setUsername(data.username)
      }
      setLoading(false)
    }
    loadUser()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getInitials = () => {
    if (username) return username.slice(0, 2).toUpperCase()
    if (email) return email.slice(0, 2).toUpperCase()
    return 'U'
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            Lister<span className="text-slate-900">{mode === 'single' ? 'AI' : 'Batch'}</span>
          </h1>
        </div>

        <nav className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {mode === 'single' ? (
              <div className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4" />
                Single Mode
              </div>
            ) : (
              <Link
                href="/"
                className="px-4 py-2 text-sm font-semibold text-slate-650 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Single Mode
              </Link>
            )}

            {mode === 'batch' ? (
              <div className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-lg flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Bulk Mode
              </div>
            ) : (
              <Link
                href="/batch"
                className="px-4 py-2 text-sm font-semibold text-slate-650 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Bulk Mode
              </Link>
            )}
          </div>

          <div className="h-6 w-[1px] bg-slate-205" />

          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {getInitials()}
                </div>
                <span className="hidden sm:inline text-sm font-semibold text-slate-700">
                  {username ? `@${username}` : email}
                </span>
              </div>

              <button
                onClick={onSettingsClick}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              <button
                onClick={handleSignOut}
                className="p-2 text-slate-600 hover:text-red-650 hover:bg-red-50/50 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
