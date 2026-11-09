// Roles, hierarchy, notifications and lockout. Run after smoke.mjs (wait a minute: login is rate limited).
// Usage: node scripts/smoke-roles.mjs
const API = process.env.API_URL ?? 'http://localhost:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Foyer@2026';
let passed = 0;
function ok(cond, label, extra = '') {
  if (!cond) { console.error(`  FAIL  ${label} ${extra}`); process.exit(1); }
  passed++; console.log(`  ok    ${label}`);
}
async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = form;
  if (!form && body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data = text; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data };
}
const login = async (email, password = PASSWORD) => {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  return r;
};
const stamp = Date.now().toString().slice(-7);
const minutes = (n) => new Date(Date.now() + n * 60_000).toISOString();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const senior = (await login('senior@foyer.demo')).data.accessToken;
const manager = (await login('manager@foyer.demo')).data.accessToken;
const employee = (await login('employee@foyer.demo')).data.accessToken;
const guard = (await login('guard@foyer.demo')).data.accessToken;
ok(senior && manager && employee && guard, 'new demo roles can sign in');

const seniorMe = (await call('GET', '/auth/me', { token: senior })).data;
const managerMe = (await call('GET', '/auth/me', { token: manager })).data;
const employeeMe = (await call('GET', '/auth/me', { token: employee })).data;
ok(seniorMe.role === 'SENIOR_MANAGER' && managerMe.role === 'MANAGER' && employeeMe.role === 'EMPLOYEE', 'roles are reported');
ok(managerMe.managerId === seniorMe.id && employeeMe.managerId === managerMe.id, 'reporting line is senior -> manager -> employee');

const person = (role, n) => ({ name: `Test ${role} ${n}`, email: `t.${role.toLowerCase()}.${n}.${stamp}@example.com`, password: 'Strong1pass', role });

// Who may add whom
ok((await call('POST', '/users', { token: senior, body: person('HOST', 1) })).status === 403, 'senior manager cannot add a host');
ok((await call('POST', '/users', { token: senior, body: person('GUARD', 1) })).status === 403, 'senior manager cannot add a guard');
const m2 = await call('POST', '/users', { token: senior, body: person('MANAGER', 1) });
ok(m2.status === 201 && m2.data.managerId === seniorMe.id, 'senior manager adds a manager under themselves');
ok((await call('POST', '/users', { token: manager, body: person('MANAGER', 2) })).status === 403, 'manager cannot add a manager');
ok((await call('POST', '/users', { token: manager, body: person('SENIOR_MANAGER', 2) })).status === 403, 'manager cannot add a senior manager');
const e1 = await call('POST', '/users', { token: manager, body: person('EMPLOYEE', 1) });
const h1 = await call('POST', '/users', { token: manager, body: person('HOST', 3) });
ok(e1.status === 201 && e1.data.managerId === managerMe.id, 'manager adds an employee under themselves');
ok(h1.status === 201 && h1.data.managerId === managerMe.id, 'manager adds a host under themselves');
ok((await call('POST', '/users', { token: employee, body: person('EMPLOYEE', 4) })).status === 403, 'employee cannot add people');
ok((await call('POST', '/users', { token: manager, body: { ...person('EMPLOYEE', 5), password: 'short' } })).status === 400, 'weak password is refused');
ok((await call('POST', '/users', { token: manager, body: { ...person('EMPLOYEE', 6), password: 'onlyletters' } })).status === 400, 'password without a number is refused');

// Who sees whom
const seniorList = (await call('GET', '/users', { token: senior })).data;
const managerList = (await call('GET', '/users', { token: manager })).data;
ok(seniorList.some((u) => u.id === m2.data.id) && seniorList.some((u) => u.id === e1.data.id), 'senior sees managers and their teams');
ok(!seniorList.some((u) => u.role === 'ADMIN' || u.role === 'GUARD'), 'senior does not see admins or guards');
ok(managerList.some((u) => u.id === e1.data.id) && !managerList.some((u) => u.id === m2.data.id), 'manager sees only their own team');
ok((await call('GET', '/users', { token: employee })).status === 403, 'employee cannot list team');
ok((await call('PATCH', `/users/${m2.data.id}`, { token: manager, body: { isActive: false } })).status === 403, 'manager cannot edit someone outside their team');
ok((await call('PATCH', `/users/${e1.data.id}`, { token: manager, body: { role: 'HOST' } })).status === 403, 'manager cannot change roles');
ok((await call('PATCH', `/users/${e1.data.id}`, { token: manager, body: { phone: '0300 1234567' } })).status === 200, 'manager edits a team member');

// Visitors for the team
const visitBody = (hostId, n) => ({
  hostId,
  purpose: 'Roles check',
  expectedFrom: minutes(-10),
  expectedTo: minutes(120),
  visitor: { fullName: `Role Visitor ${n}`, phone: `0300${stamp}${n}`, email: `rv${n}@example.com` },
});
const v1 = await call('POST', '/visits', { token: manager, body: visitBody(employeeMe.id, 1) });
ok(v1.status === 201 && v1.data.host.id === employeeMe.id, 'manager invites a visitor for a team member');
const outside = await call('POST', '/visits', { token: manager, body: visitBody(m2.data.id, 2) });
ok(outside.status === 403, 'manager cannot invite for someone outside their team');
ok((await call('GET', `/visits/${v1.data.id}`, { token: senior })).status === 200, 'senior sees the team visit');
ok((await call('GET', `/visits/${v1.data.id}`, { token: employee })).status === 200, 'the employee host sees their own visitor');
const otherVisit = await call('POST', '/visits', { token: manager, body: visitBody(h1.data.id, 3) });
ok(otherVisit.status === 201 && (await call('GET', `/visits/${otherVisit.data.id}`, { token: employee })).status === 403, 'an employee cannot open a teammate’s visit');
const mSummary = await call('GET', '/reports/summary', { token: manager });
ok(mSummary.status === 200 && mSummary.data.totals.total >= 1, 'manager gets a team summary');
ok((await call('GET', '/audit', { token: manager })).status === 403, 'manager cannot read the audit log');
ok((await call('GET', '/blacklist', { token: manager })).status === 403, 'manager cannot see the blacklist');
const teamHosts = (await call('GET', '/users/hosts?scope=team', { token: manager })).data;
ok(teamHosts.some((h) => h.id === e1.data.id) && !teamHosts.some((h) => h.id === m2.data.id), 'host list can be limited to the team');

// Arrive / leave -> host, manager and senior manager are notified
const before = async (t) => (await call('GET', '/notifications', { token: t })).data.unread;
const [b1, b2, b3] = [await before(employee), await before(manager), await before(senior)];
const scan = await call('POST', '/gate/scan', { token: guard, body: { code: v1.data.passCode } });
ok(scan.data.verdict === 'ALLOW', 'guard scan allows the visitor', JSON.stringify(scan.data));
const form = new FormData();
form.append('photo', new Blob([PNG], { type: 'image/png' }), 'p.png');
ok((await call('POST', `/gate/check-in/${v1.data.id}`, { token: guard, form })).status === 201, 'guard checks the visitor in');
await new Promise((r) => setTimeout(r, 600));
ok((await before(employee)) === b1 + 1, 'host is notified of arrival');
ok((await before(manager)) === b2 + 1, 'manager is notified of arrival');
ok((await before(senior)) === b3 + 1, 'senior manager is notified of arrival');
ok((await call('POST', `/gate/check-out/${v1.data.id}`, { token: guard })).status === 201, 'guard checks the visitor out');
await new Promise((r) => setTimeout(r, 600));
const inboxSenior = (await call('GET', '/notifications', { token: senior })).data;
ok(inboxSenior.unread === b3 + 2 && inboxSenior.items[0].title.endsWith('has left'), 'all three are notified when the visitor leaves');
ok((await call('POST', '/notifications/read-all', { token: senior })).status === 201 && (await before(senior)) === 0, 'notifications can be marked read');
ok((await call('GET', '/notifications', { token: guard })).data.items.length === 0, 'guard is not part of the notification chain');

// Own password change + lockout (login is rate limited, so wait for the window to reset)
const mine = person('EMPLOYEE', 9);
ok((await call('POST', '/users', { token: manager, body: mine })).status === 201, 'create a throwaway account');
console.log('  ...waiting 62s for the login rate limit window');
await new Promise((r) => setTimeout(r, 62_000));
for (let i = 0; i < 4; i++) ok((await login(mine.email, 'Wrong-pass1')).status === 401, `wrong password #${i + 1}`);
const fifth = await login(mine.email, 'Wrong-pass1');
ok(fifth.status === 401, 'fifth wrong password');
const locked = await login(mine.email, mine.password);
ok(locked.status === 429 && /Try again in/.test(locked.data.message), 'account is locked even with the right password');
const reset = await call('PATCH', `/users/${(await call('GET', '/users', { token: manager })).data.find((u) => u.email === mine.email).id}`, { token: manager, body: { password: 'Fresh1password' } });
ok(reset.status === 200, 'manager resets the password and clears the lock');
const back = await login(mine.email, 'Fresh1password');
ok(back.status === 200, 'sign in works after the reset');
const t = back.data.accessToken;
ok((await call('POST', '/auth/password', { token: t, body: { currentPassword: 'nope', newPassword: 'Another1pass' } })).status === 401, 'wrong current password is refused');
ok((await call('POST', '/auth/password', { token: t, body: { currentPassword: 'Fresh1password', newPassword: 'Another1pass' } })).status === 200, 'own password can be changed');
ok((await login(mine.email, 'Another1pass')).status === 200, 'new password works');

// clean up: deactivate everything this test created
for (const id of [m2.data.id, e1.data.id, h1.data.id]) await call('PATCH', `/users/${id}`, { token: id === m2.data.id ? senior : manager, body: { isActive: false } });
console.log(`\nAll ${passed} role checks passed.`);
