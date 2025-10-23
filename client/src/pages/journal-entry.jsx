// src/pages/journal-entry.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function JournalEntryPage() {
  const [session, setSession] = useState(null);
  const [tradeType, setTradeType] = useState('forex');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState('buy');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState('09:30');
  const [exitTime, setExitTime] = useState('10:15');
  const [sessionName, setSessionName] = useState('');
  const [timeframe, setTimeframe] = useState('1M');
  const [newsImpact, setNewsImpact] = useState('NONE');
  const [bias, setBias] = useState('NEUTRAL');
  const [confluences, setConfluences] = useState([]);
  const [winLoss, setWinLoss] = useState('BREAKEVEN');
  const [profitLoss, setProfitLoss] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tradingviewLink, setTradingviewLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [pipCount, setPipCount] = useState('');
  const [pipUnit, setPipUnit] = useState('auto');
  const [importMode, setImportMode] = useState(false);
  const [importedTrades, setImportedTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [tradeEnvironment, setTradeEnvironment] = useState('live'); // 'live', 'demo', 'backtest'
  const [takeProfits, setTakeProfits] = useState([{ price: '', quantity: '' }]);
  const [isEditing, setIsEditing] = useState(false);
  const [tradeId, setTradeId] = useState(null);

  // Fetch session and check for trade ID
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      const env = urlParams.get('env') || 'live';
      if (id && session) {
        setTradeId(id);
        setTradeEnvironment(env);
        setIsEditing(true);
        await loadTrade(id, session.user.id);
      } else {
        // Set environment from URL or default to 'live'
        setTradeEnvironment(env);
      }
    };
    init();
  }, []);

  const loadTrade = async (id, userId) => {
    setLoading(true);
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new Error('Invalid trade ID');
      }

      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          trading_accounts(account_name, broker)
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Trade not found');

      setTradeId(id);
      setTradeType(data.trade_type || 'forex');
      setSymbol(data.symbol || '');
      setDirection(data.direction || 'buy');
      setEntryPrice(data.entry_price?.toString() || '');
      setExitPrice(data.exit_price?.toString() || '');
      setStopLoss(data.stop_loss?.toString() || '');
      setQuantity(data.quantity?.toString() || '');
      setDate(data.date || new Date().toISOString().split('T')[0]);
      setEntryTime(data.entry_time || '09:30');
      setExitTime(data.exit_time || '10:15');
      setSessionName(data.session || '');
      setTimeframe(data.timeframe || '1M');
      setNewsImpact(data.news_impact || 'NONE');
      setBias(data.bias || 'NEUTRAL');
      setConfluences(Array.isArray(data.confluences) ? data.confluences : []);
      setWinLoss(data.win_loss || 'BREAKEVEN');
      setProfitLoss(data.profit_loss?.toString() || '');
      setNotes(data.notes || '');
      setImageUrl(data.image_url || '');
      setTradingviewLink(data.tradingview_link || '');
      setTradeEnvironment(data.trade_environment || 'live');
      setAccountId(data.account_id || '');
      setPipCount(data.pips_or_ticks?.toString() || '');

      if (Array.isArray(data.take_profit_levels) && data.take_profit_levels.length > 0) {
        setTakeProfits(data.take_profit_levels.map(tp => ({
          price: tp.price?.toString() || '',
          quantity: tp.quantity?.toString() || ''
        })));
      } else {
        setTakeProfits([{ price: '', quantity: '' }]);
      }
    } catch (err) {
      console.error('Failed to load trade:', err);
      alert('Could not load trade for editing.\n\n' + (err.message || 'Unknown error'));
      window.location.href = '/journal';
    } finally {
      setLoading(false);
    }
  };

  // Fetch accounts based on tradeEnvironment
  useEffect(() => {
    if (!session?.user?.id) return;
    const loadAccounts = async () => {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, account_name, broker, environment')
        .eq('user_id', session.user.id)
        .eq('environment', tradeEnvironment)
        .order('created_at', { ascending: true });
      if (!error) {
        setAccounts(data || []);
        if (data && data.length > 0) {
          setAccountId(data[0].id);
        } else {
          setAccountId('');
        }
      }
    };
    loadAccounts();
  }, [session, tradeEnvironment]);

  // ... (rest of your existing logic: parseCSV, autoCalculatePipCount, etc. — unchanged)

  const parseTradeCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].toLowerCase().split(',');
    if (headers.includes('ticket') && headers.includes('open time')) return parseMT4Format(lines);
    if (headers.includes('id') && headers.includes('entry time')) return parseCTraderFormat(lines);
    if (headers.includes('date') && headers.includes('strategy')) return parseTradingViewFormat(lines);
    throw new Error('Unsupported CSV format');
  };

  const parseMT4Format = (lines) => {
    const headers = lines[0].split(',');
    const trades = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim());
      if (!['buy', 'sell'].includes(row.Type?.toLowerCase())) continue;
      const [openDate, openTime] = (row['Open Time'] || '').split(' ');
      trades.push({
        symbol: row.Item || '',
        direction: row.Type?.toLowerCase() || 'buy',
        quantity: parseFloat(row.Size) || 0,
        entry_price: parseFloat(row.Price) || 0,
        exit_price: parseFloat(row['Price']) || 0,
        stop_loss: row['S/L'] ? parseFloat(row['S/L']) : null,
        take_profit: row['T/P'] ? parseFloat(row['T/P']) : null,
        date: openDate ? openDate.replace(/\./g, '-') : '',
        entry_time: openTime || '',
        exit_time: (row['Close Time'] || '').split(' ')[1] || '',
        profit_loss: parseFloat(row.Profit) || 0,
        win_loss: parseFloat(row.Profit) > 0 ? 'WIN' : parseFloat(row.Profit) < 0 ? 'LOSS' : 'BREAKEVEN',
        notes: 'Imported from MetaTrader'
      });
    }
    return trades;
  };

  const parseCTraderFormat = (lines) => {
    const headers = lines[0].split(',');
    const trades = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim());
      if (!['Buy', 'Sell'].includes(row.Type)) continue;
      trades.push({
        symbol: row.Symbol || '',
        direction: row.Type.toLowerCase() === 'buy' ? 'buy' : 'sell',
        quantity: parseFloat(row.Volume) || 0,
        entry_price: parseFloat(row.EntryPrice) || 0,
        exit_price: parseFloat(row.ExitPrice) || 0,
        stop_loss: row.StopLoss ? parseFloat(row.StopLoss) : null,
        take_profit: row.TakeProfit ? parseFloat(row.TakeProfit) : null,
        date: row.EntryTime ? row.EntryTime.split(' ')[0].replace(/\./g, '-') : '',
        entry_time: row.EntryTime ? row.EntryTime.split(' ')[1] : '',
        exit_time: row.ExitTime ? row.ExitTime.split(' ')[1] : '',
        profit_loss: parseFloat(row.NetProfit) || 0,
        win_loss: parseFloat(row.NetProfit) > 0 ? 'WIN' : parseFloat(row.NetProfit) < 0 ? 'LOSS' : 'BREAKEVEN',
        notes: 'Imported from cTrader'
      });
    }
    return trades;
  };

  const parseTradingViewFormat = (lines) => {
    const headers = lines[0].split(',');
    const trades = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim());
      if (!['buy', 'sell'].includes(row.Order.toLowerCase())) continue;
      trades.push({
        symbol: row.Symbol || '',
        direction: row.Order.toLowerCase(),
        quantity: 1,
        entry_price: parseFloat(row.Price) || 0,
        exit_price: parseFloat(row['Exit Price']) || 0,
        stop_loss: null,
        take_profit: null,
        date: row.Date ? row.Date.split(' ')[0] : '',
        entry_time: row.Date ? row.Date.split(' ')[1] : '',
        exit_time: '',
        profit_loss: parseFloat(row.Profit) || 0,
        win_loss: parseFloat(row.Profit) > 0 ? 'WIN' : parseFloat(row.Profit) < 0 ? 'LOSS' : 'BREAKEVEN',
        notes: 'Imported from TradingView'
      });
    }
    return trades;
  };

  const autoCalculatePipCount = () => {
    if (!entryPrice || !exitPrice || !symbol) {
      alert('Please enter symbol, entry, and exit prices.');
      return;
    }
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const diff = Math.abs(exit - entry);
    const sym = symbol.toUpperCase();
    let count;
    if (['ES', 'NQ', 'CL', 'GC', 'YM'].some(f => sym.includes(f))) {
      const tickSize = sym.includes('ES') || sym.includes('NQ') || sym.includes('YM') ? 0.25 :
                       sym.includes('CL') ? 0.01 :
                       sym.includes('GC') ? 0.1 : 0.01;
      count = diff / tickSize;
    } else {
      const pipSize = sym.includes('JPY') ? 0.01 : 0.0001;
      count = diff / pipSize;
    }
    setPipCount(Math.round(count));
  };

  const addConfluenceTag = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      setConfluences([...confluences, e.target.value.trim()]);
      e.target.value = '';
    }
  };

  const removeConfluenceTag = (index) => {
    setConfluences(confluences.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !session) return;
    setLoading(true);
    try {
      const filePath = `user_${session.user.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('trade-images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('trade-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      alert('Image uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error uploading image: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const applyImportedTrade = (trade) => {
    setSymbol(trade.symbol);
    setDirection(trade.direction);
    setQuantity(trade.quantity.toString());
    setEntryPrice(trade.entry_price.toString());
    setExitPrice(trade.exit_price.toString());
    setStopLoss(trade.stop_loss ? trade.stop_loss.toString() : '');
    setTakeProfits(trade.take_profit ? [{ price: trade.take_profit.toString(), quantity: trade.quantity.toString() }] : [{ price: '', quantity: '' }]);
    setDate(trade.date);
    setEntryTime(trade.entry_time);
    setExitTime(trade.exit_time);
    setProfitLoss(trade.profit_loss.toString());
    setWinLoss(trade.win_loss);
    setNotes(trade.notes);
    setTradeType('forex');
    setImportMode(false);
    setImportedTrades([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) {
      alert('You must be logged in to save a trade.');
      return;
    }

    const tradeData = {
      user_id: session.user.id,
      updated_at: new Date().toISOString(),
      symbol,
      direction,
      entry_price: entryPrice ? parseFloat(entryPrice) : null,
      exit_price: exitPrice ? parseFloat(exitPrice) : null,
      stop_loss: stopLoss ? parseFloat(stopLoss) : null,
      take_profit_levels: takeProfits.filter(tp => tp.price).map(tp => ({
        price: parseFloat(tp.price),
        quantity: parseFloat(tp.quantity) || 0
      })),
      quantity_type: tradeType === 'forex' ? 'lot' : tradeType === 'futures' ? 'contract' : 'unit',
      quantity: quantity ? parseFloat(quantity) : null,
      date: date,
      entry_time: entryTime,
      exit_time: exitTime,
      session: sessionName,
      timeframe,
      news_impact: newsImpact,
      bias,
      confluences,
      win_loss: winLoss,
      pips_or_ticks: pipCount ? parseInt(pipCount) : 0,
      profit_loss: profitLoss ? parseFloat(profitLoss) : 0,
      notes,
      image_url: imageUrl,
      tradingview_link: tradingviewLink,
      trade_environment: tradeEnvironment, // ✅ key change
      account_id: accountId || null,
    };

    setLoading(true);
    try {
      let error;
      if (isEditing && tradeId) {
        ({ error } = await supabase.from('trades').update(tradeData).eq('id', tradeId));
      } else {
        tradeData.created_at = new Date().toISOString();
        ({ error } = await supabase.from('trades').insert([tradeData]));
      }
      if (error) throw error;
      alert(isEditing ? 'Trade updated successfully!' : 'Trade saved successfully!');
      window.location.href = '/journal';
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving trade: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getQuantityLabel = () => {
    switch (tradeType) {
      case 'forex': return 'Lot Size';
      case 'futures': return 'Contracts';
      case 'crypto': return 'Units';
      default: return 'Quantity';
    }
  };

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: '#000000',
        fontFamily: 'Segoe UI, system-ui, sans-serif'
      }}>
        <p>Please log in to access the Trade Journal.</p>
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          paddingBottom: '15px'
        }}>
          <h1 style={{ color: '#155DFC', fontSize: '28px', fontWeight: '800' }}>
            {isEditing ? 'Edit Trade' : 'New Trade Journal Entry'}
          </h1>
          <button
            onClick={() => window.location.href = '/journal'}
            style={{
              background: 'rgba(21, 93, 252, 0.15)',
              border: '1px solid rgba(21, 93, 252, 0.3)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            ← Back to Journal
          </button>
        </div>

        <div style={{
          background: 'rgba(26, 26, 26, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '40px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(21, 93, 252, 0.1)',
          overflow: 'visible'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <Section title="Trade Environment">
              <Field label="Trade Type">
                <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} className="ios-input">
                  <option value="forex">Forex</option>
                  <option value="futures">Futures</option>
                  <option value="crypto">Crypto</option>
                </select>
              </Field>
              {/* ✅ Environment Toggle */}
              <Field label="Account Type">
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {['live', 'demo', 'backtest'].map(env => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setTradeEnvironment(env)}
                      style={{
                        background: tradeEnvironment === env ? '#155DFC' : '#333',
                        color: tradeEnvironment === env ? 'white' : '#aaa',
                        border: '1px solid #444',
                        padding: '6px 12px',
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
              </Field>
              <Field label="Trading Account">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="ios-input" style={{ flex: 1 }}>
                    <option value="">Select Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.broker})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => window.location.href = `/accounts?env=${tradeEnvironment}`}
                    style={{
                      background: '#155DFC',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    +
                  </button>
                </div>
              </Field>
            </Section>

            <Section title="Trade Setup">
              <Field label="Symbol">
                <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g., GBPUSD, ES" className="ios-input" />
              </Field>
              <Field label="Direction">
                <select value={direction} onChange={(e) => setDirection(e.target.value)} className="ios-input">
                  {tradeType === 'futures' ? (
                    <>
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </>
                  ) : (
                    <>
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </>
                  )}
                </select>
              </Field>
              <Field label={getQuantityLabel()}>
                <input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 1.0" className="ios-input" />
              </Field>
            </Section>

            <Section title="Price Levels">
              <Field label="Entry Price">
                <input type="number" step="0.0001" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="e.g., 1.32847" className="ios-input" />
              </Field>
              <Field label="Exit Price">
                <input type="number" step="0.0001" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="e.g., 1.33500" className="ios-input" />
              </Field>
              <Field label="Stop Loss">
                <input type="number" step="0.0001" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="e.g., 1.32500" className="ios-input" />
              </Field>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: '#155DFC', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                  Take Profit
                </h4>
                {takeProfits.map((tp, i) => {
                  const label = takeProfits.length === 1 ? 'Take Profit' : `TP${i + 1}`;
                  return (
                    <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder={`${label} Price`}
                        value={tp.price}
                        onChange={(e) => {
                          const newTPs = [...takeProfits];
                          newTPs[i].price = e.target.value;
                          setTakeProfits(newTPs);
                        }}
                        className="ios-input"
                        style={{ flex: 2 }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Qty Closed"
                        value={tp.quantity}
                        onChange={(e) => {
                          const newTPs = [...takeProfits];
                          newTPs[i].quantity = e.target.value;
                          setTakeProfits(newTPs);
                        }}
                        className="ios-input"
                        style={{ flex: 1 }}
                      />
                    </div>
                  );
                })}

                {takeProfits.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setTakeProfits([...takeProfits, { price: '', quantity: '' }])}
                    style={{
                      background: 'rgba(21, 93, 252, 0.1)',
                      color: '#155DFC',
                      border: '1px solid rgba(21, 93, 252, 0.3)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      width: 'fit-content',
                      marginTop: '8px'
                    }}
                  >
                    ➕ Add TP
                  </button>
                )}
              </div>
            </Section>

            <Section title="Timing & Context">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <Field label="Entry">
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="ios-input"
                    />
                    <input
                      type="time"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="ios-input"
                    />
                  </div>
                </Field>
                <Field label="Exit">
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="ios-input"
                    />
                    <input
                      type="time"
                      value={exitTime}
                      onChange={(e) => setExitTime(e.target.value)}
                      className="ios-input"
                    />
                  </div>
                </Field>
                <Field label="Session">
                  <select value={sessionName} onChange={(e) => setSessionName(e.target.value)} className="ios-input">
                    <option value="">Select</option>
                    <option value="LONDON SESSION">London Session</option>
                    <option value="NY OPEN">NY Open</option>
                    <option value="ASIA">Asia</option>
                    <option value="ALL DAY">All Day</option>
                  </select>
                </Field>
                <Field label="Timeframe">
                  <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="ios-input">
                    <option value="1M">1M</option>
                    <option value="5M">5M</option>
                    <option value="H1">H1</option>
                    <option value="H4">H4</option>
                    <option value="D1">D1</option>
                  </select>
                </Field>
                <Field label="News Impact">
                  <select value={newsImpact} onChange={(e) => setNewsImpact(e.target.value)} className="ios-input">
                    <option value="NONE">None</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="NOT_PHASED">Not Phased</option>
                  </select>
                </Field>
                <Field label="Bias">
                  <select value={bias} onChange={(e) => setBias(e.target.value)} className="ios-input">
                    <option value="NEUTRAL">Neutral</option>
                    <option value="BULLISH">Bullish</option>
                    <option value="BEARISH">Bearish</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Performance Metrics">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <Field label="Pip/Tick Count">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={pipCount}
                      onChange={(e) => setPipCount(e.target.value)}
                      step="any"
                      placeholder="e.g., 70"
                      className="ios-input"
                      style={{ flex: 1 }}
                    />
                    <select value={pipUnit} onChange={(e) => setPipUnit(e.target.value)} className="ios-input" style={{ width: '90px' }}>
                      <option value="auto">Auto</option>
                      <option value="pip">Pips</option>
                      <option value="tick">Ticks</option>
                    </select>
                    <button
                      type="button"
                      onClick={autoCalculatePipCount}
                      style={{
                        background: '#155DFC',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Auto
                    </button>
                  </div>
                  <small style={{ color: '#525252', fontSize: '12px', marginTop: '6px' }}>
                    {pipUnit === 'auto' ? 'Auto-detects based on symbol' : `Measured in ${pipUnit}`}
                  </small>
                </Field>
                <Field label="Profit/Loss ($)">
                  <input
                    type="number"
                    value={profitLoss}
                    onChange={(e) => setProfitLoss(e.target.value)}
                    className="ios-input"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Notes & Media">
              <Field label="Trade Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="e.g., News event, strategy used..."
                  className="ios-input"
                  style={{ resize: 'vertical' }}
                />
              </Field>
              <Field label="TradingView Link">
                <input
                  type="url"
                  value={tradingviewLink}
                  onChange={(e) => setTradingviewLink(e.target.value)}
                  placeholder="https://tradingview.com/...  "
                  className="ios-input"
                />
              </Field>
              <Field label="Upload Chart Image">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="ios-input"
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Chart"
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  />
                )}
              </Field>
            </Section>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setImportMode(!importMode)}
                  style={{
                    background: 'rgba(21, 93, 252, 0.1)',
                    color: '#155DFC',
                    border: '1px solid rgba(21, 93, 252, 0.3)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: 'fit-content'
                  }}
                >
                  📥 Import from Broker
                </button>
                <button
                  type="button"
                  onClick={() => alert(`How to export:\n\nMT4/MT5: History → Export\n\ncTrader: Reports → Export\n\nTradingView: Strategy Tester → Export`)}
                  style={{
                    background: 'none',
                    border: '1px solid #555',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    color: '#aaa',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  ?
                </button>
              </div>

              {importMode && (
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#222222', borderRadius: '12px' }}>
                  <h4 style={{ color: '#155DFC', marginBottom: '12px' }}>Import Trade History</h4>
                  <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
                    Upload CSV from MT4/MT5, cTrader, or TradingView.
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const csvText = event.target.result;
                        try {
                          const parsedTrades = parseTradeCSV(csvText);
                          if (parsedTrades.length === 0) {
                            alert('No valid trades found.');
                            return;
                          }
                          setImportedTrades(parsedTrades);
                          alert(`Found ${parsedTrades.length} trade(s).`);
                        } catch (err) {
                          alert('Failed to parse CSV: ' + err.message);
                        }
                      };
                      reader.readAsText(file);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      backgroundColor: '#2a2a2a',
                      color: '#ffffff',
                      fontSize: '14px'
                    }}
                  />
                  
                  {importedTrades.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h5 style={{ color: '#fff', marginBottom: '8px' }}>Select a trade to import:</h5>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {importedTrades.map((trade, idx) => (
                          <div
                            key={idx}
                            onClick={() => applyImportedTrade(trade)}
                            style={{
                              padding: '10px',
                              background: '#333',
                              borderRadius: '6px',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              border: '1px solid #155DFC',
                              fontSize: '13px'
                            }}
                          >
                            {trade.direction.toUpperCase()} {trade.quantity} {trade.symbol} @ {trade.entry_price}
                            <div style={{ color: '#aaa', fontSize: '12px' }}>
                              {trade.date} {trade.entry_time} → {trade.exit_time} | P/L: ${trade.profit_loss.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #155DFC 0%, #00aaff 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '16px 48px',
                  fontSize: '18px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 6px 20px rgba(21, 93, 252, 0.4)',
                  transition: 'all 0.3s ease'
                }}
              >
                {loading ? 'Saving...' : isEditing ? 'Update Trade' : 'Save Trade'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .ios-input {
          width: 100%;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          background: rgba(30, 30, 30, 0.6);
          color: white;
          font-size: 15px;
          transition: all 0.25s ease;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }
        .ios-input:focus {
          outline: none;
          border-color: #155DFC;
          box-shadow: 0 0 0 2px rgba(21, 93, 252, 0.3);
        }
        .ios-input::placeholder {
          color: #555;
        }
        textarea.ios-input {
          padding: 14px;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{
        color: '#155DFC',
        marginBottom: '20px',
        fontSize: '20px',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {title}
        <div style={{
          height: '1px',
          flex: 1,
          background: 'linear-gradient(to right, rgba(21,93,252,0.3), transparent)'
        }}></div>
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: '#ddd',
        marginBottom: '8px',
        marginLeft: '4px'
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}