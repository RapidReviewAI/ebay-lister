'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase/client'
import { X, LogOut, Loader2, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    default_postal_code: '',
    default_shipping_profile: '',
    default_return_policy: '',
    default_handling_time: '1',
    default_payment_policy: '',
  })

  useEffect(() => {
    if (!isOpen) return

    async function loadProfile() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfile({
          default_postal_code: data.default_postal_code || '',
          default_shipping_profile: data.default_shipping_profile || '',
          default_return_policy: data.default_return_policy || '',
          default_handling_time: data.default_handling_time || '1',
          default_payment_policy: data.default_payment_policy || '',
        })
      }
      setLoading(false)
    }

    loadProfile()
  }, [isOpen, supabase])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        ...profile,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setSaving(false)
    if (!error) {
      onClose()
    } else {
      alert(error.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-white shadow-2xl p-6 flex flex-col justify-between dark:bg-zinc-900 border-l dark:border-zinc-800">
        <div>
          <div className="flex justify-between items-center pb-4 border-b dark:border-zinc-800">
            <h2 className="text-xl font-bold dark:text-white">Listing Defaults</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-gray-400">
              <X size={20} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300">Postal Code</label>
                <input
                  type="text"
                  value={profile.default_postal_code}
                  onChange={(e) => setProfile({ ...profile, default_postal_code: e.target.value })}
                  className="mt-1 block w-full rounded border border-gray-305 px-3 py-2 text-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300">Shipping Profile</label>
                <input
                  type="text"
                  value={profile.default_shipping_profile}
                  onChange={(e) => setProfile({ ...profile, default_shipping_profile: e.target.value })}
                  className="mt-1 block w-full rounded border border-gray-305 px-3 py-2 text-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300">Return Policy Profile</label>
                <input
                  type="text"
                  value={profile.default_return_policy}
                  onChange={(e) => setProfile({ ...profile, default_return_policy: e.target.value })}
                  className="mt-1 block w-full rounded border border-gray-305 px-3 py-2 text-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300">Payment Profile</label>
                <input
                  type="text"
                  value={profile.default_payment_policy}
                  onChange={(e) => setProfile({ ...profile, default_payment_policy: e.target.value })}
                  className="mt-1 block w-full rounded border border-gray-305 px-3 py-2 text-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300">Handling Time (Days)</label>
                <input
                  type="text"
                  value={profile.default_handling_time}
                  onChange={(e) => setProfile({ ...profile, default_handling_time: e.target.value })}
                  className="mt-1 block w-full rounded border border-gray-305 px-3 py-2 text-sm dark:bg-zinc-950 dark:border-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex justify-center items-center gap-2 rounded bg-blue-600 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Settings
              </button>
            </form>
          )}
        </div>

        <div className="pt-4 border-t dark:border-zinc-800">
          <button
            onClick={handleLogout}
            className="w-full flex justify-center items-center gap-2 rounded border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
