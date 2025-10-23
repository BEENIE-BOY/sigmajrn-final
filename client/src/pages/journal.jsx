// src/pages/journal.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function JournalListPage() {
  const [session, setSession] = useState(null);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [tradeEnvironment, setTradeEnvironment] = useState('live'); // 'live', 'demo', 'backtest'
  const [loading, setLoading] = useState(true);

  // Fetch session
  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    fetchSession();
  }, []);

  // Fetch trades filtered by environment
  useEffect(() => {
    if (!session) return;
    const fetchTrades = async () => {
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select(`
          *,
          trading_accounts(account_name, broker)
        `)
        .eq('user_id', session.user.id)
        .eq('trade_environment', tradeEnvironment)
        .order('created_at', { ascending: false });

      if (tradesError) {
        console.error('❌ Error fetching trades:', tradesError.message || tradesError);
      } else {
        setTrades(tradesData || []);
      }
      setLoading(false);
    };
    fetchTrades();
  }, [session, tradeEnvironment]);

  // Fetch accounts for filter dropdown (filtered by environment)
  useEffect(() => {
    if (!session) return;
    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, account_name, broker')
        .eq('user_id', session.user.id)
        .eq('environment', tradeEnvironment)
        .order('created_at', { ascending: true });
      if (!error) {
        setAccounts(data || []);
        setSelectedAccountId('all'); // reset filter when env changes
      }
    };
    fetchAccounts();
  }, [session, tradeEnvironment]);

  // Apply account filter
  const filteredTrades = selectedAccountId === 'all'
    ? trades
    : trades.filter(trade => trade.account_id === selectedAccountId);

  // Group filtered trades by year → month → week
  const grouped = {};
  filteredTrades.forEach(trade => {
    const d = new Date(trade.created_at);
    const year = d.getFullYear();
    const month = d.toLocaleString('default', { month: 'long' });
    const week = Math.ceil(d.getDate() / 7);
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = {};
    if (!grouped[year][month][week]) grouped[year][month][week] = [];
    grouped[year][month][week].push(trade);
  });

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <p>Please log in.</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f15 0%, #000000 100%)',
      padding: '20px',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      color: 'white'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header with Navigation & Environment Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          paddingBottom: '15px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ color: '#155DFC', fontSize: '28px', fontWeight: '800' }}>Trade Journal</h1>
            
            {/* ✅ Environment Toggle */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#aaa' }}>View:</span>
              {['live', 'demo', 'backtest'].map(env => (
                <button
                  key={env}
                  onClick={() => setTradeEnvironment(env)}
                  style={{
                    background: tradeEnvironment === env ? '#155DFC' : '#333',
                    color: tradeEnvironment === env ? 'white' : '#aaa',
                    border: '1px solid #444',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {env}
                </button>
              ))}
            </div>

            {/* ✅ Account Filter Dropdown */}
            {accounts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#aaa' }}>Account:</span>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minWidth: '180px'
                  }}
                >
                  <option value="all">All {tradeEnvironment.charAt(0).toUpperCase() + tradeEnvironment.slice(1)} Accounts</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.broker})
                    </option>
                  ))}
                </select>
                {/* ✅ Add Account Button */}
                <button
                  type="button"
                  onClick={() => window.location.href = `/accounts?env=${tradeEnvironment}`}
                  style={{
                    background: '#155DFC',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.location.href = `/journal-entry?env=${tradeEnvironment}`}
              style={{
                background: 'linear-gradient(135deg, #155DFC 0%, #00aaff 100%)',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ New Entry
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                background: 'rgba(21, 93, 252, 0.15)',
                border: '1px solid rgba(21, 93, 252, 0.3)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>Loading trades...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <h3 style={{ marginBottom: '10px' }}>No trades found</h3>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              {selectedAccountId === 'all'
                ? `No ${tradeEnvironment} trades yet.`
                : `No trades for this ${tradeEnvironment} account.`
              }
            </p>
            <button
              onClick={() => window.location.href = `/journal-entry?env=${tradeEnvironment}`}
              style={{
                background: 'linear-gradient(135deg, #155DFC 0%, #00aaff 100%)',
                border: 'none',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ Add {tradeEnvironment.charAt(0).toUpperCase() + tradeEnvironment.slice(1)} Trade
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([year, months]) => (
            <div key={year} style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '22px', marginBottom: '16px', color: '#155DFC' }}>{year}</h2>
              {Object.entries(months).map(([month, weeks]) => (
                <div key={month} style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#aaa' }}>{month}</h3>
                  {Object.entries(weeks).map(([weekNum, weekTrades]) => (
                    <div key={weekNum} style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '16px', marginBottom: '10px', color: '#888' }}>Week {weekNum}</h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '16px'
                      }}>
                        {weekTrades.map(trade => (
                          <div
                            key={trade.id}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              padding: '16px',
                              borderRadius: '12px',
                              border: '1px solid rgba(255,255,255,0.03)',
                              transition: 'transform 0.2s ease',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                          >
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
                            {/* ✅ P&L: Blue for profit, White for loss */}
                            <div style={{
                              fontWeight: 'bold',
                              fontSize: '16px',
                              color: trade.profit_loss > 0 
                                ? '#155DFC' 
                                : trade.profit_loss < 0 
                                  ? '#fff' 
                                  : '#fff',
                              textAlign: 'right'
                            }}>
                              {trade.profit_loss != null ? 
                                (trade.profit_loss < 0 ? `- $${Math.abs(trade.profit_loss).toFixed(2)}` : `$${trade.profit_loss.toFixed(2)}`) 
                                : '—'}
                            </div>

                            {/* Account Info */}
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

                            {/* ✅ Edit Button — Matches Calendar Style */}
                            <div style={{ marginTop: '12px', textAlign: 'right' }}>
                              <button
                                onClick={() => window.location.href = `/journal-entry?id=${trade.id}&env=${tradeEnvironment}`}
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
                                  gap: '4px'
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
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}