-- Daily Shapes v4.0 Database Schema for Supabase
-- This schema defines all tables needed for the authentication and competition system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- USERS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT true, -- Default true since we use Hunter.io validation
    total_days_played INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    is_guest BOOLEAN DEFAULT false,
    timezone TEXT DEFAULT 'UTC',
    
    -- Additional user profile fields
    avatar_url TEXT,
    display_name TEXT,
    
    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
    CONSTRAINT username_format CHECK (username ~* '^[A-Za-z0-9_]+$')
);

-- Create indexes for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ================================
-- DAILY SCORES TABLE
-- ================================
CREATE TABLE IF NOT EXISTS daily_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Individual shape attempts
    shape1_attempt1 DECIMAL(4,1),
    shape1_attempt2 DECIMAL(4,1),
    shape2_attempt1 DECIMAL(4,1),
    shape2_attempt2 DECIMAL(4,1),
    shape3_attempt1 DECIMAL(4,1),
    shape3_attempt2 DECIMAL(4,1),
    
    -- Averages
    shape1_average DECIMAL(4,1),
    shape2_average DECIMAL(4,1),
    shape3_average DECIMAL(4,1),
    daily_average DECIMAL(4,1),
    
    -- Metadata
    mechanic_used TEXT NOT NULL,
    time_spent_seconds INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one score per user per day
    CONSTRAINT unique_user_date UNIQUE(user_id, date),
    
    -- Validate score ranges (0.0 to 100.0)
    CONSTRAINT valid_scores CHECK (
        (shape1_attempt1 IS NULL OR (shape1_attempt1 >= 0 AND shape1_attempt1 <= 100)) AND
        (shape1_attempt2 IS NULL OR (shape1_attempt2 >= 0 AND shape1_attempt2 <= 100)) AND
        (shape2_attempt1 IS NULL OR (shape2_attempt1 >= 0 AND shape2_attempt1 <= 100)) AND
        (shape2_attempt2 IS NULL OR (shape2_attempt2 >= 0 AND shape2_attempt2 <= 100)) AND
        (shape3_attempt1 IS NULL OR (shape3_attempt1 >= 0 AND shape3_attempt1 <= 100)) AND
        (shape3_attempt2 IS NULL OR (shape3_attempt2 >= 0 AND shape3_attempt2 <= 100)) AND
        (shape1_average IS NULL OR (shape1_average >= 0 AND shape1_average <= 100)) AND
        (shape2_average IS NULL OR (shape2_average >= 0 AND shape2_average <= 100)) AND
        (shape3_average IS NULL OR (shape3_average >= 0 AND shape3_average <= 100)) AND
        (daily_average IS NULL OR (daily_average >= 0 AND daily_average <= 100))
    )
);

-- Create indexes for score lookups
CREATE INDEX idx_daily_scores_user_id ON daily_scores(user_id);
CREATE INDEX idx_daily_scores_date ON daily_scores(date);
CREATE INDEX idx_daily_scores_user_date ON daily_scores(user_id, date);

-- ================================
-- COMPETITIONS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_timezone TEXT NOT NULL DEFAULT 'UTC',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_global BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    invite_code TEXT UNIQUE,
    max_participants INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Competition settings
    scoring_type TEXT DEFAULT 'average', -- 'average', 'total', 'best'
    min_days_required INTEGER DEFAULT 1,
    
    -- Ensure end date is after start date
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT name_length CHECK (char_length(name) >= 3 AND char_length(name) <= 50)
);

-- Create indexes for competitions
CREATE INDEX idx_competitions_creator_id ON competitions(creator_id);
CREATE INDEX idx_competitions_start_date ON competitions(start_date);
CREATE INDEX idx_competitions_end_date ON competitions(end_date);
CREATE INDEX idx_competitions_invite_code ON competitions(invite_code);
CREATE INDEX idx_competitions_is_active ON competitions(is_active);

-- ================================
-- COMPETITION PARTICIPANTS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS competition_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_score DECIMAL(6,1) DEFAULT 0,
    days_played INTEGER DEFAULT 0,
    average_score DECIMAL(4,1),
    best_day_score DECIMAL(4,1),
    rank INTEGER,
    
    -- Ensure unique participation
    CONSTRAINT unique_competition_user UNIQUE(competition_id, user_id),
    
    -- Validate score ranges
    CONSTRAINT valid_participant_scores CHECK (
        total_score >= 0 AND
        days_played >= 0 AND
        (average_score IS NULL OR (average_score >= 0 AND average_score <= 100)) AND
        (best_day_score IS NULL OR (best_day_score >= 0 AND best_day_score <= 100))
    )
);

-- Create indexes for participants
CREATE INDEX idx_participants_competition_id ON competition_participants(competition_id);
CREATE INDEX idx_participants_user_id ON competition_participants(user_id);
CREATE INDEX idx_participants_total_score ON competition_participants(competition_id, total_score DESC);

-- ================================
-- DAILY SHAPES TABLE
-- ================================
CREATE TABLE IF NOT EXISTS daily_shapes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    day_of_week TEXT NOT NULL,
    mechanic TEXT NOT NULL,
    shape1_path TEXT NOT NULL,
    shape2_path TEXT NOT NULL,
    shape3_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional metadata
    difficulty_level TEXT DEFAULT 'medium', -- 'easy', 'medium', 'hard'
    theme TEXT,
    
    -- Validate day of week
    CONSTRAINT valid_day_of_week CHECK (
        day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    ),
    
    -- Validate mechanic type
    CONSTRAINT valid_mechanic CHECK (
        mechanic IN (
            'DefaultWithUndo', 'HorizontalOnly', 'DiagonalAscending', 
            'CircleCut', 'RotatingSquare', 'ThreePointTriangle', 'RotatingShapeVector'
        )
    )
);

-- Create index for date lookups
CREATE INDEX idx_daily_shapes_date ON daily_shapes(date);

-- ================================
-- USER SESSIONS TABLE (for auth tokens)
-- ================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for sessions
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- ================================
-- SOCIAL LOGINS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS social_logins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'google', 'facebook', 'apple'
    provider_user_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique provider account per user
    CONSTRAINT unique_provider_account UNIQUE(provider, provider_user_id),
    CONSTRAINT valid_provider CHECK (provider IN ('google', 'facebook', 'apple'))
);

-- Create indexes for social logins
CREATE INDEX idx_social_logins_user_id ON social_logins(user_id);
CREATE INDEX idx_social_logins_provider ON social_logins(provider, provider_user_id);

-- ================================
-- GUEST MIGRATION TABLE
-- ================================
CREATE TABLE IF NOT EXISTS guest_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guest_data JSONB NOT NULL, -- Store guest stats and scores
    migrated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    migration_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    
    CONSTRAINT valid_status CHECK (migration_status IN ('pending', 'completed', 'failed'))
);

-- ================================
-- STORED FUNCTIONS
-- ================================

-- Function to update user streaks
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
    v_last_played DATE;
    v_current_streak INTEGER;
    v_best_streak INTEGER;
BEGIN
    -- Get user's last played date and current streak
    SELECT date INTO v_last_played
    FROM daily_scores
    WHERE user_id = p_user_id AND date < p_date
    ORDER BY date DESC
    LIMIT 1;
    
    SELECT current_streak, best_streak INTO v_current_streak, v_best_streak
    FROM users
    WHERE id = p_user_id;
    
    -- Update streak based on consecutive days
    IF v_last_played IS NULL OR v_last_played = p_date - INTERVAL '1 day' THEN
        -- Continue or start streak
        v_current_streak := COALESCE(v_current_streak, 0) + 1;
    ELSIF v_last_played < p_date - INTERVAL '1 day' THEN
        -- Streak broken, restart
        v_current_streak := 1;
    END IF;
    
    -- Update best streak if necessary
    v_best_streak := GREATEST(COALESCE(v_best_streak, 0), v_current_streak);
    
    -- Update user record
    UPDATE users
    SET current_streak = v_current_streak,
        best_streak = v_best_streak,
        total_days_played = total_days_played + 1,
        last_login = CURRENT_TIMESTAMP
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate competition rankings
CREATE OR REPLACE FUNCTION update_competition_rankings(p_competition_id UUID)
RETURNS void AS $$
BEGIN
    WITH ranked_participants AS (
        SELECT 
            id,
            RANK() OVER (ORDER BY total_score DESC, days_played DESC) as new_rank
        FROM competition_participants
        WHERE competition_id = p_competition_id
    )
    UPDATE competition_participants cp
    SET rank = rp.new_rank
    FROM ranked_participants rp
    WHERE cp.id = rp.id;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- ROW LEVEL SECURITY POLICIES
-- ================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_logins ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_read_own ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (auth.uid() = id);

-- Daily scores - users can manage their own scores
CREATE POLICY daily_scores_manage_own ON daily_scores
    FOR ALL USING (auth.uid() = user_id);

-- Competitions - public read, authenticated create
CREATE POLICY competitions_read ON competitions
    FOR SELECT USING (is_public = true OR creator_id = auth.uid());

CREATE POLICY competitions_create ON competitions
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Competition participants - manage own participation
CREATE POLICY participants_manage_own ON competition_participants
    FOR ALL USING (auth.uid() = user_id);

-- ================================
-- TRIGGERS
-- ================================

-- Trigger to calculate NEW ADDITIVE scoring (sum of smaller percentages + bonuses)
-- NOTE: Field names still say "average" for backward compatibility, but they now store additive totals
CREATE OR REPLACE FUNCTION calculate_score_averages()
RETURNS TRIGGER AS $$
BEGIN
    NEW.shape1_average := COALESCE(NEW.shape1_attempt1, 0) + COALESCE(NEW.shape1_attempt2, 0) +
                          CASE WHEN NEW.shape1_attempt1 = 50 THEN 50 ELSE 0 END +
                          CASE WHEN NEW.shape1_attempt2 = 50 THEN 50 ELSE 0 END;

    NEW.shape2_average := COALESCE(NEW.shape2_attempt1, 0) + COALESCE(NEW.shape2_attempt2, 0) +
                          CASE WHEN NEW.shape2_attempt1 = 50 THEN 50 ELSE 0 END +
                          CASE WHEN NEW.shape2_attempt2 = 50 THEN 50 ELSE 0 END;

    NEW.shape3_average := COALESCE(NEW.shape3_attempt1, 0) + COALESCE(NEW.shape3_attempt2, 0) +
                          CASE WHEN NEW.shape3_attempt1 = 50 THEN 50 ELSE 0 END +
                          CASE WHEN NEW.shape3_attempt2 = 50 THEN 50 ELSE 0 END;

    NEW.daily_average := COALESCE(NEW.shape1_average, 0) +
                         COALESCE(NEW.shape2_average, 0) +
                         COALESCE(NEW.shape3_average, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_averages_trigger
    BEFORE INSERT OR UPDATE ON daily_scores
    FOR EACH ROW
    EXECUTE FUNCTION calculate_score_averages();

-- Trigger to update user streak when score is saved
CREATE TRIGGER update_streak_trigger
    AFTER INSERT ON daily_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_user_streak(NEW.user_id, NEW.date);