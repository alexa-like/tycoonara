'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BUILDINGS, buildingState, ec } from '@/lib/rules.mjs';
import { signOut } from '@/app/actions';
import { Avatar } from './portrait';
import { ThemeToggle } from './theme';
import { JobCenter } from './job-center';
export type Player = { id:string; username:string; avatar:string; level:number; xp:number; reputation:number };
type Section = 'district'|'buildings'|'founder'|'notices'|'settings';
type Panel = Exclude<Section,'district'>|'building';
type IconName = Section|'locate'|'close'|'lock';
const ICON_PATHS:Record<IconName,string> = {
  district:'M3 7 9 4l6 3 6-3v14l-6 3-6-3-6 3Z M9 4v14 M15 7v14',
  buildings:'M3 21h18 M5 21V9h6v12 M11 21V3h8v18 M7 12h1 M7 16h1 M14 7h2 M14 11h2 M14 15h2',
  founder:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21v-3a7 7 0 0 1 14 0v3Z',
  notices:'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Z M10 21h4 M12 2v2',
  settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  locate:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M12 11v2',
  close:'m6 6 12 12 M6 18 18 6',
  lock:'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5Z M12 14v3',
};
const NAV:readonly Section[] = ['district','buildings','founder','notices','settings'];
function title(section:Section) {return section[0].toUpperCase()+section.slice(1);}
function Icon({name}:{name:IconName}) {return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[name]}/></svg>;}
function statusLabel(state:string,level:number) {return state==='Locked'?`Level ${level} · Locked`:state==='Preview'?'Future preview':'Open · Explore';}
export function District({player,balance,jobsEnabled=false}:{player:Player;balance:number;jobsEnabled?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const panelHeading=useRef<HTMLHeadingElement>(null);
  const map=useRef<HTMLDivElement>(null);
  const markerRefs=useRef<Record<string,HTMLButtonElement|null>>({});
  const focusAfterClose=useRef<HTMLElement|null>(null);
  const [panel,setPanel]=useState<Panel|null>(null);
  const [active,setActive]=useState<Section>('district');
  const [selected,setSelected]=useState('hq');
  const [mode,setMode]=useState<'overview'|'explore'>('overview');
  const [zoom,setZoom]=useState(1);
  const [fitWidth,setFitWidth]=useState(0);
  const [tip,setTip]=useState(true);
  const building=BUILDINGS.find(b=>b.id===selected)!;
  const state=buildingState(building,player.level);
  useEffect(()=>{
    const element=map.current;if(!element)return;
    const measure=()=>setFitWidth(Math.max(292,Math.min(element.clientWidth-8,(element.clientHeight-8)*1200/880)));
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return ()=>observer.disconnect();
  },[]);
  function open(next:Panel,section:Section=active) {
    setPanel(next);setActive(section);
    if(!dialog.current?.open)dialog.current?.showModal();
    else requestAnimationFrame(()=>panelHeading.current?.focus());
  }
  function close() {dialog.current?.close();}
  function closed() {
    // A queued close event must not clear a panel opened immediately afterwards.
    if(dialog.current?.open){focusAfterClose.current=null;return;}
    setPanel(null);setActive('district');
    // Native dialog dismissal restores its opener synchronously. Only Locate overrides it.
    const target=focusAfterClose.current;focusAfterClose.current=null;
    target?.focus({preventScroll:true});
  }
  function navigate(section:Section) {
    if(section==='district'){close();setActive('district');map.current?.focus({preventScroll:true});return;}
    if(panel===section&&dialog.current?.open)return;
    open(section,section);
  }
  function openBuilding(id:string) {setSelected(id);open('building');}
  function changeMode(next:'overview'|'explore') {
    setMode(next);setZoom(1);requestAnimationFrame(()=>{if(map.current){map.current.scrollLeft=0;map.current.scrollTop=0;}});
  }
  function changeZoom(next:number) {
    const element=map.current;
    const cx=element?(element.scrollLeft+element.clientWidth/2)/element.scrollWidth:.5;
    const cy=element?(element.scrollTop+element.clientHeight/2)/element.scrollHeight:.5;
    setZoom(next);requestAnimationFrame(()=>{if(element){element.scrollLeft=cx*element.scrollWidth-element.clientWidth/2;element.scrollTop=cy*element.scrollHeight-element.clientHeight/2;}});
  }
  function locate() {
    const marker=markerRefs.current[selected];focusAfterClose.current=marker??null;close();
    requestAnimationFrame(()=>marker?.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'}));
  }
  const panelTitle=panel==='building'?building.name:panel==='founder'?'Your founder story':panel==='notices'?'District notices':panel==='settings'?'Settings':'Every address, one tap away.';
  return <>
    <header className="game-topbar">
      <Link href="/" className="game-brand" aria-label="Tycoonara home"><span className="brand-mark" aria-hidden="true">T</span><span>tycoonara</span></Link>
      <div className="hud" aria-label="Founder statistics">
        <button className="identity" onClick={()=>navigate('founder')} aria-label="Open founder profile" title={player.username}><Avatar preset={player.avatar}/><span><strong>{player.username}</strong><small>Founder · Level {player.level}</small></span></button>
        <div className="capital-stat"><small>YOUR CAPITAL</small><strong>{ec(balance)} <span>EC</span></strong></div>
        <div className="hud-metrics"><span><strong>{player.xp}</strong> XP</span><span><strong>{player.reputation}</strong> reputation</span></div>
      </div>
      <div className="game-top-actions"><button className="header-notices" onClick={()=>navigate('notices')} aria-label="Notifications, no new notices"><Icon name="notices"/></button><span className="header-theme"><ThemeToggle/></span><button onClick={()=>navigate('settings')} aria-label="Open account settings"><Icon name="settings"/></button></div>
    </header>
    <section className="district-main" aria-labelledby="district-title">
      <div className="map-toolbar">
        <div className="map-title"><h1 id="district-title">Business District</h1><span>Central Island · Chapter 01</span></div>
        <div className="map-controls"><div className="map-modes" role="group" aria-label="Map view"><button aria-pressed={mode==='overview'} onClick={()=>changeMode('overview')}>Whole district</button><button aria-pressed={mode==='explore'} onClick={()=>changeMode('explore')}>Explore streets</button></div>{mode==='explore'&&<div className="map-zoom" role="group" aria-label="Map zoom"><button aria-label="Zoom out" disabled={zoom<=1} onClick={()=>changeZoom(Math.max(1,zoom-.25))}>−</button><output aria-live="polite">{Math.round(zoom*100)}%</output><button aria-label="Zoom in" disabled={zoom>=1.5} onClick={()=>changeZoom(Math.min(1.5,zoom+.25))}>+</button></div>}</div>
      </div>
      {tip&&<div className="district-tip"><p>Your founder profile is saved. Tap a building or open Buildings to explore.</p><button aria-label="Dismiss district tip" onClick={()=>setTip(false)}><Icon name="close"/></button></div>}
      <div id="district-map" className="map-scroll" ref={map} data-mode={mode} data-ready={fitWidth>0} role="region" aria-label={mode==='overview'?'Whole district map, all 11 buildings. Swipe or scroll on short screens. Numbers match the building directory.':'Explore district map. Swipe or scroll in both directions. Tab to reach every building.'} tabIndex={0}>
        <div className="map-canvas"><div className="map-world" style={{'--world-width':`${mode==='overview'?Math.max(292,fitWidth):1080*zoom}px`} as CSSProperties}>
          <Image src="/district.svg" alt="Original illustrated Business District: eleven distinct buildings, a riverside park, tree-lined avenues, a golden-roofed headquarters and fountain square." width={1200} height={880} priority/>
          {BUILDINGS.map((b,index)=>{const status=buildingState(b,player.level);return <button key={b.id} ref={node=>{markerRefs.current[b.id]=node;}} className={`hotspot ${status.toLowerCase()}`} data-selected={selected===b.id} style={{left:`${b.x}%`,top:`${b.y}%`}} onClick={()=>openBuilding(b.id)} aria-haspopup="dialog" aria-label={`${b.name}. ${status}. Level ${b.level}`} title={`${b.name} · ${statusLabel(status,b.level)}`}><span className="site-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span></button>;})}
        </div></div>
      </div>
      <div className="map-status"><span><i className="key-dot available"/>Available</span><span><i className="key-dot preview"/>Preview</span><span><i className="key-dot locked"/>Level locked</span><span className="map-instruction">{mode==='overview'?'11 buildings · Swipe if needed':'Swipe / scroll to explore'}</span></div>
    </section>
    <nav className="district-nav" aria-label="District navigation">{NAV.map(section=><button key={section} type="button" onClick={()=>navigate(section)} aria-label={title(section)} aria-current={active===section?'page':undefined} aria-haspopup={section==='district'?undefined:'dialog'} aria-expanded={section==='district'?undefined:active===section&&panel!==null} title={title(section)}><Icon name={section}/><span>{title(section)}</span></button>)}</nav>
    <dialog ref={dialog} className="game-panel building-dialog" aria-labelledby="building-title" onClose={closed}>
      <div className="panel-header"><div><span className="eyebrow">{panel==='building'?statusLabel(state,building.level):'YOUR TYCOONARA'}</span><h2 id="building-title" ref={panelHeading} tabIndex={-1}>{panelTitle}</h2></div><button className="dialog-close" aria-label="Close panel" onClick={close} autoFocus><Icon name="close"/></button></div>
      <div className="panel-body">
        {panel==='buildings'&&<><p className="panel-intro">All 11 places. Choose any address to see its details.</p><div className="directory-grid">{BUILDINGS.map((b,index)=>{const status=buildingState(b,player.level);return <button key={b.id} className={`building-card ${status.toLowerCase()}`} data-selected={selected===b.id} onClick={()=>openBuilding(b.id)}><span className="building-emblem" aria-hidden="true"><Icon name={status==='Locked'?'lock':'buildings'}/><small>{String(index+1).padStart(2,'0')}</small></span><span><strong>{b.name}</strong><small>{statusLabel(status,b.level)}</small></span><span className="building-arrow" aria-hidden="true">↗</span></button>;})}</div></>}
        {panel==='building'&&<><div className="panel-crest" aria-hidden="true"><Icon name={state==='Locked'?'lock':'buildings'}/></div><p id="building-description">{building.description}</p>{building.id==='hq'?<Founder player={player} balance={balance}/>:building.id==='jobs'?(jobsEnabled?<JobCenter level={player.level}/>:<p className="feedback">Small favors. Real progress. Job Center is awaiting its isolated development database. No earnings actions are enabled here.</p>):<p className="feedback">{player.level<building.level?`Requires level ${building.level}. Earn XP through NPC jobs to reach this level.`:'Future district preview. This business is not playable in Stage 2A.'}</p>}<button className="locate-button" onClick={locate}><Icon name="locate"/>Locate on map</button><button className="panel-link" onClick={()=>open('buildings','buildings')}>Browse all buildings</button></>}
        {panel==='founder'&&<Founder player={player} balance={balance}/>}
        {panel==='notices'&&<div className="notice-empty"><Icon name="notices"/><h3>A quiet first day.</h3><p>No notifications yet. Future district updates will appear here.</p><p className="feedback">Good things start small. Your founder profile and one-time 500 EC grant are saved. Visit the Job Center to earn EC and XP. Trading remains a future feature.</p></div>}
        {panel==='settings'&&<><div className="settings-section"><h3>Appearance</h3><p>Choose the theme that feels at home. Your preference is saved on this device.</p><ThemeToggle/></div><div className="settings-section"><h3>Your account</h3><p>Signed in as <strong>{player.username}</strong>. Your founder profile and district are saved.</p><form action={signOut}><button className="signout-button">Sign out</button></form></div><div className="settings-section"><h3>About your district</h3><p>Tycoonara · Stage 2A development. NPC jobs are the first earnings loop. Other businesses remain previews.</p></div></>}
        <button className="primary panel-done" onClick={close}>Back to the district</button>
      </div>
    </dialog>
  </>;
}
function Founder({player,balance}:{player:Player;balance:number}) {
  return <div className="hq-profile"><Avatar preset={player.avatar}/><h3>{player.username}</h3><p>Founder · Level {player.level}</p><dl><div><dt>Capital</dt><dd>{ec(balance)} EC</dd></div><div><dt>Experience</dt><dd>{player.xp} XP</dd></div><div><dt>Reputation</dt><dd>{player.reputation}</dd></div></dl><p className="feedback">Your founding grant is recorded. Earn XP at the Job Center. Every 100 XP adds a level, up to level 25. Other businesses remain future previews.</p></div>;
}
