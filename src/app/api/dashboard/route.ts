import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { format, addDays } from 'date-fns'
import { successResponse, errorResponse } from '@/lib/api-response'
import { normalizeStatus } from '@/lib/utils'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      console.warn('User has no firm_id associated:', user.id)
      return successResponse({ stats: [], recentActivity: [] }) // Return empty dashboard for users without firm
    }

    const firmId = profile.firm_id
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const nextWeekEnd = addDays(todayEnd, 7)
    const todayStr = format(todayStart, 'yyyy-MM-dd')

    const [todayHearingsRes, upcomingHearingsRes, todayTasksRes, overdueTasksRes, casesCountRes, recentCasesRes] = await Promise.all([
      // Fetch Today's Hearings from 'hearings' table
      supabase
        .from('hearings')
        .select(`
          id, hearing_date, court_room,
          case:cases!inner (
            id, case_uid, case_title, court_name, court_city, court_state, status, firm_id,
            assigned_lawyer:profiles!cases_assigned_lawyer_id_fkey(full_name)
          )
        `)
        .eq('hearing_date', todayStr)
        .eq('case.firm_id', firmId)
        .order('court_room'),

      // Fetch Upcoming Hearings from 'hearings' table
      supabase
        .from('hearings')
        .select(`
          id, hearing_date, court_room,
          case:cases!inner (
            id, case_uid, case_title, court_name, court_city, court_state, status, firm_id,
            assigned_lawyer:profiles!cases_assigned_lawyer_id_fkey(full_name)
          )
        `)
        .gt('hearing_date', todayStr)
        .lte('hearing_date', format(nextWeekEnd, 'yyyy-MM-dd'))
        .eq('case.firm_id', firmId)
        .order('hearing_date'),

      supabase
        .from('tasks')
        .select(`
          *,
          case:cases!inner(id, case_uid, case_title, firm_id)
        `)
        .eq('case.firm_id', firmId)
        .neq('status', 'completed'),

      supabase
        .from('tasks')
        .select(`
          *,
          case:cases!inner(id, case_uid, case_title, firm_id)
        `)
        .eq('case.firm_id', firmId)
        .lt('due_date', todayStr)
        .neq('status', 'completed')
        .order('due_date', { ascending: true }),

      supabase
        .from('cases')
        .select('status, court_city, court_state')
        .eq('firm_id', firmId),

      supabase
        .from('cases')
        .select('id, case_uid, case_title, status, last_updated_at, court_city, court_state')
        .eq('firm_id', firmId)
        .order('last_updated_at', { ascending: false })
        .limit(5)
    ])

    if (todayHearingsRes.error) {
      console.error('Today hearings error:', todayHearingsRes.error)
      return errorResponse(todayHearingsRes.error.message)
    }
    if (upcomingHearingsRes.error) {
      console.error('Upcoming hearings error:', upcomingHearingsRes.error)
      return errorResponse(upcomingHearingsRes.error.message)
    }
    if (todayTasksRes.error) {
      console.error('Today tasks error:', todayTasksRes.error)
      // return errorResponse(todayTasksRes.error.message) // Don't fail the whole dashboard if tasks fails
    }
    if (overdueTasksRes.error) {
      console.error('Overdue tasks error:', overdueTasksRes.error)
      // return errorResponse(overdueTasksRes.error.message)
    }
    if (casesCountRes.error) {
      console.error('Cases count error:', casesCountRes.error)
      return errorResponse(casesCountRes.error.message)
    }
    if (recentCasesRes.error) {
      console.error('Recent cases error:', recentCasesRes.error)
      return errorResponse(recentCasesRes.error.message)
    }

    const casesCountData = casesCountRes.data || []
    const activeCases = casesCountData.filter(c => c.status?.toLowerCase() === 'active').length
    const totalCases = casesCountData.length

    const normalizeCaseInHearing = (h: any) => ({
      ...h,
      case: h.case ? { ...h.case, status: normalizeStatus(h.case.status) } : null
    })

    return successResponse({
      todayHearings: (todayHearingsRes.data || []).map(normalizeCaseInHearing),
      upcomingHearings: (upcomingHearingsRes.data || []).map(normalizeCaseInHearing),
      todayTasks: todayTasksRes.data || [],
      overdueTasks: overdueTasksRes.data || [],
      recentUpdatedCases: (recentCasesRes.data || []).map(c => ({ ...c, status: normalizeStatus(c.status) })),
      stats: {
        activeCases,
        totalCases,
        todayHearingsCount: todayHearingsRes.data?.length || 0,
        upcomingHearingsCount: upcomingHearingsRes.data?.length || 0,
        todayTasksCount: todayTasksRes.data?.length || 0,
        overdueTasksCount: overdueTasksRes.data?.length || 0
      }
    })
  } catch (err: any) {
    console.error('Dashboard API Error:', err.message, err)
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
