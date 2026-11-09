// End-to-end check of the main flows against a running API (with demo data seeded).
// Usage: API_URL=http://localhost:4000/api node scripts/smoke.mjs
const API = process.env.API_URL ?? 'http://localhost:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Foyer@2026';

let passed = 0;
function ok(cond, label, extra = '') {
  if (!cond) {
    console.error(`  FAIL  ${label} ${extra}`);
    process.exitCode = 1;
    throw new Error(`Smoke test failed: ${label}`);
  }
  passed++;
  console.log(`  ok    ${label}`);
}

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* not json (csv) */ }
  return { status: res.status, data };
}

const login = async (email) => {
  const r = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  ok(r.status === 200 && r.data.accessToken, `login ${email}`);
  return r.data.accessToken;
};

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const stamp = Date.now().toString().slice(-7);
const minutes = (n) => new Date(Date.now() + n * 60_000).toISOString();

async function main() {
  console.log('Foyer smoke test against', API);

  const health = await call('GET', '/health');
  ok(health.status === 200, 'health check');

  const bad = await call('POST', '/auth/login', { body: { email: 'host@foyer.demo', password: 'wrong-password' } });
  ok(bad.status === 401, 'wrong password is rejected');

  const host = await login('sana@foyer.demo');
  const otherHost = await login('host@foyer.demo');
  const guard = await login('guard@foyer.demo');
  const admin = await login('admin@foyer.demo');

  console.log('\nPre-registration');
  const phone = `+92345${stamp}`;
  const created = await call('POST', '/visits', {
    token: host,
    body: {
      visitor: { fullName: 'Smoke Tester', phone, company: 'QA Works', email: 'smoke@example.com' },
      purpose: 'Smoke test meeting',
      expectedFrom: minutes(10),
      expectedTo: minutes(120),
    },
  });
  ok(created.status === 201, 'host pre-registers a visit', JSON.stringify(created.data));
  const visit = created.data;
  ok(typeof visit.passToken === 'string' && visit.passToken.startsWith('v1.'), 'visit has a signed pass token');
  ok(/^\d{6}$/.test(visit.passCode), 'visit has a 6-digit code');

  const pub = await call('GET', `/public/pass/${encodeURIComponent(visit.passToken)}`);
  ok(pub.status === 200 && pub.data.visitorName === 'Smoke Tester', 'visitor can open the public pass');
  ok(!('idNumber' in pub.data) && !('phone' in pub.data), 'public pass hides private data');
  const fake = await call('GET', `/public/pass/${encodeURIComponent(visit.passToken.slice(0, -2) + 'xx')}`);
  ok(fake.status === 404, 'tampered pass link is rejected');

  const peek = await call('GET', `/visits/${visit.id}`, { token: otherHost });
  ok(peek.status === 403, 'another host cannot open this visit');
  const noAdmin = await call('GET', '/reports/summary', { token: host });
  ok(noAdmin.status === 403, 'host cannot open admin reports');
  const noToken = await call('GET', '/visits');
  ok(noToken.status === 401, 'requests without a token are rejected');

  console.log('\nGate');
  const scan = await call('POST', '/gate/scan', { token: guard, body: { token: visit.passToken } });
  ok(scan.status === 201 && scan.data.verdict === 'ALLOW', 'QR scan allows entry', JSON.stringify(scan.data));
  const byCode = await call('POST', '/gate/scan', { token: guard, body: { code: visit.passCode } });
  ok(byCode.data.verdict === 'ALLOW', 'manual 6-digit code allows entry');
  const forged = await call('POST', '/gate/scan', { token: guard, body: { token: 'v1.forged.123.abc' } });
  ok(forged.status === 400, 'forged QR is rejected');
  const hostScan = await call('POST', '/gate/scan', { token: host, body: { token: visit.passToken } });
  ok(hostScan.status === 403, 'hosts cannot use the gate');

  const form = new FormData();
  form.append('photo', new Blob([PNG], { type: 'image/png' }), 'visitor.png');
  form.append('vehiclePlate', 'abc 123');
  const checkIn = await call('POST', `/gate/check-in/${visit.id}`, { token: guard, form });
  ok(checkIn.status === 201 && checkIn.data.status === 'CHECKED_IN', 'guard checks the visitor in', JSON.stringify(checkIn.data));
  ok(/^V-\d{4}$/.test(checkIn.data.badgeNumber), 'badge number assigned');
  ok(checkIn.data.entryPhotoUrl?.startsWith('/uploads/photos/'), 'entry photo stored');
  ok(checkIn.data.vehiclePlate === 'ABC 123', 'vehicle plate normalised');

  const photo = await fetch(API.replace(/\/api$/, '') + checkIn.data.entryPhotoUrl);
  ok(photo.status === 200, 'photo is served');

  const again = await call('POST', `/gate/check-in/${visit.id}`, { token: guard });
  ok(again.status === 409, 'double check-in is blocked');
  const rescan = await call('POST', '/gate/scan', { token: guard, body: { token: visit.passToken } });
  ok(rescan.data.verdict === 'ALREADY_INSIDE', 'scan of a visitor already inside says so');

  const textPhoto = new FormData();
  textPhoto.append('photo', new Blob(['not an image'], { type: 'image/png' }), 'evil.png');
  const walk0 = await call('POST', '/gate/walk-in', {
    token: guard,
    body: { visitor: { fullName: 'Photo Test', phone: `+92346${stamp}` }, hostId: otherHost && (await call('GET', '/auth/me', { token: otherHost })).data.id, purpose: 'Photo validation' },
  });
  const approveFirst = await call('PATCH', `/visits/${walk0.data.id}/approve`, { token: otherHost });
  ok(approveFirst.status === 200, 'host approves a walk-in');
  const badPhoto = await call('POST', `/gate/check-in/${walk0.data.id}`, { token: guard, form: textPhoto });
  ok(badPhoto.status === 400, 'a non-image upload is rejected');
  await call('PATCH', `/visits/${walk0.data.id}/cancel`, { token: otherHost });

  const inside = await call('GET', '/gate/inside', { token: guard });
  ok(inside.data.some((v) => v.id === visit.id), 'visitor shows in the "inside now" list');

  console.log('\nEmergency roll call');
  const rc = await call('POST', '/roll-call/start', { token: guard, body: { reason: 'Smoke test drill' } });
  ok(rc.status === 201 && rc.data.total >= 1, 'roll call starts with everyone inside', JSON.stringify(rc.data).slice(0, 200));
  const dup = await call('POST', '/roll-call/start', { token: guard, body: {} });
  ok(dup.status === 409, 'a second roll call cannot start');
  const activeForHost = await call('GET', '/roll-call/active', { token: host });
  ok(activeForHost.status === 200 && activeForHost.data?.id === rc.data.id, 'hosts can see the active roll call');
  const entry = rc.data.entries.find((e) => e.visitId === visit.id);
  const safe = await call('POST', `/roll-call/entries/${entry.entryId}/safe`, { token: guard });
  ok(safe.data.safe === 1 && safe.data.missing === rc.data.total - 1, 'marking someone safe updates counts');
  const undo = await call('POST', `/roll-call/entries/${entry.entryId}/undo`, { token: guard });
  ok(undo.data.safe === 0, 'marking safe can be undone');
  const end = await call('POST', '/roll-call/end', { token: guard });
  ok(end.data.endedAt, 'roll call ends');

  const out = await call('POST', `/gate/check-out/${visit.id}`, { token: guard });
  ok(out.status === 201 && out.data.status === 'CHECKED_OUT', 'guard checks the visitor out');
  const outAgain = await call('POST', `/gate/check-out/${visit.id}`, { token: guard });
  ok(outAgain.status === 409, 'double check-out is blocked');
  const reuse = await call('POST', '/gate/scan', { token: guard, body: { token: visit.passToken } });
  ok(reuse.data.verdict === 'DENY', 'a used pass is denied');

  console.log('\nWalk-in approval');
  const hostMe = await call('GET', '/auth/me', { token: host });
  const walk = await call('POST', '/gate/walk-in', {
    token: guard,
    body: { visitor: { fullName: 'Walk In Wendy', phone: `+92347${stamp}`, company: 'Courier Co' }, hostId: hostMe.data.id, purpose: 'Parcel delivery' },
  });
  ok(walk.status === 201 && walk.data.status === 'PENDING_APPROVAL', 'guard registers a walk-in');
  const waitScan = await call('POST', '/gate/scan', { token: guard, body: { code: walk.data.passCode } });
  ok(waitScan.status === 404 || waitScan.data.verdict === 'WAIT', 'pending walk-in cannot be admitted yet');
  const cantApprove = await call('PATCH', `/visits/${walk.data.id}/approve`, { token: otherHost });
  ok(cantApprove.status === 403, 'only the right host can approve');
  const approved = await call('PATCH', `/visits/${walk.data.id}/approve`, { token: host });
  ok(approved.data.status === 'APPROVED', 'host approves the walk-in');
  const walkIn = await call('POST', `/gate/check-in/${walk.data.id}`, { token: guard });
  ok(walkIn.data.status === 'CHECKED_IN', 'approved walk-in is checked in');
  await call('POST', `/gate/check-out/${walk.data.id}`, { token: guard });

  console.log('\nBlacklist');
  const bl = await call('POST', '/blacklist', { token: admin, body: { phone, reason: 'Smoke test block' } });
  ok(bl.status === 201, 'admin blacklists a phone number');
  const blocked = await call('POST', '/visits', {
    token: host,
    body: { visitor: { fullName: 'Blocked Person', phone: phone.replace('+92', '0') }, purpose: 'Should fail', expectedFrom: minutes(10), expectedTo: minutes(60) },
  });
  ok(blocked.status === 400, 'blacklisted visitor cannot be registered (different phone format)');
  const blockedWalkin = await call('POST', '/gate/walk-in', {
    token: guard,
    body: { visitor: { fullName: 'Blocked Person', phone }, hostId: hostMe.data.id, purpose: 'Should fail' },
  });
  ok(blockedWalkin.status === 400, 'blacklisted visitor cannot walk in');
  await call('DELETE', `/blacklist/${bl.data.id}`, { token: admin });

  console.log('\nReturning visitors and lists');
  const lookup = await call('GET', `/visitors/lookup?phone=${encodeURIComponent(phone)}`, { token: host });
  ok(lookup.data?.fullName === 'Smoke Tester' && lookup.data.visits >= 1, 'returning visitor is recognised by phone');
  ok(!('idNumber' in (lookup.data ?? {})), 'lookup never exposes ID numbers');
  const list = await call('GET', '/visits?status=CHECKED_OUT&pageSize=5', { token: host });
  ok(list.data.items.every((v) => v.host.id === hostMe.data.id), 'hosts only list their own visits');
  const summary = await call('GET', '/visits/summary', { token: host });
  ok(typeof summary.data.insideNow === 'number', 'dashboard summary works');

  console.log('\nAdmin');
  const report = await call('GET', '/reports/summary', { token: admin });
  ok(report.status === 200 && report.data.totals.total > 10 && report.data.byDay.length > 3, 'analytics summary');
  const csv = await call('GET', '/reports/export.csv', { token: admin });
  ok(csv.status === 200 && String(csv.data).includes('Smoke Tester'), 'CSV export includes visits');
  const audit = await call('GET', '/audit', { token: admin });
  ok(audit.data.total > 5, 'audit log records actions');
  const users = await call('GET', '/users', { token: admin });
  ok(users.data.length >= 5 && !users.data.some((u) => 'passwordHash' in u), 'user list hides password hashes');

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
