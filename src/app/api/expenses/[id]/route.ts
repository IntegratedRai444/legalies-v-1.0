import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { normalizeRole } from '@/lib/utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      console.warn('User has no firm_id associated:', user.id)
      return NextResponse.json({ success: true, data: null }) // Return null for users without firm
    }

    // Validate expense belongs to case in same firm
    const { data: existingExpense, error: fetchError } = await supabase
      .from('case_expenses')
      .select(`
        title,
        description,
        amount,
        expense_date,
        category,
        added_by,
        case_id,
        case:cases!inner(firm_id)
      `)
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (fetchError || !existingExpense) {
      return NextResponse.json({ success: false, error: 'Expense not found or access denied' }, { status: 404 })
    }

    // Ownership check - only creator or admin can edit
    const isAdmin = normalizeRole(profile.role) === 'admin'
    const isOwner = existingExpense.added_by === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Only expense creator or admin can edit expenses' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, amount, expense_date, category } = body

    // Build update data with only provided fields
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = parseFloat(amount)
    if (expense_date !== undefined) updateData.expense_date = expense_date
    if (category !== undefined) updateData.category = category

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

    // Update expense
    const { data: updatedExpense, error: updateError } = await supabase
      .from('case_expenses')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        added_by_profile:profiles!case_expenses_added_by_fkey(full_name),
        case:cases(id, case_uid, case_title)
      `)
      .single()

    if (updateError) {
      console.error('Expense update error:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Log activity
    await logActivity(supabase, {
      case_id: existingExpense.case_id,
      user_id: user.id,
      activity_type: 'expense_update',
      description: `updated expense "${existingExpense.title}"`,
      metadata: { 
        old_data: {
          title: existingExpense.title,
          amount: existingExpense.amount,
          category: existingExpense.category
        },
        new_data: updateData
      },
      firm_id: profile.firm_id
    })

    return NextResponse.json({ success: true, data: updatedExpense })
  } catch (err: any) {
    console.error('Expense update error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      console.warn('User has no firm_id associated:', user.id)
      return NextResponse.json({ success: true, data: null }) // Return null for users without firm
    }

    // Verify ownership or admin role AND firm isolation
    const { data: expense } = await supabase
      .from('case_expenses')
      .select('id, added_by, case_id, case:cases!inner(firm_id)')
      .eq('id', id)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (!expense) {
      return NextResponse.json({ success: false, error: 'Expense not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalizeRole(profile?.role || '') === 'admin'
    const isOwner = expense.added_by === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('case_expenses')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
