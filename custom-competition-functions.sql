-- Custom Competition Database Functions for Daily Shapes v4.0
-- Extends the existing database with custom competition management

-- Function to get custom competition leaderboard with enhanced medals
CREATE OR REPLACE FUNCTION get_custom_competition_leaderboard(
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
    joined_at TIMESTAMP WITH TIME ZONE,
    medal TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC)::INTEGER as rank,
        cp.user_id,
        u.username,
        cp.total_score,
        cp.days_played,
        CASE 
            WHEN cp.days_played > 0 THEN ROUND(cp.total_score / cp.days_played, 1)
            ELSE 0.0
        END as average_score,
        cp.joined_at,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) = 1 THEN '🥇'
            WHEN ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) = 2 THEN '🥈'
            WHEN ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) = 3 THEN '🥉'
            ELSE ''
        END as medal
    FROM competition_participants cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.competition_id = p_competition_id
        AND cp.total_score > 0
    ORDER BY cp.total_score DESC, cp.days_played DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get today's best scores for daily awards
CREATE OR REPLACE FUNCTION get_todays_best_scores(
    p_competition_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    user_id UUID,
    daily_average DECIMAL(4,1),
    perfect_cuts INTEGER,
    is_best_score BOOLEAN,
    has_perfect_cut BOOLEAN
) AS $$
DECLARE
    best_score DECIMAL(4,1);
BEGIN
    -- Get the best score for today
    SELECT MAX(ds.daily_average) INTO best_score
    FROM daily_scores ds
    JOIN competition_participants cp ON ds.user_id = cp.user_id
    WHERE cp.competition_id = p_competition_id
        AND ds.date = p_date
        AND ds.daily_average >= 0;
    
    RETURN QUERY
    SELECT
        ds.user_id,
        ds.daily_average,
        ds.perfect_cuts,
        (ds.daily_average = COALESCE(best_score, -1)) as is_best_score,
        (ds.perfect_cuts > 0) as has_perfect_cut
    FROM daily_scores ds
    JOIN competition_participants cp ON ds.user_id = cp.user_id
    WHERE cp.competition_id = p_competition_id
        AND ds.date = p_date
        AND ds.daily_average >= 0
    ORDER BY ds.daily_average DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to submit score to custom competition
CREATE OR REPLACE FUNCTION submit_to_custom_competition(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score DECIMAL(4,1)
)
RETURNS void AS $$
BEGIN
    -- Update participant score
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        best_day_score,
        average_score,
        joined_at
    )
    VALUES (
        p_competition_id,
        p_user_id,
        p_daily_score,
        1,
        p_daily_score,
        p_daily_score,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's rank in custom competition
CREATE OR REPLACE FUNCTION get_user_rank_in_custom_competition(
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
    total_count INTEGER;
    better_players INTEGER;
BEGIN
    -- Get user's data
    SELECT total_score, days_played, average_score
    INTO user_data
    FROM competition_participants
    WHERE competition_id = p_competition_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Count total participants with scores > 0
    SELECT COUNT(*) INTO total_count
    FROM competition_participants
    WHERE competition_id = p_competition_id AND total_score > 0;
    
    -- Count participants with better scores
    SELECT COUNT(*) INTO better_players
    FROM competition_participants
    WHERE competition_id = p_competition_id 
        AND total_score > user_data.total_score;
    
    RETURN QUERY SELECT
        (better_players + 1)::INTEGER,
        total_count::INTEGER,
        user_data.total_score,
        user_data.days_played,
        user_data.average_score;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and get competition by invite code
CREATE OR REPLACE FUNCTION get_competition_by_invite_code(
    p_invite_code TEXT
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    description TEXT,
    start_date DATE,
    end_date DATE,
    creator_timezone TEXT,
    is_active BOOLEAN,
    is_public BOOLEAN,
    creator_username TEXT,
    participant_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.creator_timezone,
        c.is_active,
        c.is_public,
        COALESCE(u.display_name, u.username) as creator_username,
        (SELECT COUNT(*)::INTEGER FROM competition_participants cp 
         WHERE cp.competition_id = c.id AND cp.total_score > 0) as participant_count
    FROM competitions c
    LEFT JOIN users u ON c.creator_id = u.id
    WHERE c.invite_code = p_invite_code
        AND c.is_active = true
        AND c.is_global = false;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is already in competition
CREATE OR REPLACE FUNCTION is_user_in_competition(
    p_competition_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    participant_exists BOOLEAN DEFAULT FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM competition_participants 
        WHERE competition_id = p_competition_id AND user_id = p_user_id
    ) INTO participant_exists;
    
    RETURN participant_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to join competition
CREATE OR REPLACE FUNCTION join_competition(
    p_competition_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is already in competition
    IF is_user_in_competition(p_competition_id, p_user_id) THEN
        RETURN FALSE; -- Already joined
    END IF;
    
    -- Check if competition is active and exists
    IF NOT EXISTS(
        SELECT 1 FROM competitions 
        WHERE id = p_competition_id 
            AND is_active = true 
            AND is_global = false
    ) THEN
        RETURN FALSE; -- Competition not found or inactive
    END IF;
    
    -- Join the competition
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        joined_at
    )
    VALUES (
        p_competition_id,
        p_user_id,
        0,
        0,
        CURRENT_TIMESTAMP
    );
    
    RETURN TRUE; -- Successfully joined
END;
$$ LANGUAGE plpgsql;

-- Function to get competition statistics
CREATE OR REPLACE FUNCTION get_custom_competition_stats(p_competition_id UUID)
RETURNS TABLE(
    total_participants INTEGER,
    active_participants INTEGER,
    total_games_played INTEGER,
    average_score DECIMAL(4,1),
    highest_score DECIMAL(4,1),
    days_remaining INTEGER,
    competition_status TEXT
) AS $$
DECLARE
    comp_end_date DATE;
    comp_is_active BOOLEAN;
    comp_start_date DATE;
BEGIN
    -- Get competition dates and status
    SELECT end_date, is_active, start_date 
    INTO comp_end_date, comp_is_active, comp_start_date
    FROM competitions
    WHERE id = p_competition_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_participants,
        COUNT(CASE WHEN cp.total_score > 0 THEN 1 END)::INTEGER as active_participants,
        SUM(cp.days_played)::INTEGER as total_games_played,
        ROUND(AVG(NULLIF(cp.average_score, 0)), 1) as average_score,
        MAX(cp.total_score) as highest_score,
        GREATEST(0, (comp_end_date - CURRENT_DATE))::INTEGER as days_remaining,
        CASE 
            WHEN NOT comp_is_active THEN 'Ended'
            WHEN CURRENT_DATE < comp_start_date THEN 'Upcoming'
            WHEN CURRENT_DATE > comp_end_date THEN 'Completed'
            ELSE 'Active'
        END as competition_status
    FROM competition_participants cp
    WHERE cp.competition_id = p_competition_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-deactivate expired competitions
CREATE OR REPLACE FUNCTION deactivate_expired_custom_competitions()
RETURNS INTEGER AS $$
DECLARE
    deactivated_count INTEGER;
BEGIN
    -- Deactivate competitions that have passed their end date
    UPDATE competitions 
    SET is_active = false
    WHERE is_global = false
        AND is_active = true
        AND end_date < CURRENT_DATE;
    
    GET DIAGNOSTICS deactivated_count = ROW_COUNT;
    
    RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old competition data
CREATE OR REPLACE FUNCTION cleanup_old_custom_competitions()
RETURNS void AS $$
BEGIN
    -- Mark competitions older than 2 years as inactive (but keep data)
    UPDATE competitions 
    SET is_active = false
    WHERE is_global = false
        AND end_date < (CURRENT_DATE - INTERVAL '2 years')
        AND is_active = true;
        
    -- Note: We don't actually delete data to preserve user history
    -- This could be extended to archive data to a separate table if needed
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active competitions
CREATE OR REPLACE FUNCTION get_user_active_competitions(p_user_id UUID)
RETURNS TABLE(
    competition_id UUID,
    name TEXT,
    description TEXT,
    start_date DATE,
    end_date DATE,
    creator_timezone TEXT,
    is_creator BOOLEAN,
    participant_count INTEGER,
    user_rank INTEGER,
    user_score DECIMAL(4,1)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.description,
        c.start_date,
        c.end_date,
        c.creator_timezone,
        (c.creator_id = p_user_id) as is_creator,
        (SELECT COUNT(*)::INTEGER FROM competition_participants cp2 
         WHERE cp2.competition_id = c.id AND cp2.total_score > 0) as participant_count,
        (SELECT COUNT(*)::INTEGER + 1 FROM competition_participants cp3 
         WHERE cp3.competition_id = c.id AND cp3.total_score > cp.total_score) as user_rank,
        cp.total_score as user_score
    FROM competitions c
    JOIN competition_participants cp ON c.id = cp.competition_id
    WHERE cp.user_id = p_user_id
        AND c.is_global = false
        AND c.is_active = true
    ORDER BY c.start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to regenerate invite code for competition
CREATE OR REPLACE FUNCTION regenerate_invite_code(
    p_competition_id UUID,
    p_creator_id UUID
)
RETURNS TEXT AS $$
DECLARE
    new_invite_code TEXT;
BEGIN
    -- Verify the user is the creator of the competition
    IF NOT EXISTS(
        SELECT 1 FROM competitions 
        WHERE id = p_competition_id 
            AND creator_id = p_creator_id
            AND is_global = false
    ) THEN
        RETURN NULL; -- User is not the creator
    END IF;
    
    -- Generate new invite code
    new_invite_code := LOWER(SUBSTR(MD5(RANDOM()::TEXT || EXTRACT(EPOCH FROM NOW())::TEXT), 1, 15));
    
    -- Update the competition
    UPDATE competitions 
    SET invite_code = new_invite_code
    WHERE id = p_competition_id;
    
    RETURN new_invite_code;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_competition_participants_custom_lookup
ON competition_participants(competition_id, total_score DESC, days_played DESC)
WHERE total_score > 0;

CREATE INDEX IF NOT EXISTS idx_competitions_invite_code
ON competitions(invite_code) 
WHERE is_global = false AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_competitions_creator_active
ON competitions(creator_id, is_active, end_date DESC)
WHERE is_global = false;

CREATE INDEX IF NOT EXISTS idx_daily_scores_date_user
ON daily_scores(date, user_id, daily_average DESC);

-- Create trigger to automatically deactivate expired competitions
CREATE OR REPLACE FUNCTION trigger_deactivate_expired_competitions()
RETURNS TRIGGER AS $$
BEGIN
    -- This would be called by a scheduled job, not a trigger
    -- But we define it here for completeness
    PERFORM deactivate_expired_custom_competitions();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;