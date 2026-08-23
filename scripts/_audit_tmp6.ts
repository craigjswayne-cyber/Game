import { buildLeague, roundRobin } from '../src/game/schedule'
import { mulberry32 } from '../src/game/rng'
const st: any = { fixtures: [], nextId: 1 }
for (const n of [0,1,2,3,4,5,15]) {
  st.fixtures = []
  const teams = Array.from({length:n}, (_,i)=>`t${i}`)
  try {
    const c = buildLeague({id:'x',name:'X',short:'X',teams,double:false,playoffTeams:0}, mulberry32(1), st)
    const weeks = st.fixtures.map((f:any)=>f.week)
    console.log(`n=${n}: rounds=${c.rounds} fixtures=${st.fixtures.length} weeks=[${[...new Set(weeks)].join(',')}] weeksByRound=[${c.weeksByRound}]`)
  } catch(e){ console.log(`n=${n}: THREW ${String(e).split('\n')[0]}`) }
}
