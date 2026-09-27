import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// We use the service role key on the server to bypass Row Level Security 
// when we need to confidently update game state, match history, and leaderboards.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
