
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BudgetItem, Operator } from './types';
import { formatCurrency, formatDate } from './utils/formatters';

// Supabase configuration
const SUPABASE_URL = 'https://ukkrrfoilaslhexfswij.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVra3JyZm9pbGFzbGhleGZzd2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTYyMDEsImV4cCI6MjA4NDMzMjIwMX0.H3S84tmZ6jCh6f5OwtrQbLbbFQcwU7C3q1vD_tvxsDc';

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SHA-256 hashing utility
async function sha256(text: string) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const INITIAL_ITEMS: BudgetItem[] = [
  { id: 'card1', label: '카드1[현대카드]', amount: 0, operator: '-' },
  { id: 'card2', label: '카드2[하이패스]', amount: 0, operator: '-' },
  { id: 'card3', label: '카드3[교통카드]', amount: 0, operator: '-' },
  { id: 'card4', label: '카드4[기타]', amount: 0, operator: '-' },
  { id: 'extra1', label: '용돈', amount: 0, operator: '-' },
  { id: 'extra2', label: '기타1', amount: 0, operator: '-' },
  { id: 'extra3', label: '기타2', amount: 0, operator: '-' },
  { id: 'extra4', label: '기타3', amount: 0, operator: '-' },
];

const App: React.FC = () => {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Main app states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [items, setItems] = useState<BudgetItem[]>(INITIAL_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  const todayDisplay = useMemo(() => formatDate(new Date()).today, []);
  const monthKey = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [currentDate]);

  const dateDisplay = useMemo(() => formatDate(currentDate), [currentDate]);

  const totalAmount = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.operator === '+') return acc + item.amount;
      return acc - item.amount;
    }, baseAmount);
  }, [baseAmount, items]);

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) return;

    setIsVerifying(true);
    setPinError(false);
    
    try {
      const hashedInput = await sha256(pin);
      const { data, error } = await supabase
        .from('app_pin')
        .select('pin_hash')
        .eq('pin_hash', hashedInput);

      if (error) throw error;

      if (data && data.length > 0) {
        setIsAuthenticated(true);
      } else {
        setPinError(true);
        setPin('');
      }
    } catch (err) {
      console.error('PIN Verification Error:', err);
      setPinError(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const generateSummaryText = useCallback(() => {
    let text = `[${dateDisplay.month} 가계부 내역]\n`;
    text += `기준금액: ${formatCurrency(baseAmount)}\n`;
    items.forEach(item => {
      if (item.amount > 0) {
        text += `${item.operator} ${formatCurrency(item.amount)} [${item.label}]\n`;
      }
    });
    text += `------------------------\n`;
    text += `최종잔액: ${formatCurrency(totalAmount)}`;
    return text;
  }, [baseAmount, items, totalAmount, dateDisplay.month]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('monthly_money')
        .select('*')
        .eq('month', monthKey)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setBaseAmount(data.salary);
        setItems([
          { id: 'card1', label: '카드1[현대카드]', amount: data.card1, operator: '-' },
          { id: 'card2', label: '카드2[하이패스]', amount: data.card2, operator: '-' },
          { id: 'card3', label: '카드3[교통카드]', amount: data.card3, operator: '-' },
          { id: 'card4', label: '카드4[기타]', amount: data.card4, operator: '-' },
          { id: 'extra1', label: '용돈', amount: data.extra1, operator: '-' },
          { id: 'extra2', label: '기타1', amount: data.extra2, operator: '-' },
          { id: 'extra3', label: '기타2', amount: data.extra3, operator: '-' },
          { id: 'extra4', label: '기타3', amount: data.extra4, operator: '-' },
        ]);
      } else {
        setBaseAmount(0);
        setItems(INITIAL_ITEMS);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [monthKey, isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_money')
        .select('*')
        .eq('month', monthKey)
        .order('id', { ascending: false });
      
      if (data) setHistoryList(data);
      if (error) console.error('History fetch error:', error.message);
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  const saveData = async () => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const payload = {
        month: monthKey,
        salary: baseAmount,
        card1: items.find(i => i.id === 'card1')?.amount || 0,
        card2: items.find(i => i.id === 'card2')?.amount || 0,
        card3: items.find(i => i.id === 'card3')?.amount || 0,
        card4: items.find(i => i.id === 'card4')?.amount || 0,
        extra1: items.find(i => i.id === 'extra1')?.amount || 0,
        extra2: items.find(i => i.id === 'extra2')?.amount || 0,
        extra3: items.find(i => i.id === 'extra3')?.amount || 0,
        extra4: items.find(i => i.id === 'extra4')?.amount || 0,
        memo: generateSummaryText(),
      };

      const { error } = await supabase
        .from('monthly_money')
        .insert([payload]);

      if (error) throw error;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      if (showHistory) fetchHistory();
    } catch (err: any) {
      console.error('Save error details:', err.message || err);
      setSaveStatus('error');
      setErrorMessage(err.message || '저장 중 오류가 발생했습니다.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const toggleHistoryItem = (id: number) => {
    setExpandedHistoryId(expandedHistoryId === id ? null : id);
  };

  const changeMonth = (offset: number) => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(nextDate);
  };

  const handleBaseAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
    setBaseAmount(val);
  };

  const handleItemAmountChange = (id: string, value: string) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setItems(prev => prev.map(item => item.id === id ? { ...item, amount: numValue } : item));
  };

  const toggleOperator = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, operator: item.operator === '+' ? '-' : '+' } : item
    ));
  };

  const copyToClipboard = async () => {
    const text = generateSummaryText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const handleShare = async () => {
    const text = generateSummaryText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${dateDisplay.month} 가계부 내역`,
          text: text,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
      alert('공유 기능을 지원하지 않는 브라우저입니다. 내역이 클립보드에 복사되었습니다.');
    }
  };

  // Auth Screen Render (Light Theme)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-8 shadow-xl animate-fade-in text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-200">
              <i className="fa-solid fa-lock text-2xl"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-1">Security PIN Required</h1>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Authorized Access Only</p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-6">
            <div className="relative group">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className={`w-full bg-slate-50 border ${pinError ? 'border-rose-500' : 'border-slate-200 group-hover:border-indigo-500/30'} rounded-2xl py-4 text-center text-2xl tracking-[1em] text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-slate-300`}
                autoFocus
              />
              {pinError && (
                <p className="text-rose-600 text-[10px] mt-2 font-bold animate-fade-in">Invalid Security PIN</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying || !pin}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 group"
            >
              {isVerifying ? (
                <i className="fa-solid fa-circle-notch animate-spin"></i>
              ) : (
                <>
                  Verify PIN
                  <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-slate-400 text-[9px] uppercase tracking-tighter">
            © {new Date().getFullYear()} Monthly Budget Security Layer
          </p>
        </div>
      </div>
    );
  }

  // Main Dashboard Render (Light Theme)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-2 md:p-6 pb-6 text-slate-800 transition-colors duration-500">
      {/* Header */}
      <header className="w-full max-w-lg mb-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 w-full flex flex-col items-center">
          <div className="flex items-center gap-4 mb-0">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-indigo-600"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {dateDisplay.month}
            </h1>
            <button 
              onClick={() => changeMonth(1)}
              className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-indigo-600"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
          <p className="text-slate-400 text-[9px] font-medium uppercase tracking-wider">TODAY: {todayDisplay}</p>
        </div>
      </header>

      <main className={`w-full max-w-lg space-y-3 flex-1 transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Top: Base Amount (Salary) */}
        <section className="bg-indigo-600 rounded-xl shadow-md p-3 text-white relative group">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-indigo-100 text-[10px] font-medium uppercase">기준 금액 (Salary)</label>
            <div className="text-[9px] font-medium flex items-center gap-1 opacity-80">
              {saveStatus === 'saving' && <><i className="fa-solid fa-circle-notch animate-spin text-white"></i> Saving</>}
              {saveStatus === 'saved' && <><i className="fa-solid fa-circle-check text-emerald-300"></i> Saved</>}
              {saveStatus === 'error' && <><i className="fa-solid fa-circle-exclamation text-rose-300"></i> Error</>}
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={baseAmount === 0 ? '' : baseAmount.toLocaleString()}
              onChange={handleBaseAmountChange}
              placeholder="0"
              className="w-full bg-indigo-500/30 border border-indigo-400/50 rounded-lg pl-3 pr-8 py-1.5 text-xl font-bold placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-right text-white"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-100 text-base font-bold pointer-events-none">원</span>
          </div>
          {errorMessage && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-rose-500 text-white text-[10px] py-1 px-2 rounded shadow-lg z-10 animate-fade-in border border-rose-400">
              {errorMessage}
            </div>
          )}
        </section>

        {/* Middle: Items */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Expenses & Income</h2>
            <div className="flex items-center gap-10">
              <button 
                onClick={() => { setShowHistory(true); fetchHistory(); }}
                className="text-[10px] font-bold text-indigo-600 flex items-center gap-1.5 hover:text-indigo-800 transition-colors p-1"
              >
                <i className="fa-solid fa-clock-rotate-left"></i> 이력
              </button>
              <button 
                onClick={saveData}
                disabled={saveStatus === 'saving'}
                className="text-[11px] font-bold bg-emerald-50 text-emerald-600 flex items-center gap-1.5 hover:bg-emerald-100 active:scale-95 px-6 py-2.5 rounded-lg border border-emerald-100 disabled:opacity-50 transition-all shadow-sm"
              >
                <i className="fa-solid fa-floppy-disk"></i> 저장
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 animate-fade-in">
                <div className="w-28 shrink-0 font-medium text-slate-600 text-[11px] truncate">{item.label}</div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.amount === 0 ? '' : item.amount.toLocaleString()}
                    onChange={(e) => handleItemAmountChange(item.id, e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-7 py-1.5 text-right text-[13px] text-slate-800 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all placeholder-slate-300"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-medium">원</span>
                </div>
                <button
                  onClick={() => toggleOperator(item.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all shadow-sm border ${
                    item.operator === '+' 
                      ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' 
                      : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                  }`}
                >
                  {item.operator}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom: Result & Copy/Share */}
        <section className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-800">
           <div 
             onClick={() => setIsResultExpanded(!isResultExpanded)}
             className="p-5 cursor-pointer hover:bg-slate-800/40 transition-colors flex flex-col gap-1.5 relative"
           >
             <div className="font-mono text-[10px] flex justify-between items-center text-slate-500">
                <span className="uppercase tracking-widest text-[8px]">Base Amount</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(baseAmount)}</span>
             </div>
             
             {!isResultExpanded && (
               <div className="flex justify-center my-1.5">
                 <div className="h-px bg-slate-800 w-full relative">
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 text-[8px] text-slate-500 uppercase font-bold tracking-widest">Details</span>
                 </div>
               </div>
             )}

             <div className={`font-mono text-[10px] leading-relaxed overflow-hidden transition-all duration-300 ${isResultExpanded ? 'max-h-[500px] opacity-100 mt-2 border-t border-slate-800 pt-3' : 'max-h-0 opacity-0'}`}>
                {items.filter(i => i.amount > 0).map(item => (
                    <div key={item.id} className="flex justify-between items-center text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={item.operator === '+' ? 'text-blue-400 font-bold' : 'text-rose-400 font-bold'}>{item.operator}</span>
                        <span className="text-[9px] text-slate-500">[{item.label}]</span>
                      </div>
                      <span className="text-right text-slate-300">{formatCurrency(item.amount)}</span>
                    </div>
                ))}
                <div className="border-t border-slate-800 my-2.5"></div>
             </div>

             <div className="flex justify-between items-center mt-1">
                <span className="text-xs font-bold text-white tracking-tight uppercase">Total Balance</span>
                <span className={`text-xl font-black transition-colors ${totalAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(totalAmount)}
                </span>
             </div>

             <div className="absolute top-2 right-2.5 text-slate-600">
               <i className={`fa-solid fa-chevron-${isResultExpanded ? 'up' : 'down'} text-[8px]`}></i>
             </div>
           </div>

           <div className="px-5 pb-5 flex gap-3">
             <button
               onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
               className="flex-1 bg-white/10 text-white/90 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 hover:bg-white/20 active:scale-[0.98] transition-all border border-white/10 uppercase tracking-widest"
             >
               {copyFeedback ? (
                 <>
                   <i className="fa-solid fa-check text-emerald-400"></i>
                   Copied
                 </>
               ) : (
                 <>
                   <i className="fa-solid fa-copy"></i>
                   Copy
                 </>
               )}
             </button>
             <button
               onClick={(e) => { e.stopPropagation(); handleShare(); }}
               className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-500 active:scale-[0.98] transition-all border border-indigo-500 uppercase tracking-widest shadow-lg shadow-indigo-900/20"
             >
               <i className="fa-solid fa-share-nodes"></i>
               Share
             </button>
           </div>
        </section>
      </main>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-2">
          <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] border-x border-t border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-slate-800 font-bold text-sm flex items-center gap-2 uppercase tracking-wider">
                <i className="fa-solid fa-clock-rotate-left text-indigo-600"></i>
                Save History ({dateDisplay.month})
              </h3>
              <button 
                onClick={() => setShowHistory(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyList.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-3">
                  <i className="fa-solid fa-ghost text-3xl opacity-10"></i>
                  저장된 이력이 없습니다.
                </div>
              ) : (
                historyList.map((entry) => (
                  <div 
                    key={entry.id}
                    onClick={() => toggleHistoryItem(entry.id)}
                    className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-indigo-500/50 hover:bg-white transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{entry.id} | {new Date(entry.created_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <i className={`fa-solid fa-chevron-${expandedHistoryId === entry.id ? 'up' : 'down'} text-[8px] text-slate-400`}></i>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-[11px] text-slate-600">
                        Salary: <span className="font-bold text-slate-800">{formatCurrency(entry.salary)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">Balance</div>
                        <div className="text-sm font-black text-emerald-600">
                          {formatCurrency(entry.salary - (entry.card1 || 0) - (entry.card2 || 0) - (entry.card3 || 0) - (entry.card4 || 0) - (entry.extra1 || 0) - (entry.extra2 || 0) - (entry.extra3 || 0) - (entry.extra4 || 0))}
                        </div>
                      </div>
                    </div>

                    {expandedHistoryId === entry.id && (
                      <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 animate-fade-in shadow-inner">
                        <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">
                          {entry.memo}
                        </pre>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(entry.memo);
                            alert('복사되었습니다.');
                          }}
                          className="mt-3 w-full py-2 text-[8px] font-bold text-indigo-600 border border-indigo-200 rounded-lg uppercase tracking-widest hover:bg-indigo-50 transition-colors"
                        >
                          Copy Detail
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-5 bg-slate-50 border-t border-slate-100">
               <p className="text-[9px] text-slate-400 text-center uppercase tracking-[0.2em] font-medium">Cloud Synced Financial History</p>
            </div>
          </div>
        </div>
      )}

      <footer className="w-full max-w-lg text-center mt-4 text-slate-400 text-[8px] uppercase tracking-widest">
        <p>© {new Date().getFullYear()} Monthly Budget. Built for Efficiency</p>
      </footer>
    </div>
  );
};

export default App;
