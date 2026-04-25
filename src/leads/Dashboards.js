import { useState, useEffect, useRef } from "react";

const TIER_CONFIG = {
  HOT:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: '🔥 HOT',  glow: 'rgba(239,68,68,0.3)'  },
  WARM:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '⚡ WARM', glow: 'rgba(245,158,11,0.3)' },
  COLD:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: '❄️ COLD', glow: 'rgba(59,130,246,0.3)' },
  UNKNOWN: { color: '#64748b', bg: 'rgba(100,116,139,0.12)',label: '? N/A',   glow: 'rgba(100,116,139,0.3)' },
};

function parseScore(s)  { const m = s?.match(/SCORE:\s*(\d+)/);  return m ? parseInt(m[1]) : 0; }
function parseTier(s)   { const m = s?.match(/TIER:\s*(\w+)/);   return m ? m[1] : 'UNKNOWN'; }
function parseBudget(s) { const m = s?.match(/BUDGET_ESTIMATE:\s*(.+)/); return m ? m[1].trim() : 'N/A'; }

// ── ANIMATED COUNTER ───────────────────────────────────────────────────────
function Counter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display}</>;
}

// ── MINI DONUT CHART ───────────────────────────────────────────────────────
function DonutChart({ hot, warm, cold, total }) {
  const size = 120;
  const r = 45;
  const circ = 2 * Math.PI * r;
  const hotPct  = total ? (hot  / total) : 0;
  const warmPct = total ? (warm / total) : 0;
  const coldPct = total ? (cold / total) : 0;
  const hotDash  = hotPct  * circ;
  const warmDash = warmPct * circ;
  const coldDash = coldPct * circ;
  const hotOff   = 0;
  const warmOff  = -(hotDash);
  const coldOff  = -(hotDash + warmDash);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14"/>
      {total > 0 && <>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ef4444"
          strokeWidth="14" strokeDasharray={`${hotDash} ${circ - hotDash}`}
          strokeDashoffset={hotOff} style={{transition:'all 1s ease'}}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f59e0b"
          strokeWidth="14" strokeDasharray={`${warmDash} ${circ - warmDash}`}
          strokeDashoffset={warmOff} style={{transition:'all 1s ease'}}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#3b82f6"
          strokeWidth="14" strokeDasharray={`${coldDash} ${circ - coldDash}`}
          strokeDashoffset={coldOff} style={{transition:'all 1s ease'}}/>
      </>}
    </svg>
  );
}

// ── SCORE BAR ──────────────────────────────────────────────────────────────
function ScoreBar({ score, color }) {
  return (
    <div style={{flex:1, height:4, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden'}}>
      <div style={{
        height:'100%', width:`${score * 10}%`,
        background: color, borderRadius:4,
        transition:'width 1s ease', boxShadow:`0 0 8px ${color}`
      }}/>
    </div>
  );
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function Dashboard({ leads, onSelectLead }) {
  const [view, setView] = useState('overview'); // overview | kanban

  const hot  = leads.filter(l => parseTier(l.score) === 'HOT');
  const warm = leads.filter(l => parseTier(l.score) === 'WARM');
  const cold = leads.filter(l => parseTier(l.score) === 'COLD');
  const avgScore = leads.length
    ? Math.round(leads.reduce((a, l) => a + parseScore(l.score), 0) / leads.length * 10) / 10
    : 0;

  // Score distribution buckets
  const buckets = [0,0,0,0,0,0,0,0,0,0];
  leads.forEach(l => {
    const s = parseScore(l.score);
    if (s >= 1 && s <= 10) buckets[s-1]++;
  });
  const maxBucket = Math.max(...buckets, 1);

  // Recent activity (last 5)
  const recent = [...leads].slice(0, 5);

  if (!leads.length) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', minHeight:400, color:'#334155', textAlign:'center'
      }}>
        <div style={{fontSize:56, marginBottom:16, opacity:0.4}}>📊</div>
        <h3 style={{color:'#475569', fontSize:18, margin:'0 0 8px'}}>No data yet</h3>
        <p style={{fontSize:14, margin:0}}>Research some companies to see your dashboard</p>
      </div>
    );
  }

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>

      {/* View toggle */}
      <div style={{display:'flex', gap:8}}>
        {['overview','kanban'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding:'8px 18px', borderRadius:8, border:'1.5px solid',
            borderColor: view===v ? '#3b82f6' : '#1e293b',
            background: view===v ? 'rgba(59,130,246,0.12)' : '#0a1628',
            color: view===v ? '#93c5fd' : '#475569',
            fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.2s',
            textTransform:'capitalize'
          }}>
            {v === 'overview' ? '📊 Overview' : '🗂 Kanban'}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <>
          {/* KPI Cards */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12}}>
            {[
              { label:'Total Leads', value:leads.length, icon:'🎯', color:'#8b5cf6' },
              { label:'Hot Leads',   value:hot.length,   icon:'🔥', color:'#ef4444' },
              { label:'Warm Leads',  value:warm.length,  icon:'⚡', color:'#f59e0b' },
              { label:'Avg Score',   value:avgScore,     icon:'⭐', color:'#10b981', isFloat:true },
            ].map((kpi,i) => (
              <div key={i} style={{
                background:'#0a1628', border:'1px solid #1e293b',
                borderRadius:12, padding:'16px',
                borderTop:`2px solid ${kpi.color}`,
              }}>
                <div style={{fontSize:20, marginBottom:8}}>{kpi.icon}</div>
                <div style={{
                  fontSize:28, fontWeight:900, color:'#f1f5f9',
                  lineHeight:1, marginBottom:4
                }}>
                  {kpi.isFloat ? avgScore : <Counter value={kpi.value}/>}
                </div>
                <div style={{fontSize:11, color:'#475569', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                  {kpi.label}
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>

            {/* Donut + legend */}
            <div style={{
              background:'#0a1628', border:'1px solid #1e293b',
              borderRadius:12, padding:20,
            }}>
              <div style={{fontSize:12, fontWeight:700, color:'#475569',
                textTransform:'uppercase', letterSpacing:'1px', marginBottom:16}}>
                Lead Distribution
              </div>
              <div style={{display:'flex', alignItems:'center', gap:20}}>
                <div style={{position:'relative', flexShrink:0}}>
                  <DonutChart hot={hot.length} warm={warm.length} cold={cold.length} total={leads.length}/>
                  <div style={{
                    position:'absolute', inset:0, display:'flex',
                    flexDirection:'column', alignItems:'center', justifyContent:'center'
                  }}>
                    <div style={{fontSize:20, fontWeight:900, color:'#f1f5f9'}}>{leads.length}</div>
                    <div style={{fontSize:9, color:'#475569', textTransform:'uppercase'}}>total</div>
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:10, flex:1}}>
                  {[
                    { label:'Hot',  count:hot.length,  color:'#ef4444' },
                    { label:'Warm', count:warm.length, color:'#f59e0b' },
                    { label:'Cold', count:cold.length, color:'#3b82f6' },
                  ].map(item => (
                    <div key={item.label} style={{display:'flex', alignItems:'center', gap:8}}>
                      <div style={{width:8, height:8, borderRadius:'50%', background:item.color, flexShrink:0}}/>
                      <div style={{fontSize:12, color:'#94a3b8', flex:1}}>{item.label}</div>
                      <div style={{fontSize:13, fontWeight:700, color:item.color}}>{item.count}</div>
                      <div style={{fontSize:11, color:'#334155'}}>
                        {leads.length ? Math.round(item.count/leads.length*100) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Score histogram */}
            <div style={{
              background:'#0a1628', border:'1px solid #1e293b',
              borderRadius:12, padding:20,
            }}>
              <div style={{fontSize:12, fontWeight:700, color:'#475569',
                textTransform:'uppercase', letterSpacing:'1px', marginBottom:16}}>
                Score Distribution
              </div>
              <div style={{display:'flex', alignItems:'flex-end', gap:4, height:80}}>
                {buckets.map((count, i) => {
                  const score = i + 1;
                  const color = score >= 8 ? '#ef4444' : score >= 5 ? '#f59e0b' : '#3b82f6';
                  return (
                    <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                      <div style={{
                        width:'100%', background: count > 0 ? color : 'rgba(255,255,255,0.05)',
                        borderRadius:'3px 3px 0 0', height: `${(count/maxBucket)*64}px`,
                        minHeight: count > 0 ? 4 : 0,
                        transition:'height 1s ease',
                        boxShadow: count > 0 ? `0 0 8px ${color}40` : 'none'
                      }}/>
                      <div style={{fontSize:9, color:'#334155'}}>{score}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent leads table */}
          <div style={{
            background:'#0a1628', border:'1px solid #1e293b', borderRadius:12, overflow:'hidden'
          }}>
            <div style={{
              padding:'14px 20px', borderBottom:'1px solid #1e293b',
              display:'flex', justifyContent:'space-between', alignItems:'center'
            }}>
              <div style={{fontSize:12, fontWeight:700, color:'#475569',
                textTransform:'uppercase', letterSpacing:'1px'}}>
                Recent Leads
              </div>
              <div style={{fontSize:11, color:'#334155'}}>{leads.length} total</div>
            </div>
            <div>
              {leads.slice(0,8).map((lead, i) => {
                const tier = parseTier(lead.score);
                const tc = TIER_CONFIG[tier] || TIER_CONFIG.UNKNOWN;
                const score = parseScore(lead.score);
                return (
                  <div key={i} onClick={() => onSelectLead(lead)} style={{
                    display:'flex', alignItems:'center', gap:16,
                    padding:'12px 20px', cursor:'pointer',
                    borderBottom: i < Math.min(leads.length,8)-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{
                      width:32, height:32, borderRadius:8,
                      background: tc.bg, border:`1px solid ${tc.color}40`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:14, flexShrink:0
                    }}>
                      {tier === 'HOT' ? '🔥' : tier === 'WARM' ? '⚡' : '❄️'}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:700, color:'#cbd5e1',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {lead.company}
                      </div>
                      <div style={{fontSize:11, color:'#334155'}}>
                        {new Date(lead.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <ScoreBar score={score} color={tc.color}/>
                    <div style={{
                      fontSize:14, fontWeight:800, color:tc.color,
                      width:36, textAlign:'right', flexShrink:0
                    }}>
                      {score}/10
                    </div>
                    <div style={{
                      fontSize:10, fontWeight:700, padding:'3px 8px',
                      borderRadius:100, background:tc.bg, color:tc.color,
                      flexShrink:0, minWidth:44, textAlign:'center'
                    }}>
                      {tier}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {view === 'kanban' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16}}>
          {[
            { tier:'HOT',  leads:hot,  icon:'🔥', color:'#ef4444' },
            { tier:'WARM', leads:warm, icon:'⚡', color:'#f59e0b' },
            { tier:'COLD', leads:cold, icon:'❄️', color:'#3b82f6' },
          ].map(col => (
            <div key={col.tier} style={{
              background:'#0a1628', border:`1px solid ${col.color}30`,
              borderRadius:12, overflow:'hidden',
              borderTop:`3px solid ${col.color}`
            }}>
              {/* Column header */}
              <div style={{
                padding:'14px 16px', borderBottom:'1px solid #1e293b',
                display:'flex', justifyContent:'space-between', alignItems:'center'
              }}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span>{col.icon}</span>
                  <span style={{fontSize:13, fontWeight:700, color:col.color}}>{col.tier}</span>
                </div>
                <div style={{
                  fontSize:12, fontWeight:700,
                  background:`rgba(${col.tier==='HOT'?'239,68,68':col.tier==='WARM'?'245,158,11':'59,130,246'},0.15)`,
                  color:col.color, padding:'2px 8px', borderRadius:100
                }}>
                  {col.leads.length}
                </div>
              </div>

              {/* Cards */}
              <div style={{padding:12, display:'flex', flexDirection:'column', gap:8, maxHeight:500, overflowY:'auto'}}>
                {col.leads.length === 0 ? (
                  <div style={{
                    textAlign:'center', padding:'24px 0',
                    fontSize:12, color:'#334155'
                  }}>No {col.tier.toLowerCase()} leads</div>
                ) : col.leads.map((lead, i) => (
                  <div key={i} onClick={() => onSelectLead(lead)} style={{
                    background:'#0f1e35', border:'1px solid #1e293b',
                    borderRadius:10, padding:'12px 14px',
                    cursor:'pointer', transition:'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = col.color+'60'; e.currentTarget.style.transform='translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform='none'; }}>
                    <div style={{
                      display:'flex', justifyContent:'space-between',
                      alignItems:'flex-start', marginBottom:8
                    }}>
                      <div style={{fontSize:13, fontWeight:700, color:'#cbd5e1'}}>
                        {lead.company}
                      </div>
                      <div style={{
                        fontSize:13, fontWeight:800, color:col.color, flexShrink:0
                      }}>
                        {parseScore(lead.score)}/10
                      </div>
                    </div>
                    <div style={{marginBottom:8}}>
                      <ScoreBar score={parseScore(lead.score)} color={col.color}/>
                    </div>
                    <div style={{
                      display:'flex', justifyContent:'space-between',
                      fontSize:10, color:'#334155'
                    }}>
                      <span>{parseBudget(lead.score)}</span>
                      <span>{new Date(lead.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}