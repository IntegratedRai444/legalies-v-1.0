import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Validate invoice belongs to firm and is draft status
    const { data: existingInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        invoice_number,
        status,
        case_id,
        total_amount
      `)
      .eq('id', id)
      .eq('firm_id', profile.firm_id)
      .single()

    if (fetchError || !existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found or access denied' }, { status: 404 })
    }

    // Only allow deletion of draft invoices
    if (existingInvoice.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 403 })
    }

    // Delete related invoice items first (already handled by cascade, but explicit for clarity)
    const { error: itemsDeleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id)

    if (itemsDeleteError) {
      console.error('Failed to delete invoice items:', itemsDeleteError)
      return NextResponse.json({ error: 'Failed to delete invoice items' }, { status: 500 })
    }

    // Delete the invoice
    const { error: invoiceDeleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)

    if (invoiceDeleteError) {
      console.error('Invoice delete error:', invoiceDeleteError)
      return NextResponse.json({ error: invoiceDeleteError.message }, { status: 500 })
    }

    // Log activity
    await logActivity(supabase, {
      case_id: existingInvoice.case_id,
      user_id: user.id,
      activity_type: 'invoice_delete',
      description: `deleted draft invoice ${existingInvoice.invoice_number}`,
      metadata: { 
        invoice_number: existingInvoice.invoice_number,
        total_amount: existingInvoice.total_amount
      },
      firm_id: profile.firm_id
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Invoice delete error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
