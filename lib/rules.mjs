export const AVATARS = ['cedar', 'marigold', 'tide', 'orchid'];
export const INITIAL_BALANCE = 50000;
export function validUsername(value) { return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(value); }
export function safeNext(value, fallback = '/game') {
  // Deliberate allowlist: email links never redirect to arbitrary paths or origins.
  return ['/game', '/onboarding', '/auth/update-password'].includes(value) ? value : fallback;
}
export function ec(value) {
  if (!Number.isSafeInteger(Number(value))) throw new Error('Invalid EC amount');
  return new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) / 100);
}
export const BUILDINGS = [
  { id:'hq', name:'Headquarters', level:1, x:44, y:48, color:'#e6b54b', kind:'hq', description:'Your first address in Tycoonara. Your founder profile and initial grant are safely recorded here.' },
  { id:'jobs', name:'Job Center', level:1, x:23, y:33, color:'#63a783', kind:'office', description:'Meet the people who keep the district running. Complete NPC jobs to earn EC and XP, one saved reward at a time.' },
  { id:'market', name:'Marketplace', level:1, x:69, y:38, color:'#d98265', kind:'market', description:'A future meeting place for buyers and sellers. Trading is not available in Stage 1.' },
  { id:'retail', name:'Retail District', level:2, x:77, y:63, color:'#cf9a50', kind:'market', description:'A row of future storefronts for your next chapter.' },
  { id:'factory', name:'Factory', level:3, x:20, y:64, color:'#7d94a0', kind:'factory', description:'Production lines are quiet for now. Manufacturing is a future-stage feature.' },
  { id:'academy', name:'Academy', level:4, x:45, y:22, color:'#6d97bd', kind:'academy', description:'A place to turn curiosity into business knowledge in a future stage.' },
  { id:'logistics', name:'Logistics Depot', level:7, x:11, y:86, color:'#7d9d81', kind:'factory', description:'Future deliveries start here.' },
  { id:'recruitment', name:'Recruitment Office', level:10, x:11, y:11, color:'#c9a3aa', kind:'office', description:'Build your future team when recruitment opens.' },
  { id:'corporate', name:'Corporate Tower', level:15, x:72, y:12, color:'#7a9ca9', kind:'tower', description:'Room for big ambitions. Corporations are reserved for a future stage.' },
  { id:'research', name:'Research Center', level:20, x:91, y:29, color:'#98a5c9', kind:'academy', description:'Tomorrow’s ideas have a home here. Research is not active yet.' },
  { id:'property', name:'Property Exchange', level:25, x:55, y:81, color:'#b5a17a', kind:'office', description:'Discover future places to put down roots.' },
];
export function buildingState(building, level) { return level < building.level ? 'Locked' : ['hq','jobs'].includes(building.id) ? 'Available' : 'Preview'; }
