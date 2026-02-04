import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CasePrintClient from './case-print-client'

// Server component for protected case printing
export default async function CasePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Authentication check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Get user profile and firm
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    redirect('/login')
  }

  // Verify case belongs to user's firm
  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, firm_id')
    .eq('id', id)
    .eq('firm_id', profile.firm_id)
    .single()

  if (!caseRecord) {
    redirect('/cases')
  }

  return <CasePrintClient caseId={id} />
}
