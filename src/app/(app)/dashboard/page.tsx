import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // No longer redirecting admins to /admin automatically, 
  // they can use the scope switcher or manual navigation.
  // if (profile?.role === 'admin') {
  //   redirect('/admin')
  // }

  return <DashboardClient />
}
