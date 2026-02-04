import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const caseId = searchParams.get('case_id')

  let query = supabase
    .from('diary_notes')
    .select(`
        *,
        case:cases!inner(id, case_uid, case_title, court_city, court_state, firm_id)
      `)
    .eq('case.firm_id', profile.firm_id)
    .order('note_date', { ascending: true })
    .order('priority', { ascending: false })

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (date) {
    query = query.eq('note_date', date)
  } else if (startDate && endDate) {
    query = query.gte('note_date', startDate).lte('note_date', endDate)
  }

  const { data: notes, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(notes)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
  }

  const body = await request.json()

  // Verify Case ownership if case_id is provided
  if (body.case_id) {
    const { data: caseRef } = await supabase
      .from('cases')
      .select('id, court_city, court_state')
      .eq('id', body.case_id)
      .eq('firm_id', profile.firm_id)
      .single()

    if (!caseRef) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 })
    }
  }

  const { data: note, error } = await supabase
    .from('diary_notes')
    .insert({
      ...body,
      lawyer_id: user.id
    })
    .select(`
      *,
      case:cases(id, case_uid, case_title, court_city, court_state)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(note)
}
