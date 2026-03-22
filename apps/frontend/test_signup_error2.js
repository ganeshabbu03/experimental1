import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wjdvbodcmsfnpuyuhgxi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZHZib2RjbXNmbnB1eXVoZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYzNzAsImV4cCI6MjA4NzQ3MjM3MH0.kyKn9OnIRD7vyLyYDCOQ00RRmgJ-AXC55zHiMaK2lpw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
    console.log("TEST 1: Sign up with fully random dummy email to check if existing email is the issue");
    const { data: d1, error: e1 } = await supabase.auth.signUp({
        email: `random_${Date.now()}@gmail.com`,
        password: "ValidPassword123!",
    });
    console.log("Result 1:", e1 ? e1.message + " " + e1.status : "Success");

    console.log("\nTEST 2: Sign IN with the aggaming email to check if it's already registered but broken");
    const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({
        email: "aggaming08082004@gmail.com",
        password: "Admin@123",
    });
    console.log("Result 2:", e2 ? e2.message + " " + e2.status : "Success");
}

testAuth();
