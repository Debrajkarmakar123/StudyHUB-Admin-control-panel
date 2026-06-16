import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env;
const supabaseUrl = metaEnv?.VITE_SUPABASE_URL || 'https://parkuhfdblorqxztfaqw.supabase.co';
const supabaseAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhcmt1aGZkYmxvcnF4enRmYXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwODIsImV4cCI6MjA5NzE2OTA4Mn0.CzvMeY7Izo7p5NAbAXHRphb0ghiHjhWRbZVd2G5hQFA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
