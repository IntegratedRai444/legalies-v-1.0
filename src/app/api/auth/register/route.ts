import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const adminClient = await createServiceRoleClient()

  try {
    const { email, password, fullName, phone } = await req.json()

    // 1. Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'advocate', // New users are advocates by default, admin is assigned manually
        }
      }
    })

    if (authError) {
      return NextResponse.json({ success: false, error: authError.message }, { 
        status: 400
      })
    }

    if (authData.user) {
      // 2. Auto-confirm the user using service role
      await adminClient.auth.admin.updateUserById(authData.user.id, {
        email_confirm: true
      })

      // 3. Create a new firm for this user
      const { data: firm, error: firmError } = await adminClient
        .from('firms')
        .insert({
          name: `${fullName}'s Firm`,
        })
        .select()
        .single()

      if (firmError) {
        console.error('Firm creation error:', firmError)
        return new Response(JSON.stringify({ success: false, error: 'Failed to create firm' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // 4. Create profile WITH firm_id and role=advocate
      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: authData.user.id,
        full_name: fullName,
        email,
        role: 'advocate',
        firm_id: firm.id,
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return NextResponse.json({ success: false, error: 'Failed to create profile' }, { 
          status: 500
        })
      }
    }

    return NextResponse.json({ success: true, data: { user: authData.user } })
  } catch (err: any) {
    console.error('Registration error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { 
      status: 500
    })
  }
}
