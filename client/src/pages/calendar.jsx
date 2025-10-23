// src/pages/calendar.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function CalendarPage() {
  const [session, setSession] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Modal state
  const [selectedDayTrades, setSelectedDayTrades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDateObj, setModalDateObj] = useState(null); // Store actual Date object

  // Fetch session
  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    fetchSession();
  }, []);

  // Fetch trades
  useEffect(() => {
    if (!session) return;
    const fetchTrades = async () => {
      const currentMonthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const currentMonthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
      const { data, error } = await supabase
        .from('trades')
        .select('id, date, profit_loss, symbol, direction, entry_price, exit_price, notes, trading_accounts(account_name, broker)')
        .eq('user_id', session.user.id)
        .gte('date', currentMonthStart.toISOString().split('T')[0])
        .lte('date', currentMonthEnd.toISOString().split('T')[0])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching trades:', error.message || error);
      } else {
        setTrades(data || []);
      }
      setLoading(false);
    };
    fetchTrades();
  }, [session, selectedMonth]);

  const openDayModal = (dayNumber, trades) => {
    // ✅ Create Date object in local time
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), dayNumber);
    setModalDateObj(date); // Pass the actual Date object
    setSelectedDayTrades(trades);
    setIsModalOpen(true);
  };

  const closeDayModal = () => {
    setIsModalOpen(false);
    setSelectedDayTrades([]);
    setModalDateObj(null);
  };

  const currentYear = selectedMonth.getFullYear();
  const currentMonth = selectedMonth.getMonth();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Group trades by date
  const tradesByDate = {};
  trades.forEach(trade => {
    if (!tradesByDate[trade.date]) tradesByDate[trade.date] = [];
    tradesByDate[trade.date].push(trade);
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
        {/* ✅ Header with navigation */}
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
          <div>
            <h1 style={{ color: '#155DFC', fontSize: '28px', fontWeight: '800' }}>Trading Calendar</h1>
            <span style={{
              fontSize: '14px',
              color: '#525252',
              fontWeight: '500'
            }}>
              {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(newDate.getMonth() - 1);
                setSelectedMonth(newDate);
              }}
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
              ← Previous Month
            </button>
            <button
              onClick={() => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(newDate.getMonth() + 1);
                setSelectedMonth(newDate);
              }}
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
              Next Month →
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>Loading calendar...</div>
        ) : (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '16px',
              marginBottom: '10px'
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Weekly'].map(day => (
                <div key={day} style={{ textAlign: 'center', fontSize: '14px', color: '#aaa', fontWeight: '600', padding: '8px 0' }}>
                  {day}
                </div>
              ))}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '16px'
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

                  const weeklyTrades = trades.filter(trade => {
                    const tradeDate = new Date(trade.date);
                    return tradeDate >= startDate && tradeDate <= endDate;
                  });

                  const totalPnL = weeklyTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
                  const validTrades = weeklyTrades.filter(t => t.profit_loss != null);
                  const winningTrades = validTrades.filter(t => t.profit_loss > 0).length;
                  const winRate = validTrades.length > 0 ? ((winningTrades / validTrades.length) * 100).toFixed(0) : 0;
                  const isProfitable = totalPnL > 0;
                  const isLoss = totalPnL < 0;

                  // ✅ Losing week: grey bg, white P&L
                  const weekBg = isLoss ? '#2a2a2a' : isProfitable ? 'rgba(21, 93, 252, 0.1)' : 'rgba(255,255,255,0.05)';
                  const weekPnLColor = isLoss ? '#fff' : isProfitable ? '#155DFC' : '#aaa';
                  const weekPnLText = isLoss ? `- $${Math.abs(totalPnL).toFixed(2)}` : `$${totalPnL.toFixed(2)}`;

                  return (
                    <div
                      key={`week-${row}`}
                      style={{
                        background: weekBg,
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.03)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#155DFC', marginBottom: '8px' }}>
                        Week {weekIndex + 1}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: isLoss ? 'normal' : 'bold',
                        color: weekPnLColor,
                        textAlign: 'center', // ✅ Centered
                        marginTop: '8px'
                      }}>
                        {weeklyTrades.length > 0 ? weekPnLText : '-'}
                      </div>
                      <div style={{ fontSize: '12px', color: isLoss ? '#888' : '#aaa', marginTop: '4px' }}>
                        {weeklyTrades.length} trade{weeklyTrades.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: isLoss ? '#888' : '#aaa' }}>
                        {winRate}% win rate
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
                    <div key={i} style={{
                      padding: '12px',
                      textAlign: 'center',
                      background: 'transparent',
                      border: '1px solid #444',
                      borderRadius: '6px',
                      minHeight: '80px',
                      cursor: 'default'
                    }} />
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

                // ✅ Losing day: grey bg, white P&L
                const dayBg = isLoss ? '#2a2a2a' : isProfitable ? 'rgba(21, 93, 252, 0.1)' : 'rgba(255,255,255,0.03)';
                const dayPnLColor = isLoss ? '#fff' : isProfitable ? '#155DFC' : '#aaa';
                const dayPnLText = isLoss ? `- $${Math.abs(totalPnL).toFixed(2)}` : `$${totalPnL.toFixed(2)}`;

                return (
                  <div
                    key={i}
                    onClick={() => openDayModal(dayNumber, dayTrades)}
                    style={{
                      background: dayBg,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.03)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#155DFC'
                    }}>
                      {dayNumber}
                    </div>
                    <div style={{ marginTop: '20px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: isLoss ? 'normal' : 'bold',
                        color: dayPnLColor,
                        textAlign: 'center', // ✅ Centered
                        marginTop: '8px'
                      }}>
                        {dayTrades.length > 0 ? dayPnLText : '-'}
                      </div>
                      <div style={{ fontSize: '12px', color: isLoss ? '#888' : '#aaa', marginTop: '4px' }}>
                        {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: isLoss ? '#888' : '#aaa' }}>
                        {winRate}% win rate
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ✅ Day Trades Modal — with correct day name */}
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
                {/* ✅ FIXED: Use the actual Date object to get correct day name */}
                Trades for {modalDateObj?.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) || ''}
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
                  {/* ✅ View Analytics — SVG icon */}
                  <button onClick={() => window.location.href = `/analytics?date=${modalDateObj?.toISOString().split('T')[0]}`} style={{
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
                  {/* Export CSV */}
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
                    link.setAttribute('download', `trades_${modalDateObj?.toISOString().split('T')[0]}.csv`);
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
                  {/* ✅ Add Trade for this date */}
                  <button onClick={() => window.location.href = `/journal-entry?date=${modalDateObj?.toISOString().split('T')[0]}`} style={{
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
                            ? '#fff'  // ✅ WHITE for negative
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
                      {/* ✅ Per-trade Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/journal-entry?id=${trade.id}`;
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
  );
}