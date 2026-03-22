import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wjdvbodcmsfnpuyuhgxi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZHZib2RjbXNmbnB1eXVoZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYzNzAsImV4cCI6MjA4NzQ3MjM3MH0.kyKn9OnIRD7vyLyYDCOQ00RRmgJ-AXC55zHiMaK2lpw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
    const email = "aggaming08082004@gmail.com";
    const password = "ValidPassword123!";

    console.log(`Testing Supabase Auth Signup for ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: "Jaswanth",
            }
        }
    });

    if (signUpError) {
        console.error("SIGNUP ERROR DETAILS:", JSON.stringify(signUpError, null, 2));
        return;
    }

    console.log("Signup returned User:", !!signUpData.user, "Session:", !!signUpData.session);
}

testAuth();
