import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wjdvbodcmsfnpuyuhgxi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZHZib2RjbXNmbnB1eXVoZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYzNzAsImV4cCI6MjA4NzQ3MjM3MH0.kyKn9OnIRD7vyLyYDCOQ00RRmgJ-AXC55zHiMaK2lpw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
    const email = `test_dummy_${Date.now()}@gmail.com`;
    const password = "ValidPassword123!";

    console.log(`Testing Supabase Auth Signup for ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (signUpError) {
        console.error("SIGNUP ERROR:", signUpError.message);
        return;
    }

    console.log("Signup returned User:", !!signUpData.user, "Session:", !!signUpData.session);

    console.log("Immediately attempting login...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (signInError) {
        console.error("LOGIN ERROR CAUGHT:", signInError.message, signInError.status);
    } else {
        console.log("LOGIN SUCCESS:", !!signInData.user);
    }
}

testAuth();
