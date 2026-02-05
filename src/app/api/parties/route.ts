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

    console.log("PARTIES API firm_id:", profile.firm_id)

    const { data: parties, error } = await supabase
      .from('parties')
      .select(`
        *,
        case_parties (
          id,
          case_id,
          cases (
            case_title,
            id
          )
        )
      `)
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false })

    console.log("PARTIES API result count:", parties?.length)

    if (error) {
      console.error("PARTIES API error:", error)
      return errorResponse(error.message, 500)
    }

    // Map party_kind to client/opponent for frontend compatibility
    const mappedParties = parties?.map(party => ({
      ...party,
      party_kind: party.party_kind === 'person' ? 'client' : 
                   party.party_kind === 'organization' ? 'opponent' : 
                   party.party_kind
    })) || []

    return successResponse(mappedParties)
  } catch (err: any) {
    console.error("PARTIES API unexpected error:", err)
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

    console.log("PARTIES POST API firm_id:", profile?.firm_id)
    console.log("PARTIES POST API body:", body)

    // Map frontend type to database party_kind
    const party_kind = body.type === 'client' ? 'person' : 
                       body.type === 'opponent' ? 'organization' : 
                       body.party_kind

    const { data, error } = await supabase
      .from('parties')
      .insert([
        {
          name: body.name,
          phone: body.phone,
          email: body.email,
          address: body.address,
          party_kind: party_kind,
          created_by: user.id,
          firm_id: profile?.firm_id
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("PARTIES POST API error:", error)
      return errorResponse(error.message, 500)
    }

    console.log("PARTIES POST API success:", data)

    // Map back to frontend format
    const mappedData = {
      ...data,
      party_kind: data.party_kind === 'person' ? 'client' : 
                   data.party_kind === 'organization' ? 'opponent' : 
                   data.party_kind
    }

    return successResponse(mappedData, 201)
  } catch (err: any) {
    console.error("PARTIES POST API unexpected error:", err)
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
