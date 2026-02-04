import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { successResponse, errorResponse } from '@/lib/api-response'
import { normalizeRole } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
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

    // Admins must not see billing data (retaining business logic)
    if (normalizeRole(profile.role || '') === 'admin') {
      return successResponse([])
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const caseId = searchParams.get('caseId')

    let query = supabase
      .from('invoices')
      .select(`
        *,
        client:parties!client_id(*),
        case:cases!inner(id, case_uid, case_title, firm_id)
      `)
      .eq('firm_id', profile.firm_id)
      .eq('case.firm_id', profile.firm_id)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status.toLowerCase())
    }

    if (caseId) {
      query = query.eq('case_id', caseId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Billing Fetch Error:', error)
      return errorResponse(error.message, 500)
    }

    return successResponse(data || [])
  } catch (err: any) {
    console.error('API Error /api/billing:', err)
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}

export async function POST(request: NextRequest) {
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
      return errorResponse('No firm associated', 403)
    }

    const body = await request.json()
    const { items, ...invoiceData } = body

    let success = false
    let attempts = 0
    let finalInvoice: any = null

    while (!success && attempts < 3) {
      attempts++

      if (!invoiceData.invoice_number) {
        const { data: lastInvoice } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('firm_id', profile.firm_id)
          .order('created_at', { ascending: false })
          .limit(1)

        const firstItem = Array.isArray(lastInvoice) ? lastInvoice[0] : lastInvoice

        let nextNum = 1
        if (firstItem) {
          const match = firstItem.invoice_number.match(/INV-(\d+)/)
          if (match) {
            nextNum = parseInt(match[1]) + 1
          }
        }
        invoiceData.invoice_number = `INV-${String(nextNum).padStart(5, '0')}`
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          ...invoiceData,
          firm_id: profile.firm_id
        })
        .select()
        .single()

      if (!invoiceError) {
        finalInvoice = invoice
        success = true
      } else if (invoiceError.code === '23505') { // Unique violation
        invoiceData.invoice_number = null // Reset to regenerate
        continue
      } else {
        console.error('Invoice Creation Error:', invoiceError)
        return errorResponse(invoiceError.message, 500)
      }
    }

    if (!finalInvoice) {
      return errorResponse('Failed to generate unique invoice number after multiple attempts', 500)
    }

    if (items && items.length > 0) {
      await supabase
        .from('invoice_items')
        .insert(
          items.map((item: any) => ({
            ...item,
            invoice_id: finalInvoice.id
          }))
        )
    }

    await logActivity(supabase, {
      case_id: finalInvoice.case_id,
      user_id: user.id,
      activity_type: 'invoice_created',
      description: `created invoice ${finalInvoice.invoice_number}`,
      firm_id: profile.firm_id
    })

    return successResponse(finalInvoice, 201)
  } catch (err: any) {
    console.error('POST Billing Error:', err)
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
