import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { notifyCaseParticipants } from '@/lib/notifications'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile to get firm_id for security
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return errorResponse('No firm associated', 403)
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
    return errorResponse(error.message, 500)
  }

  return successResponse(hearings)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile to get firm_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  const body = await request.json()

  const { data: hearing, error: hearingError } = await supabase
    .from('hearings')
    .insert({
      ...body,
      case_id: id,
      firm_id: profile?.firm_id,
      assigned_advocate_id: body.assigned_advocate_id || user.id
    })
    .select()
    .single()

  if (hearingError) {
    console.error('Hearing Insert Error:', hearingError)
    return errorResponse(hearingError.message, 500)
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

  return successResponse(hearing)
}
