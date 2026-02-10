-- Additional Database Functions for Global Competition System
-- These functions extend the existing database schema for competition management

-- Function to update competition participant score atomically
CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score DECIMAL(4,1)
)
RETURNS void AS $$
BEGIN
    -- Upsert participant record with atomic score update
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        best_day_score,
        average_score
    )
    VALUES (
        p_competition_id,
        p_user_id,
        p_daily_score,
        1,
        p_daily_score,
        p_daily_score
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1);
        
    -- Update competition rankings
    PERFORM update_competition_rankings(p_competition_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's rank in competition
CREATE OR REPLACE FUNCTION get_user_rank_in_competition(
    p_competition_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    rank INTEGER,
    total_participants INTEGER,
    user_score DECIMAL(4,1),
    user_days INTEGER,
    user_average DECIMAL(4,1)
) AS $$
DECLARE
    user_data RECORD;
BEGIN
    -- Get user's data
    SELECT total_score, days_played, average_score, rank
    INTO user_data
    FROM competition_participants
    WHERE competition_id = p_competition_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Count total active participants
    SELECT COUNT(*)
    INTO total_participants
    FROM competition_participants
    WHERE competition_id = p_competition_id AND total_score > 0;
    
    RETURN QUERY SELECT
        user_data.rank::INTEGER,
        total_participants::INTEGER,
        user_data.total_score,
        user_data.days_played,
        user_data.average_score;
END;
$$ LANGUAGE plpgsql;

-- Function to get global leaderboard with efficient pagination
CREATE OR REPLACE FUNCTION get_global_leaderboard(
    p_competition_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    rank INTEGER,
    user_id UUID,
    username TEXT,
    total_score DECIMAL(4,1),
    days_played INTEGER,
    average_score DECIMAL(4,1),
    best_day_score DECIMAL(4,1),
    medal TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.rank,
        cp.user_id,
        u.username,
        cp.total_score,
        cp.days_played,
        cp.average_score,
        cp.best_day_score,
        CASE 
            WHEN cp.rank = 1 THEN '🥇'
            WHEN cp.rank = 2 THEN '🥈'
            WHEN cp.rank = 3 THEN '🥉'
            ELSE ''
        END as medal
    FROM competition_participants cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.competition_id = p_competition_id
        AND cp.total_score > 0
    ORDER BY cp.rank
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to create monthly global competition
CREATE OR REPLACE FUNCTION create_monthly_global_competition(
    p_year INTEGER,
    p_month INTEGER
)
RETURNS UUID AS $$
DECLARE
    competition_id UUID;
    start_date DATE;
    end_date DATE;
    competition_name TEXT;
BEGIN
    -- Calculate dates
    start_date := DATE(p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01');
    end_date := (start_date + INTERVAL '1 month - 1 day')::DATE;
    
    -- Generate competition name
    competition_name := 'Global Leaderboard ' || 
        TO_CHAR(start_date, 'Month') || ' ' || p_year;
    
    -- Create competition
    INSERT INTO competitions (
        name,
        description,
        creator_id,
        creator_timezone,
        start_date,
        end_date,
        is_global,
        is_public,
        is_active,
        scoring_type,
        min_days_required
    )
    VALUES (
        TRIM(competition_name),
        'Monthly global competition for all Daily Shapes players',
        NULL,
        'UTC',
        start_date,
        end_date,
        true,
        true,
        true,
        'total',
        1
    )
    RETURNING id INTO competition_id;
    
    -- Auto-enroll all existing non-guest users
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        average_score,
        best_day_score,
        rank
    )
    SELECT 
        competition_id,
        u.id,
        0,
        0,
        0,
        0,
        999999
    FROM users u
    WHERE NOT u.is_guest
    ON CONFLICT (competition_id, user_id) DO NOTHING;
    
    RETURN competition_id;
END;
$$ LANGUAGE plpgsql;

-- Function to archive previous month's competition and create new one
CREATE OR REPLACE FUNCTION handle_monthly_competition_reset()
RETURNS UUID AS $$
DECLARE
    current_year INTEGER;
    current_month INTEGER;
    new_competition_id UUID;
BEGIN
    -- Get current year and month
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    
    -- Archive all currently active global competitions
    UPDATE competitions 
    SET is_active = false
    WHERE is_global = true 
        AND is_active = true
        AND end_date < CURRENT_DATE;
    
    -- Check if current month competition already exists
    SELECT id INTO new_competition_id
    FROM competitions
    WHERE is_global = true
        AND is_active = true
        AND start_date = DATE(current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-01');
    
    -- Create new competition if it doesn't exist
    IF new_competition_id IS NULL THEN
        new_competition_id := create_monthly_global_competition(current_year, current_month);
    END IF;
    
    RETURN new_competition_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get competition statistics
CREATE OR REPLACE FUNCTION get_competition_stats(p_competition_id UUID)
RETURNS TABLE(
    total_participants INTEGER,
    active_participants INTEGER,
    total_games_played INTEGER,
    average_score DECIMAL(4,1),
    highest_score DECIMAL(4,1),
    days_remaining INTEGER
) AS $$
DECLARE
    comp_end_date DATE;
BEGIN
    -- Get competition end date
    SELECT end_date INTO comp_end_date
    FROM competitions
    WHERE id = p_competition_id;
    
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_participants,
        COUNT(CASE WHEN cp.total_score > 0 THEN 1 END)::INTEGER as active_participants,
        SUM(cp.days_played)::INTEGER as total_games_played,
        ROUND(AVG(NULLIF(cp.average_score, 0)), 1) as average_score,
        MAX(cp.total_score) as highest_score,
        GREATEST(0, (comp_end_date - CURRENT_DATE))::INTEGER as days_remaining
    FROM competition_participants cp
    WHERE cp.competition_id = p_competition_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_competition_participants_score_rank 
ON competition_participants(competition_id, total_score DESC, days_played DESC);

CREATE INDEX IF NOT EXISTS idx_competition_participants_user_lookup
ON competition_participants(competition_id, user_id);

CREATE INDEX IF NOT EXISTS idx_competitions_global_active
ON competitions(is_global, is_active, start_date DESC);

-- Create a trigger to automatically update rankings when scores change
CREATE OR REPLACE FUNCTION trigger_update_rankings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update rankings for the affected competition
    PERFORM update_competition_rankings(COALESCE(NEW.competition_id, OLD.competition_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS competition_rankings_update ON competition_participants;
CREATE TRIGGER competition_rankings_update
    AFTER INSERT OR UPDATE OR DELETE ON competition_participants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_rankings();

-- Function to clean up old competition data (run monthly)
CREATE OR REPLACE FUNCTION cleanup_old_competitions()
RETURNS void AS $$
BEGIN
    -- Archive competitions older than 12 months
    UPDATE competitions 
    SET is_active = false
    WHERE is_global = true
        AND end_date < (CURRENT_DATE - INTERVAL '12 months');
    
    -- Could add more cleanup logic here if needed
    -- For now, we keep all historical data for user stats
END;
$$ LANGUAGE plpgsql;