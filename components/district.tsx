'use client';
import Image from 'next/image';
import { useRef, useState, type CSSProperties } from 'react';
import { BUILDINGS, buildingState, ec } from '@/lib/rules.mjs';
import { Avatar } from './portrait';
export type Player = { id: string; username: string; avatar: string; level: number; xp: number; reputation: number };
type IconName = 'district' | 'buildings' | 'founder' | 'notices' | 'locate' | 'sun' | 'close' | 'lock';
const ICON_PATHS: Record<IconName,string> = {
  district:'M3 7 9 4l6 3 6-3v14l-6 3-6-3-6 3Z M9 4v14 M15 7v14',
  buildings:'M3 21h18 M5 21V9h6v12 M11 21V3h8v18 M7 12h1 M7 16h1 M14 7h2 M14 11h2 M14 15h2',
  founder:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21v-3a7 7 0 0 1 14 0v3Z',
  notices:'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Z M10 21h4 M12 2v2',
  locate:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M12 11v2',
  sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
  close:'m6 6 12 12 M6 18 18 6',
  lock:'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5Z M12 14v3',
};
function Icon({name}:{name:IconName}) { return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[name]}/></svg>; }
function statusLabel(state:string,level:number) { return state === 'Locked' ? `Level ${level} · Locked` : state === 'Preview' ? 'Future preview' : 'Open · Your HQ'; }
function scrollBehavior():ScrollBehavior { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'; }
export function District({ player, balance }: { player: Player; balance: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Record<string,HTMLButtonElement|null>>({});
  const [selected,setSelected] = useState('hq');
  const [activeNav,setActiveNav] = useState('district');
  const [mode,setMode] = useState<'overview'|'explore'>('overview');
  const [zoom,setZoom] = useState(1);
  const building = BUILDINGS.find(b => b.id === selected);
  const state = building ? buildingState(building,player.level) : '';
  function open(id:string) { setSelected(id); dialog.current?.showModal(); }
  function navigate(section:'district'|'buildings') {
    setActiveNav(section);
    document.getElementById(section === 'district' ? 'district-map' : 'buildings-directory')?.scrollIntoView({behavior:scrollBehavior(),block:'start'});
  }
  function changeMode(next:'overview'|'explore') { setMode(next); setZoom(1); if(map.current) { map.current.scrollLeft=0;map.current.scrollTop=0; } }
  function changeZoom(next:number) {
    const viewport = map.current;
    const cx = viewport ? (viewport.scrollLeft+viewport.clientWidth/2)/viewport.scrollWidth : .5;
    const cy = viewport ? (viewport.scrollTop+viewport.clientHeight/2)/viewport.scrollHeight : .5;
    setZoom(next);
    requestAnimationFrame(()=> { if(viewport) { viewport.scrollLeft=cx*viewport.scrollWidth-viewport.clientWidth/2;viewport.scrollTop=cy*viewport.scrollHeight-viewport.clientHeight/2; } });
  }
  function locate() {
    dialog.current?.close();setActiveNav('district');
    requestAnimationFrame(()=> { const marker=markerRefs.current[selected]; marker?.focus({preventScroll:true});marker?.scrollIntoView({behavior:scrollBehavior(),block:'nearest',inline:'center'}); });
  }
  return <>
    <nav className="district-nav" aria-label="District navigation">
      <span className="nav-kicker">YOUR DISTRICT</span>
      <button onClick={()=>navigate('district')} aria-current={activeNav==='district'?'page':undefined}><Icon name="district"/><span>District</span></button>
      <button onClick={()=>navigate('buildings')} aria-current={activeNav==='buildings'?'page':undefined}><Icon name="buildings"/><span>Buildings</span></button>
      <button onClick={()=>open('hq')}><Icon name="founder"/><span>Founder</span></button>
      <button onClick={()=>open('notifications')}><Icon name="notices"/><span>Notices</span></button>
      <span className="nav-chapter">CHAPTER<br/><strong>01</strong></span>
    </nav>
    <section className="district-main" id="district" aria-labelledby="district-title">
      <div className="district-heading"><div><span className="eyebrow">A LITTLE AMBITION GOES A LONG WAY</span><h1 id="district-title">Business District<span className="live-label"><i/>FOUNDATION OPEN</span></h1><p>A first address. A fresh start. A whole neighborhood of possibility.</p></div><div className="district-weather"><Icon name="sun"/><span>A bright beginning<br/><strong>Founders’ season · Chapter 01</strong></span></div></div>
      <div className="hud" aria-label="Founder statistics">
        <div className="identity"><Avatar preset={player.avatar}/><div><strong>{player.username}</strong><small>Founder · Level {player.level}</small></div></div>
        <div className="capital-stat"><small>YOUR CAPITAL</small><strong className="capital"><span aria-hidden="true">◈</span> {ec(balance)} <span>EC</span></strong><small className="capital-caption">Founding grant secured</small></div>
        <div className="xp-stat"><small>EXPERIENCE</small><strong>{player.xp} <span>XP</span></strong><span className="xp-track" aria-hidden="true"/><small>Level {player.level} · A new beginning</small></div>
        <div className="rep-stat"><small>REPUTATION</small><strong><span aria-hidden="true">✦</span> {player.reputation}</strong><small>A trusted new neighbor</small></div>
        <button className="notice-button" onClick={()=>open('notifications')} aria-label="Notifications, no new notices"><Icon name="notices"/><span>Notices</span></button>
      </div>
      <section id="district-map" className="district-map" aria-labelledby="map-heading">
        <div className="map-toolbar"><div><span className="eyebrow">CENTRAL ISLAND · EST. TODAY</span><h2 id="map-heading">Your corner of the world.</h2></div><div className="map-modes" aria-label="Map view"><button aria-pressed={mode==='overview'} onClick={()=>changeMode('overview')}>Whole district</button><button aria-pressed={mode==='explore'} onClick={()=>changeMode('explore')}>Explore streets</button></div></div>
        <div className="map-scroll" ref={map} data-mode={mode} role="region" aria-label={mode==='overview'?'Whole district map, all 11 buildings. Numbers match the building directory.':'Explore district map. Swipe or scroll in both directions. Tab to reach every building.'} tabIndex={0}>
          <div className="map-world" style={{'--map-zoom':zoom} as CSSProperties}>
            <Image src="/district.svg" alt="Original illustrated Business District: eleven distinct buildings, a riverside park, tree-lined avenues, a golden-roofed headquarters and fountain square." width={1200} height={880} priority/>
            {BUILDINGS.map((b,index)=> {const status=buildingState(b,player.level);return <button key={b.id} ref={node=>{markerRefs.current[b.id]=node;}} className={`hotspot ${status.toLowerCase()}`} data-selected={selected===b.id} style={{left:`${b.x}%`,top:`${b.y}%`}} onClick={()=>open(b.id)} aria-haspopup="dialog" aria-label={`${b.name}. ${status}. Level ${b.level}`}><span className="site-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span className="site-caption"><strong>{b.name === 'Headquarters'?'Your Headquarters':b.name}</strong><small>{statusLabel(status,b.level)}</small></span>{status==='Locked'&&<span className="site-lock"><Icon name="lock"/></span>}</button>;})}
          </div>
        </div>
        <div className="map-bottom"><p id="map-help">{mode==='overview'?'The whole neighborhood, in view. Tap a numbered pin or choose any building below.':'Swipe to wander. Zoom stays inside the map. Every building is also listed below.'}</p>{mode==='explore'&&<div className="map-zoom" aria-label="Map zoom"><button aria-label="Zoom out" disabled={zoom<=1} onClick={()=>changeZoom(Math.max(1,zoom-.25))}>−</button><output aria-live="polite">{Math.round(zoom*100)}%</output><button aria-label="Zoom in" disabled={zoom>=1.5} onClick={()=>changeZoom(Math.min(1.5,zoom+.25))}>+</button></div>}</div>
        <div className="map-key"><span><i className="key-dot available"/>Available now</span><span><i className="key-dot preview"/>Future preview</span><span><i className="key-dot locked"/>Level locked</span><small>11 addresses. One beginning.</small></div>
      </section>
      <section className="directory" id="buildings-directory" aria-labelledby="directory-heading"><div className="directory-heading"><div><span className="eyebrow">TAKE A LOOK AROUND</span><h2 id="directory-heading">Every address, one tap away.</h2><p>Building directory · all 11 places</p></div><span className="district-count">11 <small>PLACES TO DISCOVER</small></span></div>
        <div className="directory-grid">{BUILDINGS.map((b,index)=> {const status=buildingState(b,player.level);return <button key={b.id} className={`building-card ${status.toLowerCase()}`} data-selected={selected===b.id} onClick={()=>open(b.id)} aria-haspopup="dialog"><span className="building-emblem" aria-hidden="true" style={{'--building-color':b.color} as CSSProperties}><Icon name={status==='Locked'?'lock':'buildings'}/><span>{String(index+1).padStart(2,'0')}</span></span><span className="building-card-copy"><strong>{b.name}</strong><small>{statusLabel(status,b.level)}</small></span><span className="building-arrow" aria-hidden="true">↗</span></button>;})}</div>
      </section>
      <div className="founder-note"><span aria-hidden="true">✦</span><div><strong>Good things start small.</strong><p>Your founder profile and 500 EC grant are saved. Explore today; jobs, trading and progression arrive in later stages.</p></div><span className="pill">CHAPTER 01</span></div>
    </section>
    <dialog ref={dialog} className="building-dialog" aria-labelledby="building-title" aria-describedby="building-description"><div className="dialog-inner"><button className="dialog-close" aria-label="Close building panel" onClick={()=>dialog.current?.close()} autoFocus><Icon name="close"/></button><div className={`panel-crest ${state.toLowerCase()}`} aria-hidden="true"><Icon name={state==='Locked'?'lock':building?'buildings':'notices'}/></div><span className={`panel-status ${state.toLowerCase()}`}>{building?statusLabel(state,building.level):'DISTRICT NOTICEBOARD'}</span><h2 id="building-title">{building?.name??'A quiet first day.'}</h2><p id="building-description">{building?.description??'No notifications yet. Future district updates will appear here.'}</p>{building&&(building.id==='hq'?<div className="hq-profile"><Avatar preset={player.avatar}/><strong>{player.username}</strong><p>Level {player.level} · {player.xp} XP · Reputation {player.reputation}</p><p>{ec(balance)} EC · Your founding grant is recorded.</p></div>:<p className="feedback">{player.level<building.level?`Requires level ${building.level}. Progression is not available in Stage 1.`:'Stage 2 coming soon. This is a preview; no jobs, trades or EC changes are available yet.'}</p>)}{building&&<button className="locate-button" onClick={locate}><Icon name="locate"/>Locate on map</button>}<button className="primary" onClick={()=>dialog.current?.close()}>Back to the district</button></div></dialog>
  </>;
}
