import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { normalizeRole } from '@/lib/utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, hearingId: string }> }
) {
  try {
    const { id: caseId, hearingId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    // Permission check and Firm Isolation
    const { data: caseData } = await supabase
      .from('cases')
      .select('id, assigned_lawyer_id, firm_id, court_city, court_state')
      .eq('id', caseId)
      .eq('firm_id', profile.firm_id)
      .single()

    if (!caseData) {
      return NextResponse.json({ success: false, error: 'Case not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalizeRole(profile.role) === 'admin'
    const isAssigned = caseData.assigned_lawyer_id === user.id

    if (!isAdmin && !isAssigned) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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
      .select(`
        *,
        case:cases!inner(firm_id)
      `)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (error) {
      console.error('Hearing Update Error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
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

    return NextResponse.json({ success: true, data: hearing })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, hearingId: string }> }
) {
  try {
    const { id: caseId, hearingId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    // Permission check and Firm Isolation
    const { data: caseData } = await supabase
      .from('cases')
      .select('id, assigned_lawyer_id, firm_id, court_city, court_state')
      .eq('id', caseId)
      .eq('firm_id', profile.firm_id)
      .single()

    if (!caseData) {
      return NextResponse.json({ success: false, error: 'Case not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalizeRole(profile.role) === 'admin'
    const isAssigned = caseData.assigned_lawyer_id === user.id

    if (!isAdmin && !isAssigned) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get hearing details before deletion for activity log
    const { data: hearing } = await supabase
      .from('hearings')
      .select('hearing_date, hearing_type')
      .eq('id', hearingId)
      .eq('case_id', caseId)
      .single()

    if (!hearing) {
      return NextResponse.json({ success: false, error: 'Hearing not found' }, { status: 404 })
    }

    // Delete the hearing
    const { error } = await supabase
      .from('hearings')
      .delete()
      .eq('id', hearingId)
      .eq('case_id', caseId)

    if (error) {
      console.error('Hearing Delete Error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Recalculate next hearing date for the case
    const { data: nextHearing } = await supabase
      .from('hearings')
      .select('hearing_date')
      .eq('case_id', caseId)
      .gte('hearing_date', new Date().toISOString().split('T')[0]) // Only future dates
      .order('hearing_date', { ascending: true })
      .limit(1)
      .single()

    await supabase
      .from('cases')
      .update({
        next_hearing_date: nextHearing?.hearing_date || null
      })
      .eq('id', caseId)
      .eq('firm_id', profile.firm_id)

    // Log activity
    await logActivity(supabase, {
      case_id: caseId,
      user_id: user.id,
      activity_type: 'hearing_delete',
      description: `deleted hearing for ${hearing.hearing_type || 'General'} on ${hearing.hearing_date}`,
      firm_id: profile.firm_id
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
