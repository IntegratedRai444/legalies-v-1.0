import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return errorResponse('No firm associated', 403)
    }

    const firmId = profile.firm_id
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return errorResponse('start_date and end_date are required', 400)
    }

    // Fetch all events in parallel - WITH FIRM ISOLATION
    const [hearingsRes, tasksRes, diaryRes] = await Promise.all([
      supabase
        .from('hearings')
        .select(`
          *,
          case:cases!inner(id, case_uid, case_title, firm_id, court_city, court_state)
        `)
        .eq('case.firm_id', firmId)
        .gte('hearing_date', startDate)
        .lte('hearing_date', endDate),

      supabase
        .from('tasks')
        .select(`
          *,
          case:cases!inner(id, case_uid, case_title, firm_id, court_city, court_state)
        `)
        .eq('case.firm_id', firmId)
        .gte('due_date', startDate)
        .lte('due_date', endDate),

      supabase
        .from('diary_notes')
        .select(`
          *,
          case:cases!inner(id, case_uid, case_title, firm_id, court_city, court_state)
        `)
        .eq('case.firm_id', firmId)
        .gte('note_date', startDate)
        .lte('note_date', endDate)
    ])

    if (hearingsRes.error) {
      console.error('Hearings error:', hearingsRes.error)
      return errorResponse(hearingsRes.error.message)
    }
    if (tasksRes.error) {
      console.error('Tasks error:', tasksRes.error)
      return errorResponse(tasksRes.error.message)
    }
    if (diaryRes.error) {
      console.error('Diary error:', diaryRes.error)
      return errorResponse(diaryRes.error.message)
    }

    const hearings = hearingsRes.data || []
    const tasks = tasksRes.data || []
    const diaryNotes = diaryRes.data || []

    // Transform data into a unified format for the calendar
    const events = [
      ...hearings.map(h => ({
        id: h.id,
        type: 'hearing',
        title: `Hearing: ${h.case?.case_title || h.case_id}`,
        date: h.hearing_date,
        location: h.court_room || h.location,
        purpose: h.hearing_type || h.outcome,
        case_id: h.case_id,
        case_uid: h.case?.case_uid
      })),
      ...tasks.map(t => ({
        id: t.id,
        type: 'task',
        title: `Task: ${t.title}`,
        date: t.due_date,
        priority: t.priority,
        status: t.status,
        case_id: t.case_id,
        case_uid: t.case?.case_uid
      })),
      ...diaryNotes.map(d => ({
        id: d.id,
        type: 'task', // Treating diary notes as tasks/reminders on calendar
        title: `Note: ${d.note_text}`,
        date: d.note_date,
        priority: d.priority,
        status: d.task_status,
        case_id: d.case_id,
        case_uid: d.case?.case_uid
      }))
    ]

    return successResponse(events)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
