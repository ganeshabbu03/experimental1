import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wjdvbodcmsfnpuyuhgxi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZHZib2RjbXNmbnB1eXVoZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYzNzAsImV4cCI6MjA4NzQ3MjM3MH0.kyKn9OnIRD7vyLyYDCOQ00RRmgJ-AXC55zHiMaK2lpw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
    const email = "ganeshabbu03@gmail.com";
    const password = "password123"; // Dummy password just to see the type of error

    console.log(`Testing Supabase Auth for ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error("SUPABASE ERROR CAUGHT:", error.message, error.status);
    } else {
        console.log("SUCCESS:", data);
    }
}

testAuth();
