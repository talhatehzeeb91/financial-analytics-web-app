'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

const items = [
  { path:'/', section:'overview', label:'Overview', icon:'▦' },
  { path:'/performance', section:'performance', label:'Performance', icon:'↗' },
  { path:'/expenses', section:'expenses', label:'Expenses', icon:'◉' },
  { path:'/monthly-detail', section:'monthly-detail', label:'Monthly report', icon:'▤' },
];
function subscribe(listener: ()=>void) {
  window.addEventListener('hashchange',listener);
  window.addEventListener('popstate',listener);
  return ()=>{window.removeEventListener('hashchange',listener);window.removeEventListener('popstate',listener);};
}
const clientReady = ()=>true;
const serverReady = ()=>false;
const emptySubscribe = ()=>()=>{};
const readHash = ()=>window.location.hash;
const serverHash = ()=>'';

export function DashboardNavigation() {
  const pathname=usePathname();
  const hash=useSyncExternalStore(subscribe,readHash,serverHash);
  // Rewritten URLs differ from the prerendered root URL. Keep initial HTML
  // stable, then determine the active route in the browser after hydration.
  const ready=useSyncExternalStore(emptySubscribe,clientReady,serverReady);
  const path=pathname.replace(/\/$/,'') || '/';
  const active=ready ? items.find(item=>item.path===path && path!=='/') ?? items.find(item=>`#${item.section}`===hash) ?? items[0] : undefined;

  useEffect(()=>{
    if(ready && path!=='/') {
      const section=items.find(item=>item.path===path)?.section;
      if(section) document.getElementById(section)?.scrollIntoView({behavior:'instant'});
    }
  },[path,ready]);

  return <nav aria-label="Dashboard navigation" className="mt-5 flex gap-2 overflow-x-auto lg:flex-col">
    {items.map(item=><a key={item.path} href={item.path==='/'?'/#overview':item.path} aria-current={active===item?'page':undefined} className={`nav-item ${active===item?'bg-teal-50 font-semibold text-teal-800':'text-slate-500'}`} onClick={event=>{
      if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      // Next.js integrates the native history API with usePathname. Keeping
      // this dashboard mounted also retains local imports and filter state.
      window.history.pushState(null,'',item.path==='/'?'/#overview':item.path);
      // pushState does not emit hashchange for same-document section updates.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      document.getElementById(item.section)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }}><span aria-hidden="true">{item.icon}</span> {item.label}</a>)}
  </nav>;
}
