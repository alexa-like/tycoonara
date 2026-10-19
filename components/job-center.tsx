'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {jobAction} from '@/app/job-actions';
import {ec} from '@/lib/rules.mjs';
import type {JobBoard,JobResult} from '@/lib/jobs';
export function JobCenter({level}:{level:number}) {
  const [board,setBoard]=useState<JobBoard|null>(null);
  const [message,setMessage]=useState('Loading your saved jobs…');
  const [error,setError]=useState(false);
  const [pending,startTransition]=useTransition();
  const [elapsed,setElapsed]=useState(0);
  const received=useRef(0);
  const keys=useRef<Record<string,string>>({});
  const router=useRouter();
  function accept(result:JobResult) {
    if(result.board){setBoard(result.board);received.current=performance.now();setElapsed(0);}
    setError(Boolean(result.error));
    setMessage(result.error??(result.claimed?`Saved! +${ec(result.claimed.reward_subunits)} EC and +${result.claimed.reward_xp} XP. Your receipt is below.`:''));
  }
  useEffect(()=>{
    let mounted=true;
    jobAction('board').then(result=>{if(mounted)accept(result);}).catch(()=>{if(mounted){setError(true);setMessage('Connection interrupted. Refresh jobs to recover your saved progress.');}});
    const tick=setInterval(()=>setElapsed(performance.now()-received.current),500);
    return ()=>{mounted=false;clearInterval(tick);};
  },[]);
  function act(operation:'board'|'start'|'claim',id?:string) {
    if(pending)return;
    if(operation==='start'&&id&&!keys.current[id])keys.current[id]=crypto.randomUUID();
    startTransition(async()=>{
      try {
        const result=await jobAction(operation,id,id?keys.current[id]:undefined);accept(result);
        if(result.board){if(operation==='claim')keys.current={};router.refresh();}
      } catch {setError(true);setMessage('Connection interrupted. Retry safely; your job and rewards are saved on the server.');}
    });
  }
  const now=board?Date.parse(board.server_now)+elapsed:0;
  const active=board?.active;
  const remaining=active?Math.max(0,Math.ceil((Date.parse(active.ready_at)-now)/1000)):0;
  const cooldown=board?Math.max(0,...board.recent.map(r=>Math.ceil((Date.parse(r.cooldown_until)-now)/1000))):0;
  return <section className="job-center" aria-label="NPC jobs" aria-busy={pending}>
    <p className="panel-intro">Small favors. Real progress. Help your neighbors, earn EC and grow your founder story.</p>
    <p className="job-rules">One job at a time. Rewards are saved only when you claim. Timers continue while you are away; the server verifies every claim.</p>
    <div aria-live="polite" aria-atomic="true">{message&&<p className={`feedback${error?' error':''}`} role={error?'alert':'status'}>{message}</p>}</div>
    <button className="panel-link" disabled={pending} onClick={()=>act('board')}>{pending?'Saving…':'Refresh jobs'}</button>
    {active&&<div className="job-active"><span className="eyebrow">YOUR CURRENT JOB</span><h3>{board?.catalog.find(j=>j.id===active.job_id)?.title??'District job'}</h3><p>{remaining>0?`In progress · about ${remaining}s remaining`:'Ready to claim · server will verify'}</p><p><strong>{ec(active.reward_subunits)} EC</strong> + {active.reward_xp} XP</p><button className="primary" disabled={pending||remaining>0} onClick={()=>act('claim',active.id)}>Claim reward</button><small>No need to keep this panel open.</small></div>}
    {!active&&cooldown>0&&<p className="feedback">Take a breather · about {cooldown}s before your next job.</p>}
    <div className="job-list">{board?.catalog.map(job=><article className="job-card" key={job.id}><span className="eyebrow">{job.npc_name}</span><h3>{job.title}</h3><p>{job.description}</p><dl><div><dt>Reward</dt><dd>{ec(job.reward_subunits)} EC · {job.reward_xp} XP</dd></div><div><dt>Time / break</dt><dd>{job.duration_seconds}s / {job.cooldown_seconds}s</dd></div></dl><button className="primary" disabled={pending||Boolean(active)||cooldown>0||level<job.min_level} onClick={()=>act('start',job.id)}>{level<job.min_level?`Unlocks at level ${job.min_level}`:`Start ${job.title}`}</button></article>)}</div>
    {board&&<div className="job-receipts"><h3>Recent earnings</h3>{board.recent.length===0?<p>Your first receipt will appear here.</p>:<ul>{board.recent.map(r=><li key={r.run_id}><strong>+{ec(r.reward_subunits)} EC · +{r.reward_xp} XP</strong><small>Saved {new Date(r.claimed_at).toLocaleString()} · Receipt {r.run_id.slice(0,8)}</small></li>)}</ul>}<p>Every 100 XP adds a level, up to level 25. Other district businesses remain future previews.</p></div>}
  </section>;
}
