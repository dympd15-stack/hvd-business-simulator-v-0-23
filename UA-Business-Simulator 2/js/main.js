
(function(){
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const r2=(v)=>Math.round(v*100)/100;
  const $=(sel)=>document.querySelector(sel);
  const $$=(sel)=>Array.from(document.querySelectorAll(sel));

  let _UA_UNLOCK_SCORE = false;
  let _UA_UNLOCK_SCENARIO = false;
  const _UA_PASSWORD = 'UA123654';
  const app=document.getElementById("app");

  function buildIntro(){
    app.innerHTML="";
    const container=document.createElement("div"); container.className="container";
    const header=document.createElement("div");
    header.className="card"; header.innerHTML=`
      <div class="body" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="header-brand">
          <img src="assets/logo.png" alt="UA">
          <h1>UA Business Simulator <span class="badge ua">Produced by UA</span></h1>
        </div>
        <span class="badge">Academic Edition</span>
      </div>`;
    const hero=document.createElement("div"); hero.className="hero";
    hero.innerHTML = `
      <div class="bg"></div><div class="grain"></div>
      <div class="content">
        <h2>Harvard-Style Managerial Sandbox</h2>
        <p>This simulation places you in the role of a decision-maker balancing pricing, brand, quality, morale, capacity, cash, and policy shocks.</p>
        <p>Tariff shocks, rate hikes, labor strikes, quality issues, and viral marketing events can occur unpredictably.</p>
        <div class="cta">
          <button class="btn" id="start">Start Simulation</button>
        </div>
      </div>
    `;
    container.append(header,hero);
    app.appendChild(container);
    $("#start").addEventListener("click",buildSim);
  }

  const EVENT_DECK=[
    {id:"prumt_tariff",name:"Prumt Tariff Shock",hint:"Country A imposes tariffs; unit costs +15% this period",w:1,apply:()=>({unitCostBump:0.15})},
    {id:"supply_shock",name:"Supply Chain Spike",hint:"Raw materials up, unit cost +10% (this period)",w:1,apply:()=>({unitCostBump:0.10})},
    {id:"marketing_viral",name:"Marketing Viral",hint:"Short video goes viral, Brand +8 (this period)",w:1,apply:()=>({brandBoost:8})},
    {id:"quality_issue",name:"Quality Issue",hint:"Minor recall, Quality -10, Demand -5% (this period)",w:0.7,apply:()=>({qualityDrop:10,demandMul:0.95})},
    {id:"labor_strike",name:"Labor Strike",hint:"Morale -15, Effective capacity -10% (this period)",w:0.6,apply:()=>({moraleDrop:15,capacityMul:0.9})},
    {id:"rate_hike",name:"Rate Hike",hint:"Interest rate +50bp (persists)",w:0.6,apply:()=>({rateBpsUp:0.005})},
    {id:"nothing",name:"Calm",hint:"No major event this period",w:2,apply:()=>({})},
  ];
  function drawEvent(){
    const total=EVENT_DECK.reduce((s,e)=>s+e.w,0);
    let r=Math.random()*total;
    for(const e of EVENT_DECK){r-=e.w; if(r<=0) return e;}
    return EVENT_DECK[EVENT_DECK.length-1];
  }
  function compPrice(prev, player, s){
    const target=s.competitorBasePrice + (player - s.competitorBasePrice)*s.competitorAggressiveness;
    const np = 0.6*prev + 0.4*target;
    return r2(clamp(np,20,400));
  }

  const PRESETS={
    manufacturing:{label:"Manufacturing", scenario:{
      periods:12, baseDemand:1100, priceElasticity:-1.1, brandEffect:0.0007, qualityEffect:0.0014,
      seasonality:[1.0,0.95,1.05,1.15], unitCostBase:38, learningRate:0.0035, capacityInitial:1200,
      capacityUnitCost:20, fixedCost:18000, marketingDecay:0.55, qualityDecay:0.35, moraleDecay:0.40,
      interestRate:0.06, competitorAggressiveness:0.55, competitorBasePrice:82
    }},
    internet:{label:"Internet / Subscription", scenario:{
      periods:8, baseDemand:1400, priceElasticity:-0.6, brandEffect:0.0016, qualityEffect:0.0010,
      seasonality:[1.0,1.05,1.1,1.0], unitCostBase:22, learningRate:0.001, capacityInitial:1500,
      capacityUnitCost:6, fixedCost:26000, marketingDecay:0.65, qualityDecay:0.25, moraleDecay:0.35,
      interestRate:0.05, competitorAggressiveness:0.4, competitorBasePrice:60
    }},
    retail:{label:"Retail", scenario:{
      periods:10, baseDemand:1000, priceElasticity:-1.4, brandEffect:0.0009, qualityEffect:0.0008,
      seasonality:[0.9,0.95,1.0,1.3], unitCostBase:28, learningRate:0.0025, capacityInitial:1000,
      capacityUnitCost:12, fixedCost:14000, marketingDecay:0.5, qualityDecay:0.3, moraleDecay:0.45,
      interestRate:0.07, competitorAggressiveness:0.6, competitorBasePrice:70
    }}
  };

  function buildSim(){
    app.innerHTML="";
    const container=document.createElement("div"); container.className="container";

    const header=document.createElement("div");
    header.className="card"; header.innerHTML=`
      <div class="body" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn-outline" id="back">← Back to Story</button>
          <h1>UA Business Simulator <span class="badge ua">Produced by UA</span></h1>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <select id="industry" style="padding:8px;border:1px solid var(--line);border-radius:8px">
            <option value="manufacturing">Manufacturing</option>
            <option value="internet">Internet / Subscription</option>
            <option value="retail">Retail</option>
          </select>
          <label class="pill"><input type="checkbox" id="teaching" checked> Teaching mode</label>
          <div class="btns">
            <button class="btn" id="run">Run next period</button>
            <button class="btn-outline" id="reset">Reset</button>
            <button class="btn-sec" id="export">Export CSV</button>
          </div>
        </div>
      </div>`;

    const metrics=document.createElement("div"); metrics.className="metrics";
    metrics.innerHTML=`
      <div class="metric"><div><div class="name">Cash (¥)</div><div class="val" id="m-cash">-</div></div><span>💰</span></div>
      <div class="metric"><div><div class="name">Cumulative Net Income (¥)</div><div class="val" id="m-cni">-</div></div><span>📈</span></div>
      <div class="metric"><div><div class="name">Capacity (units/period)</div><div class="val" id="m-cap">-</div></div><span>🏭</span></div>
      <div class="metric" id="score-card" title="Click to unlock"><div><div class="name">Class Score</div><div class="val" id="m-score">•••</div></div><span>🔒</span></div>
    `;

    const bodyRow=document.createElement("div"); bodyRow.className="row row-3";
    const left=document.createElement("div"); left.className="card"; left.innerHTML=`
      <div class="body controls">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div><strong>Decisions — Period <span id="period">1</span></strong> <span class="muted">(Remaining <span id="remaining">-</span>)</span></div>
        </div>
        <div id="ctl"></div>
        <div class="hint">Tips: Brand/Quality/Morale decay; morale affects effective capacity; expansion timing matters; tariffs and rate hikes can strike randomly.</div>
      </div>`;

    const right=document.createElement("div"); right.className="card"; right.innerHTML=`
      <div class="body">
        <div class="tabs">
          <button class="tab active" data-tab="kpi">KPI Charts</button>
          <button class="tab" data-tab="table">Data Table</button>
          <button class="tab" data-tab="events">Events</button>
          <button class="tab" data-tab="scenario">Scenario</button>
        </div>
        <div id="tab-kpi">
          <div class="row-split">
            <div><div class="muted" style="margin:6px 0">Revenue & Net Income</div><svg id="chart1" class="chart"></svg></div>
            <div><div class="muted" style="margin:6px 0">Brand • Quality • Morale</div><svg id="chart2" class="chart"></svg></div>
          </div>
          <div class="row-split" style="margin-top:12px">
            <div><div class="muted" style="margin:6px 0">Cash Flows (CFO • CFI • CFF)</div><svg id="chart3" class="chart"></svg></div>
            <div><div class="muted" style="margin:6px 0">Assets • Debt • Equity</div><svg id="chart4" class="chart"></svg></div>
          </div>
        </div>
        <div id="tab-table" style="display:none;max-height:360px;overflow:auto"><table id="grid"></table></div>
        <div id="tab-events" style="display:none"><div class="events" id="evlog"></div></div>
        <div id="tab-scenario" style="display:none"><div id="scenarioFields" class="controls"></div></div>
      </div>`;

    bodyRow.append(left,right);

    const sideRow=document.createElement("div"); sideRow.className="row row-3b";
    sideRow.innerHTML=`
      <div class="card"><div class="body">
        <div><strong>Soft KPIs</strong> <div class="muted">Brand, Quality, Morale</div></div>
        <div class="kv"><span>Brand</span><span id="kv-brand">-</span></div>
        <div class="gauge"><div id="gg-brand" style="width:0%"></div></div>
        <div class="kv"><span>Quality</span><span id="kv-quality">-</span></div>
        <div class="gauge"><div id="gg-quality" style="width:0%"></div></div>
        <div class="kv"><span>Morale</span><span id="kv-morale">-</span></div>
        <div class="gauge"><div id="gg-morale" style="width:0%"></div></div>
      </div></div>

      <div class="card"><div class="body">
        <div><strong>Hard KPIs</strong> <div class="muted">Capacity, Debt, Competitor Price</div></div>
        <div class="kv"><span>Capacity</span><span id="kv-capacity">-</span></div>
        <div class="kv"><span>Debt</span><span id="kv-debt">-</span></div>
        <div class="kv"><span>Competitor Price</span><span id="kv-comp">-</span></div>
        <div class="kv"><span>Rate Hikes (cum)</span><span id="kv-rate">0%</span></div>
      </div></div>

      <div class="card"><div class="body">
        <div><strong>Debrief Prompts</strong><div class="muted">For teaching use</div></div>
        <ul class="muted" style="margin:6px 0 0 16px">
          <li>Price elasticity and non-linear demand.</li>
          <li>Marginal returns of marketing/R&D.</li>
          <li>CFO vs CFI vs CFF trade-offs.</li>
          <li>Event shock paths: tariffs, cost, rate, demand, capacity.</li>
        </ul>
      </div></div>
    `;

    const footer=document.createElement("div"); footer.className="footer";
    footer.textContent="© UA 版权所有 ©2025 · 保留所有权利 · Developed by Steven";

    container.append(header,metrics,bodyRow,sideRow,footer);
    app.appendChild(container);

    let industryKey="manufacturing";
    let scenario=JSON.parse(JSON.stringify(PRESETS[industryKey].scenario));
    let teaching=true;
    let carry={rateBpsDelta:0};

    let state={
      period:0, cash:100000, debt:20000, capacity:scenario.capacityInitial,
      brand:10, quality:10, morale:50, compPrice:85, cumUnits:0,
      equity:80000, assets:180000, PPE:scenario.capacityInitial*120*0.6,
    };

    let decisions={ price:99, marketingSpend:8000, rndSpend:6000, hrSpend:3000, capacityDelta:0, newDebt:0, repayDebt:0 };
    let history=[]; let evlog=[]; let dlog=[];

    function decisionRow(id,label,min,max,step,hint){
      const wrap=document.createElement("div");
      const top=document.createElement("label");
      const span=document.createElement("span"); span.textContent=label;
      const val=document.createElement("b"); val.textContent=decisions[id];
      top.append(span,val);
      const row=document.createElement("div"); row.style.display="flex"; row.style.gap="8px"; row.style.alignItems="center";
      const num=document.createElement("input"); num.type="number"; num.value=decisions[id]; num.min=min; num.max=max; num.step=step; num.style.width="110px";
      const rng=document.createElement("input"); rng.type="range"; rng.min=min; rng.max=max; rng.step=step; rng.value=decisions[id];
      function upd(v){ v=Number(v); v=isNaN(v)?0:v; v=clamp(v,min,max); decisions[id]=v; val.textContent=v; num.value=v; rng.value=v; }
      num.addEventListener("input",e=>upd(e.target.value));
      rng.addEventListener("input",e=>upd(e.target.value));
      row.append(num,rng);
      wrap.append(top,row);
      if(teaching && hint){ const p=document.createElement("div"); p.className="hint"; p.textContent=hint; wrap.append(p); }
      return wrap;
    }
    function buildControls(){
      const c=$("#ctl"); c.innerHTML="";
      c.append(
        decisionRow("price","Price (¥)",20,400,1,"Higher price ↓ demand via elasticity but ↑ unit revenue/margin."),
        decisionRow("marketingSpend","Marketing (¥)",0,60000,500,"Marketing → Brand. Brand decays and has diminishing returns."),
        decisionRow("rndSpend","R&D for Quality (¥)",0,60000,500,"Quality ↑ boosts demand and eases price pain."),
        decisionRow("hrSpend","People & Morale (¥)",0,40000,500,"Morale affects effective capacity."),
        decisionRow("capacityDelta","Capacity Δ (± units)",-800,4000,50,"Expansion needs CAPEX; too early hurts cash flow."),
        decisionRow("newDebt","New Debt (¥)",0,100000,1000,"Debt improves cash but raises interest burden."),
        decisionRow("repayDebt","Repay Debt (¥)",0,100000,1000,"Lower leverage cuts interest but uses cash.")
      );
    }
    function scenarioField(key,label,min,max,step){
      const wrap=document.createElement("div");
      const top=document.createElement("label");
      const span=document.createElement("span"); span.textContent=label;
      const val=document.createElement("b"); val.textContent=scenario[key];
      top.append(span,val);
      const row=document.createElement("div"); row.style.display="flex"; row.style.gap="8px"; row.style.alignItems="center";
      const num=document.createElement("input"); num.type="number"; num.value=scenario[key]; num.min=min; num.max=max; num.step=step; num.style.width="110px";
      const rng=document.createElement("input"); rng.type="range"; rng.min=min; rng.max=max; rng.step=step; rng.value=scenario[key];
      function upd(v){ v=Number(v); v=isNaN(v)?0:v; v=clamp(v,min,max); scenario[key]=v; val.textContent=v; num.value=v; rng.value=v; }
      num.addEventListener("input",e=>upd(e.target.value));
      rng.addEventListener("input",e=>upd(e.target.value));
      row.append(num,rng);
      wrap.append(top,row);
      return wrap;
    }
    function buildScenarioFields(){
      const s=$("#scenarioFields"); s.innerHTML="";
      s.append(
        scenarioField("periods","Periods",4,20,1),
        scenarioField("baseDemand","Base Demand",200,5000,50),
        scenarioField("priceElasticity","Price Elasticity (neg.)",-2.5,-0.1,0.1),
        scenarioField("brandEffect","Brand Coef.",0.0001,0.003,0.0001),
        scenarioField("qualityEffect","Quality Coef.",0.0001,0.003,0.0001),
        scenarioField("fixedCost","Fixed Cost / period",2000,80000,500),
        scenarioField("learningRate","Learning Rate",0,0.01,0.0005),
        scenarioField("capacityInitial","Initial Capacity",200,8000,50),
        scenarioField("unitCostBase","Unit Cost (base)",10,120,1),
        scenarioField("capacityUnitCost","Capacity Util. Add-on",0,60,1),
        scenarioField("interestRate","Interest (annual)",0,0.3,0.01),
        scenarioField("competitorBasePrice","Competitor Base Price",20,400,1)
      );
    }

    function drawLines(svgId, history, series){
      const svg=$(svgId); const W=svg.clientWidth||600; const H=svg.clientHeight||240;
      svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
      while(svg.firstChild) svg.removeChild(svg.firstChild);
      const pad={l:40,r:10,t:10,b:22};
      const xs=history.map(d=>d.period);
      const ys=[];
      series.forEach(s=>history.forEach(d=>{ if(typeof d[s.key]==="number") ys.push(d[s.key]); }));
      const xMin=xs.length?Math.min(...xs):0, xMax=xs.length?Math.max(...xs):1;
      const yMin=ys.length?Math.min(...ys):0, yMax=ys.length?Math.max(...ys):1;
      const X=v=>pad.l + ( (v-xMin)/(xMax-xMin||1) )*(W-pad.l-pad.r);
      const Y=v=>H-pad.b - ( (v-yMin)/(yMax-yMin||1) )*(H-pad.t-pad.b);
      const ax=document.createElementNS("http://www.w3.org/2000/svg","path");
      ax.setAttribute("d",`M${pad.l},${pad.t} V${H-pad.b} H${W-pad.r}`);
      ax.setAttribute("stroke","#cbd5e1"); ax.setAttribute("fill","none"); svg.appendChild(ax);
      for(let i=0;i<=4;i++){ const y=yMin+(yMax-yMin)*i/4; const gy=Y(y);
        const g=document.createElementNS("http://www.w3.org/2000/svg","line");
        g.setAttribute("x1",pad.l);g.setAttribute("x2",W-pad.r);g.setAttribute("y1",gy);g.setAttribute("y2",gy);
        g.setAttribute("stroke","#eef2f7"); svg.appendChild(g);
        const t=document.createElementNS("http://www.w3.org/2000/svg","text");
        t.setAttribute("x",4); t.setAttribute("y",gy+4); t.setAttribute("font-size","10"); t.setAttribute("fill","#6b7280");
        t.textContent=r2(y); svg.appendChild(t);
      }
      series.forEach((s,idx)=>{
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");
        let d=""; history.forEach((row,j)=>{
          const x=X(row.period), y=Y(row[s.key]||0);
          d += (j===0?`M${x},${y}`:` L${x},${y}`);
        });
        path.setAttribute("d",d); path.setAttribute("fill","none");
        const palette=["#0f3d3e","#c9a227","#2563eb","#16a34a","#ef4444","#7c3aed"];
        path.setAttribute("stroke",palette[idx%palette.length]); path.setAttribute("stroke-width","2");
        svg.appendChild(path);
        const label=document.createElementNS("http://www.w3.org/2000/svg","text");
        label.setAttribute("x",W-90); label.setAttribute("y",pad.t+12+12*idx); label.setAttribute("font-size","11"); label.setAttribute("fill",palette[idx%palette.length]);
        label.textContent=s.name; svg.appendChild(label);
      });
    }
    function refreshCharts(){
      drawLines("#chart1",history,[ {key:"revenue",name:"Revenue"}, {key:"netIncome",name:"Net Income"} ]);
      drawLines("#chart2",history,[ {key:"brand",name:"Brand"}, {key:"quality",name:"Quality"}, {key:"morale",name:"Morale"} ]);
      drawLines("#chart3",history,[ {key:"CFO",name:"CFO"}, {key:"CFI",name:"CFI"}, {key:"CFF",name:"CFF"} ]);
      drawLines("#chart4",history,[ {key:"assets",name:"Assets"}, {key:"debt",name:"Debt"}, {key:"equity",name:"Equity"} ]);
    }

    function simulatePeriod(){
      const p=state.period+1;
      const season=scenario.seasonality[(p-1)%scenario.seasonality.length];
      const ev=drawEvent(); alert(`⚠️ Special Event: ${ev.name}\n${ev.hint}`); const effect=ev.apply();

      const brand=clamp(state.brand*(1-scenario.marketingDecay) + decisions.marketingSpend*scenario.brandEffect + (effect.brandBoost||0),0,100);
      const quality=clamp(state.quality*(1-scenario.qualityDecay) + decisions.rndSpend*scenario.qualityEffect - (effect.qualityDrop||0),0,100);
      const morale=clamp(state.morale*(1-scenario.moraleDecay) + decisions.hrSpend*0.001 - (effect.moraleDrop||0),0,100);

      const compP=compPrice(state.compPrice, decisions.price, scenario);

      const demandPriceFactor = Math.pow(decisions.price/100, scenario.priceElasticity);
      let demand = scenario.baseDemand * demandPriceFactor * (1 + brand/200) * (1 + quality/180) * season * (effect.demandMul||1);

      const effectiveCapacity = state.capacity * (0.8 + morale/500) * (effect.capacityMul||1);
      const units=Math.min(demand, effectiveCapacity);

      const avgCostBase = scenario.unitCostBase * (1 - scenario.learningRate * Math.log(1 + state.cumUnits/1000));
      const avgCost = (avgCostBase * (1 + (effect.unitCostBump||0))) + scenario.capacityUnitCost * (units/Math.max(1,state.capacity));
      const cogs=units*avgCost;

      const revenue=units*decisions.price;
      const grossProfit=revenue-cogs;

      const opex=scenario.fixedCost + decisions.marketingSpend + decisions.rndSpend + decisions.hrSpend;

      const baseRate=scenario.interestRate + (carry.rateBpsDelta||0);
      const interest=state.debt * (baseRate/4);

      const capexUnitCost=120;
      const capex=Math.max(0,decisions.capacityDelta)*capexUnitCost;
      const capacityAfter=clamp(state.capacity + decisions.capacityDelta, 200, 20000);

      const newDebt=clamp(state.debt + decisions.newDebt - decisions.repayDebt, 0, 1_000_000_000);

      const ebit=grossProfit-opex;
      const ebt=ebit - interest;
      const tax=Math.max(0,0.2*ebt);
      const netIncome=ebt - tax;

      const CFO=netIncome;
      const CFI=-capex;
      const CFF=decisions.newDebt - decisions.repayDebt;
      let cash=state.cash + CFO + CFI + CFF;
      const overdraftPenalty = cash<0 ? Math.abs(cash)*0.05 : 0;
      cash -= overdraftPenalty;

      const PPE=capacityAfter*capexUnitCost*0.6;
      const assets=cash + PPE;
      const equity=assets - newDebt;

      if(effect.rateBpsUp){ carry.rateBpsDelta=(carry.rateBpsDelta||0)+effect.rateBpsUp; }

      state={
        period:p, cash, debt:newDebt, capacity:capacityAfter,
        brand, quality, morale, compPrice:compP, cumUnits:state.cumUnits+units,
        equity, assets, PPE
      };

      const kpis={
        period:p, season:r2(season), event:ev.name, price:decisions.price, compPrice:compP,
        demand:r2(demand), units:r2(units), revenue:r2(revenue), cogs:r2(cogs),
        grossProfit:r2(grossProfit), opex:r2(opex), interest:r2(interest), tax:r2(tax),
        netIncome:r2(netIncome), CFO:r2(CFO-overdraftPenalty), CFI:r2(CFI), CFF:r2(CFF),
        cash:r2(state.cash), debt:r2(state.debt), equity:r2(state.equity), assets:r2(state.assets),
        capacity:r2(state.capacity), brand:r2(brand), quality:r2(quality), morale:r2(morale),
        avgCost:r2(avgCost)
      };
      history.push(kpis);
      evlog.push({period:p, id:ev.id, name:ev.name, hint:ev.hint});
      dlog.push({period:p, ...decisions});
    }

    function refreshMetrics(){
      $("#m-cash").textContent=r2(state.cash);
      const cni=history.reduce((s,r)=>s+(r.netIncome||0),0);
      $("#m-cni").textContent=r2(cni);
      $("#m-cap").textContent=r2(state.capacity);
      const last=history[history.length-1]||{cash:state.cash, debt:state.debt, brand:state.brand, quality:state.quality, morale:state.morale};
      const penalty=(last.cash<0)?5000:0;
      const score=r2(last.cash + cni*0.6 - last.debt*0.3 + last.brand*200 + last.quality*150 + last.morale*100 - penalty);
      if(_UA_UNLOCK_SCORE && state.period>0){ $("#m-score").textContent=score; $("#score-card").querySelector("span").textContent="🎓"; }
      else { $("#m-score").textContent="•••"; $("#score-card").querySelector("span").textContent="🔒"; }
      $("#period").textContent=state.period+1;
      $("#remaining").textContent=Math.max(0, scenario.periods-state.period);
      $("#kv-brand").textContent=r2(state.brand); $("#gg-brand").style.width=clamp(state.brand,0,100)+"%";
      $("#kv-quality").textContent=r2(state.quality); $("#gg-quality").style.width=clamp(state.quality,0,100)+"%";
      $("#kv-morale").textContent=r2(state.morale); $("#gg-morale").style.width=clamp(state.morale,0,100)+"%";
      $("#kv-capacity").textContent=r2(state.capacity)+" units/period";
      $("#kv-debt").textContent="¥ "+r2(state.debt);
      $("#kv-comp").textContent="¥ "+r2(state.compPrice||0);
      $("#kv-rate").textContent=r2((carry.rateBpsDelta||0)*100)+"%";
    }

    function refreshTable(){
      const grid=$("#tab-table #grid");
      grid.innerHTML="";
      const rows=history;
      if(rows.length===0){ grid.innerHTML="<thead><tr><th>No data yet — click 'Run next period'</th></tr></thead>"; return; }
      const keys=Object.keys(rows[0]);
      const thead=document.createElement("thead"); const trh=document.createElement("tr");
      keys.forEach(k=>{ const th=document.createElement("th"); th.textContent=k; trh.appendChild(th); });
      thead.appendChild(trh);
      const tbody=document.createElement("tbody");
      rows.forEach(r=>{ const tr=document.createElement("tr"); keys.forEach(k=>{ const td=document.createElement("td"); td.textContent=r[k]; tr.appendChild(td); }); tbody.appendChild(tr); });
      grid.append(thead,tbody);
    }

    function refreshEvents(){
      const box=$("#evlog"); box.innerHTML="";
      if(evlog.length===0){ box.innerHTML='<div class="muted">No events yet — run a few periods.</div>'; return; }
      evlog.forEach(e=>{
        const div=document.createElement("div"); div.className="event";
        div.innerHTML=`<div>⚠️</div><div><div><b>Period ${e.period}</b> · ${e.name}</div><div class="muted" style="font-size:12px">${e.hint}</div></div>`;
        box.appendChild(div);
      });
    }

    function refreshAll(){ refreshMetrics(); refreshCharts(); refreshTable(); refreshEvents(); }

    // Scenario fields builder (duplicate to maintain closure over 'scenario')
    function buildScenarioFields(){ 
      const sElm=$("#scenarioFields"); sElm.innerHTML="";
      function sf(key,label,min,max,step){
        const wrap=document.createElement("div");
        const top=document.createElement("label");
        const span=document.createElement("span"); span.textContent=label;
        const val=document.createElement("b"); val.textContent=scenario[key];
        top.append(span,val);
        const row=document.createElement("div"); row.style.display="flex"; row.style.gap="8px"; row.style.alignItems="center";
        const num=document.createElement("input"); num.type="number"; num.value=scenario[key]; num.min=min; num.max=max; num.step=step; num.style.width="110px";
        const rng=document.createElement("input"); rng.type="range"; rng.min=min; rng.max=max; rng.step=step; rng.value=scenario[key];
        function upd(v){ v=Number(v); v=isNaN(v)?0:v; v=clamp(v,min,max); scenario[key]=v; val.textContent=v; num.value=v; rng.value=v; }
        num.addEventListener("input",e=>upd(e.target.value));
        rng.addEventListener("input",e=>upd(e.target.value));
        row.append(num,rng);
        wrap.append(top,row);
        return wrap;
      }
      sElm.append(
        sf("periods","Periods",4,20,1), sf("baseDemand","Base Demand",200,5000,50), sf("priceElasticity","Price Elasticity (neg.)",-2.5,-0.1,0.1),
        sf("brandEffect","Brand Coef.",0.0001,0.003,0.0001), sf("qualityEffect","Quality Coef.",0.0001,0.003,0.0001),
        sf("fixedCost","Fixed Cost / period",2000,80000,500), sf("learningRate","Learning Rate",0,0.01,0.0005),
        sf("capacityInitial","Initial Capacity",200,8000,50), sf("unitCostBase","Unit Cost (base)",10,120,1),
        sf("capacityUnitCost","Capacity Util. Add-on",0,60,1), sf("interestRate","Interest (annual)",0,0.3,0.01),
        sf("competitorBasePrice","Competitor Base Price",20,400,1)
      );
    }

    // Locks & tabs
    document.addEventListener("click",(e)=>{
      const card=e.target.closest("#score-card");
      if(card){
        const pwd=prompt("Enter password to view Score:");
        if(pwd===_UA_PASSWORD){ _UA_UNLOCK_SCORE=true; alert("✅ Access granted."); refreshMetrics(); }
        else if(pwd!==null){ alert("❌ Incorrect password. Access denied."); }
      }
    });
    $$(".tab").forEach(btn=>btn.addEventListener("click",(ev)=>{
      const targetTab = btn.dataset.tab;
      if(targetTab==="scenario" && !_UA_UNLOCK_SCENARIO){
        const pwd=prompt("Enter password to access Scenario settings:");
        if(pwd===_UA_PASSWORD){ _UA_UNLOCK_SCENARIO=true; alert("✅ Scenario unlocked."); }
        else{
          alert("❌ Incorrect password. Access denied.");
          ev.stopImmediatePropagation();
          return;
        }
      }
      $$(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      ["kpi","table","events","scenario"].forEach(id=>$("#tab-"+id).style.display="none");
      $("#tab-"+btn.dataset.tab).style.display="block";
    }));

    // Wiring
    $("#back").addEventListener("click",buildIntro);
    $("#industry").addEventListener("change",e=>{
      industryKey=e.target.value;
      scenario=JSON.parse(JSON.stringify(PRESETS[industryKey].scenario));
      state.capacity=scenario.capacityInitial;
      state.PPE=scenario.capacityInitial*120*0.6;
      state.period=0; history=[]; dlog=[]; evlog=[]; carry={rateBpsDelta:0};
      buildScenarioFields();
      refreshAll();
    });
    $("#teaching").addEventListener("change",e=>{ teaching=e.target.checked; buildControls(); });
    $("#run").addEventListener("click",()=>{
      if(state.period>=scenario.periods){ alert("No periods remaining."); return; }
      simulatePeriod(); refreshAll();
    });
    $("#reset").addEventListener("click",()=>{
      scenario=JSON.parse(JSON.stringify(PRESETS[industryKey].scenario));
      state={ period:0, cash:100000, debt:20000, capacity:scenario.capacityInitial,
        brand:10, quality:10, morale:50, compPrice:85, cumUnits:0,
        equity:80000, assets:180000, PPE:scenario.capacityInitial*120*0.6 };
      history=[]; evlog=[]; dlog=[]; carry={rateBpsDelta:0};
      buildScenarioFields(); refreshAll();
    });
    $("#export").addEventListener("click",()=>{
      if(history.length===0){ alert("No data to export yet."); return; }
      const meta=[
        `Industry,${PRESETS[industryKey].label}`,
        `Mode,${teaching?'Teaching':'Challenge'}`,
        `BaseRate,${scenario.interestRate}`,
        `Periods,${scenario.periods}`,
      ].join("\n");

      const kKeys=Object.keys(history[0]);
      const kRows=[kKeys.join(",")].concat(history.map(r=>kKeys.map(k=>r[k]).join(",")));

      const dKeys=Object.keys(dlog[0]||{period:0});
      const dRows=[dKeys.join(",")].concat(dlog.map(r=>dKeys.map(k=>r[k]).join(",")));

      const eRows=["period,id,name,hint"].concat(evlog.map(e=>[e.period,e.id,e.name,e.hint].join(",")));

      const csv=[meta,"","[KPI]",...kRows,"","[DECISIONS]",...dRows,"","[EVENTS]",...eRows].join("\n");
      const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url; a.download="UA-Business-Simulator.csv"; a.click();
      URL.revokeObjectURL(url);
    });

    // Initial
    buildControls();
    buildScenarioFields();
    refreshAll();
  }

  buildIntro();
})();
