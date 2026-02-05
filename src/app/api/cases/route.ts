import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { successResponse, errorResponse } from '@/lib/api-response'
import { normalizeStatus, normalizeRole } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse('Unauthorized', 401)
    }

    // Debug: Log user context
    console.log('Cases API - USER ID:', user.id)
    console.log('Cases API - USER EMAIL:', user.email)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

    // Debug: Log profile context
    console.log('Cases API - USER PROFILE:', profile)
    console.log('Cases API - USER FIRM_ID:', profile?.firm_id)

    if (!profile?.firm_id) {
      console.warn('User has no firm_id associated:', user.id)
      return successResponse([]) // Return empty cases for users without firm
    }

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_uid,
        case_title,
        court_name,
        court_city,
        court_state,
        case_type,
        status,
        stage,
        priority,
        filing_date,
        next_hearing_date,
        assigned_lawyer_id,
        created_by,
        firm_id,
        agreed_fee,
        last_updated_at,
        created_at,
        assigned_lawyer:profiles!cases_assigned_lawyer_id_fkey(id, full_name),
        case_parties(
          id,
          role_label,
          party:parties(*)
        ),
        hearings(hearing_date)
      `)
      .eq('firm_id', profile.firm_id)
      .order('created_at', { ascending: false })

    let cases: any[] | null = null
    let error: any = null

    if (status && status !== 'all') {
      // Debug: Log the status filter being applied
      console.log('Cases API - Filtering by status:', status, 'toLowerCase():', status.toLowerCase())
      
      // Try exact match first (for consistent data)
      const result = await query.eq('status', status.toLowerCase())
      cases = result.data
      error = result.error
      
      // If no results, try case-insensitive filtering by fetching all and filtering manually
      if (!error && (!cases || cases.length === 0)) {
        console.log('Cases API - No results with exact match, trying case-insensitive filter')
        const { data: allCases, error: allError } = await supabase
          .from('cases')
          .select(`
            id,
            case_uid,
            case_title,
            court_name,
            court_city,
            court_state,
            case_type,
            status,
            stage,
            priority,
            filing_date,
            next_hearing_date,
            assigned_lawyer_id,
            created_by,
            firm_id,
            agreed_fee,
            last_updated_at,
            created_at,
            assigned_lawyer:profiles!cases_assigned_lawyer_id_fkey(id, full_name),
            case_parties(
              id,
              role_label,
              party:parties(*)
            ),
            hearings(hearing_date)
          `)
          .eq('firm_id', profile.firm_id)
          .order('created_at', { ascending: false })
        
        if (!allError && allCases) {
          cases = allCases.filter(c => c.status?.toLowerCase() === status.toLowerCase())
          error = null
        } else {
          error = allError
        }
      }
    } else {
      // Debug: No status filter applied - fetching all cases
      console.log('Cases API - No status filter, fetching all cases for firm:', profile.firm_id)
      const result = await query
      cases = result.data
      error = result.error
    }
    
    // Debug: Log all cases and their statuses
    console.log('Cases API - All cases fetched:', cases?.map(c => ({ id: c.id, case_uid: c.case_uid, status: c.status, firm_id: c.firm_id })))
    
    // Debug: Check if any cases have different firm_id
    const mismatchedFirmCases = cases?.filter(c => c.firm_id !== profile.firm_id)
    if (mismatchedFirmCases && mismatchedFirmCases.length > 0) {
      console.log('Cases API - Cases with different firm_id:', mismatchedFirmCases.map(c => ({ id: c.id, case_uid: c.case_uid, case_firm_id: c.firm_id, user_firm_id: profile.firm_id })))
    }
    
    // Debug: Show distinct statuses in the result
    const distinctStatuses = [...new Set(cases?.map(c => c.status).filter(Boolean))]
    console.log('Cases API - Distinct statuses in fetched cases:', distinctStatuses)

    if (error) {
      console.error('Case Fetch Error:', error)
      return errorResponse(error.message, 500)
    }

    const result = (cases || []).map(c => {
      // Compute next hearing date locally from joined hearings
      const hearings = c.hearings ?? []
      const upcomingHearings = hearings
        .map((h: any) => h.hearing_date)
        .filter((d: string) => d && new Date(d) >= new Date())
        .sort()

      const next_hearing_date = upcomingHearings[0] || c.next_hearing_date || null

      const case_parties = c.case_parties ?? []
      // Transform parties into clients and opponents
      const clients = case_parties.filter((cp: any) => cp.party?.party_kind === 'client').map((cp: any) => ({
        id: cp.id,
        party_id: cp.party?.id,
        role_label: cp.role_label,
        party: cp.party
      }))

      const opponents = case_parties.filter((cp: any) => cp.party?.party_kind === 'opponent').map((cp: any) => ({
        id: cp.id,
        party_id: cp.party?.id,
        role_label: cp.role_label,
        party: cp.party
      }))

      const normalizedCase = {
        ...c,
        status: normalizeStatus(c.status),
        clients,
        opponents,
        next_hearing_date
      }

      // Strip financial data for admins if required
      if (normalizeRole(profile?.role || '') === 'admin') {
        const { agreed_fee, ...rest } = normalizedCase
        return rest
      }
      return normalizedCase
    })

    let filteredResult = result
    if (search) {
      const searchLower = search.toLowerCase()
      filteredResult = (result || []).filter(c =>
        c.case_uid?.toLowerCase().includes(searchLower) ||
        c.case_title?.toLowerCase().includes(searchLower) ||
        c.court_name?.toLowerCase().includes(searchLower) ||
        c.clients?.some((cl: any) => cl.party?.name?.toLowerCase().includes(searchLower) || cl.party?.phone?.includes(search)) ||
        c.opponents?.some((op: any) => op.party?.name?.toLowerCase().includes(searchLower) || op.party?.phone?.includes(search))
      )
    }

    return successResponse(filteredResult)
  } catch (err: any) {
    console.error('API Error /api/cases:', err)
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

    // Fetch user profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return errorResponse('Profile not found', 404)
    }

    const body = await request.json()
    const { clients, opponents, ...rawCaseData } = body

    // Validation
    if (!rawCaseData.case_title || typeof rawCaseData.case_title !== "string") {
      return NextResponse.json({ success: false, error: "Invalid case title" }, { status: 400 })
    }
    if (rawCaseData.case_title.length < 3 || rawCaseData.case_title.length > 200) {
      return NextResponse.json({ success: false, error: "Case title must be 3-200 characters" }, { status: 400 })
    }
    if (rawCaseData.agreed_fee && (isNaN(parseFloat(rawCaseData.agreed_fee)) || parseFloat(rawCaseData.agreed_fee) < 0)) {
      return NextResponse.json({ success: false, error: "Invalid agreed fee amount" }, { status: 400 })
    }
    if (rawCaseData.priority && !['Routine', 'Urgent', 'High'].includes(rawCaseData.priority)) {
      return NextResponse.json({ success: false, error: "Invalid priority level" }, { status: 400 })
    }

    // Map frontend fields to database columns and filter out non-existent columns
    const caseData = {
      case_title: rawCaseData.case_title,
      case_type: rawCaseData.case_type,
      court_name: rawCaseData.court_name,
      court_city: rawCaseData.court_city,
      court_state: rawCaseData.court_state,
      filing_date: rawCaseData.filing_date || null,
      status: (rawCaseData.status || 'active').toLowerCase(),
      stage: rawCaseData.stage || 'Notice',
      agreed_fee: rawCaseData.agreed_fee ? parseFloat(rawCaseData.agreed_fee) : null,
      priority: rawCaseData.priority || 'Routine',
      assigned_lawyer_id: rawCaseData.assigned_lawyer_id || user.id,
      next_hearing_date: rawCaseData.next_hearing_date || null
    }

    let success = false
    let attempts = 0
    let newCase: any = null

    while (!success && attempts < 3) {
      attempts++
      // Generate unique UID
      const { data: countData } = await supabase
        .from('cases')
        .select('case_uid')
        .order('created_at', { ascending: false })
        .limit(1)

      let nextNum = 1
      if (countData && countData.length > 0) {
        const lastUid = countData[0].case_uid
        const match = lastUid.match(/LCM-\d{4}-(\d+)/)
        if (match) {
          nextNum = parseInt(match[1]) + 1
        }
      }

      const year = new Date().getFullYear()
      const case_uid = `LCM-${year}-${String(nextNum).padStart(4, '0')}`

      // 1. Create the case
      const { data, error: caseError } = await supabase
        .from('cases')
        .insert({
          ...caseData,
          case_uid,
          created_by: user.id,
          firm_id: profile.firm_id,
          assigned_lawyer_id: caseData.assigned_lawyer_id || user.id
        })
        .select(`
          id,
          case_uid,
          case_title,
          court_name,
          court_city,
          court_state,
          case_type,
          status,
          stage,
          priority,
          filing_date,
          next_hearing_date,
          assigned_lawyer_id,
          created_by,
          firm_id,
          agreed_fee,
          last_updated_at,
          created_at
        `)
        .single()

      if (!caseError) {
        newCase = data
        success = true
      } else if (caseError.code === '23505') { // Unique violation
        continue
      } else {
        console.error('Error creating case:', caseError)
        return errorResponse(caseError.message, 500)
      }
    }

    if (!newCase) {
      return errorResponse('Failed to generate unique case ID after multiple attempts', 500)
    }

    // 2. Insert Client Party
    let clientParty = null
    if (clients && clients.length > 0 && clients[0].name && clients[0].name.trim()) {
      try {
        const { data: clientData, error: clientError } = await supabase
          .from('parties')
          .insert({
            name: clients[0].name,
            phone: clients[0].phone || null,
            email: clients[0].email || null,
            address: clients[0].address || null,
            party_kind: 'person',
            firm_id: profile.firm_id,
            created_by: user.id
          })
          .select()
          .single()

        if (clientError) {
          console.error('Error creating client party:', clientError)
        } else {
          clientParty = clientData
          // Link Client to Case
          const { error: linkError } = await supabase.from('case_parties').insert({
            case_id: newCase.id,
            party_id: clientParty.id,
            role_label: 'client'
          })
          if (linkError) {
            console.error('Error linking client to case:', linkError)
          }
        }
      } catch (err) {
        console.error('Client creation error:', err)
      }
    }

    // 3. Insert Opponent Party
    let opponentParty = null
    if (opponents && opponents.length > 0 && opponents[0].name && opponents[0].name.trim()) {
      try {
        const { data: opponentData, error: opponentError } = await supabase
          .from('parties')
          .insert({
            name: opponents[0].name,
            phone: opponents[0].phone || null,
            email: opponents[0].email || null,
            address: opponents[0].address || null,
            party_kind: 'organization',
            firm_id: profile.firm_id,
            created_by: user.id
          })
          .select()
          .single()

        if (opponentError) {
          console.error('Error creating opponent party:', opponentError)
        } else {
          opponentParty = opponentData
          // Link Opponent to Case
          const { error: linkError } = await supabase.from('case_parties').insert({
            case_id: newCase.id,
            party_id: opponentParty.id,
            role_label: 'opponent'
          })
          if (linkError) {
            console.error('Error linking opponent to case:', linkError)
          }
        }
      } catch (err) {
        console.error('Opponent creation error:', err)
      }
    }

    // 4. Create initial activity log
    await supabase.from('activity_logs').insert({
      case_id: newCase.id,
      user_id: user.id,
      activity_type: 'case_created',
      description: `Case "${caseData.case_title}" was created.`,
      firm_id: profile.firm_id
    })

    // 5. Create initial hearing if provided
    if (rawCaseData.next_hearing_date) {
      await supabase.from('hearings').insert({
        case_id: newCase.id,
        hearing_date: rawCaseData.next_hearing_date,
        hearing_type: 'Initial Hearing',
        court_room: rawCaseData.court_room || '',
        firm_id: profile.firm_id
      })

      // Update case next_hearing_date
      await supabase.from('cases').update({
        next_hearing_date: rawCaseData.next_hearing_date
      }).eq('id', newCase.id)
    }

    return successResponse(newCase, 201)
  } catch (err: any) {
    console.error('POST Case Error:', err)
    return errorResponse(err.message || 'Internal Server Error', 500)
  }
}
