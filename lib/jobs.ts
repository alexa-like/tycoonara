export type Job = {id:string;title:string;npc_name:string;description:string;min_level:number;duration_seconds:number;cooldown_seconds:number;reward_subunits:number;reward_xp:number};
export type JobRun = {id:string;job_id:string;started_at:string;ready_at:string;reward_subunits:number;reward_xp:number};
export type JobReceipt = {run_id:string;claimed_at:string;cooldown_until:string;reward_subunits:number;reward_xp:number};
export type JobBoard = {server_now:string;catalog:Job[];active:JobRun|null;recent:JobReceipt[]};
export type JobResult = {board?:JobBoard;error?:string;claimed?:JobReceipt};
