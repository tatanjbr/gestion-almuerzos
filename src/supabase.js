import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://auwljcqvjnnmchvabfmp.supabase.co'
const supabaseKey = 'sb_publishable_tg4MvJ8KWerMFg6FVvUXOw_K-J2wv3d'

export const supabase = createClient(supabaseUrl, supabaseKey)