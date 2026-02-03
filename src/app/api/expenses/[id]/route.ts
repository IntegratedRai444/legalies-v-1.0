import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
const normalize = (v?: string) => v?.toLowerCase().trim()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Verify ownership or admin role AND firm isolation
    const { data: expense } = await supabase
      .from('case_expenses')
      .select('id, added_by, case_id, case:cases!inner(firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalize(profile?.role || '') === 'admin'
    const isOwner = expense.added_by === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('case_expenses')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
