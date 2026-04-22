import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ecyflusfzmlieinvzoix.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeWZsdXNmem1saWVpbnZ6b2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjU4NTIsImV4cCI6MjA5MjIwMTg1Mn0.xLqCkDstcTdBeFh698OwQf3nppePmnr42EeYe7SV1CE';

export const supabase = createClient(supabaseUrl, supabaseKey);