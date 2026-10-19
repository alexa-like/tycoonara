'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { BUILDINGS, buildingState, ec } from '@/lib/rules.mjs';
import { Avatar } from './portrait';
export type Player = { id: string; username: string; avatar: string; level: number; xp: number; reputation: number };
export function District({ player, balance }: { player: Player; balance: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState('hq');
  const building = BUILDINGS.find(b => b.id === selected);
  function open(id: string) { setSelected(id); dialog.current?.showModal(); }
  return <>
    <nav className="district-nav" aria-label="District navigation"><a href="#district" aria-current="page">⌂ <span>District</span></a><button onClick={() => open('hq')}>◇ <span>Founder</span></button><button onClick={() => open('notifications')}>♧ <span>Notices</span></button></nav>
    <section className="district-main" id="district" aria-labelledby="district-title">
      <div className="district-heading"><div><span className="eyebrow">YOUR WORLD, WAITING TO HAPPEN</span><h1 id="district-title">Business District<span className="live-label">FOUNDATION OPEN</span></h1><p>Find your feet. Explore the neighborhood. Dream a little bigger.</p></div><div className="district-weather" aria-label="District atmosphere">☀<span>A bright beginning<br /><strong>Chapter 01</strong></span></div></div>
      <div className="hud" aria-label="Founder statistics"><div className="identity"><Avatar preset={player.avatar} /><div><strong>{player.username}</strong><small>Founder · Level {player.level}</small></div></div><div><small>YOUR CAPITAL</small><strong className="capital">◈ {ec(balance)} <span>EC</span></strong></div><div><small>EXPERIENCE</small><strong>{player.xp} XP</strong><span className="xp-track" aria-hidden="true" /></div><div><small>REPUTATION</small><strong>✦ {player.reputation}</strong></div><button className="notice-button" onClick={() => open('notifications')} aria-label="Notifications, no new notices">♧<span>Notices</span></button></div>
      <div className="map-caption"><span>⌖ BUSINESS DISTRICT · CENTRAL ISLAND</span><span>Tap a building to explore ↙</span></div>
      <div className="map-scroll" role="region" aria-label="Illustrated district map. Scroll horizontally on small screens, or use the building directory below." tabIndex={0}>
        <div className="map-world"><Image src="/district.svg" alt="Original illustrated business district, with tree-lined streets, a central fountain and eleven colorful buildings." width={1200} height={880} priority />
          {BUILDINGS.map(b => <button key={b.id} className={`hotspot ${buildingState(b,player.level).toLowerCase()}`} style={{ left:`${b.x}%`, top:`${b.y}%` }} onClick={() => open(b.id)} aria-label={`${b.name}. ${buildingState(b,player.level)}. Level ${b.level}`}><span>{b.name === 'Headquarters' ? '★ Your HQ' : b.name}</span><small>{buildingState(b,player.level) === 'Locked' ? `⌑ Level ${b.level}` : buildingState(b,player.level)}</small></button>)}
        </div>
      </div>
      <div className="map-key"><span><i className="key-dot available" />Available</span><span><i className="key-dot preview" />Coming soon preview</span><span><i className="key-dot locked" />Level locked</span><small>Stage 1 · Explore today. Build tomorrow.</small></div>
      <details className="directory"><summary>Building directory · all 11 places</summary><div className="directory-grid">{BUILDINGS.map(b => <button key={b.id} onClick={() => open(b.id)}><strong>{b.name}</strong><small>{buildingState(b,player.level)} · Level {b.level}</small></button>)}</div></details>
      <div className="founder-note"><span aria-hidden="true">✦</span><div><strong>Good things start small.</strong><p>Your founder profile and 500 EC grant are saved. Jobs, trading and progression will open in later stages. Take a look around.</p></div><span className="pill">STAGE 1</span></div>
    </section>
    <dialog ref={dialog} className="building-dialog" aria-labelledby="building-title"><div className="dialog-inner"><button className="dialog-close" aria-label="Close building panel" onClick={() => dialog.current?.close()}>×</button><span className="eyebrow">{building ? buildingState(building,player.level) : 'DISTRICT NOTICEBOARD'}</span><h2 id="building-title">{building?.name ?? 'A quiet first day.'}</h2>{building ? <><p>{building.description}</p>{building.id === 'hq' ? <div className="hq-profile"><Avatar preset={player.avatar} /><strong>{player.username}</strong><p>Level {player.level} · {player.xp} XP · Reputation {player.reputation}</p><p>{ec(balance)} EC · Your founding grant is recorded.</p></div> : <p className="feedback">{player.level < building.level ? `Requires level ${building.level}. Progression is not available in Stage 1.` : 'Stage 2 coming soon. This is a preview; no jobs, trades or EC changes are available yet.'}</p>}</> : <p>No notifications yet. Future district updates will appear here.</p>}<button className="primary" onClick={() => dialog.current?.close()}>Back to the district</button></div></dialog>
  </>;
}
