import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

const normalize = (v?: string) => v?.toLowerCase().trim()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, hearingId: string }> }
) {
  try {
    const { id: caseId, hearingId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Permission check and Firm Isolation
    const { data: caseData } = await supabase
      .from('cases')
      .select('id, assigned_lawyer_id, firm_id')
      .eq('id', caseId)
      .eq('firm_id', profile.firm_id)
      .single()

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalize(profile.role) === 'admin'
    const isAssigned = caseData.assigned_lawyer_id === user.id

    if (!isAdmin && !isAssigned) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { outcome_note, outcome, next_hearing_date } = body

    const { data: hearing, error } = await supabase
      .from('hearings')
      .update({
        outcome: outcome || outcome_note, // Handle both for safety
        next_hearing_date: next_hearing_date || null
      })
      .eq('id', hearingId)
      .eq('case_id', caseId)
      .select()
      .single()

    if (error) {
      console.error('Hearing Update Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log activity
    await logActivity(supabase, {
      case_id: caseId,
      user_id: user.id,
      activity_type: 'hearing_updated',
      description: `updated outcome for hearing on ${hearing.hearing_date}`,
      firm_id: profile.firm_id
    })

    // Update next_hearing_date in case if provided
    if (next_hearing_date) {
      await supabase
        .from('cases')
        .update({ next_hearing_date })
        .eq('id', caseId)
        .eq('firm_id', profile.firm_id)
    }

    return NextResponse.json(hearing)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
