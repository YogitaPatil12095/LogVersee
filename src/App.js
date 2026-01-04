import React, { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Settings, Sun, Moon, Edit2, Trash2, X, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
// After deployment, replace these with your actual Supabase credentials
// For artifacts, we use demo mode by default (localStorage)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
// Use the official Supabase JS client when configured

// Initialize Supabase (or use localStorage for demo)
// Only enable Supabase when both URL and anon key are provided (not undefined/placeholders)
const USE_SUPABASE = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ============================================================================
// STORAGE ABSTRACTION (Works with both localStorage and Supabase)
// ============================================================================

class StorageService {
  constructor() {
    this.useSupabase = USE_SUPABASE;
  }

  // Get current user ID
  getUserId() {
    if (this.useSupabase) {
      try {
        const token = localStorage.getItem('supabase.auth.token');
        if (!token) return null;
        const parsed = JSON.parse(token);
        return parsed?.currentSession?.user?.id || null;
      } catch (e) {
        return null;
      }
    }
    return localStorage.getItem('demo_user_id');
  }

  // Local storage helpers (for demo mode)
  getUserKey(key) {
    const userId = this.getUserId();
    if (!userId) return null;
    return `user_${userId}_${key}`;
  }

  // Get activities
  async getActivities() {
    // Try Supabase first when enabled. If Supabase is not set up or returns no result,
    // fall back to per-user localStorage so state persists across sign-out/sign-in.
    const key = this.getUserKey('activities');
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (e) {
        // ignore and fallback to localStorage
      }
    }
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  // Save activities
  async saveActivities(activities) {
    // Persist to both Supabase (if you want server-side sync) and localStorage as a
    // reliable client-side fallback so user data is not lost on logout.
    const key = this.getUserKey('activities');
    try {
      if (this.useSupabase) {
        // Fetch authenticated session/user first. If there's no signed-in user, skip
        // the Supabase upsert to avoid sending `user_id: null`.
        try {
          // DEBUG: surface session info before upsert
          if (typeof window !== 'undefined') {
            const sess = await supabase.auth.getSession();
            console.debug('saveActivities - session', sess);
          }
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id || null;
          if (userId) {
            const { data: upsertRes, error: upsertErr } = await supabase.from('user_activities').upsert({ user_id: userId, activities });
            if (typeof window !== 'undefined') console.debug('user_activities upsert', { upsertRes, upsertErr });
          }
        } catch (e) {
          // ignore and fallback to localStorage
        }
      }
    } catch (e) {
      // ignore
    }
    if (key) localStorage.setItem(key, JSON.stringify(activities));
  }

  // Get grid data for a month
  async getGridData(monthKey) {
    const key = this.getUserKey('gridData');
    if (this.useSupabase) {
      try {
        const { data, error } = await supabase.from('grid_cells').select('*').eq('month_key', monthKey);
        if (!error && data) {
          const gridData = {};
          data.forEach(cell => {
            const cellKey = `${cell.date_key}_${cell.hour}`;
            gridData[cellKey] = { activityId: cell.activity_id, note: cell.note };
          });
          return gridData;
        }
      } catch (e) {
        // fallback to localStorage
      }
    }
    const allData = localStorage.getItem(key);
    const parsed = allData ? JSON.parse(allData) : {};
    return parsed[monthKey] || {};
  }

  // Save all grid data
  async saveGridData(gridData) {
    const key = this.getUserKey('gridData');
    try {
      if (this.useSupabase) {
        // Try to upsert full grid JSON into a user-scoped table `user_grid_data`.
        try {
          if (typeof window !== 'undefined') {
            const sess = await supabase.auth.getSession();
            console.debug('saveGridData - session', sess);
          }
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id || null;
          if (userId) {
            const { data: upsertRes, error: upsertErr } = await supabase.from('user_grid_data').upsert({ user_id: userId, grid_data: gridData });
            if (typeof window !== 'undefined') console.debug('user_grid_data upsert', { upsertRes, upsertErr });
          }
        } catch (e) {
          // ignore and fallback to localStorage
        }
      }
    } catch (e) {
      // ignore
    }
    if (key) localStorage.setItem(key, JSON.stringify(gridData));
  }

  // Get theme
  async getTheme() {
    const key = this.getUserKey('theme');
    if (this.useSupabase) {
      try {
        // Ensure we have an authenticated user before querying by user_id.
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || null;
        if (userId) {
          const { data, error } = await supabase.from('user_preferences').select('theme').eq('user_id', userId);
          if (!error && data && data.length > 0) return data[0].theme;
        }
      } catch (e) {
        // fallback
      }
    }
    return localStorage.getItem(key) || 'light';
  }

  // Save theme
  async saveTheme(theme) {
    const key = this.getUserKey('theme');
    try {
      if (this.useSupabase) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || null;
        if (userId) {
          await supabase.from('user_preferences').upsert({ user_id: userId, theme });
        }
      }
    } catch (e) {
      // ignore
    }
    if (key) localStorage.setItem(key, theme);
  }
}

const storage = new StorageService();

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================

class AuthService {
  async signup(email, password) {
    if (!USE_SUPABASE) {
      return { user: null, error: 'Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.' };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    // DEBUG: log signup result (temporary)
    if (typeof window !== 'undefined') console.debug('supabase.signUp ->', { data, error });
    return { user: data?.user, error: error?.message };
  }

  async login(email, password) {
    if (!USE_SUPABASE) {
      return { user: null, error: 'Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // DEBUG: log login result (temporary)
    if (typeof window !== 'undefined') console.debug('supabase.signInWithPassword ->', { data, error });
    return { user: data?.user, error: error?.message };
  }

  async logout() {
    if (USE_SUPABASE) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('demo_user_id');
    localStorage.removeItem('demo_user');
  }

  async getCurrentUser() {
    if (USE_SUPABASE) {
      try {
        const { data } = await supabase.auth.getUser();
        return data?.user || null;
      } catch (e) {
        return null;
      }
    }
    const user = localStorage.getItem('demo_user');
    return user ? JSON.parse(user) : null;
  }
}

const authService = new AuthService();

// ============================================================================
// CONTEXTS
// ============================================================================

const AuthContext = createContext();
const ThemeContext = createContext();
const DataContext = createContext();

const useAuth = () => useContext(AuthContext);
const useTheme = () => useContext(ThemeContext);
const useData = () => useContext(DataContext);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const generateMonthDates = (year, month) => {
  const days = getDaysInMonth(year, month);
  const dates = [];
  
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    dates.push(date);
  }
  
  return dates;
};

const formatDate = (date) => {
  const day = date.getDate().toString().padStart(2, '0');
  const monthName = monthsShort[date.getMonth()];
  return `${day} ${monthName}`;
};

const hours = Array.from({ length: 24 }, (_, i) => {
  const period = i < 12 ? 'am' : 'pm';
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return `${hour}${period}`;
});

const defaultActivities = [
  { id: '1', name: 'Sleep', color: '#9b59b6' },
  { id: '2', name: 'Work', color: '#3498db' },
  { id: '3', name: 'Exercise', color: '#e74c3c' },
  { id: '4', name: 'Social', color: '#f39c12' },
  { id: '5', name: 'Learning', color: '#2ecc71' }
];

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function LogVerse() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    authService.getCurrentUser().then(u => {
      if (mounted) setUser(u);
    });

    let subscription = null;
    if (USE_SUPABASE && supabase?.auth?.onAuthStateChange) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        // Update user state on sign in / sign out / token refresh
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setUser(session?.user ?? null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });
      subscription = data?.subscription || null;
    }

    return () => {
      mounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <AuthProvider user={user} setUser={setUser}>
      <ThemeProvider>
        <DataProvider>
          <MainApp />
        </DataProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

// ============================================================================
// AUTHENTICATION UI
// ============================================================================

function AuthScreen({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = isSignup 
        ? await authService.signup(email, password)
        : await authService.login(email, password);

      if (result.error) {
        setError(result.error);
      } else {
        onLogin(result.user);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #5e503f 0%, #a9927d 100%)',
      padding: '1rem'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '2rem',
          fontWeight: '700',
          color: '#0a0908',
          textAlign: 'center'
        }}>
          LogVerse
        </h1>
        <p style={{
          margin: '0 0 2rem 0',
          fontSize: '0.875rem',
          color: '#5e503f',
          textAlign: 'center'
        }}>
          Track your life, Excel-style
        </p>

        {error && (
          <div style={{
            padding: '0.75rem',
            background: '#fee',
            color: '#c33',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#0a0908'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #a9927d',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#0a0908'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #a9927d',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #5e503f 0%, #a9927d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Processing...' : isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>


        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#5e503f'
        }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button
            onClick={() => setIsSignup(!isSignup)}
            style={{
              background: 'none',
              border: 'none',
              color: '#5e503f',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </div>

        {/* Demo mode removed: pure Supabase auth required */}
      </div>
    </div>
  );
}

// ============================================================================
// CONTEXT PROVIDERS
// ============================================================================

function AuthProvider({ children, user, setUser }) {
  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getTheme().then(savedTheme => {
      setTheme(savedTheme);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      storage.saveTheme(theme);
    }
  }, [theme, loading]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const colors = {
    light: {
      bg: '#f2f4f3',
      surface: '#ffffff',
      border: '#a9927d',
      text: '#0a0908',
      primary: '#5e503f',
      hover: '#a9927d',
      secondary: '#a9927d'
    },
    dark: {
      bg: '#0a0908',
      surface: '#49111c',
      border: '#5e503f',
      text: '#f2f4f3',
      primary: '#a9927d',
      hover: '#5e503f',
      secondary: '#5e503f'
    }
  };

  if (loading) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: colors[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

function DataProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const [gridData, setGridData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      storage.getActivities(),
      storage.getGridData('all')
    ]).then(([savedActivities, savedGridData]) => {
      setActivities(savedActivities.length > 0 ? savedActivities : defaultActivities);
      setGridData(savedGridData);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      storage.saveActivities(activities);
    }
  }, [activities, loading]);

  useEffect(() => {
    if (!loading) {
      storage.saveGridData(gridData);
    }
  }, [gridData, loading]);

  const addActivity = (name, color) => {
    const newActivity = { id: Date.now().toString(), name, color };
    setActivities([...activities, newActivity]);
  };

  const updateActivity = (id, name, color) => {
    setActivities(activities.map(a => a.id === id ? { ...a, name, color } : a));
  };

  const deleteActivity = (id) => {
    setActivities(activities.filter(a => a.id !== id));
    const newGridData = { ...gridData };
    Object.keys(newGridData).forEach(monthKey => {
      Object.keys(newGridData[monthKey] || {}).forEach(cellKey => {
        if (newGridData[monthKey][cellKey].activityId === id) {
          delete newGridData[monthKey][cellKey];
        }
      });
    });
    setGridData(newGridData);
  };

  const updateCell = (monthKey, dateKey, hour, activityId, note) => {
    const cellKey = `${dateKey}_${hour}`;
    
    setGridData(prev => {
      const newData = { ...prev };
      if (!newData[monthKey]) newData[monthKey] = {};
      
      if (!activityId) {
        delete newData[monthKey][cellKey];
      } else {
        newData[monthKey][cellKey] = { activityId, note: note || '' };
      }
      
      return newData;
    });
  };

  if (loading) return null;

  return (
    <DataContext.Provider value={{
      activities,
      addActivity,
      updateActivity,
      deleteActivity,
      gridData,
      updateCell
    }}>
      {children}
    </DataContext.Provider>
  );
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

function MainApp() {
  const { colors } = useTheme();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [showToolbox, setShowToolbox] = useState(false);
  const [editingCell, setEditingCell] = useState(null);

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      color: colors.text,
      transition: 'all 0.3s ease'
    }}>
      <Header />
      <MonthTabs
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
      />
      <Grid
        year={selectedYear}
        month={selectedMonth}
        setEditingCell={setEditingCell}
      />
      
      {showToolbox && <ActivityToolbox onClose={() => setShowToolbox(false)} />}
      <FloatingButton onClick={() => setShowToolbox(true)} />
      
      {editingCell && (
        <CellEditor
          cell={editingCell}
          year={selectedYear}
          month={selectedMonth}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function Header() {
  const { theme, toggleTheme, colors } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header style={{
      padding: '1.5rem 2rem',
      background: colors.surface,
      borderBottom: `2px solid ${colors.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700' }}>LogVerse</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.7 }}>
          {user?.email || ''}
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={toggleTheme}
          style={{
            background: colors.primary,
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: theme === 'light' ? '#fff' : colors.text,
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
        
        <button
          onClick={logout}
          style={{
            background: colors.secondary,
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: colors.text,
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </header>
  );
}

// ============================================================================
// MONTH TABS
// ============================================================================

function MonthTabs({ selectedYear, selectedMonth, onYearChange, onMonthChange }) {
  const { colors } = useTheme();

  return (
    <div style={{
      background: colors.surface,
      borderBottom: `2px solid ${colors.border}`,
      padding: '1rem 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      overflowX: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.text,
            padding: '0.25rem'
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: '1rem', fontWeight: '700', minWidth: '60px', textAlign: 'center' }}>
          {selectedYear}
        </span>
        <button
          onClick={() => onYearChange(selectedYear + 1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.text,
            padding: '0.25rem'
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
        {monthsShort.map((month, index) => (
          <button
            key={month}
            onClick={() => onMonthChange(index)}
            style={{
              padding: '0.625rem 1rem',
              background: selectedMonth === index ? colors.primary : 'transparent',
              color: selectedMonth === index ? (colors.primary === '#5e503f' ? '#fff' : colors.text) : colors.text,
              border: selectedMonth === index ? 'none' : `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: selectedMonth === index ? '600' : '500',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {month}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// GRID
// ============================================================================

function Grid({ year, month, setEditingCell }) {
  const { colors } = useTheme();
  const { activities, gridData } = useData();
  const dates = generateMonthDates(year, month);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthData = gridData[monthKey] || {};

  const getCellData = (dateKey, hour) => {
    const cellKey = `${dateKey}_${hour}`;
    return monthData[cellKey];
  };

  return (
    <div style={{ padding: '2rem', overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: '100%' }}>
        {/* Header Row */}
        <div style={{ display: 'flex' }}>
          <div style={{
            width: '100px',
            minWidth: '100px',
            padding: '0.75rem',
            background: colors.surface,
            borderRight: `2px solid ${colors.border}`,
            borderBottom: `2px solid ${colors.border}`,
            fontWeight: '700',
            fontSize: '0.875rem',
            position: 'sticky',
            left: 0,
            zIndex: 10
          }}>
            Date
          </div>
          {hours.map(hour => (
            <div
              key={hour}
              style={{
                width: '60px',
                minWidth: '60px',
                padding: '0.75rem 0.5rem',
                background: colors.surface,
                borderRight: `1px solid ${colors.border}`,
                borderBottom: `2px solid ${colors.border}`,
                fontWeight: '600',
                fontSize: '0.75rem',
                textAlign: 'center'
              }}
            >
              {hour}
            </div>
          ))}
        </div>

        {/* Date Rows */}
        {dates.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          return (
            <div key={dateKey} style={{ display: 'flex' }}>
              <div style={{
                width: '100px',
                minWidth: '100px',
                padding: '0.75rem',
                background: colors.surface,
                borderRight: `2px solid ${colors.border}`,
                borderBottom: `1px solid ${colors.border}`,
                fontWeight: '600',
                fontSize: '0.875rem',
                position: 'sticky',
                left: 0,
                zIndex: 10
              }}>
                {formatDate(date)}
              </div>
              {hours.map(hour => {
                const cellData = getCellData(dateKey, hour);
                const activity = cellData ? activities.find(a => a.id === cellData.activityId) : null;
                
                return (
                  <div
                    key={hour}
                    onClick={() => setEditingCell({ dateKey, hour, data: cellData })}
                    style={{
                      width: '60px',
                      minWidth: '60px',
                      height: '40px',
                      background: activity ? activity.color : colors.bg,
                      borderRight: `1px solid ${colors.border}`,
                      borderBottom: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!activity) e.currentTarget.style.background = colors.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (!activity) e.currentTarget.style.background = colors.bg;
                    }}
                  >
                    {cellData && cellData.note && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '6px',
                        height: '6px',
                        background: '#fff',
                        borderRadius: '50%',
                        opacity: 0.8
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// CELL EDITOR
// ============================================================================

function CellEditor({ cell, year, month, onClose }) {
  const { colors } = useTheme();
  const { activities, updateCell } = useData();
  const [selectedActivity, setSelectedActivity] = useState(cell.data?.activityId || '');
  const [note, setNote] = useState(cell.data?.note || '');
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const handleSave = () => {
    updateCell(monthKey, cell.dateKey, cell.hour, selectedActivity, note);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.surface,
          borderRadius: '12px',
          padding: '1.5rem',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Edit Cell</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.text,
              padding: '0.25rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
            Activity
          </label>
          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              background: colors.bg,
              color: colors.text,
              fontSize: '0.875rem'
            }}
          >
            <option value="">None</option>
            {activities.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
            Note
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened?"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              background: colors.bg,
              color: colors.text,
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: colors.primary,
              color: colors.primary === '#5e503f' ? '#fff' : colors.text,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.875rem'
            }}
          >
            Save
          </button>
          <button
            onClick={() => {
              updateCell(monthKey, cell.dateKey, cell.hour, '', '');
              onClose();
            }}
            style={{
              padding: '0.75rem 1rem',
              background: 'transparent',
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.875rem'
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY TOOLBOX
// ============================================================================

function ActivityToolbox({ onClose }) {
  const { colors } = useTheme();
  const { activities, addActivity, updateActivity, deleteActivity } = useData();
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3498db');

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (editing) {
      updateActivity(editing, name, color);
      setEditing(null);
    } else {
      addActivity(name, color);
    }
    
    setName('');
    setColor('#3498db');
  };

  const handleEdit = (activity) => {
    setEditing(activity.id);
    setName(activity.name);
    setColor(activity.color);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.surface,
          borderRadius: '12px',
          padding: '1.5rem',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Activity Manager</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.text,
              padding: '0.25rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: colors.bg, borderRadius: '8px' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Activity name"
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: '0.875rem'
              }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '60px',
                height: '44px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: colors.primary,
              color: colors.primary === '#5e503f' ? '#fff' : colors.text,
              border: 'none',
              borderRadius: '6px',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '0.875rem',
              opacity: name.trim() ? 1 : 0.5
            }}
          >
            {editing ? 'Update' : 'Add'} Activity
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activities.map(activity => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: colors.bg,
                borderRadius: '8px',
                border: editing === activity.id ? `2px solid ${colors.primary}` : 'none'
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  background: activity.color
                }}
              />
              <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: '500' }}>
                {activity.name}
              </span>
              <button
                onClick={() => handleEdit(activity)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.text,
                  padding: '0.25rem'
                }}
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => deleteActivity(activity.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#e74c3c',
                  padding: '0.25rem'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FLOATING BUTTON
// ============================================================================

function FloatingButton({ onClick }) {
  const { colors } = useTheme();
  
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: colors.primary,
        color: colors.primary === '#5e503f' ? '#fff' : colors.text,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'transform 0.2s',
        zIndex: 100
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <Settings size={24} />
    </button>
  );
}