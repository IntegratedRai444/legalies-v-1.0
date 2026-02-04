import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { successResponse, errorResponse } from '@/lib/api-response'

const normalize = (v?: string) => v?.toLowerCase().trim()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return errorResponse('No firm associated', 403)
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, case:cases!inner(id, case_title, case_uid, court_city, court_state, created_by, assigned_lawyer_id, firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    if (!task) {
      return errorResponse('Task not found or access denied', 404)
    }

    const isAdmin = normalize(profile.role) === 'admin'
    const isOwnerOrAssigned = task.created_by === user.id || task.assigned_to === user.id ||
      task.case?.created_by === user.id || task.case?.assigned_lawyer_id === user.id

    if (!isOwnerOrAssigned && !isAdmin) {
      return errorResponse('Forbidden', 403)
    }

    return successResponse(task)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return errorResponse('No firm associated', 403)
    }

    // Check Access and Firm Isolation
    const { data: task } = await supabase
      .from('tasks')
      .select('id, created_by, assigned_to, case:cases!inner(firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (!task) {
      return errorResponse('Task not found or access denied', 404)
    }

    const isAdmin = normalize(profile.role) === 'admin'
    const hasAccess = task.created_by === user.id || task.assigned_to === user.id || isAdmin

    if (!hasAccess) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()

    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse(updatedTask)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return errorResponse('No firm associated', 403)
    }

    const { data: task } = await supabase
      .from('tasks')
      .select('id, created_by, assigned_to, case:cases!inner(firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (!task) {
      return errorResponse('Task not found or access denied', 404)
    }

    const isAdmin = normalize(profile.role) === 'admin'
    const hasAccess = task.created_by === user.id || task.assigned_to === user.id || isAdmin

    if (!hasAccess) {
      return errorResponse('Forbidden', 403)
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse({ success: true })
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
