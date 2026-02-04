import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
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

    const { data: caseData, error } = await supabase
      .from('cases')
      .select(`
        id,
        case_uid,
        case_title,
        court_name,
        court_city,
        court_state,
        case_type,
        status,
        stage,
        priority,
        filing_date,
        next_hearing_date,
        assigned_lawyer_id,
        created_by,
        firm_id,
        agreed_fee,
        last_updated_at,
        created_at,
        assigned_lawyer:profiles!cases_assigned_lawyer_id_fkey(id, full_name, phone, role),
        case_parties(
          id,
          role_label,
          party_id,
          party:parties(*)
        ),
        hearings(*),
        tasks(*),
        diary_notes(*),
        case_documents(*),
        case_messages(*),
        activity_logs(*),
        invoices(*),
        expenses:case_expenses(*)
      `)
      .eq('id', id)
      .eq('firm_id', profile.firm_id)
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    if (!caseData) {
      return errorResponse('Case not found', 404)
    }

    // Transform parties into clients and opponents
    const rawParties = caseData.case_parties || []

    const clients = rawParties
      .filter((cp: any) => cp.party?.party_kind === 'client')
      .map((cp: any) => ({
        id: cp.id,
        party_id: cp.party_id,
        role_label: cp.role_label,
        party: cp.party
      }))

    const opponents = rawParties
      .filter((cp: any) => cp.party?.party_kind === 'opponent')
      .map((cp: any) => ({
        id: cp.id,
        party_id: cp.party_id,
        role_label: cp.role_label,
        party: cp.party
      }))

    const responseData = { ...caseData }

    responseData.hearings = responseData.hearings || []
    responseData.tasks = responseData.tasks || []
    responseData.diary_notes = responseData.diary_notes || []
    responseData.case_documents = responseData.case_documents || []
    responseData.case_messages = responseData.case_messages || []
    responseData.activity_logs = responseData.activity_logs || []
    responseData.invoices = responseData.invoices || []
    responseData.expenses = responseData.expenses || []

    if (profile?.role === 'admin') {
      delete responseData.agreed_fee
    }

    return successResponse({
      ...responseData,
      clients,
      opponents
    })
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

    const body = await request.json()
    const { clients, opponents, ...rawCaseData } = body

    // Map frontend fields to database columns and filter out non-existent columns
    const caseData = {
      case_title: rawCaseData.case_title,
      case_type: rawCaseData.case_type,
      court_name: rawCaseData.court_name,
      court_city: rawCaseData.court_city,
      court_state: rawCaseData.court_state,
      filing_date: rawCaseData.filing_date || null,
      status: rawCaseData.status ? rawCaseData.status.toLowerCase() : undefined,
      stage: rawCaseData.stage || undefined,
      agreed_fee: rawCaseData.agreed_fee ? parseFloat(rawCaseData.agreed_fee) : null,
      priority: rawCaseData.priority || undefined,
      assigned_lawyer_id: rawCaseData.assigned_lawyer_id || undefined,
      next_hearing_date: rawCaseData.next_hearing_date || undefined
    }

    // Remove undefined fields to avoid overwriting with null
    Object.keys(caseData).forEach(key => {
      if (caseData[key as keyof typeof caseData] === undefined) {
        delete caseData[key as keyof typeof caseData]
      }
    })

    const { data: updatedCase, error } = await supabase
      .from('cases')
      .update(caseData)
      .eq('id', id)
      .eq('firm_id', profile.firm_id)
      .select(`
        id,
        case_uid,
        case_title,
        court_name,
        court_city,
        court_state,
        case_type,
        status,
        stage,
        priority,
        filing_date,
        next_hearing_date,
        assigned_lawyer_id,
        created_by,
        firm_id,
        agreed_fee,
        last_updated_at,
        created_at
      `)
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    await logActivity(supabase, {
      case_id: id,
      user_id: user.id,
      activity_type: 'case_updated',
      description: `updated case details for "${updatedCase.case_title}"`,
      firm_id: profile.firm_id
    })

    return successResponse(updatedCase)
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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
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

    if (profile?.role !== 'admin') {
      return errorResponse('Only admins can delete cases', 403)
    }

    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', id)
      .eq('firm_id', profile.firm_id)

    if (error) {
      return errorResponse(error.message, 500)
    }

    await logActivity(supabase, {
      case_id: id,
      user_id: user.id,
      activity_type: 'case_deleted',
      description: `deleted case ID ${id}`,
      firm_id: profile.firm_id
    })

    return successResponse({ success: true })
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
