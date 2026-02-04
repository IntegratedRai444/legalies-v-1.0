import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return errorResponse('No firm associated', 403)
    }

    const { data: parties, error } = await supabase
      .from('parties')
      .select(`
        *,
        case_parties (
          id,
          case_id,
          cases (
            case_title,
            id,
            firm_id
          )
        )
      `)
      .eq('firm_id', profile.firm_id)
      .order('name')

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse(parties)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()

    // Fetch profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('parties')
      .insert([
        {
          name: body.name,
          phone: body.phone,
          email: body.email,
          address: body.address,
          party_kind: body.party_kind || body.type, // Handle both for safety
          created_by: user.id,
          firm_id: profile?.firm_id
        },
      ])
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return successResponse(data, 201)
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
