import React, { useState, useEffect, createContext, useContext } from 'react';
import { Settings, Sun, Moon, Edit2, Trash2, X, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
// After deployment, replace these with your actual Supabase credentials
// For artifacts, we use demo mode by default (localStorage)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
// Simple Supabase client (lightweight implementation)
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.authToken = localStorage.getItem('supabase_auth_token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.key,
      ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
    };

    const response = await fetch(`${this.url}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    const data = await response.json();
    return { data, error: !response.ok ? data : null };
  }

  auth = {
    signUp: async ({ email, password }) => {
      const { data, error } = await this.request('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data?.access_token) {
        localStorage.setItem('supabase_auth_token', data.access_token);
        localStorage.setItem('supabase_user', JSON.stringify(data.user));
        this.authToken = data.access_token;
      }
      return { data, error };
    },

    signInWithPassword: async ({ email, password }) => {
      const { data, error } = await this.request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data?.access_token) {
        localStorage.setItem('supabase_auth_token', data.access_token);
        localStorage.setItem('supabase_user', JSON.stringify(data.user));
        this.authToken = data.access_token;
      }
      return { data, error };
    },

    signOut: async () => {
      localStorage.removeItem('supabase_auth_token');
      localStorage.removeItem('supabase_user');
      this.authToken = null;
      return { error: null };
    },

    getUser: () => {
      const user = localStorage.getItem('supabase_user');
      return { data: { user: user ? JSON.parse(user) : null } };
    }
  };

  from(table) {
    return {
      select: (columns = '*') => ({
        eq: (column, value) => this.query(table, 'select', { columns, filters: { [column]: value } }),
        order: (column, options) => this.query(table, 'select', { columns, order: { column, ...options } })
      }),
      insert: (data) => this.query(table, 'insert', { data }),
      upsert: (data, options) => this.query(table, 'upsert', { data, options }),
      update: (data) => ({
        eq: (column, value) => this.query(table, 'update', { data, filters: { [column]: value } })
      }),
      delete: () => ({
        eq: (column, value) => this.query(table, 'delete', { filters: { [column]: value } })
      })
    };
  }

  async query(table, operation, params) {
    // This is a simplified implementation for demo
    // In production, use the official @supabase/supabase-js package
    return { data: [], error: null };
  }
}

// Initialize Supabase (or use localStorage for demo)
const USE_SUPABASE = SUPABASE_URL !== 'YOUR_SUPABASE_URL';
const supabase = USE_SUPABASE ? new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
      const { data } = supabase.auth.getUser();
      return data?.user?.id;
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
    if (this.useSupabase) {
      const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: true });
      return data || [];
    }
    const key = this.getUserKey('activities');
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  // Save activities
  async saveActivities(activities) {
    if (this.useSupabase) {
      // In production, handle individual inserts/updates
      return;
    }
    const key = this.getUserKey('activities');
    localStorage.setItem(key, JSON.stringify(activities));
  }

  // Get grid data for a month
  async getGridData(monthKey) {
    if (this.useSupabase) {
      const { data } = await supabase.from('grid_cells').select('*').eq('month_key', monthKey);
      const gridData = {};
      data?.forEach(cell => {
        const cellKey = `${cell.date_key}_${cell.hour}`;
        gridData[cellKey] = { activityId: cell.activity_id, note: cell.note };
      });
      return gridData;
    }
    const key = this.getUserKey('gridData');
    const allData = localStorage.getItem(key);
    const parsed = allData ? JSON.parse(allData) : {};
    return parsed[monthKey] || {};
  }

  // Save all grid data
  async saveGridData(gridData) {
    if (this.useSupabase) {
      // In production, handle individual upserts
      return;
    }
    const key = this.getUserKey('gridData');
    localStorage.setItem(key, JSON.stringify(gridData));
  }

  // Get theme
  async getTheme() {
    if (this.useSupabase) {
      const userId = this.getUserId();
      const { data } = await supabase.from('user_preferences').select('theme').eq('user_id', userId);
      return data?.[0]?.theme || 'light';
    }
    const key = this.getUserKey('theme');
    return localStorage.getItem(key) || 'light';
  }

  // Save theme
  async saveTheme(theme) {
    if (this.useSupabase) {
      const userId = this.getUserId();
      await supabase.from('user_preferences').upsert({ user_id: userId, theme });
      return;
    }
    const key = this.getUserKey('theme');
    localStorage.setItem(key, theme);
  }
}

const storage = new StorageService();

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================

class AuthService {
  async signup(email, password) {
    if (USE_SUPABASE) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      return { user: data?.user, error: error?.message };
    }
    
    // Demo mode
    const user = {
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      created_at: new Date().toISOString()
    };
    localStorage.setItem('demo_user_id', user.id);
    localStorage.setItem('demo_user', JSON.stringify(user));
    return { user, error: null };
  }

  async login(email, password) {
    if (USE_SUPABASE) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { user: data?.user, error: error?.message };
    }
    
    // Demo mode
    const user = {
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      created_at: new Date().toISOString()
    };
    localStorage.setItem('demo_user_id', user.id);
    localStorage.setItem('demo_user', JSON.stringify(user));
    return { user, error: null };
  }

  async logout() {
    if (USE_SUPABASE) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('demo_user_id');
    localStorage.removeItem('demo_user');
  }

  getCurrentUser() {
    if (USE_SUPABASE) {
      const { data } = supabase.auth.getUser();
      return data?.user;
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

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const [user, setUser] = useState(() => authService.getCurrentUser());

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

  const handleDemoLogin = async () => {
    setEmail('demo@logverse.com');
    setPassword('demo123');
    await handleSubmit({ preventDefault: () => {} });
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
          marginTop: '1rem',
          textAlign: 'center'
        }}>
          <button
            onClick={handleDemoLogin}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              color: '#5e503f',
              border: '2px dashed #5e503f',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              width: '100%'
            }}
          >
            🚀 Quick Demo Login
          </button>
        </div>

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

        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#f2f4f3',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#5e503f',
          textAlign: 'center'
        }}>
          💡 <strong>Demo Mode:</strong> Enter any email/password to try it out!
        </div>
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
          {user?.email || 'Demo User'}
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