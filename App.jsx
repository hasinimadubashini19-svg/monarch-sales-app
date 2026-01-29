import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, deleteDoc, query, orderBy, where, enableIndexedDbPersistence } from 'firebase/firestore';
import { LayoutDashboard, Store, FileText, Plus, X, Trash2, Crown, Settings, LogOut, Search, Send, MapPin, Receipt, Package, Wallet } from 'lucide-react';

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

try { enableIndexedDbPersistence(db); } catch (err) { console.warn(err.code); }

const appId = 'monarch-v5-pro';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState({ routes: [], shops: [], orders: [], expenses: [], brands: [], settings: [] });
  const [selectedRouteId, setSelectedRouteId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({});
  const [selectedShop, setSelectedShop] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const collections = ['routes', 'shops', 'orders', 'expenses', 'brands', 'settings'];
    const unsubs = collections.map(c => {
      const q = query(collection(db, 'artifacts', appId, 'data', c), where("userId", "==", user.uid), orderBy("timestamp", "asc"));
      return onSnapshot(q, s => setData(prev => ({ ...prev, [c]: s.docs.map(d => ({ id: d.id, ...d.data() })) })), (err) => console.log(err));
    });
    return () => unsubs.forEach(f => f());
  }, [user]);

  const addItem = async (col, payload) => {
    await addDoc(collection(db, 'artifacts', appId, 'data', col), { ...payload, userId: user.uid, date: new Date().toLocaleDateString(), timestamp: Date.now() });
    setShowModal(null);
  };

  const deleteItem = async (col, id) => { if (confirm("Delete?")) await deleteDoc(doc(db, 'artifacts', appId, 'data', col, id)); };

  const submitOrder = async () => {
    const items = Object.entries(cart).filter(([_, q]) => q > 0).map(([id, q]) => {
      const b = data.brands.find(x => x.id === id);
      return { name: b.name, size: b.size, price: b.price, qty: q, subtotal: b.price * q };
    });
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const orderData = { userId: user.uid, shopId: selectedShop.id, shopName: selectedShop.name, items, total, date: new Date().toLocaleDateString(), timestamp: Date.now() };
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'data', 'orders'), orderData);
    setLastOrder({ id: docRef.id, ...orderData });
    setCart({}); setShowModal('receipt');
  };

  const repProfile = data.settings.find(s => s.type === 'rep') || { name: 'REP' };
  const todayOrders = data.orders.filter(o => o.date === new Date().toLocaleDateString());
  const brandSummary = useMemo(() => {
    const summary = {};
    todayOrders.forEach(o => o.items.forEach(i => {
      const k = `${i.name} (${i.size})`;
      if(!summary[k]) summary[k] = { q: 0, t: 0 };
      summary[k].q += i.qty; summary[k].t += i.subtotal;
    }));
    return Object.entries(summary);
  }, [todayOrders]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-[#d4af37] font-bold tracking-tighter italic animate-pulse">MONARCH...</div>;

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-xs text-center">
        <Crown className="text-[#d4af37] mx-auto mb-6" size={48} />
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (authMode === 'login') await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
            else await createUserWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
          } catch (err) { alert(err.message); }
        }} className="space-y-4">
          <input name="email" type="email" placeholder="Email" className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 outline-none" required />
          <input name="password" type="password" placeholder="Password" className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 outline-none" required />
          <button className="w-full py-4 bg-[#d4af37] text-black font-black rounded-2xl uppercase tracking-widest text-[10px]">{authMode === 'login' ? 'Login' : 'Register'}</button>
        </form>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="mt-6 text-[9px] text-white/30 uppercase tracking-widest">{authMode === 'login' ? "Create Account" : "Back to Login"}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <header className="p-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2"><Crown className="text-[#d4af37]" size={20}/><h1 className="text-lg font-black italic">MONARCH</h1></div>
        <button onClick={() => signOut(auth)} className="p-2 text-red-500 bg-red-500/10 rounded-full"><LogOut size={16}/></button>
      </header>
      <main className="p-5 max-w-lg mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111] p-5 rounded-[2rem] border border-white/5 text-center">
                <p className="text-[8px] text-white/20 uppercase mb-1 font-bold">Today Sales</p>
                <p className="text-xl font-black text-[#d4af37]">Rs.{todayOrders.reduce((s,o)=>s+o.total,0).toFixed(2)}</p>
              </div>
              <div className="bg-[#111] p-5 rounded-[2rem] border border-white/5 text-center">
                <p className="text-[8px] text-white/20 uppercase mb-1 font-bold">Expenses</p>
                <p className="text-xl font-black text-red-500">Rs.{data.expenses.filter(e => e.date === new Date().toLocaleDateString()).reduce((s,e)=>s+Number(e.amount),0).toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-[#111] p-6 rounded-[2rem] border border-white/5">
              <h3 className="text-[10px] font-black text-[#d4af37] uppercase mb-4 tracking-widest">Item Summary</h3>
              {brandSummary.map(([n, s], i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-[10px] font-bold uppercase">{n}</span>
                  <span className="text-[10px] font-black">{s.q} BOTTLES</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'shops' && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button onClick={() => setSelectedRouteId('all')} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase ${selectedRouteId === 'all' ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-white/40'}`}>All</button>
              {data.routes.map(r => <button key={r.id} onClick={() => setSelectedRouteId(r.id)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase ${selectedRouteId === r.id ? 'bg-[#d4af37] text-black' : 'bg-[#111] text-white/40'}`}>{r.name}</button>)}
            </div>
            {data.shops.filter(s => selectedRouteId === 'all' || s.routeId === selectedRouteId).map(s => (
              <div key={s.id} className="bg-[#111] p-5 rounded-[2rem] border border-white/5 flex justify-between items-center">
                <div><h4 className="text-xs font-black uppercase">{s.name}</h4><p className="text-[8px] text-white/20 uppercase">{s.area}</p></div>
                <button onClick={()=>{setSelectedShop(s); setShowModal('invoice');}} className="bg-[#d4af37] px-4 py-2 rounded-xl text-[9px] font-black text-black uppercase">BILL</button>
              </div>
            ))}
            <button onClick={()=>setShowModal('shop')} className="w-full p-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-black text-white/20 uppercase">+ Add New Shop</button>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <button onClick={()=>setShowModal('route')} className="w-full p-4 bg-[#111] rounded-2xl text-[10px] font-black uppercase border border-white/5">+ Manage Routes</button>
            <button onClick={()=>setShowModal('brand')} className="w-full p-4 bg-[#111] rounded-2xl text-[10px] font-black uppercase border border-white/5">+ Manage Brands</button>
            <button onClick={()=>setShowModal('expense')} className="w-full p-4 bg-[#111] rounded-2xl text-[10px] font-black uppercase border border-white/5">+ Add Expense</button>
          </div>
        )}
      </main>
      <nav className="fixed bottom-6 inset-x-6 h-16 bg-[#0a0a0a] border border-white/5 rounded-full flex items-center justify-around z-50 shadow-2xl">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-[#d4af37]' : 'text-white/20'}><LayoutDashboard size={20}/></button>
        <button onClick={() => setActiveTab('shops')} className={activeTab === 'shops' ? 'text-[#d4af37]' : 'text-white/20'}><Store size={20}/></button>
        <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'text-[#d4af37]' : 'text-white/20'}><Settings size={20}/></button>
      </nav>

      {showModal === 'invoice' && (
        <div className="fixed inset-0 bg-black z-[100] p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-8 sticky top-0 bg-black pb-4">
            <h2 className="text-lg font-black uppercase italic">{selectedShop?.name}</h2>
            <button onClick={()=>setShowModal(null)} className="p-2 bg-white/5 rounded-full"><X/></button>
          </div>
          <div className="space-y-3 pb-32">
            {data.brands.map(brand => (
              <div key={brand.id} className="bg-[#111] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                <div><p className="text-[10px] font-black uppercase">{brand.name}</p><p className="text-[8px] text-white/20">Rs.{brand.price.toFixed(2)}</p></div>
                <div className="flex items-center gap-4">
                  <button onClick={()=>setCart({...cart, [brand.id]: Math.max(0, (cart[brand.id]||0)-1)})} className="text-[#d4af37] text-xl font-bold">-</button>
                  <span className="text-xs font-bold">{cart[brand.id]||0}</span>
                  <button onClick={()=>setCart({...cart, [brand.id]: (cart[brand.id]||0)+1})} className="text-[#d4af37] text-xl font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="fixed bottom-0 inset-x-0 p-8 bg-black/90 backdrop-blur-xl border-t border-white/5">
            <button onClick={submitOrder} className="w-full py-4 bg-[#d4af37] text-black font-black rounded-xl uppercase text-[10px]">Submit Order (Rs.{Object.entries(cart).reduce((sum, [id, q]) => sum + (data.brands.find(b=>b.id===id)?.price||0)*q, 0).toFixed(2)})</button>
          </div>
        </div>
      )}

      {showModal === 'receipt' && lastOrder && (
        <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-6">
          <div className="bg-[#111] w-full max-w-xs p-8 rounded-[2rem] border border-[#d4af37]/30 text-center">
            <Crown className="text-[#d4af37] mx-auto mb-4" size={32}/>
            <h3 className="font-black text-[#d4af37] uppercase mb-6">SUCCESS</h3>
            <div className="space-y-2 mb-6 text-left border-y border-white/5 py-4">
              {lastOrder.items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-[10px] font-bold uppercase">
                  <span>{i.name} x {i.qty}</span>
                  <span>Rs.{i.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="text-xl font-black text-[#d4af37] mb-8 uppercase tracking-widest">Rs.{lastOrder.total.toFixed(2)}</p>
            <div className="flex gap-2">
              <button onClick={() => window.open(`https://wa.me/?text=MONARCH%20RECEIPT%20-%20Total:%20Rs.${lastOrder.total}`, '_blank')} className="flex-1 py-3 bg-[#25D366] text-white font-black rounded-xl text-[9px] uppercase">WhatsApp</button>
              <button onClick={()=>setShowModal(null)} className="flex-1 py-3 bg-white/10 text-white font-black rounded-xl text-[9px] uppercase">Close</button>
            </div>
          </div>
        </div>
      )}

      {['route', 'shop', 'brand', 'expense'].includes(showModal) && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-8">
          <div className="bg-[#111] w-full max-w-xs p-8 rounded-[2rem] border border-white/5">
            <h3 className="text-center font-black text-[10px] mb-6 uppercase text-[#d4af37] tracking-widest">{showModal}</h3>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target;
              if(showModal === 'route') addItem('routes', { name: f.name.value.toUpperCase() });
              if(showModal === 'shop') addItem('shops', { name: f.name.value.toUpperCase(), area: f.area.value.toUpperCase(), routeId: f.routeId.value });
              if(showModal === 'brand') addItem('brands', { name: f.name.value.toUpperCase(), size: f.size.value.toUpperCase(), price: parseFloat(f.price.value) });
              if(showModal === 'expense') addItem('expenses', { reason: f.reason.value.toUpperCase(), amount: parseFloat(f.amount.value) });
            }}>
              {showModal === 'shop' && <select name="routeId" className="w-full bg-black p-4 rounded-xl mb-3 border border-white/5 text-[10px] text-white uppercase">{data.routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
              <input name="name" placeholder="Name" className="w-full bg-black p-4 rounded-xl mb-3 border border-white/5 text-[10px] text-white uppercase outline-none" required />
              {showModal === 'shop' && <input name="area" placeholder="Area" className="w-full bg-black p-4 rounded-xl mb-3 border border-white/5 text-[10px] text-white uppercase outline-none" required />}
              {showModal === 'brand' && <><input name="size" placeholder="Size" className="w-full bg-black p-4 rounded-xl mb-3 border border-white/5 text-[10px] text-white uppercase outline-none" required /><input name="price" type="number" step="any" placeholder="Price" className="w-full bg-black p-4 rounded-xl mb-3 border border-white/5 text-[10px] text-white uppercase outline-none" required /></>}
              {showModal === 'expense' && <input name="amount" type="number" step="any" placeholder="Amount" className="w-full bg-black p-4 rounded-xl mb-3 border border-white/5 text-[10px] text-white uppercase outline-none" required />}
              <button className="w-full py-4 bg-[#d4af37] text-black font-black rounded-xl text-[10px] uppercase shadow-lg">Save</button>
              <button type="button" onClick={()=>setShowModal(null)} className="block w-full mt-4 text-[8px] text-white/10 uppercase font-black text-center underline">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
