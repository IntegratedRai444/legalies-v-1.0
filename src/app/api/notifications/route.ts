import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { format, addDays, startOfDay } from 'date-fns'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user profile to get firm_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
  }

  // Trigger automated reminder generation
  await checkReminders(user.id, profile.firm_id)

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(notifications)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, is_read, mark_all } = await request.json()

  if (mark_all) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (id) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

async function checkReminders(userId: string, firmId: string) {
  const supabase = await createServerSupabaseClient()
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd')

  const startOfToday = startOfDay(today).toISOString()

  // 1. Check for tomorrow's hearings - with firm isolation
  const { data: hearings } = await supabase
    .from('hearings')
    .select('*, case:cases!inner(id, case_title, case_uid, firm_id)')
    .eq('hearing_date', tomorrowStr)
    .eq('case.firm_id', firmId)

  if (hearings && hearings.length > 0) {
    const titles = hearings.map(h => `Upcoming Hearing: ${h.case?.case_title || 'Case'}`)

    // Batch fetch existing notifications for today to avoid N+1
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('title')
      .eq('user_id', userId)
      .in('title', titles)
      .gte('created_at', startOfToday)

    const existingTitles = new Set(existingNotifs?.map(n => n.title) || [])

    for (const h of hearings) {
      const title = `Upcoming Hearing: ${h.case?.case_title || 'Case'}`
      if (!existingTitles.has(title)) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message: `Hearing tomorrow for ${h.case?.case_uid || 'Case'}. Purpose: ${h.purpose || h.hearing_type || 'General'}.`,
          type: 'warning',
          link: `/cases/${h.case_id}`,
          is_read: false
        })
      }
    }
  }

  // 2. Check for tomorrow's diary tasks
  const { data: tasks } = await supabase
    .from('diary_notes')
    .select('id, note_text')
    .eq('lawyer_id', userId)
    .eq('note_date', tomorrowStr)
    .eq('task_status', 'pending')

  if (tasks && tasks.length > 0) {
    const messages = tasks.map(t => `Reminder: "${t.note_text}" is due tomorrow.`)

    // Batch fetch existing notifications for today to avoid N+1
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('message')
      .eq('user_id', userId)
      .eq('title', 'Task Due Tomorrow')
      .in('message', messages)
      .gte('created_at', startOfToday)

    const existingMessages = new Set(existingNotifs?.map(n => n.message) || [])

    for (const t of tasks) {
      const title = 'Task Due Tomorrow'
      const message = `Reminder: "${t.note_text}" is due tomorrow.`

      if (!existingMessages.has(message)) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          type: 'info',
          link: '/diary',
          is_read: false
        })
      }
    }
  }
}
