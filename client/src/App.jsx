// src/App.jsx
import { useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import JournalEntryPage from './pages/journal-entry';
import JournalListPage from './pages/journal';
import AccountsPage from './pages/accounts';
import CalendarPage from './pages/calendar';

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('forex');
  const [marketNews, setMarketNews] = useState([]);
  const [economicEvents, setEconomicEvents] = useState([
    { date: 'Today', time: '8:30am', event: 'USD CPI m/m', impact: 'High Impact', color: '#FF0000' },
    { date: 'Today', time: '10:00am', event: 'CB Consumer Confidence', impact: 'High Impact', color: '#FF0000' },
    { date: 'Tonight', time: '7:00pm', event: 'FOMC Member Speech', impact: 'Medium Impact', color: '#FFA500' },
    { date: 'Tomorrow', time: '2:00pm', event: 'Fed Interest Rate Decision', impact: 'High Impact', color: '#FF0000' }
  ]);
  const [dashboardTrades, setDashboardTrades] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [selectedDayTrades, setSelectedDayTrades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then((response) => {
      setSession(response.session);
    });
    const { subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch real trades for dashboard calendar
  useEffect(() => {
    if (!session) return;
    const fetchDashboardTrades = async () => {
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      const { data, error } = await supabase
        .from('trades')
        .select('id, date, profit_loss, symbol, direction, entry_price, exit_price, notes, trading_accounts(account_name, broker)')
        .eq('user_id', session.user.id)
        .eq('trade_environment', 'live')
        .gte('date', currentMonthStart.toISOString().split('T')[0])
        .lte('date', currentMonthEnd.toISOString().split('T')[0]);
      if (!error) {
        setDashboardTrades(data || []);
      }
      setDashboardLoading(false);
    };
    fetchDashboardTrades();
  }, [session]);

  // Fetch general news articles
  useEffect(() => {
    const fetchMarketNews = async () => {
      const apiKey = 'ee7d84a016c84302b46649b31962b1d2';
      let q = '';
      if (activeCategory === 'forex') {
        q = 'forex OR currency OR gold OR oil';
      } else if (activeCategory === 'indices') {
        q = 'S&P 500 OR NASDAQ OR DAX OR FTSE';
      } else if (activeCategory === 'crypto') {
        q = 'bitcoin OR ethereum OR cryptocurrency';
      }
      try {
        const response = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=3&language=en&apiKey=${apiKey}`
        );
        const data = await response.json();
        setMarketNews(data.articles || []);
      } catch (error) {
        console.error('Failed to fetch news:', error);
        const placeholderNews = [
          { title: 'Market data unavailable', source: { name: 'Offline' } },
          { title: 'Check your internet connection', source: { name: 'Error' } },
          { title: 'API limit may be reached', source: { name: 'NewsAPI' } }
        ];
        setMarketNews(placeholderNews);
      }
    };
    fetchMarketNews();
  }, [activeCategory]);

  // Fetch economic events
  useEffect(() => {
    const fetchEconomicEvents = async () => {
      const finnhubToken = 'd3q9ndhr01qgab53pmtgd3q9ndhr01qgab53pmu0';
      const today = new Date();
      const next7Days = new Date();
      next7Days.setDate(today.getDate() + 7);
      const todayStr = today.toISOString().split('T')[0];
      const next7Str = next7Days.toISOString().split('T')[0];
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/calendar/economic?from=${todayStr}&to=${next7Str}&token=${finnhubToken}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const events = data.economicCalendar || [];
        const filteredEvents = events
          .filter(event => event.impact === 'High' || event.impact === 'Medium')
          .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
          .slice(0, 4);
        const formatted = filteredEvents.map(event => {
          const eventDate = new Date(event.datetime);
          const now = new Date();
          const isToday = eventDate.toDateString() === now.toDateString();
          const isTomorrow = eventDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
          let displayDate = 'Later';
          if (isToday) displayDate = 'Today';
          else if (isTomorrow) displayDate = 'Tomorrow';
          const hours = eventDate.getHours().toString().padStart(2, '0');
          const minutes = eventDate.getMinutes().toString().padStart(2, '0');
          const timeStr = `${hours}:${minutes}`;
          const countryMap = {
            'US': 'USD', 'EU': 'EUR', 'UK': 'GBP', 'JP': 'JPY',
            'CA': 'CAD', 'AU': 'AUD', 'NZ': 'NZD', 'CH': 'CHF'
          };
          const currency = countryMap[event.country] || event.country;
          return {
            date: displayDate,
            time: timeStr,
            event: `${currency} ${event.event}`,
            impact: `${event.impact} Impact`,
            color: event.impact === 'High' ? '#FF0000' : '#FFA500'
          };
        });
        if (formatted.length > 0) {
          setEconomicEvents(formatted);
        }
      } catch (error) {
        console.error('Failed to fetch economic events:', error);
      }
    };
    fetchEconomicEvents();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:5173' }
    });
  };

  const openDayModal = (dayNumber, trades) => {
    const date = new Date(new Date().getFullYear(), new Date().getMonth(), dayNumber);
    setModalDate(date.toISOString().split('T')[0]);
    setSelectedDayTrades(trades);
    setIsModalOpen(true);
  };

  const closeDayModal = () => {
    setIsModalOpen(false);
    setSelectedDayTrades([]);
    setModalDate(null);
  };

  if (session) {
    const path = window.location.pathname;
    if (path === '/journal-entry') return <JournalEntryPage />;
    if (path === '/journal') return <JournalListPage />;
    if (path === '/accounts') return <AccountsPage />;
    if (path === '/calendar') return <CalendarPage />;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const tradesByDate = {};
    dashboardTrades.forEach(trade => {
      if (!tradesByDate[trade.date]) tradesByDate[trade.date] = [];
      tradesByDate[trade.date].push(trade);
    });

    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f15 0%, #000000 100%)',
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '20px',
        paddingBottom: '20px',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        color: 'white'
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            borderBottom: '1px solid #333',
            paddingBottom: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo.png" alt="Σigmajrn Logo" style={{ width: '40px', height: '40px' }} />
              <div>
                <h1 style={{ color: '#155DFC', margin: '0' }}>Σigmajrn</h1>
                <p style={{
                  fontSize: '14px',
                  margin: '4px 0 0 0',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <span style={{ color: '#525252' }}>Welcome,</span>
                  <span style={{
                    color: '#ffffff',
                    textShadow: '0 0 8px rgba(21, 93, 252, 0.7), 0 0 16px rgba(21, 93, 252, 0.5)',
                    fontWeight: '500'
                  }}>Trader</span>
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '20px',
              alignItems: 'center'
            }}>
              <button
                onClick={() => window.location.href = '/dashboard'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/dashboard' || window.location.pathname === '/' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/dashboard' || window.location.pathname === '/' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/dashboard' || window.location.pathname === '/' 
                    ? '3px solid #155DFC' 
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <img src="/logo.png" alt="Dashboard" style={{ width: '16px', height: '16px' }} />
                <span>Dashboard</span>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => window.location.href = '/journal'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/journal' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/journal' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/journal'
                    ? '3px solid #155DFC'
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <img 
                  src="/pencil.png" 
                  alt="Pencil" 
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    filter: 'grayscale(100%) brightness(0.8)' 
                  }} 
                />
                <span>Trade Journal</span>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => window.location.href = '/calendar'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/calendar' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/calendar' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/calendar'
                    ? '3px solid #155DFC'
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Calendar</span>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => window.location.href = '/news-events'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/news-events' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/news-events' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/news-events'
                    ? '3px solid #155DFC'
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2z"></path>
                  <line x1="8" y1="6" x2="20" y2="6"></line>
                  <line x1="8" y1="12" x2="20" y2="12"></line>
                  <line x1="8" y1="18" x2="14" y2="18"></line>
                </svg>
                <span>News Events</span>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => window.location.href = '/analytics'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/analytics' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/analytics' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/analytics'
                    ? '3px solid #155DFC'
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                  <polyline points="17 6 23 6 23 12"></polyline>
                </svg>
                <span>Analytics</span>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => window.location.href = '/risk-manager'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/risk-manager' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/risk-manager' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/risk-manager'
                    ? '3px solid #155DFC'
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>Risk Manager</span>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => window.location.href = '/settings'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: window.location.pathname === '/settings' ? '#ffffff' : '#525252',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: window.location.pathname === '/settings' ? '700' : '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  borderBottom: window.location.pathname === '/settings'
                    ? '3px solid #155DFC'
                    : '2px solid transparent',
                  paddingBottom: '6px'
                }}
              >
                <span>⚙️</span>
                <span>Settings</span>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#155DFC',
                  marginLeft: '6px'
                }}></div>
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px 8px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  marginLeft: 'auto'
                }}
              >
                <img 
                  src="/power-icon.png" 
                  alt="Power" 
                  style={{ 
                    width: '24px',
                    height: '24px',
                    filter: 'grayscale(100%) brightness(0.8)' 
                  }} 
                />
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '8px'
          }}>
            <button style={{
              backgroundColor: '#155DFC',
              color: 'white',
              border: 'none',
              padding: '14px 16px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '300px'
            }}>
              ➕ NEW JOURNAL ENTRY
            </button>
            <div
              onClick={() => window.location.href = '/news-events'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                overflowX: 'auto',
                scrollbarWidth: 'none'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#155DFC" strokeWidth="2">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2z"></path>
                <line x1="8" y1="6" x2="20" y2="6"></line>
                <line x1="8" y1="12" x2="20" y2="12"></line>
                <line x1="8" y1="18" x2="14" y2="18"></line>
              </svg>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#155DFC',
                whiteSpace: 'nowrap'
              }}>
                News Events:
              </div>
              <div style={{
                flex: 1,
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollBehavior: 'smooth'
              }}>
                {economicEvents.map((event, i) => (
                  <div key={i} style={{
                    minWidth: '180px',
                    padding: '6px 8px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '6px',
                    borderLeft: `3px solid ${event.color}`,
                    color: '#fff',
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    <div>{event.date}</div>
                    <div>{event.time}</div>
                    <div>{event.event}</div>
                    <div style={{ color: event.color, marginTop: '2px' }}>{event.impact}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '300px 1fr',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{
              borderRadius: '12px',
              padding: '0px',
              border: '1px solid #333',
              height: '180px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: '4px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ 
                  color: '#155DFC', 
                  margin: '0 0 8px 0',
                  fontWeight: '700',
                  letterSpacing: '-0.3px'
                }}>
                  Net P&L
                </h3>
                <div style={{
                  fontSize: '14px',
                  color: '#525252',
                  textAlign: 'right'
                }}>
                  <div>Weekly P&L: $1.05K</div>
                  <div>Monthly P&L: $1.61K</div>
                </div>
              </div>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#155DFC', margin: '0 0 8px 0' }}>$14,742</p>
              <div style={{
                width: '100%',
                height: '100px',
                marginTop: 'auto',
                margin: '0',
                padding: '0',
                overflow: 'hidden'
              }}>
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox="0 0 100 100" 
                  preserveAspectRatio="none"
                  style={{ display: 'block' }}
                >
                  <line x1="0" y1="0" x2="100" y2="0" stroke="#333" strokeWidth="0.5" />
                  <line x1="0" y1="20" x2="100" y2="20" stroke="#333" strokeWidth="0.5" />
                  <line x1="0" y1="40" x2="100" y2="40" stroke="#333" strokeWidth="0.5" />
                  <line x1="0" y1="60" x2="100" y2="60" stroke="#333" strokeWidth="0.5" />
                  <line x1="0" y1="80" x2="100" y2="80" stroke="#333" strokeWidth="0.5" />
                  <path 
                    d="M0,80 C10,60 20,70 30,50 C40,30 50,40 60,20 C70,0 80,10 90,0 C95,0 98,0 100,0" 
                    fill="none" 
                    stroke="#155DFC" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M0,80 C10,60 20,70 30,50 C40,30 50,40 60,20 C70,0 80,10 90,0 C95,0 98,0 100,0 L100,100 L0,100 Z" 
                    fill="url(#profitGradient)" 
                  />
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#155DFC" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#155DFC" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <text x="0" y="8" fontSize="8" fill="#525252">$2,000</text>
                  <text x="0" y="25" fontSize="8" fill="#525252">$1,500</text>
                  <text x="0" y="45" fontSize="8" fill="#525252">$1,000</text>
                  <text x="0" y="65" fontSize="8" fill="#525252">$500</text>
                  <text x="0" y="85" fontSize="8" fill="#525252">$0</text>
                  <text x="0" y="95" fontSize="6" fill="#525252" textAnchor="start">01/01</text>
                  <text x="25" y="95" fontSize="6" fill="#525252" textAnchor="middle">02/01</text>
                  <text x="50" y="95" fontSize="6" fill="#525252" textAnchor="middle">03/01</text>
                  <text x="75" y="95" fontSize="6" fill="#525252" textAnchor="middle">04/01</text>
                  <text x="100" y="95" fontSize="6" fill="#525252" textAnchor="end">05/01</text>
                </svg>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr) 207px',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              {[
                { label: 'Win Rate', value: '72%' },
                { label: 'Risk Exposure', value: '65%' },
                { label: 'Drawdown', value: '12%' },
                { label: 'Trade Frequency', value: '3.2x' },
                { label: 'Avg R-Multiple', value: '1.8x' }
              ].map((gauge, i) => (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  <h3 style={{ color: '#155DFC', margin: '0 0 8px 0', fontSize: '14px' }}>{gauge.label}</h3>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#333"
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#155DFC"
                        strokeWidth="10"
                        strokeDasharray="283"
                        strokeDashoffset="127"
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="#155DFC" fontSize="14" fontWeight="bold">
                        {gauge.value}
                      </text>
                    </svg>
                  </div>
                </div>
              ))}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                justifyContent: 'center',
                position: 'relative',
                top: '-10px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  {['forex', 'indices', 'crypto'].map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      style={{
                        background: activeCategory === category ? '#155DFC' : '#333',
                        color: activeCategory === category ? 'white' : '#aaa',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: activeCategory === category ? '600' : '400'
                      }}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{
                  width: '200px',
                  fontSize: '10px',
                  color: '#eee',
                  lineHeight: '1.4',
                  textAlign: 'left'
                }}>
                  {marketNews.map((article, i) => (
                    <div key={i} style={{
                      marginBottom: '8px',
                      padding: '6px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '4px',
                      borderLeft: '2px solid #155DFC'
                    }}>
                      <div style={{ fontWeight: '600', fontSize: '11px' }}>
                        {article.title.length > 40 ? article.title.substring(0, 40) + '...' : article.title}
                      </div>
                      <div style={{ color: '#525252', fontSize: '9px', marginTop: '2px' }}>
                        {article.source?.name || 'Source'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ✅ REAL DATA CALENDAR — FIXED STYLING */}
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #2a2a2a',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(21, 93, 252, 0.1)',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2
                onClick={() => window.location.href = '/calendar'}
                style={{
                  color: '#ffffff',
                  fontWeight: '700',
                  letterSpacing: '-0.5px',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  cursor: 'pointer',
                  display: 'inline-block',
                  paddingBottom: '4px',
                  borderBottom: '2px solid transparent',
                  transition: 'border-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = '#155DFC'}
                onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}
              >
                Trading Calendar
              </h2>
              <span style={{
                fontSize: '14px',
                color: '#525252',
                fontWeight: '500'
              }}>
                {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '8px',
              marginBottom: '10px'
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Weekly'].map(day => (
                <div key={day} style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#525252',
                  fontWeight: '600',
                  padding: '8px 0'
                }}>
                  {day}
                </div>
              ))}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '8px'
            }}>
              {[...Array(48)].map((_, i) => {
                const col = i % 8;
                const row = Math.floor(i / 8);
                // Weekly column
                if (col === 7) {
                  const weekIndex = row;
                  const startDate = new Date(currentYear, currentMonth, 1 + weekIndex * 7 - firstDayOfMonth);
                  const endDate = new Date(currentYear, currentMonth, Math.min(1 + (weekIndex + 1) * 7 - firstDayOfMonth - 1, daysInMonth));
                  if (startDate.getDate() < 1) startDate.setDate(1);
                  if (endDate.getDate() > daysInMonth) endDate.setDate(daysInMonth);
                  const weeklyTrades = dashboardTrades.filter(trade => {
                    const tradeDate = new Date(trade.date);
                    return tradeDate >= startDate && tradeDate <= endDate;
                  });
                  const totalPnL = weeklyTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
                  const validTrades = weeklyTrades.filter(t => t.profit_loss != null);
                  const winningTrades = validTrades.filter(t => t.profit_loss > 0).length;
                  const winRate = validTrades.length > 0 ? ((winningTrades / validTrades.length) * 100).toFixed(0) : 0;
                  const isProfitable = totalPnL > 0;
                  const isLoss = totalPnL < 0;

                  // ✅ FIXED: Use exact colors from calendar.jsx
                  const weekBg = isLoss ? '#2a2a2a' : isProfitable ? 'rgba(21, 93, 252, 0.1)' : 'rgba(255,255,255,0.05)';
                  const weekPnLColor = isLoss ? '#fff' : isProfitable ? '#155DFC' : '#aaa';
                  const weekPnLText = isLoss ? `- $${Math.abs(totalPnL).toFixed(2)}` : `$${totalPnL.toFixed(2)}`;

                  return (
                    <div 
                      key={`week-${row}`}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        background: weekBg,
                        border: '1px solid #444',
                        borderRadius: '6px',
                        minHeight: '80px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '6px',
                        left: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#155DFC'
                      }}>
                        Week {weekIndex + 1}
                      </div>
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: weekPnLColor,
                          marginTop: '4px',
                          textAlign: 'center'
                        }}>
                          {weeklyTrades.length > 0 ? weekPnLText : '-'}
                        </div>
                        <div style={{ fontSize: '10px', color: isLoss ? '#888' : '#eee', marginTop: '4px' }}>
                          {weeklyTrades.length} trade{weeklyTrades.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '10px', color: isLoss ? '#888' : '#eee', marginTop: '4px' }}>
                          {winRate}% win rate
                        </div>
                      </div>
                    </div>
                  );
                }
                // Day cells
                const dayIndex = row * 7 + col;
                const dayNumber = dayIndex - firstDayOfMonth + 1;
                const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
                if (!isCurrentMonth) {
                  return (
                    <div 
                      key={i} 
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        background: 'transparent',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        minHeight: '80px',
                        cursor: 'default'
                      }}
                    />
                  );
                }
                const isoDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                const dayTrades = tradesByDate[isoDate] || [];
                const totalPnL = dayTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
                const validTrades = dayTrades.filter(t => t.profit_loss != null);
                const winningTrades = validTrades.filter(t => t.profit_loss > 0).length;
                const winRate = validTrades.length > 0 ? ((winningTrades / validTrades.length) * 100).toFixed(0) : 0;
                const isProfitable = totalPnL > 0;
                const isLoss = totalPnL < 0;

                // ✅ FIXED: Use exact colors from calendar.jsx
                const dayBg = isLoss ? '#2a2a2a' : isProfitable ? 'rgba(21, 93, 252, 0.1)' : 'rgba(255,255,255,0.03)';
                const dayPnLColor = isLoss ? '#fff' : isProfitable ? '#155DFC' : '#aaa';
                const dayPnLText = isLoss ? `- $${Math.abs(totalPnL).toFixed(2)}` : `$${totalPnL.toFixed(2)}`;

                return (
                  <div 
                    key={i} 
                    onClick={() => openDayModal(dayNumber, dayTrades)}
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      background: dayBg,
                      border: '1px solid #444',
                      borderRadius: '6px',
                      minHeight: '80px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 8px rgba(21, 93, 252, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      left: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#155DFC'
                    }}>
                      {dayNumber}
                    </div>
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        color: dayPnLColor,
                        marginTop: '4px',
                        textAlign: 'center'
                      }}>
                        {dayTrades.length > 0 ? dayPnLText : '-'}
                      </div>
                      <div style={{ fontSize: '10px', color: isLoss ? '#888' : '#eee', marginTop: '4px' }}>
                        {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '10px', color: isLoss ? '#888' : '#eee', marginTop: '4px' }}>
                        {winRate}% win rate
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ✅ FIXED MODAL — WITH EDIT BUTTON AND CORRECT P&L COLOR */}
          {isModalOpen && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }} onClick={closeDayModal}>
              <div style={{
                background: 'linear-gradient(135deg, #0f0f15 0%, #000000 100%)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '800px',
                maxHeight: '80vh',
                overflow: 'auto',
                border: '1px solid rgba(21, 93, 252, 0.3)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                padding: '24px'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: '#155DFC', margin: 0 }}>
                    Trades for {new Date(modalDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h2>
                  <button onClick={closeDayModal} style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid #444',
                    color: 'white',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    fontSize: '18px',
                    cursor: 'pointer'
                  }}>×</button>
                </div>
                {selectedDayTrades.length === 0 ? (
                  <p>No trades recorded for this day.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      <button onClick={() => window.location.href = `/analytics?date=${modalDate}`} style={{
                        background: 'rgba(21, 93, 252, 0.2)',
                        color: 'white',
                        border: '1px solid rgba(21, 93, 252, 0.4)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                          <polyline points="17 6 23 6 23 12"></polyline>
                        </svg>
                        View Analytics
                      </button>
                      <button onClick={() => {
                        const headers = ['Symbol', 'Direction', 'Entry', 'Exit', 'P&L', 'Account', 'Notes'];
                        const csvContent = [
                          headers.join(','),
                          ...selectedDayTrades.map(t => [
                            `"${t.symbol || ''}"`,
                            `"${t.direction || ''}"`,
                            t.entry_price || '',
                            t.exit_price || '',
                            t.profit_loss || '',
                            `"${t.trading_accounts?.account_name || ''}"`,
                            `"${t.notes || ''}"`
                          ].join(','))
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.setAttribute('href', url);
                        link.setAttribute('download', `trades_${modalDate}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }} style={{
                        background: 'rgba(21, 93, 252, 0.2)',
                        color: 'white',
                        border: '1px solid rgba(21, 93, 252, 0.4)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}>
                        📥 Export CSV
                      </button>
                      <button onClick={() => window.location.href = `/journal-entry?date=${modalDate}`} style={{
                        background: 'rgba(21, 93, 252, 0.2)',
                        color: 'white',
                        border: '1px solid rgba(21, 93, 252, 0.4)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}>
                        ➕ Add Trade
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {selectedDayTrades.map(trade => (
                        <div key={trade.id} style={{
                          background: 'rgba(255,255,255,0.05)',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.03)',
                          position: 'relative'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong>{trade.symbol || 'N/A'}</strong>
                            <span style={{
                              fontSize: '14px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: trade.direction === 'buy' 
                                ? 'rgba(21, 93, 252, 0.2)'
                                : 'rgba(128, 128, 128, 0.2)',
                              color: trade.direction === 'buy' 
                                ? '#155DFC'
                                : '#888888'
                            }}>
                              {trade.direction?.toUpperCase() || 'N/A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>
                            <span>Entry: {trade.entry_price != null ? trade.entry_price.toFixed(5) : '—'}</span>
                            <span>Exit: {trade.exit_price != null ? trade.exit_price.toFixed(5) : '—'}</span>
                          </div>
                          <div style={{
                            fontWeight: 'bold',
                            fontSize: '16px',
                            color: trade.profit_loss > 0 
                              ? '#155DFC' 
                              : trade.profit_loss < 0 
                                ? '#fff'  // ✅ WHITE for losses
                                : '#fff',
                            textAlign: 'right'
                          }}>
                            {trade.profit_loss != null ? 
                              (trade.profit_loss < 0 ? `- $${Math.abs(trade.profit_loss).toFixed(2)}` : `$${trade.profit_loss.toFixed(2)}`) 
                              : '—'}
                          </div>
                          {trade.notes && (
                            <div style={{ fontSize: '13px', color: '#ccc', marginTop: '8px', fontStyle: 'italic' }}>
                              “{trade.notes}”
                            </div>
                          )}
                          {trade.trading_accounts && (
                            <div style={{
                              fontSize: '12px',
                              color: '#155DFC',
                              marginTop: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              </svg>
                              {trade.trading_accounts.account_name} ({trade.trading_accounts.broker})
                            </div>
                          )}
                          {/* ✅ EDIT BUTTON — matches calendar.jsx */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/journal-entry?id=${trade.id}&env=live`;
                            }}
                            style={{
                              background: '#000',
                              color: 'white',
                              border: '1px solid #666',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '8px',
                              width: 'fit-content'
                            }}
                          >
                            <img 
                              src="/pencil.png" 
                              alt="Edit" 
                              style={{ 
                                width: '12px', 
                                height: '12px', 
                                filter: 'grayscale(100%) brightness(0.8)' 
                              }} 
                            />
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: '#000000',
      margin: 0,
      fontFamily: 'Segoe UI, system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          textAlign: 'center',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <img src="/logo.png" alt="Σigmajrn Logo" style={{
            width: '60px',
            height: '60px',
            objectFit: 'contain',
            marginBottom: '16px'
          }} />
          <h1 style={{
            fontSize: '35px',
            fontWeight: 'bold',
            color: '#505259'
          }}>Σigmajrn</h1>
          <p style={{
            fontSize: '14px',
            color: '#535457',
            marginTop: '8px'
          }}>Your Pro Trading Journal</p>
        </div>
        <div style={{ padding: '32px' }}>
          <form onSubmit={handleSignIn} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#155DFC',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <div style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#155DFC',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}>
              Forgot your password?
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#155DFC',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                <path d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.78 23 12 23z" fill="white"/>
                <path d="M5.84 14.09c-.24-.73-.38-1.5-.38-2.3 0-.8.14-1.57.38-2.3V7.07H2.18C1.43 8.58 1 10.38 1 12.25s.43 3.67 1.18 5.18l3.66-2.84z" fill="white"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.41 1 12 1c-2.41 0-5.45.99-7.17 2.82l3.15 3.15c1.15-1.08 2.59-1.64 4.21-1.64z" fill="white"/>
              </svg>
              Sign in with Google
            </button>
            <div style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#525252'
            }}>
              Don't have an account?{' '}
              <a href="#" style={{
                color: '#155DFC',
                fontWeight: '600'
              }}>
                Sign up
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}