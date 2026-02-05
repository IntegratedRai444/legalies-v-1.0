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

  // Input validation
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  if (role !== undefined && !['admin', 'lawyer', 'advocate'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Note: isActive validation removed since is_active field doesn't exist in profiles table

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
  // Note: is_active field doesn't exist in profiles table - removed to prevent 42703 error

  const { error } = await serviceRoleSupabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
