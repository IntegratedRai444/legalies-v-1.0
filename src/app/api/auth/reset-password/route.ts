import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const adminClient = await createServiceRoleClient()
    
    const { data, error } = await adminClient.auth.admin.updateUserById(
      'a6a60f0d-aee4-404d-9113-f33781665886',
      { password: 'Rishabhkapoor' }
    )

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Password reset successful' })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
