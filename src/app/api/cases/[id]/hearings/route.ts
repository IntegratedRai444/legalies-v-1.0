import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { notifyCaseParticipants } from '@/lib/notifications'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch profile to get firm_id for security
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

  const { data: hearings, error } = await supabase
      .from('hearings')
      .select(`
        *,
        case:cases!inner(id, firm_id)
      `)
      .eq('case_id', id)
      .eq('case.firm_id', profile.firm_id)
      .order('hearing_date', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: hearings })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

  // Fetch profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    const body = await request.json()

    const { data: hearing, error: hearingError } = await supabase
      .from('hearings')
      .insert({
        case_id: id,
        hearing_date: body.hearing_date,
        hearing_type: body.hearing_type || body.purpose,
        purpose: body.purpose || body.hearing_type,
        court_room: body.court_room,
        location: body.location,
        notes: body.notes,
        created_by: user.id,
      })
      .select()
      .single()

    if (hearingError) {
      console.error('Hearing Insert Error:', hearingError)
      return NextResponse.json({ success: false, error: hearingError.message }, { status: 500 })
    }

    await logActivity(supabase, {
      case_id: id,
      user_id: user.id,
      activity_type: 'hearing_added',
      description: `added a new hearing for "${body.purpose || body.hearing_type || 'General'}" on ${body.hearing_date}`,
      firm_id: profile?.firm_id
    })

    await notifyCaseParticipants(supabase, id, {
      exclude_user_id: user.id,
      title: 'New Hearing Added',
      content: `A new hearing for "${body.purpose || body.hearing_type || 'General'}" was added on ${body.hearing_date}.`
    })

    if (body.next_hearing_date) {
      await supabase
        .from('cases')
        .update({ next_hearing_date: body.next_hearing_date })
        .eq('id', id)
    }

    return NextResponse.json({ success: true, data: hearing })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
