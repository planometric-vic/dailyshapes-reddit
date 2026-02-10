// One-time script to update November 2025 global competition name
// Run this once in the browser console when on the Daily Shapes site

async function updateNovemberCompName() {
    console.log('🔄 Starting November competition name update...');

    // Check if Supabase is available
    if (!window.SupabaseConfig || !window.SupabaseConfig.client) {
        console.error('❌ Supabase not available. Make sure you are on the Daily Shapes site.');
        return;
    }

    const supabase = window.SupabaseConfig.client;

    try {
        // Find the November 2025 global competition
        const { data: competitions, error: findError } = await supabase
            .from('competitions')
            .select('*')
            .eq('competition_type', 'global')
            .eq('is_global', true)
            .ilike('name', '%November%2025%');

        if (findError) {
            console.error('❌ Error finding competition:', findError);
            return;
        }

        if (!competitions || competitions.length === 0) {
            console.log('⚠️ No November 2025 global competition found');
            return;
        }

        console.log('📋 Found competition:', competitions[0]);

        // Update the name
        const { data: updated, error: updateError } = await supabase
            .from('competitions')
            .update({
                name: 'NOVEMBER GLOBAL 🌍'
            })
            .eq('id', competitions[0].id)
            .select();

        if (updateError) {
            console.error('❌ Error updating competition:', updateError);
            return;
        }

        console.log('✅ Successfully updated competition name!');
        console.log('📋 Updated competition:', updated[0]);
        console.log('');
        console.log('🎉 November competition is now named: NOVEMBER GLOBAL 🌍');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the update
updateNovemberCompName();
