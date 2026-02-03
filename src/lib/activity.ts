import { SupabaseClient } from '@supabase/supabase-js'

export async function logActivity(
  supabase: SupabaseClient,
  {
    case_id,
    user_id,
    activity_type,
    description,
    metadata = {},
    firm_id
  }: {
    case_id?: string
    user_id: string
    activity_type: string
    description: string
    metadata?: any
    firm_id?: string
  }
) {
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      case_id,
      user_id,
      activity_type,
      description,
      metadata,
      firm_id
    })

  if (error) {
    console.error('Failed to log activity:', error)
  }
}
