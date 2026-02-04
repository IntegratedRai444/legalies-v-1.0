import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error("Profile fetch error:", error)
      return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { user, profile } })
  } catch (err: any) {
    console.error("Profile API error:", err)
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

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .update({
          full_name: body.full_name,
          phone: body.phone
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error("Profile update error:", error)
        return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: profile })
    }

    // Prevent Role Injection: Forced to 'advocate' for new profiles unless manually set in DB
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: body.full_name,
        phone: body.phone,
        role: 'advocate' // Securely hardcoded
      })
      .select()
      .single()

    if (error) {
      console.error("Profile creation error:", error)
      return NextResponse.json({ success: false, error: 'Failed to create profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (err: any) {
    console.error("Profile POST error:", err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
