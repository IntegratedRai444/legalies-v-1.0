import { SupabaseClient } from '@supabase/supabase-js'

export async function createNotification(
  supabase: SupabaseClient,
  {
    user_id,
    title,
    content,
    type = 'info',
    link,
    related_case_id
  }: {
    user_id: string
    title: string
    content: string
    type?: string
    link?: string
    related_case_id?: string
  }
) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id,
      title,
      message: content,
      is_read: false,
      type,
      link,
      related_case_id
    })

  if (error) {
    console.error('Failed to create notification:', error)
  }
}

export async function notifyCaseParticipants(
  supabase: SupabaseClient,
  case_id: string,
  {
    exclude_user_id,
    title,
    content,
    type = 'info',
    link
  }: {
    exclude_user_id: string
    title: string
    content: string
    type?: string
    link?: string
  }
) {
  // Fetch assigned lawyer
  const { data: caseData } = await supabase
    .from('cases')
    .select('assigned_lawyer_id, created_by')
    .eq('id', case_id)
    .single()

  const participants = new Set<string>()

  if (caseData?.assigned_lawyer_id) participants.add(caseData.assigned_lawyer_id)
  if (caseData?.created_by) participants.add(caseData.created_by)

  // Also notify admins
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  admins?.forEach(admin => participants.add(admin.id))

  // Send notifications
  for (const userId of participants) {
    if (userId !== exclude_user_id) {
      await createNotification(supabase, {
        user_id: userId,
        title,
        content,
        type,
        link,
        related_case_id: case_id
      })
    }
  }
}
