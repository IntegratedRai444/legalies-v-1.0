import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify invoice ownership via Case
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, case_id')
      .eq('id', id)
      .single()

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
    }

    const { data: caseRecord } = await supabase
      .from('cases')
      .select('id, created_by, assigned_lawyer_id, court_city, court_state')
      .eq('id', invoice.case_id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = normalizeRole(profile?.role || '') === 'admin'
    const isOwner = caseRecord?.created_by === user.id || caseRecord?.assigned_lawyer_id === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Strip financial data for admins
    if (isAdmin && data) {
      const strippedData = data.map(item => ({
        ...item,
        unit_price: null,
        amount: null
      }))
      return NextResponse.json({ success: true, data: strippedData })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
