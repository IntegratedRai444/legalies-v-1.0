import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
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
      console.error('Diary fetch error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch diary notes' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: notes || [] })
  } catch (err) {
    console.error('Diary API error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    const body = await request.json()

    // Validation
    if (!body.note_text || typeof body.note_text !== "string") {
      return NextResponse.json({ success: false, error: "Invalid note text" }, { status: 400 })
    }
    if (body.note_text.length < 3 || body.note_text.length > 2000) {
      return NextResponse.json({ success: false, error: "Note text must be 3-2000 characters" }, { status: 400 })
    }
    if (!body.note_date || typeof body.note_date !== "string") {
      return NextResponse.json({ success: false, error: "Invalid note date" }, { status: 400 })
    }
    if (isNaN(Date.parse(body.note_date))) {
      return NextResponse.json({ success: false, error: "Invalid note date format" }, { status: 400 })
    }
    if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
      return NextResponse.json({ success: false, error: "Invalid priority level" }, { status: 400 })
    }

    // Verify Case ownership if case_id is provided
    if (body.case_id) {
      const { data: caseRef } = await supabase
        .from('cases')
        .select('id, court_city, court_state')
        .eq('id', body.case_id)
        .eq('firm_id', profile.firm_id)
        .single()

      if (!caseRef) {
        return NextResponse.json({ success: false, error: 'Case not found or access denied' }, { status: 404 })
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
      console.error('Diary insert error:', error)
      return NextResponse.json({ success: false, error: 'Failed to create diary note' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: note })
  } catch (err) {
    console.error('Diary POST error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
