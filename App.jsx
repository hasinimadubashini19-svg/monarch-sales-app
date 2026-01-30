import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, enableIndexedDbPersistence 
} from 'firebase/firestore';
import { 
  LayoutDashboard, Store, ShoppingBag, History, Settings, 
  Plus, Minus, Trash2, Send, Calendar, Sun, Moon, Briefcase, User, Wallet, TrendingUp
} from 'lucide-react';

// Offline Support
try { enableIndexedDbPersistence(db); } catch (err) { console.log("Offline mode active"); }

const App = () => {
  const [activeTab, setActiveTab] = useState('dash');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchDate, setSearchDate] = useState(new Date().toLocaleDateString());
  const [data, setData] = useState({ shops: [], brands: [], orders: [], expenses: [], routes: [] });
  const [profile, setProfile] = useState({ 
    repName: localStorage.getItem('repName') || 'Sales Rep', 
    company: localStorage.getItem('company') || 'Pepsi Company' 
  });
  const [orderForm, setOrderForm] = useState({ shop: '', items: {} });
  const [expAmount, setExpAmount] = useState('');

  useEffect(() => {
    const collections = ['shops', 'brands', 'orders', 'expenses', 'routes'];
    const unsubscribes = collections.map(col => 
      onSnapshot(query(collection(db, col)), (snap) => {
        setData(prev => ({ ...prev, [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      })
    );
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // --- Logic & Stats ---
  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString();
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();

    const getStats = (orderList) => {
      let total = 0;
      let bStats = {};
      orderList.forEach(o => {
        total += (o.total || 0);
        o.items?.forEach(i => {
          if (!bStats[i.name]) bStats[i.name] = { units: 0, rev: 0 };
          bStats[i.name].units += Number(i.qty);
          bStats[i.name].rev += Number(i.subtotal);
        });
      });
      return { total, bStats };
    };

    const todayOrders = data.orders.filter(o => o.date === today);
    const monthOrders = data.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });

    const dayResults = getStats(todayOrders);
    const monthResults = getStats(monthOrders);
    const todayExp = data.expenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0);

    // Top Selling Brand
    const topBrand = Object.entries(monthResults.bStats).sort((a,b) => b[1].units - a[1].units)[0]?.[0] || 'N/A';

    return { dayResults, monthResults, todayExp, topBrand };
  }, [data]);

  // --- Actions ---
  const saveOrder = async () => {
    if (!orderForm.shop) return alert("Select Shop");
    const items = Object.entries(orderForm.items).filter(([_, q]) => q > 0).map(([n, q]) => {
      const b = data.brands.find(x => x.name === n);
      return { name: n, qty: q, subtotal: q * b.price };
    });
    if (items.length === 0) return alert("Add items");
    await addDoc(collection(db, 'orders'), {
      shopName: orderForm.shop, items, total: items.reduce((s, i) => s + i.subtotal, 0),
      date: new Date().toLocaleDateString(), rep: profile.repName
    });
    setOrderForm({ shop: '', items: {} });
    setActiveTab('history');
  };

  const addExpense = async () => {
    if (!expAmount) return;
    await addDoc(collection(db, 'expenses'), { amount: Number(expAmount), date: new Date().toLocaleDateString() });
    setExpAmount('');
  };

  const shareWhatsApp = (o) => {
    const text = `*${profile.company}*\n*Rep:* ${profile.repName}\n*Shop:* ${o.shopName}\n---\n` + 
      o.items.map(i => `${i.name} x ${i.qty} = ${i.subtotal}`).join('\n') + `\n---\n*Total: Rs.${o.total}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  // --- UI Helpers ---
  const theme = isDarkMode ? "bg-[#050505] text-white" : "bg-gray-100 text-gray-900";
  const card = isDarkMode ? "bg-[#0f0f0f] border-white/5" : "bg-white border-gray-200 shadow-sm";

  return (
    <div className={`min-h-screen pb-32 transition-all duration-500 ${theme}`}>
      {/* Header */}
      <div className="p-6 flex justify-between items-center">
        <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#d4af37] to-[#f9e29c] rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Briefcase size={20} className="text-black"/>
          </div>
          MONARCH <span className="text-[#d4af37]">PRO</span>
        </h1>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-2xl ${card} border`}>
          {isDarkMode ? <Sun size={20} className="text-yellow-500"/> : <Moon size={20}/>}
        </button>
      </div>

      <div className="px-5 space-y-6">
        {/* DASHBOARD */}
        {activeTab === 'dash' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
            <div className="grid grid-cols-2 gap-4">
              <div className={`${card} p-5 rounded-[2rem] border`}>
                <p className="text-[10px] font-black opacity-40 uppercase">Today Sales</p>
                <h2 className="text-xl font-black">Rs.{stats.dayResults.total}</h2>
              </div>
              <div className={`${card} p-5 rounded-[2rem] border`}>
                <p className="text-[10px] font-black opacity-40 uppercase">Net (After Exp)</p>
                <h2 className="text-xl font-black text-green-500">Rs.{stats.dayResults.total - stats.todayExp}</h2>
              </div>
            </div>

            <div className={`${card} p-6 rounded-[2.5rem] border relative overflow-hidden`}>
              <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={60}/></div>
              <h3 className="text-[10px] font-black uppercase text-[#d4af37] mb-4">Monthly Summary</h3>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-black">Rs.{stats.monthResults.total}</p>
                  <p className="text-[10px] opacity-40">Total Sales This Month</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-yellow-500 uppercase">{stats.topBrand}</p>
                  <p className="text-[9px] opacity-40 uppercase">Top Selling Brand</p>
                </div>
              </div>
            </div>

            {/* Daily Brand Breakdown */}
            <div className={`${card} p-6 rounded-[2.5rem] border`}>
              <h3 className="text-xs font-black uppercase mb-4 text-[#d4af37] flex items-center gap-2">
                <ShoppingBag size={14}/> Today Brand Stats
              </h3>
              <div className="space-y-4">
                {Object.entries(stats.dayResults.bStats).map(([name, s]) => (
                  <div key={name} className="flex justify-between items-center border-b border-white/5 pb-2">
                    <div>
                      <p className="text-xs font-bold uppercase">{name}</p>
                      <p className="text-[10px] opacity-40">{s.units} Units</p>
                    </div>
                    <p className="font-black text-xs">Rs.{s.rev}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ORDER SECTION */}
        {activeTab === 'shops' && (
          <div className="space-y-4 animate-in fade-in">
            <select className={`w-full p-5 rounded-2xl border outline-none font-bold text-xs uppercase ${card}`}
              onChange={(e) => setOrderForm({...orderForm, shop: e.target.value})}>
              <option value="">Select Shop</option>
              {data.shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div className="space-y-3">
              {data.brands.map(b => (
                <div key={b.id} className={`${card} p-4 rounded-3xl border flex justify-between items-center`}>
                  <div className="w-1/3"><h4 className="text-xs font-black uppercase">{b.name}</h4></div>
                  <div className="flex items-center bg-black/20 rounded-full p-1 border border-white/5">
                    <button onClick={() => setOrderForm(p => ({...p, items: {...p.items, [b.name]: Math.max(0, (p.items[b.name]||0)-1)}}))}
                      className="p-2 text-red-500"><Minus size={16}/></button>
                    <input type="number" className="w-12 bg-transparent text-center font-black text-sm outline-none"
                      value={orderForm.items[b.name] || 0}
                      onChange={(e) => setOrderForm(p => ({...p, items: {...p.items, [b.name]: parseInt(e.target.value)||0}}))}/>
                    <button onClick={() => setOrderForm(p => ({...p, items: {...p.items, [b.name]: (p.items[b.name]||0)+1}}))}
                      className="p-2 text-green-500"><Plus size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveOrder} className="w-full bg-[#d4af37] text-black font-black py-5 rounded-3xl shadow-xl">SAVE & PRINT</button>
          </div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in">
            <div className={`${card} p-4 rounded-2xl border flex items-center gap-3`}>
              <Calendar size={18} className="text-[#d4af37]"/>
              <input type="date" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                className="bg-transparent outline-none w-full font-bold text-xs"
                onChange={(e) => { if(e.target.value) { const [y,m,d] = e.target.value.split('-'); setSearchDate(`${parseInt(m)}/${parseInt(d)}/${y}`); } }}/>
            </div>
            {data.orders.filter(o => o.date === searchDate).reverse().map(o => (
              <div key={o.id} className={`${card} p-5 rounded-[2.2rem] border`}>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-xs font-black text-[#d4af37]">{o.shopName}</h4>
                  <div className="flex gap-4">
                    <button onClick={() => deleteDoc(doc(db, 'orders', o.id))} className="text-red-500/30"><Trash2 size={16}/></button>
                    <button onClick={() => shareWhatsApp(o)} className="text-green-500"><Send size={16}/></button>
                  </div>
                </div>
                {o.items.map((i, k) => <p key={k} className="text-[10px] opacity-40 uppercase">▪ {i.name} x {i.qty} = {i.subtotal}</p>)}
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between font-black"><span className="text-xs">TOTAL</span><span>Rs.{o.total}</span></div>
              </div>
            ))}
          </div>
        )}

        {/* SETUP / PROFILE */}
        {activeTab === 'setup' && (
          <div className="space-y-6 animate-in fade-in">
            <div className={`${card} p-6 rounded-[2.5rem] border space-y-4`}>
              <p className="text-xs font-black text-[#d4af37] uppercase flex items-center gap-2"><User size={14}/> Profile</p>
              <input placeholder="Rep Name" className="w-full bg-transparent border-b border-white/10 p-2 outline-none text-sm"
                value={profile.repName} onChange={(e) => {setProfile({...profile, repName: e.target.value}); localStorage.setItem('repName', e.target.value);}}/>
              <input placeholder="Company Name" className="w-full bg-transparent border-b border-white/10 p-2 outline-none text-sm"
                value={profile.company} onChange={(e) => {setProfile({...profile, company: e.target.value}); localStorage.setItem('company', e.target.value);}}/>
            </div>

            <div className={`${card} p-6 rounded-[2.5rem] border space-y-4`}>
              <p className="text-xs font-black text-red-500 uppercase flex items-center gap-2"><Wallet size={14}/> Today Expense</p>
              <div className="flex gap-2">
                <input type="number" placeholder="Amount" className="flex-1 bg-transparent border-b border-white/10 p-2 outline-none text-sm"
                  value={expAmount} onChange={(e) => setExpAmount(e.target.value)}/>
                <button onClick={addExpense} className="bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold">ADD</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature & Nav */}
      <div className="fixed bottom-24 w-full text-center pointer-events-none">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-20">for my love</p>
      </div>

      <div className={`fixed bottom-8 left-6 right-6 h-20 rounded-[2.5rem] border flex items-center justify-around px-2 shadow-2xl ${card} backdrop-blur-xl`}>
        {[
          { id: 'dash', icon: LayoutDashboard },
          { id: 'shops', icon: Store },
          { id: 'history', icon: History },
          { id: 'setup', icon: Settings }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`p-4 rounded-2xl transition-all duration-300 ${activeTab === t.id ? 'bg-[#d4af37] text-black scale-110 shadow-lg shadow-yellow-500/20' : 'opacity-30'}`}>
            <t.icon size={22} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
