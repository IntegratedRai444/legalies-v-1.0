import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const serviceRoleSupabase = await createServiceRoleClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is Admin using Service Role to bypass RLS
  const { data: profile } = await serviceRoleSupabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date()
  const todayStart = startOfDay(today).toISOString()
  const next7DaysEnd = endOfDay(addDays(today, 7)).toISOString()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  // Use Service Role for all stats queries to ensure firm-wide data is accessible
  const [casesRes, advocatesRes, hearingsRes, activityRes, tasksRes, docsRes, allHearingsRes, diaryRes] = await Promise.all([
    // Active cases and total cases
    serviceRoleSupabase
      .from('cases')
      .select('id, case_title, status, assigned_lawyer_id, priority, last_updated_at, next_hearing_date, court_name, profiles!cases_assigned_lawyer_id_fkey(full_name)')
      .eq('firm_id', profile.firm_id),

    // Advocate workload
    serviceRoleSupabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'advocate')
      .eq('firm_id', profile.firm_id),

    // Upcoming hearings (next 7 days)
    serviceRoleSupabase
      .from('cases')
      .select(`
          id, case_title, next_hearing_date, court_name,
          assigned_lawyer:profiles!cases_assigned_lawyer_id_fkey(full_name)
        `)
      .eq('firm_id', profile.firm_id)
      .gte('next_hearing_date', todayStart)
      .lte('next_hearing_date', next7DaysEnd)
      .order('next_hearing_date'),

    // Recent firm activity
    serviceRoleSupabase
      .from('activity_logs')
      .select(`
          *,
          user:profiles(full_name),
          case:cases(case_title)
        `)
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false })
      .limit(50),

    // All tasks for analysis
    serviceRoleSupabase
      .from('tasks')
      .select('id, case_id, assigned_to, status, due_date, updated_at')
      .eq('firm_id', profile.firm_id),

    // All documents for analysis
    serviceRoleSupabase
      .from('case_documents')
      .select(`
          id, case_id, created_at,
          case:cases!inner(id, firm_id)
        `)
      .eq('case.firm_id', profile.firm_id),

    // All hearings for outcome analysis
    serviceRoleSupabase
      .from('hearings')
      .select('id, case_id, hearing_date, notes, outcome, updated_at')
      .eq('firm_id', profile.firm_id),

    // Diary notes for activity analysis
    serviceRoleSupabase
      .from('diary_notes')
      .select('id, case_id, updated_at')
      .eq('firm_id', profile.firm_id)
  ])

  const cases = casesRes.data || []
  const tasks = tasksRes.data || []
  const docs = docsRes.data || []
  const allHearings = allHearingsRes.data || []
  const diaryNotes = diaryRes.data || []

  const activeCasesCount = cases.filter(c => c.status === 'Active' || c.status === 'Pending').length || 0
  const totalCasesCount = cases.length || 0
  const urgentCasesCount = cases.filter(c => c.priority === 'Urgent').length || 0

  // Step 1: Stale Cases
  // No activity (hearing update, task update, document upload, or note) in last 30 days
  const staleCases = cases.filter(c => {
    if (c.status === 'Closed') return false

    const caseLastUpdate = c.last_updated_at ? new Date(c.last_updated_at) : new Date(0)

    const lastTaskUpdate = Math.max(...tasks.filter(t => t.case_id === c.id).map(t => new Date(t.updated_at || 0).getTime()), 0)
    const lastDocUpdate = Math.max(...docs.filter(d => d.case_id === c.id).map(d => new Date(d.created_at || 0).getTime()), 0)
    const lastHearingUpdate = Math.max(...allHearings.filter(h => h.case_id === c.id).map(h => new Date(h.updated_at || 0).getTime()), 0)
    const lastNoteUpdate = Math.max(...diaryNotes.filter(n => n.case_id === c.id).map(n => new Date(n.updated_at || 0).getTime()), 0)

    const latestActivity = Math.max(caseLastUpdate.getTime(), lastTaskUpdate, lastDocUpdate, lastHearingUpdate, lastNoteUpdate)
    const isInactive = latestActivity < thirtyDaysAgo.getTime()

    // Hearing passed but no outcome
    const passedHearingWithoutOutcome = allHearings.some(h =>
      h.case_id === c.id &&
      new Date(h.hearing_date) < today &&
      (!h.outcome || h.outcome.trim() === '')
    )

    return isInactive || passedHearingWithoutOutcome
  }).map((c: any) => {
    // Supabase joins can return an object or an array of one if not strict
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      case_title: c.case_title,
      assigned_advocate: profile?.full_name || 'Unassigned',
      last_activity_date: c.last_updated_at
    }
  })

  // Step 2: Operational Alerts
  const alerts: any[] = []
  cases.forEach((c: any) => {
    if (c.status === 'Closed') return

    if (!c.assigned_lawyer_id) {
      alerts.push({ id: c.id, case_title: c.case_title, type: 'No assigned advocate' })
    }
    if (!c.next_hearing_date) {
      alerts.push({ id: c.id, case_title: c.case_title, type: 'No next hearing date' })
    }

    const hasOutcomeMissing = allHearings.some((h: any) =>
      h.case_id === c.id &&
      new Date(h.hearing_date) < today &&
      (!h.notes || h.notes.trim() === '')
    )
    if (hasOutcomeMissing) {
      alerts.push({ id: c.id, case_title: c.case_title, type: 'Hearings without outcome' })
    }

    const hasNoDocs = !docs.some((d: any) => d.case_id === c.id)
    if (hasNoDocs) {
      alerts.push({ id: c.id, case_title: c.case_title, type: 'No documents uploaded' })
    }

    const hasNoTasks = !tasks.some((t: any) => t.case_id === c.id)
    if (hasNoTasks) {
      alerts.push({ id: c.id, case_title: c.case_title, type: 'No tasks created' })
    }
  })

  const casesByStatus = {
    Active: cases.filter((c: any) => c.status === 'Active').length || 0,
    Closed: cases.filter((c: any) => c.status === 'Closed').length || 0,
    Pending: cases.filter((c: any) => c.status === 'Pending').length || 0,
  }

  const overdueTasksCount = tasks.filter((t: any) =>
    t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date()
  ).length || 0

  // Step 4: Advocate Workload
  const workload = (advocatesRes.data || []).map((adv: any) => ({
    name: adv.full_name,
    caseCount: cases.filter((c: any) => c.assigned_lawyer_id === adv.id).length || 0,
    pendingTasks: tasks.filter((t: any) => t.assigned_to === adv.id && t.status === 'pending').length || 0,
    overdueTasks: tasks.filter((t: any) => t.assigned_to === adv.id && t.status === 'pending' && t.due_date && new Date(t.due_date) < today).length || 0,
    hearingsThisWeek: allHearings.filter((h: any) => {
      const c = cases.find((cs: any) => cs.id === h.case_id)
      const hDate = new Date(h.hearing_date).getTime()
      const tStart = new Date(todayStart).getTime()
      const tEnd = new Date(next7DaysEnd).getTime()
      return c?.assigned_lawyer_id === adv.id &&
        hDate >= tStart &&
        hDate <= tEnd
    }).length || 0
  }))

  // Step 5: Clean activity logs (Remove financial data)
  const cleanActivity = (activityRes.data || []).map(a => {
    let desc = a.description
    // Remove any mention of currency amounts (₹ or other symbols + numbers)
    desc = desc.replace(/[₹$€£]\s?[\d,]+(\.\d+)?/g, '[Amount Hidden]')

    // If it's an expense or payment, show only title if possible
    if (a.activity_type === 'expense' || a.activity_type === 'payment' || desc.toLowerCase().includes('expense') || desc.toLowerCase().includes('payment')) {
      // Example: "Added expense of ₹500 for Court Fee" -> "Added expense for Court Fee"
      desc = desc.replace(/of\s+\[Amount Hidden\]\s+/, '').replace(/for\s+\[Amount Hidden\]\s+/, '')
    }
    return { ...a, description: desc }
  })

  return NextResponse.json({
    stats: {
      activeCases: activeCasesCount,
      totalCases: totalCasesCount,
      urgentCases: urgentCasesCount,
      inactiveCases: staleCases.length,
      totalAdvocates: advocatesRes.data?.length || 0,
      overdueTasks: overdueTasksCount,
      casesByStatus
    },
    staleCases,
    alerts,
    workload,
    upcomingHearings: hearingsRes.data || [],
    recentActivity: cleanActivity,
  })
}

