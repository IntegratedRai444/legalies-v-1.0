import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const caseId = searchParams.get('case_id')

  if (!caseId) {
    return NextResponse.json({ error: 'case_id is required' }, { status: 400 })
  }

  // Verify user profile and firm_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
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
    return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 })
  }

  const isAdmin = normalizeRole(profile?.role || '') === 'admin'
  const isOwner = caseRecord.created_by === user.id || caseRecord.assigned_lawyer_id === user.id

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Strip amounts for admins
  if (isAdmin && expenses) {
    const strippedExpenses = expenses.map(exp => ({
      ...exp,
      amount: null
    }))
    return NextResponse.json(strippedExpenses)
  }

  return NextResponse.json(expenses)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { case_id, title, amount, expense_date, category, description } = body

  if (!case_id || !title || !amount || !expense_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify Case Access
  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id, created_by, assigned_lawyer_id, court_city, court_state')
    .eq('id', case_id)
    .single()

  if (!caseRecord) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  const isAdmin = normalizeRole(profile?.role || '') === 'admin'
  const isOwner = caseRecord.created_by === user.id || caseRecord.assigned_lawyer_id === user.id

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(expense)
}
