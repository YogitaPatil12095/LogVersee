# LogVerse - Excel-Style Life Logger

Track your daily activities in an Excel-like grid interface with month-wise organization.

## 🎯 Features

- 📅 Month-wise tabs (January - December)
- 📊 Excel-style grid (24 hours × dates)
- 🎨 Custom activities with colors
- 📝 Add notes to each hour
- 🌓 Light/Dark theme toggle
- 🔐 Multi-user authentication
- 💾 Data persistence (localStorage or Supabase)
- 📱 Mobile responsive

## 🚀 Quick Start

### Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Run Development Server

\`\`\`bash
npm start
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

\`\`\`bash
npm run build
\`\`\`

## 🎨 Color Scheme

- **Near Black**: `#0a0908` - Dark mode background
- **Deep Burgundy**: `#49111c` - Dark mode surfaces
- **Light Gray**: `#f2f4f3` - Light mode background
- **Tan**: `#a9927d` - Borders & accents
- **Dark Brown**: `#5e503f` - Primary actions

## 🗄️ Database Setup (Optional)

### Using localStorage (Default)

Works out of the box! Your data is saved in the browser.

### Using Supabase (Production)

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema (see `docs/supabase-schema.sql`)
3. Copy `.env.example` to `.env`
4. Add your Supabase credentials
5. Restart the app

## 📦 Deployment

### Deploy to Netlify

1. Push code to GitHub
2. Connect repository to Netlify
3. Build command: `npm run build`
4. Publish directory: `build`
5. Add environment variables (if using Supabase)

### Deploy to Vercel

\`\`\`bash
npm install -g vercel
vercel
\`\`\`

## 🛠️ Tech Stack

- **React** - UI framework
- **Lucide React** - Icons
- **Supabase** - Backend (optional)
- **localStorage** - Demo mode storage

## 📝 Usage

1. **Login**: Use demo credentials or sign up
2. **Select Month**: Click month tabs to switch
3. **Click Cell**: Click any cell to edit
4. **Add Activity**: Assign activity + optional note
5. **Manage Activities**: Click gear icon to create/edit
6. **Toggle Theme**: Switch between light/dark mode

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 👨‍💻 Author

Built with ❤️ for better life tracking

---

**Need help?** Check the documentation or open an issue!
\`\`\`

---

## FILE 12: `docs/supabase-schema.sql`

**Location:** Create `docs/` folder, then `docs/supabase-schema.sql`
```sql
-- ============================================================================
-- LogVerse Supabase Database Schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grid cells table
CREATE TABLE grid_cells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  date_key TEXT NOT NULL,
  hour TEXT NOT NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_key, date_key, hour)
);

-- User preferences table
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES - Activities
-- ============================================================================

CREATE POLICY "Users can view their own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
  ON activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
  ON activities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- POLICIES - Grid Cells
-- ============================================================================

CREATE POLICY "Users can view their own grid cells"
  ON grid_cells FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grid cells"
  ON grid_cells FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grid cells"
  ON grid_cells FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grid cells"
  ON grid_cells FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- POLICIES - User Preferences
-- ============================================================================

CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- INDEXES (for better performance)
-- ============================================================================

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_grid_cells_user_id ON grid_cells(user_id);
CREATE INDEX idx_grid_cells_month ON grid_cells(user_id, month_key);
CREATE INDEX idx_grid_cells_date ON grid_cells(user_id, date_key);

-- ============================================================================
-- FUNCTIONS (optional - for future use)
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grid_cells_updated_at
  BEFORE UPDATE ON grid_cells
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE!
-- ============================================================================
-- Run this entire file in Supabase SQL Editor
-- Then add your credentials to .env file in your React app
```

---

## 📝 Setup Instructions

### Method 1: Manual Copy (5 minutes)

1. **Create React App:**
```bash
   npx create-react-app logverse
   cd logverse
```

2. **Install Dependencies:**
```bash
   npm install lucide-react @supabase/supabase-js
```

3. **Copy Files:**
   - Copy each file above into its location
   - For `src/App.js`, use the code from the artifact
   - Create `docs/` folder for SQL file

4. **Run:**
```bash
   npm start
```

### Method 2: Automated Script

Save this as `setup.sh` and run `bash setup.sh`:
```bash
#!/bin/bash

# Create project
npx create-react-app logverse
cd logverse

# Install dependencies
npm install lucide-react @supabase/supabase-js

# Create docs folder
mkdir docs

echo "✅ Project created!"
echo "📝 Now copy the files from the guide into their locations"
echo "🚀 Then run: npm start"
```

---

## 🎯 What You Get

After copying all files: