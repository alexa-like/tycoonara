'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import type { JobResult } from '@/lib/jobs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGES=new Set(['Finish your current job first','Take a short break before another job','Job unavailable at your level','Job is still in progress','Job not found','Request key conflict']);
// A server-only, default-off gate keeps stacked previews safe on the Stage 1 database.
export async function jobAction(operation:'board'|'start'|'claim',jobId?:string,key?:string):Promise<JobResult> {
  const {supabase}=await requireUser();
  if(process.env.TYCOONARA_JOBS_ENABLED!=='true')return {error:'Job Center is awaiting its isolated development database. No earnings actions are enabled here.'};
  if(!['board','start','claim'].includes(operation))return {error:'Unknown job action.'};
  if(operation==='start'&&(!jobId||!/^[a-z-]{1,40}$/.test(jobId)||!key||!UUID.test(key)))return {error:'Please choose a job and try again.'};
  if(operation==='claim'&&(!jobId||!UUID.test(jobId)))return {error:'Please choose your active job.'};
  let claimed;
  if(operation!=='board') {
    const {data,error}=operation==='start'
      ?await supabase.rpc('start_job',{chosen_job:jobId,request_key:key})
      :await supabase.rpc('claim_job',{chosen_run:jobId});
    if(error)return {error:MESSAGES.has(error.message)?`${error.message}.`:'Your job could not be saved. Retry safely; duplicate rewards are prevented.'};
    if(operation==='claim')claimed=data;
    revalidatePath('/game');
  }
  const {data:board,error}=await supabase.rpc('job_board');
  if(error)return {error:'Unable to refresh the Job Center. Retry to recover your saved job safely.'};
  return {board,claimed};
}
