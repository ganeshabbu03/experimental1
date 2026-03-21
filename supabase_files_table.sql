-- Create the files table
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own files."
    ON files FOR SELECT
    USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert their own files."
    ON files FOR INSERT
    WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own files."
    ON files FOR UPDATE
    USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own files."
    ON files FOR DELETE
    USING ( auth.uid() = user_id );
