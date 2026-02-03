import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const serviceRoleSupabase = await createServiceRoleClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Admin role
  const { data: profile } = await serviceRoleSupabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { caseIds, newLawyerId, priority } = await req.json()

    if (!caseIds || !Array.isArray(caseIds)) {
      return NextResponse.json({ error: 'Invalid case IDs' }, { status: 400 })
    }

    const updates: any = {}
    if (newLawyerId !== undefined) updates.assigned_lawyer_id = newLawyerId
    if (priority !== undefined) updates.priority = priority
    updates.last_updated_at = new Date().toISOString()

    const { error } = await serviceRoleSupabase
      .from('cases')
      .update(updates)
      .in('id', caseIds)
      .eq('firm_id', profile.firm_id)

    if (error) throw error

    // Log the activity
    for (const caseId of caseIds) {
      let logDesc = 'Case reassigned or updated by Admin'
      if (newLawyerId && priority) {
        logDesc = `Case reassigned and priority set to ${priority}`
      } else if (newLawyerId) {
        logDesc = 'Case reassigned to new advocate'
      } else if (priority) {
        logDesc = `Case priority updated to ${priority}`
      }

      await serviceRoleSupabase.from('activity_logs').insert({
        case_id: caseId,
        user_id: user.id,
        activity_type: 'case_update',
        description: logDesc,
        firm_id: profile.firm_id
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
