// Temporary script to test Supabase session parsing logic
// This simulates what happens in useAuthStore when the page loads with an OAuth hash
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wjdvbodcmsfnpuyuhgxi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZHZib2RjbXNmbnB1eXVoZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYzNzAsImV4cCI6MjA4NzQ3MjM3MH0.kyKn9OnIRD7vyLyYDCOQ00RRmgJ-AXC55zHiMaK2lpw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSession() {
    console.log("Checking current session...");
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error("Error getting session:", error.message);
    } else if (session) {
        console.log("Session found for:", session.user?.email);
    } else {
        console.log("No session found in local storage/memory.");
    }
}

checkSession();
