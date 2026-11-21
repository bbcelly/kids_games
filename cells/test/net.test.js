'use strict';
// Multi-client network test against a running server: node test/net.test.js [ws://host:port/ws]
const WebSocket = require('ws');
const URL = process.argv[2] || 'ws://localhost:8080/ws';
const N = 4;
const results = [];

function client(i) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const st = { i, welcome: false, id: null, snaps: 0, foodSnaps: 0, lb: 0, maxOrgs: 0, metaNames: new Set(), mass: 0 };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: 'Tester' + i })));
    ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'welcome') st.welcome = true;
      if (m.t === 'spawned') st.id = m.id;
      if (m.t === 's') {
        st.snaps++; if (m.f) st.foodSnaps++;
        st.maxOrgs = Math.max(st.maxOrgs, m.o.length);
        if (m.m) m.m.forEach(x => st.metaNames.add(x[1]));
        if (m.y) st.mass = m.y.ms;
      }
      if (m.t === 'lb') st.lb++;
    });
    // steer in a circle and dash occasionally
    let a = i;
    const iv = setInterval(() => {
      a += 0.1;
      if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'in', x: Math.cos(a) * 300, y: Math.sin(a) * 300, w: 900, h: 600 }));
    }, 50);
    setTimeout(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'dash' })), 1000);
    // garbage must not crash the server
    setTimeout(() => { ws.send('not json'); ws.send(JSON.stringify({ t: 'in', x: 'NaN', y: null })); ws.send(JSON.stringify({ t: 'pick', i: 99 })); }, 1500);
    ws.on('error', reject);
    setTimeout(() => { clearInterval(iv); ws.close(); resolve(st); }, 4000);
  });
}

(async () => {
  const sts = await Promise.all(Array.from({ length: N }, (_, i) => client(i)));
  let ok = true;
  for (const s of sts) {
    const good = s.welcome && s.id && s.snaps > 40 && s.foodSnaps > 10 && s.lb >= 2;
    ok = ok && good;
    console.log(`client ${s.i}: id=${s.id} snaps=${s.snaps} food=${s.foodSnaps} lb=${s.lb} orgsInView<=${s.maxOrgs} mass=${s.mass} names=${s.metaNames.size} ${good ? 'OK' : 'FAIL'}`);
  }
  const health = await (await fetch(URL.replace('ws', 'http').replace('/ws', '/health'))).json();
  console.log('server health after test:', health);
  console.log(ok ? 'NET TEST PASSED' : 'NET TEST FAILED');
  process.exit(ok ? 0 : 1);
})();
