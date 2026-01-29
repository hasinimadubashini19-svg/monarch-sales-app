import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc, updateDoc, query, orderBy, where, enableIndexedDbPersistence } from 'firebase/firestore';
import { LayoutDashboard, Store, FileText, Plus, X, Trash2, Crown, Settings, LogOut, Search, UserCircle, Send, MapPin, Edit3 } from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyA7vsja2a74dFZj1qdItzq2k6kWocXBvTU",
  authDomain: "monarch-sales.firebaseapp.com",
  projectId: "monarch-sales",
  storageBucket: "monarch-sales.firebasestorage.app",
  messagingSenderId: "1011640493770",
  appId: "1:1011640493770:web:93b0f64719c77f16897633",
  measurementId: "G-CVZ5B22GYC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 1. OFFLINE SUPPORT ENABLE (සිග්නල් නැති වෙලාවට වැඩ කරන්න)
try {
  enableIndexedDbPersistence(db);
} catch (err) {
  console.warn("Persistence failed:", err.code);
}

const appId = 'sales-monarch-pro-v3'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState({ routes: [], shops: [], orders: [], expenses: [], brands: [], settings: [] });
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [selectedShop, setSelectedShop] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setTimeout(() => setLoading(false), 1500); });
    return unsub;
  }, []);

  // 2. DATA LOADING WITH PRIVACY & ORDERING (User ID එක අනුව සහ දාපු පිළිවෙළට)
  useEffect(() => {
    if (!user) return;
    const cols = ['routes', 'shops', 'orders', 'expenses', 'brands', 'settings'];
    const unsubs = cols.map(c => {
      // මෙතන orderBy("timestamp", "asc") දාලා තියෙන්නේ ඔයා දාන පිළිවෙළටම පේන්න
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', c), 
        where("userId", "==", user.uid), 
        orderBy("timestamp", "asc")
      );
      return onSnapshot(q, s => setData(prev => ({ ...prev, [c]: s.docs.map(d => ({ id: d.id, ...d.data() })) })));
    });
    return () => unsubs.forEach(f => f());
  }, [user]);

  const addItem = async (col, payload) => { 
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', col), { 
      ...payload, 
      userId: user.uid, // අයිතිකරු හඳුනාගැනීමට
      date: new Date().toLocaleDateString(), 
      timestamp: Date.now() 
    }); 
    setShowModal(null); 
  };

  const deleteItem = async (col, id) => { 
    if(confirm("Are you sure?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id)); 
  };

  const submitOrder = async () => {
    const items = Object.entries(cart).filter(([_, qty]) => qty > 0).map(([id, qty]) => {
      const b = data.brands.find(x => x.id === id);
      return { name: b.name, size: b.size, price: b.price, qty, subtotal: b.price * qty };
    });
    if (items.length === 0) return alert("Cart is empty!");
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const orderData = { 
        userId: user.uid,
        shopId: selectedShop.id, 
        shopName: selectedShop.name, 
        items, 
        total, 
        date: new Date().toLocaleDateString(), 
        timestamp: Date.now() 
    };
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderData);
    setLastOrder({ id: docRef.id, ...orderData });
    setCart({}); setShowModal('receipt');
  };

  const shareWhatsApp = (order) => {
    let msg = `*MONARCH SALES RECEIPT*%0A--------------------------%0A*Shop:* ${order.shopName}%0A*Date:* ${order.date}%0A--------------------------%0A`;
    order.items.forEach(i => msg += `${i.name} (${i.size}) x ${i.qty} = ${i.subtotal.toFixed(2)}%0A`);
    msg += `--------------------------%0A*TOTAL: Rs.${order.total.toFixed(2)}*%0AThank You!`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const repProfile = data.settings.find(s => s.type === 'rep') || { name: 'New Rep' };
  const todayOrders = useMemo(() => data.orders.filter(o => o.date === new Date().toLocaleDateString()), [data.orders]);
  
  const brandSummary = useMemo(() => {
    const summary = {};
    todayOrders.forEach(order => order.items.forEach(item => {
      const key = `${item.name} (${item.size})`;
      if (!summary[key]) summary[key] = { qty: 0, total: 0 };
      summary[key].qty += item.qty;
      summary[key].total += item.subtotal;
    }));
    return Object.entries(summary);
  }, [todayOrders]);

  if (loading) return <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#d4af37] font-black animate-pulse"><Crown size={64} className="mb-4" />LOADING MONARCH...</div>;

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#0f0f0f] p-10 rounded-[3rem] border border-white/5 text-center shadow-2xl">
        <Crown className="text-[#d4af37] mx-auto mb-4" size={48} />
        <h1 className="text-2xl font-black italic text-white mb-8 tracking-tighter uppercase">Monarch</h1>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try { 
            if (authMode === 'login') await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
            else await createUserWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
          } catch (err) { alert(err.message); }
        }} className="space-y-4">
          <input name="email" type="email" placeholder="Email" className="w-full bg-black p-4 rounded-2xl border border-white/5 outline-none text-white text-sm" required />
          <input name="password" type="password" placeholder="Password" className="w-full bg-black p-4 rounded-2xl border border-white/5 outline-none text-white text-sm" required />
          <button className="w-full py-4 bg-[#d4af37] text-black font-black rounded-2xl uppercase tracking-widest text-[10px] mt-4 shadow-lg shadow-[#d4af37]/20">{authMode === 'login' ? 'Sign In' : 'Register'}</button>
        </form>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="mt-6 text-[9px] text-white/30 uppercase font-bold tracking-widest underline decoration-dotted">{authMode === 'login' ? "Create Account" : "Back to Login"}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <header className="p-6 flex justify-between items-center border-b border-white/5 sticky top-0 bg-black/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2"><Crown className="text-[#d4af37]" size={20}/><h1 className="text-lg font-black italic tracking-tight">MONARCH</h1></div>
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-black uppercase text-[#d4af37] bg-[#d4af37]/10 px-3 py-1 rounded-full">{repProfile.name}</span>
          <button onClick={() => signOut(auth)} className="p-2 text-red-500 bg-red-500/10 rounded-full"><LogOut size={16}/></button>
        </div>
      </header>

      <main className="p-6 max-w-lg mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Today's Revenue</p>
                <p className="text-xl font-black text-[#d4af37]">Rs.{todayOrders.reduce((s,o)=>s+o.total,0).toFixed(2)}</p>
              </div>
              <div className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Total Expenses</p>
                <p className="text-xl font-black text-red-500">Rs.{data.expenses.filter(e => e.date === new Date().toLocaleDateString()).reduce((s,e)=>s+Number(e.amount),0).toFixed(2)}</p>
              </div>
            </div>

            <section className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
              <h3 className="text-[10px] font-black text-[#d4af37] uppercase mb-4 tracking-[0.2em] flex items-center gap-2"><FileText size={14}/> Daily Item Summary</h3>
              <div className="space-y-3">
                {brandSummary.length === 0 && <p className="text-[9px] text-white/10 italic text-center py-4">No item sales recorded today</p>}
                {brandSummary.map(([name, stats], idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-bold text-white/70 uppercase">{name}</span>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-[#d4af37]">{stats.qty} Bottles</span>
                      <p className="text-[8px] text-white/20 font-bold uppercase tracking-tighter">Value: Rs.{stats.total.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
              <h3 className="text-[10px] font-black text-white/40 uppercase mb-4 tracking-[0.2em]">Live Transaction Log</h3>
              <div className="space-y-4">
                {todayOrders.map((order, idx) => (
                  <div key={idx} className="border-b border-white/5 pb-4 last:border-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase text-[#d4af37]">{order.shopName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black">Rs.{order.total.toFixed(2)}</span>
                        <button onClick={() => deleteItem('orders', order.id)} className="text-red-500/20"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    {order.items.map((item, i) => (
                      <p key={i} className="text-[8px] text-white/30 uppercase font-bold tracking-tight">• {item.name} ({item.size}) x {item.qty} = Rs.{item.subtotal.toFixed(2)}</p>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'shops' && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
              <button onClick={() => setSelectedRouteId(null)} className={`px-6 py-3 rounded-full border text-[9px] font-black uppercase transition-all ${!selectedRouteId ? 'bg-[#d4af37] border-[#d4af37] text-black' : 'border-white/10 text-white/40'}`}>All Routes</button>
              {data.routes.map(r => (
                <button key={r.id} onClick={() => setSelectedRouteId(r.id)} className={`px-6 py-3 rounded-full border text-[9px] font-black uppercase transition-all ${selectedRouteId === r.id ? 'bg-[#d4af37] border-[#d4af37] text-black' : 'border-white/10 text-white/40'}`}>{r.name}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-[#0f0f0f] border border-white/5 rounded-2xl px-4 flex items-center gap-3"><Search size={14} className="text-white/20"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search shop..." className="bg-transparent w-full py-4 text-xs outline-none text-white uppercase font-bold"/></div>
              <button onClick={()=>setShowModal('shop')} className="bg-[#d4af37] px-4 rounded-2xl text-black"><Plus/></button>
            </div>
            {data.shops.filter(s=> (!selectedRouteId || s.routeId === selectedRouteId) && s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
              <div key={s.id} className="bg-[#0f0f0f] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center group">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-tight">{s.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin size={8} className="text-white/20"/>
                    <p className="text-[8px] text-white/20 uppercase font-bold">{s.area}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => deleteItem('shops', s.id)} className="text-red-500/20 group-hover:text-red-500/50"><Trash2 size={14}/></button>
                  <button onClick={()=>{setSelectedShop(s); setShowModal('invoice');}} className="bg-[#d4af37] px-6 py-3 rounded-xl text-[9px] font-black text-black uppercase tracking-widest shadow-lg shadow-[#d4af37]/10 active:scale-95 transition-all">Billing</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <section className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
              <h3 className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest mb-4">Rep Profile</h3>
              <form onSubmit={e => { e.preventDefault(); addItem('settings', { type: 'rep', name: e.target.rep.value.toUpperCase() }) }} className="flex gap-2">
                <input name="rep" defaultValue={repProfile.name} placeholder="Rep Name" className="flex-1 bg-black p-4 rounded-2xl border border-white/5 text-xs font-bold uppercase" required />
                <button className="bg-[#d4af37] px-6 rounded-2xl text-black font-black text-[9px] uppercase">Update</button>
              </form>
            </section>

            <section className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
              <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest">Territories</h3><button onClick={()=>setShowModal('route')} className="text-[#d4af37]"><Plus size={18}/></button></div>
              <div className="grid grid-cols-2 gap-2">
                {data.routes.map(r => (
                  <div key={r.id} className="bg-black/40 p-3 rounded-2xl flex justify-between items-center border border-white/5">
                    <span className="text-[9px] font-black uppercase">{r.name}</span>
                    <button onClick={()=>deleteItem('routes', r.id)} className="text-red-500/20"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
              <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest">Inventory List</h3><button onClick={()=>setShowModal('brand')} className="text-[#d4af37]"><Plus size={18}/></button></div>
              <div className="space-y-3">
                {data.brands.map(b => (
                  <div key={b.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                    <div><span className="text-[10px] font-bold uppercase">{b.name}</span><p className="text-[8px] text-white/20 font-black">{b.size} • Rs.{b.price.toFixed(2)}</p></div>
                    <button onClick={()=>deleteItem('brands', b.id)} className="text-red-500/20"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#0f0f0f] p-6 rounded-[2.5rem] border border-white/5">
              <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Expenditure Log</h3><button onClick={()=>setShowModal('expense')} className="text-red-500"><Plus size={18}/></button></div>
              <div className="space-y-3">
                {data.expenses.map(e => (
                  <div key={e.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                    <div><span className="text-[10px] font-bold uppercase">{e.reason}</span><p className="text-[8px] text-white/20 font-black">{e.date} • Rs.{Number(e.amount).toFixed(2)}</p></div>
                    <button onClick={()=>deleteItem('expenses', e.id)} className="text-red-500/20"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      <nav className="fixed bottom-8 inset-x-8 h-20 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] flex items-center justify-around z-50 shadow-2xl">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dash' },
          { id: 'shops', icon: Store, label: 'Shops' },
          { id: 'settings', icon: Settings, label: 'Setup' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-[#d4af37] scale-110' : 'text-white/10'}`}>
            <tab.icon size={20}/><span className="text-[7px] font-black uppercase">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* BILLING MODAL */}
      {showModal === 'invoice' && (
        <div className="fixed inset-0 bg-black z-[100] p-6 overflow-y-auto animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-8 sticky top-0 bg-black pb-4 z-10">
            <div><h2 className="text-xl font-black italic tracking-tighter uppercase">Cart Selection</h2><p className="text-[9px] text-[#d4af37] font-black uppercase tracking-[0.2em]">{selectedShop?.name}</p></div>
            <button onClick={()=>setShowModal(null)} className="p-3 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="space-y-3 pb-40">
            {data.brands.map(brand => (
              <div key={brand.id} className="bg-[#0f0f0f] p-5 rounded-[2rem] border border-white/5 flex items-center justify-between">
                <div><p className="text-[11px] font-black uppercase tracking-tight">{brand.name}</p><p className="text-[9px] text-white/20 font-bold">Rs.{brand.price.toFixed(2)} | {brand.size}</p></div>
                <div className="flex items-center gap-4 bg-black p-2 rounded-2xl border border-white/5">
                  <button onClick={()=>setCart({...cart, [brand.id]: Math.max(0, (cart[brand.id]||0)-1)})} className="w-10 h-10 text-[#d4af37] font-black text-xl">-</button>
                  <span className="text-xs font-black w-6 text-center">{cart[brand.id]||0}</span>
                  <button onClick={()=>setCart({...cart, [brand.id]: (cart[brand.id]||0)+1})} className="w-10 h-10 text-[#d4af37] font-black text-xl">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="fixed bottom-0 inset-x-0 p-8 bg-black/95 backdrop-blur-xl border-t border-white/5">
            <div className="flex justify-between items-center mb-6"><span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Total Amount</span><span className="text-2xl font-black text-[#d4af37]">Rs.{Object.entries(cart).reduce((sum, [id, qty]) => sum + (data.brands.find(b=>b.id===id)?.price||0)*qty, 0).toFixed(2)}</span></div>
            <button onClick={submitOrder} className="w-full py-5 bg-[#d4af37] text-black font-black rounded-[1.5rem] uppercase text-[10px] tracking-widest shadow-xl shadow-[#d4af37]/20 active:scale-95 transition-all">Generate Invoice</button>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {showModal === 'receipt' && lastOrder && (
        <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in duration-300">
          <div className="bg-[#0f0f0f] w-full max-w-sm p-8 rounded-[3rem] border border-[#d4af37]/30 shadow-2xl relative">
            <div className="text-center mb-6">
              <Crown className="text-[#d4af37] mx-auto mb-2" size={32}/>
              <h3 className="font-black italic text-[#d4af37] uppercase tracking-tighter">Order Success</h3>
              <p className="text-[8px] text-white/20 uppercase font-black mt-1">Transaction ID: {lastOrder.id.slice(-8)}</p>
            </div>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto no-scrollbar border-y border-white/5 py-6 mb-6">
              {lastOrder.items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-[10px] uppercase font-bold">
                  <span className="text-white/50">{i.name} ({i.size}) x {i.qty}</span>
                  <span className="text-white">Rs.{i.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mb-8">
              <span className="text-[9px] font-black uppercase text-white/20">Grand Total</span>
              <span className="text-xl font-black text-[#d4af37]">Rs.{lastOrder.total.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => shareWhatsApp(lastOrder)} className="flex-1 py-4 bg-[#25D366] text-white font-black rounded-2xl text-[9px] uppercase flex items-center justify-center gap-2"><Send size={14}/> WhatsApp</button>
              <button onClick={()=>setShowModal(null)} className="flex-1 py-4 bg-white/5 text-white font-black rounded-2xl text-[9px] uppercase">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM MODALS */}
      {['route', 'shop', 'brand', 'expense'].includes(showModal) && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-8 backdrop-blur-md animate-in zoom-in duration-300">
          <div className="bg-[#0f0f0f] w-full p-8 rounded-[3rem] border border-white/5">
            <h3 className="text-center font-black text-[10px] mb-8 uppercase text-[#d4af37] tracking-[0.3em]">
              {showModal === 'route' ? 'New Territory' : showModal === 'shop' ? 'New Outlet' : showModal === 'brand' ? 'New Item' : 'New Expense'}
            </h3>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target;
              if(showModal === 'route') addItem('routes', { name: f.name.value.toUpperCase() });
              if(showModal === 'shop') addItem('shops', { name: f.name.value.toUpperCase(), area: f.area.value.toUpperCase(), routeId: selectedRouteId || data.routes[0]?.id });
              if(showModal === 'brand') addItem('brands', { name: f.name.value.toUpperCase(), size: f.size.value.toUpperCase(), price: parseFloat(f.price.value) });
              if(showModal === 'expense') addItem('expenses', { reason: f.reason.value.toUpperCase(), amount: parseFloat(f.amount.value) });
            }}>
              {showModal === 'route' && <input name="name" placeholder="Route Name" className="w-full bg-black p-4 rounded-2xl mb-6 border border-white/5 text-xs font-bold uppercase" required />}
              {showModal === 'shop' && (
                <>
                  <input name="name" placeholder="Outlet Name" className="w-full bg-black p-4 rounded-2xl mb-3 border border-white/5 text-xs font-bold uppercase" required />
                  <input name="area" placeholder="Area" className="w-full bg-black p-4 rounded-2xl mb-6 border border-white/5 text-xs font-bold uppercase" required />
                </>
              )}
              {showModal === 'brand' && (
                <>
                  <input name="name" placeholder="Brand Name" className="w-full bg-black p-4 rounded-2xl mb-3 border border-white/5 text-xs font-bold uppercase" required />
                  <input name="size" placeholder="Size (e.g. 1.5L)" className="w-full bg-black p-4 rounded-2xl mb-3 border border-white/5 text-xs font-bold uppercase" required />
                  <input name="price" type="number" step="any" placeholder="Price (Rs.)" className="w-full bg-black p-4 rounded-2xl mb-6 border border-white/5 text-xs font-bold uppercase" required />
                </>
              )}
              {showModal === 'expense' && (
                <>
                  <input name="reason" placeholder="Description" className="w-full bg-black p-4 rounded-2xl mb-3 border border-white/5 text-xs font-bold uppercase" required />
                  <input name="amount" type="number" step="any" placeholder="Amount (Rs.)" className="w-full bg-black p-4 rounded-2xl mb-6 border border-white/5 text-xs font-bold uppercase" required />
                </>
              )}
              <button className="w-full py-4 bg-[#d4af37] text-black font-black rounded-2xl text-[10px] uppercase shadow-lg">Save Record</button>
              <button type="button" onClick={()=>setShowModal(null)} className="text-center block w-full mt-6 text-[8px] text-white/10 uppercase tracking-widest font-black">Cancel</button>
            </form>
          </div>
        </div>
      )}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
