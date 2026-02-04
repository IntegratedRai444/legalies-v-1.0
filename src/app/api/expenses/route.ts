import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const caseId = searchParams.get('case_id')

    if (!caseId) {
      return NextResponse.json({ success: false, error: 'case_id is required' }, { status: 400 })
    }

    // Verify user profile and firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ success: false, error: 'No firm associated' }, { status: 403 })
    }

    const firmId = profile.firm_id

    // Verify case belongs to logged-in user or they are admin
    const { data: caseRecord } = await supabase
      .from('cases')
      .select('id, created_by, assigned_lawyer_id, court_city, court_state')
      .eq('id', caseId)
      .eq('firm_id', firmId)
      .single()

    if (!caseRecord) {
      return NextResponse.json({ success: false, error: 'Case not found or access denied' }, { status: 404 })
    }

    const isAdmin = normalizeRole(profile?.role || '') === 'admin'
    const isOwner = caseRecord.created_by === user.id || caseRecord.assigned_lawyer_id === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { data: expenses, error } = await supabase
      .from('case_expenses')
      .select(`
        *,
        added_by_profile:profiles!added_by(full_name),
        case:cases!inner(id, firm_id)
      `)
      .eq('case_id', caseId)
      .eq('case.firm_id', firmId)
      .order('expense_date', { ascending: false })

    if (error) {
      console.error("Expenses fetch error:", error)
      return NextResponse.json({ success: false, error: 'Failed to fetch expenses' }, { status: 500 })
    }

    // Strip amounts for admins
    if (isAdmin && expenses) {
      const strippedExpenses = expenses.map(exp => ({
        ...exp,
        amount: null
      }))
      return NextResponse.json({ success: true, data: strippedExpenses })
    }

    return NextResponse.json({ success: true, data: expenses })
  } catch (err: any) {
    console.error("Expenses API error:", err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { case_id, title, amount, expense_date, category, description } = body

    if (!case_id || !title || !amount || !expense_date) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Verify Case Access
    const { data: caseRecord } = await supabase
      .from('cases')
      .select('id, created_by, assigned_lawyer_id, court_city, court_state')
      .eq('id', case_id)
      .single()

    if (!caseRecord) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    const isAdmin = normalizeRole(profile?.role || '') === 'admin'
    const isOwner = caseRecord.created_by === user.id || caseRecord.assigned_lawyer_id === user.id

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { data: expense, error } = await supabase
      .from('case_expenses')
      .insert({
        case_id,
        title,
        amount,
        expense_date,
        category,
        description,
        added_by: user.id,
        firm_id: profile?.firm_id
      })
      .select()
      .single()

    if (error) {
      console.error("Expense creation error:", error)
      return NextResponse.json({ success: false, error: 'Failed to create expense' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: expense })
  } catch (err: any) {
    console.error("Expenses POST error:", err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
