import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const serviceRoleSupabase = await createServiceRoleClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await serviceRoleSupabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: users, error } = await serviceRoleSupabase
    .from('profiles')
    .select('*')
    .eq('firm_id', profile.firm_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(users)
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient()
  const serviceRoleSupabase = await createServiceRoleClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await serviceRoleSupabase
    .from('profiles')
    .select('role, firm_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, role, isActive } = await req.json()

  // Ensure we are updating a user from the same firm
  const { data: targetUser } = await serviceRoleSupabase
    .from('profiles')
    .select('firm_id')
    .eq('id', userId)
    .single()

  if (targetUser?.firm_id !== profile.firm_id) {
    return NextResponse.json({ error: 'User belongs to another firm' }, { status: 403 })
  }

  const updateData: any = {}
  if (role !== undefined) updateData.role = role
  if (isActive !== undefined) updateData.is_active = isActive

  const { error } = await serviceRoleSupabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
