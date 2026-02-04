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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, firm_id')
      .eq('id', user.id)
      .single()

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

    if (status && status !== 'all') {
      query = query.eq('status', status.toLowerCase())
    }

    const { data: cases, error } = await query

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
      filteredResult = result.filter(c =>
        c.case_uid.toLowerCase().includes(searchLower) ||
        c.case_title.toLowerCase().includes(searchLower) ||
        c.court_name?.toLowerCase().includes(searchLower) ||
        c.clients.some((cl: any) => cl.party?.name?.toLowerCase().includes(searchLower) || cl.party?.phone?.includes(search)) ||
        c.opponents.some((op: any) => op.party?.name?.toLowerCase().includes(searchLower) || op.party?.phone?.includes(search))
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

    // 2. Prepare all parties for batch insertion
    const allParties = [
      ...(clients?.map((c: any) => ({ ...c, party_kind: 'client' })) || []),
      ...(opponents?.map((o: any) => ({ ...o, party_kind: 'opponent' })) || [])
    ]

    const partyData = (allParties || [])
      .filter((p: any) => p.name && p.name.trim())
      .map((p: any) => ({
        name: p.name,
        phone: p.phone,
        address: p.address,
        party_kind: p.party_kind,
        created_by: user.id,
        firm_id: profile.firm_id
      }))

    if (partyData.length > 0) {
      const { data: createdParties, error: partiesError } = await supabase
        .from('parties')
        .insert(partyData)
        .select()

      if (partiesError) {
        console.error('Error batch creating parties:', partiesError)
      } else if (createdParties) {
        // 3. Prepare link records for batch insertion
        const partyLinks = createdParties.map((party: any, index: number) => {
          // Match back to the original party's role_label using index
          const originalParty = partyData[index]
          const sourceParty = allParties.find((ap: any) => ap.name === party.name && ap.party_kind === party.party_kind)
          return {
            case_id: newCase.id,
            party_id: party.id,
            role_label: sourceParty?.role_label || 'Party'
          }
        })

        if (partyLinks.length > 0) {
          const { error: linkError } = await supabase
            .from('case_parties')
            .insert(partyLinks)

          if (linkError) console.error('Error linking parties:', linkError)
        }
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
