import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; // ඔයාගේ firebase config එක
import { 
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, enableIndexedDbPersistence 
} from 'firebase/firestore';
import { 
  LayoutDashboard, Store, ShoppingBag, History, Settings, 
  Plus, Minus, Trash2, Send, Calendar, Sun, Moon, Briefcase, User
} from 'lucide-react';

// Offline Persistence (Internet නැතිව වැඩ කිරීමට)
try {
  enableIndexedDbPersistence(db);
} catch (err) {
  console.log("Persistence failed");
}

const App = () => {
  // --- States ---
  const [activeTab, setActiveTab] = useState('dash');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchDate, setSearchDate] = useState(new Date().toLocaleDateString());
  const [data, setData] = useState({ shops: [], brands: [], orders: [], expenses: [], routes: [] });
  const [profile, setProfile] = useState({ 
    repName: localStorage.getItem('repName') || 'Sales Rep', 
    company: localStorage.getItem('company') || 'My Company' 
  });

  // Order Form State
  const [orderForm, setOrderForm] = useState({ shop: '', items: {} });

  // --- Real-time Data Fetching ---
  useEffect(() => {
    const collections = ['shops', 'brands', 'orders', 'expenses', 'routes'];
    const unsubscribes = collections.map(col => 
      onSnapshot(query(collection(db, col)), (snap) => {
        setData(prev => ({ ...prev, [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      })
    );
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // --- Calculations ---
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const todayOrders = data.orders.filter(o => o.date === todayStr);
    const monthOrders = data.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const calcTotal = (orders) => orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Brand wise Breakdown
    const getBrandStats = (orders) => {
      const bStats = {};
      orders.forEach(o => {
        o.items?.forEach(i => {
          if (!bStats[i.name]) bStats[i.name] = { units: 0, revenue: 0 };
          bStats[i.name].units += Number(i.qty);
          bStats[i.name].revenue += Number(i.subtotal);
        });
      });
      return bStats;
    };

    return {
      todaySales: calcTotal(todayOrders),
      monthSales: calcTotal(monthOrders),
      todayExpenses: data.expenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + (e.amount || 0), 0),
      todayBrandStats: getBrandStats(todayOrders),
      monthBrandStats: getBrandStats(monthOrders)
    };
  }, [data, searchDate]);

  // --- Actions ---
  const saveOrder = async () => {
    if (!orderForm.shop) return alert("Select Shop");
    const items = Object.entries(orderForm.items)
      .filter(([_, qty]) => qty > 0)
      .map(([name, qty]) => {
        const brand = data.brands.find(b => b.name === name);
        return { name, qty, subtotal: qty * brand.price };
      });

    const total = items.reduce((sum, i) => sum + i.subtotal, 0);
    await addDoc(collection(db, 'orders'), {
      shopName: orderForm.shop,
      items,
      total,
      date: new Date().toLocaleDateString(),
      status: 'PAID',
      rep: profile.repName
    });
    setOrderForm({ shop: '', items: {} });
    setActiveTab('history');
  };

  const shareWhatsApp = (order) => {
    const text = `*${profile.company}*\n*Rep:* ${profile.repName}\n*Shop:* ${order.shopName}\n----------\n` + 
      order.items.map(i => `${i.name} x ${i.qty} = ${i.subtotal}`).join('\n') + 
      `\n----------\n*Total: Rs.${order.total}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const deleteItem = async (col, id) => {
    if(window.confirm("Delete this record?")) await deleteDoc(doc(db, col, id));
  };

  // --- Styles ---
  const theme = isDarkMode 
    ? "bg-black text-white" 
    : "bg-gray-50 text-gray-900";
  const card = isDarkMode ? "bg-[#0f0f0f] border-white/5" : "bg-white border-gray-200 shadow-sm";

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-500 font-sans ${theme}`}>
      
      {/* Header & Mode Toggle */}
      <div className="p-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 bg-[#d4af37] rounded-lg flex items-center justify-center">
              <Briefcase size={18} className="text-black"/>
            </div>
            MONARCH <span className="text-[#d4af37]">PRO</span>
          </h1>
        </div>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full ${card}`}>
          {isDarkMode ? <Sun size={20} className="text-yellow-500"/> : <Moon size={20}/>}
        </button>
      </div>

      <div className="px-6 space-y-6">
        
        {/* --- DASHBOARD TAB --- */}
        {activeTab === 'dash' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-2 gap-3">
              <div className={`${card} p-4 rounded-3xl border`}>
                <p className="text-[10px] uppercase font-black opacity-40">Today Sales</p>
                <h2 className="text-lg font-black">Rs.{stats.todaySales}</h2>
              </div>
              <div className={`${card} p-4 rounded-3xl border`}>
                <p className="text-[10px] uppercase font-black opacity-40">Month Sales</p>
                <h2 className="text-lg font-black">Rs.{stats.monthSales}</h2>
              </div>
            </div>

            {/* Today Brand Breakdown */}
            <div className={`${card} p-5 rounded-[2.5rem] border`}>
              <h3 className="text-xs font-black uppercase mb-4 text-[#d4af37]">Today Brand Summary</h3>
              <div className="space-y-3">
                {Object.entries(stats.todayBrandStats).map(([name, s]) => (
                  <div key={name} className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold uppercase">{name}</p>
                      <p className="text-[10px] opacity-40">{s.units} Units Sold</p>
                    </div>
                    <p className="font-black text-xs">Rs.{s.revenue}</p>
                  </div>
                ))}
                {Object.keys(stats.todayBrandStats).length === 0 && <p className="text-[10px] opacity-20 italic">No sales today</p>}
              </div>
            </div>
          </div>
        )}

        {/* --- SHOPS / ORDER TAB --- */}
        {activeTab === 'shops' && (
          <div className="space-y-4 animate-in fade-in">
            <select 
              className={`w-full p-4 rounded-2xl border outline-none font-bold text-xs uppercase ${card}`}
              onChange={(e) => setOrderForm({...orderForm, shop: e.target.value})}
            >
              <option value="">Select Shop</option>
              {data.shops.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>

            <div className="space-y-3">
              {data.brands.map(b => (
                <div key={b.id} className={`${card} p-4 rounded-3xl border flex justify-between items-center`}>
                  <div>
                    <h4 className="text-xs font-black uppercase">{b.name}</h4>
                    <p className="text-[10px] opacity-40">Rs.{b.price}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setOrderForm(prev => ({...prev, items: {...prev.items, [b.name]: Math.max(0, (prev.items[b.name]||0) - 1)}}))}
                      className="p-2 bg-red-500/10 text-red-500 rounded-full"><Minus size={14}/>
                    </button>
                    <input 
                      type="number"
                      className="w-12 bg-transparent text-center font-black text-sm outline-none"
                      value={orderForm.items[b.name] || 0}
                      onChange={(e) => setOrderForm(prev => ({...prev, items: {...prev.items, [b.name]: parseInt(e.target.value) || 0}}))}
                    />
                    <button 
                      onClick={() => setOrderForm(prev => ({...prev, items: {...prev.items, [b.name]: (prev.items[b.name]||0) + 1}}))}
                      className="p-2 bg-green-500/10 text-green-500 rounded-full"><Plus size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveOrder} className="w-full bg-[#d4af37] text-black font-black py-4 rounded-2xl shadow-xl shadow-yellow-500/10">SAVE ORDER</button>
          </div>
        )}

        {/* --- HISTORY TAB (Calendar Fix Included) --- */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in">
            <div className={`${card} p-4 rounded-2xl border flex items-center gap-3`}>
              <Calendar size={18} className="text-[#d4af37]"/>
              <input 
                type="date" 
                style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                className="bg-transparent outline-none w-full font-bold text-xs uppercase"
                onChange={(e) => {
                   if(e.target.value) {
                     const [y, m, d] = e.target.value.split('-');
                     setSearchDate(`${parseInt(m)}/${parseInt(d)}/${y}`);
                   }
                }}
              />
            </div>
            <p className="text-[10px] font-black opacity-20 uppercase px-2">History For: {searchDate}</p>
            {data.orders.filter(o => o.date === searchDate).map(o => (
              <div key={o.id} className={`${card} p-5 rounded-[2rem] border`}>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-xs font-black uppercase text-[#d4af37]">{o.shopName}</h4>
                  <div className="flex gap-2">
                    <button onClick={() => deleteItem('orders', o.id)} className="text-red-500/20"><Trash2 size={14}/></button>
                    <button onClick={() => shareWhatsApp(o)} className="text-green-500"><Send size={14}/></button>
                  </div>
                </div>
                {o.items.map((i, k) => <p key={k} className="text-[10px] opacity-50 uppercase">▪ {i.name} x {i.qty} = {i.subtotal}</p>)}
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between font-black">
                  <span className="text-[10px]">TOTAL</span>
                  <span className="text-sm">Rs.{o.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- PROFILE / SETUP --- */}
        {activeTab === 'setup' && (
          <div className="space-y-6 animate-in fade-in">
             <div className={`${card} p-6 rounded-[2.5rem] border space-y-4`}>
                <h3 className="text-xs font-black uppercase text-[#d4af37]">Profile Settings</h3>
                <input 
                  placeholder="Rep Name" 
                  className="w-full bg-transparent border-b border-white/10 p-2 outline-none text-sm"
                  value={profile.repName}
                  onChange={(e) => { setProfile({...profile, repName: e.target.value}); localStorage.setItem('repName', e.target.value); }}
                />
                <input 
                  placeholder="Company Name" 
                  className="w-full bg-transparent border-b border-white/10 p-2 outline-none text-sm"
                  value={profile.company}
                  onChange={(e) => { setProfile({...profile, company: e.target.value}); localStorage.setItem('company', e.target.value); }}
                />
             </div>
             {/* Shops & Brands management sections can be added here similar to above */}
          </div>
        )}

      </div>

      {/* Footer Branding */}
      <div className="fixed bottom-20 w-full text-center opacity-10 py-4">
        <p className="text-[8px] font-black uppercase tracking-[0.2em]">for my love</p>
      </div>

      {/* Bottom Navigation */}
      <div className={`fixed bottom-6 left-6 right-6 h-16 rounded-full border flex items-center justify-around px-4 shadow-2xl ${card} backdrop-blur-lg`}>
        {[
          { id: 'dash', icon: LayoutDashboard },
          { id: 'shops', icon: Store },
          { id: 'history', icon: History },
          { id: 'setup', icon: Settings }
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`p-3 rounded-full transition-all ${activeTab === t.id ? 'bg-[#d4af37] text-black scale-110' : 'opacity-40'}`}
          >
            <t.icon size={20} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
