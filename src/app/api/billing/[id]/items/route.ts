import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify invoice ownership via Case
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, case_id')
    .eq('id', id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, created_by, assigned_lawyer_id')
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Strip financial data for admins
  if (isAdmin && data) {
    const strippedData = data.map(item => ({
      ...item,
      unit_price: null,
      amount: null
    }))
    return NextResponse.json(strippedData)
  }

  return NextResponse.json(data)
}
