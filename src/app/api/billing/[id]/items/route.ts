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
      .select('id, created_by, assigned_lawyer_id, firm_id')
      .eq('id', invoice.case_id)
      .single()

    // Verify firm membership and case access
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    // Ensure user belongs to the same firm as the case
    if (caseRecord?.firm_id !== profile.firm_id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Allow access if user is case owner or assigned lawyer
    const isOwner = caseRecord?.created_by === user.id || caseRecord?.assigned_lawyer_id === user.id

    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
