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

    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')
    const status = searchParams.get('status')

    let query = supabase
      .from('tasks')
      .select('*, case:cases!inner(id, case_title, case_uid, firm_id)')
      .eq('assigned_to', user.id)
      .eq('firm_id', profile.firm_id)
      .eq('case.firm_id', profile.firm_id)

    if (caseId) {
      query = query.eq('case_id', caseId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: tasks, error } = await query.order('due_date', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse(tasks)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()

    // Fetch profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        ...body,
        assigned_to: body.assigned_to || user.id,
        created_by: user.id,
        firm_id: profile?.firm_id
      })
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse(task, 201)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
