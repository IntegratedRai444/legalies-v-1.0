import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!profile?.firm_id) {
    return NextResponse.json([]) // Return empty if no firm associated
  }

  const firmId = profile.firm_id

  // Search cases by title, UID, court - WITH FIRM ISOLATION
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id, case_title, case_uid, court_name, firm_id')
    .eq('firm_id', firmId)
    .or(`case_title.ilike.%${query}%,case_uid.ilike.%${query}%,court_name.ilike.%${query}%`)
    .limit(5)

  if (casesError) {
    return NextResponse.json({ error: casesError.message }, { status: 500 })
  }

  // Search parties by name - WITH FIRM ISOLATION
  const { data: parties, error: partiesError } = await supabase
    .from('parties')
    .select('id, name, party_kind, firm_id')
    .eq('firm_id', firmId)
    .ilike('name', `%${query}%`)
    .limit(5)

  if (partiesError) {
    return NextResponse.json({ error: partiesError.message }, { status: 500 })
  }

  // Find cases for these parties - WITH FIRM ISOLATION
  const partyIds = parties.map(p => p.id)
  let partyCases: any[] = []

  if (partyIds.length > 0) {
    const { data: cpData } = await supabase
      .from('case_parties')
      .select('case_id, role_label, cases!inner(case_title, case_uid, firm_id)')
      .in('party_id', partyIds)
      .eq('cases.firm_id', firmId)

    partyCases = cpData || []
  }

  const results = [
    ...cases.map(c => ({
      id: c.id,
      type: 'case',
      title: c.case_title,
      subtitle: `${c.case_uid} | ${c.court_name || 'No Court'}`,
      href: `/cases/${c.id}`
    })),
    ...parties.map(p => ({
      id: p.id,
      type: 'party',
      title: p.name,
      subtitle: p.party_kind === 'client' ? 'Client' : 'Opponent',
      href: partyCases.find(cp => cp.party_id === p.id)?.case_id
        ? `/cases/${partyCases.find(cp => cp.party_id === p.id).case_id}`
        : '#'
    }))
  ]

  return NextResponse.json(results)
}
