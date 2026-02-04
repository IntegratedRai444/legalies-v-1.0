import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: caseId, docId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile to get firm_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', user.id)
      .single()

    if (!profile?.firm_id) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    // Verify document belongs to a case in the same firm
    const { data: document, error } = await supabase
      .from('case_documents')
      .select(`
        file_path,
        case:cases!inner(firm_id)
      `)
      .eq('id', docId)
      .eq('case_id', caseId)
      .eq('case.firm_id', profile.firm_id)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    // Generate a signed URL from Supabase Storage
    const { data, error: signedUrlError } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(document.file_path, 60 * 60) // 1 hour expiry

    if (signedUrlError || !data?.signedUrl) {
      console.error('Failed to generate signed URL:', signedUrlError)
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err: any) {
    console.error('Document download error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
