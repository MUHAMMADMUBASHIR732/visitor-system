import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

const DEMO_PASSWORD = 'Foyer@2026';

// Small deterministic generator so every seeded database looks the same.
let state = 20261108;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const code = () => String(100000 + Math.floor(rand() * 900000));

/** Demo reporting line: senior manager -> manager -> hosts and an employee. Safe to run repeatedly. */
async function ensureHierarchy(db: ReturnType<typeof drizzle<typeof schema>>) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const byEmail = async (email: string) =>
    (await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`).limit(1))[0];
  const ensure = async (name: string, email: string, role: schema.Role, managerId: string | null, phone: string) => {
    const found = await byEmail(email);
    if (found) return found;
    const [row] = await db.insert(schema.users).values({ name, email, role, managerId, phone, passwordHash }).returning();
    return row;
  };
  const senior = await ensure('Nadia Karim', 'senior@foyer.demo', 'SENIOR_MANAGER', null, '+923001110006');
  const manager = await ensure('Ayesha Siddiqui', 'manager@foyer.demo', 'MANAGER', senior.id, '+923001110007');
  await ensure('Danish Rauf', 'employee@foyer.demo', 'EMPLOYEE', manager.id, '+923001110008');
  for (const email of ['host@foyer.demo', 'sana@foyer.demo', 'hamza@foyer.demo']) {
    await db.update(schema.users).set({ managerId: manager.id }).where(sql`lower(${schema.users.email}) = ${email} and manager_id is null`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema });

  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
    if (count > 0) {
      await ensureHierarchy(db);
      console.log('Database already has users. Demo data skipped; demo senior manager, manager and employee ensured.');
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const depts = await db
      .insert(schema.departments)
      .values(['Engineering', 'People & Culture', 'Finance', 'Operations'].map((name) => ({ name })))
      .returning();
    const dept = (name: string) => depts.find((d) => d.name === name)!.id;

    const [admin, ...rest] = await db
      .insert(schema.users)
      .values([
        { name: 'Amna Siddiqui', email: 'admin@foyer.demo', phone: '+923001110001', role: 'ADMIN', departmentId: dept('Operations'), passwordHash },
        { name: 'Bilal Ahmed', email: 'host@foyer.demo', phone: '+923001110002', role: 'HOST', departmentId: dept('Engineering'), passwordHash },
        { name: 'Sana Malik', email: 'sana@foyer.demo', phone: '+923001110003', role: 'HOST', departmentId: dept('People & Culture'), passwordHash },
        { name: 'Hamza Raza', email: 'hamza@foyer.demo', phone: '+923001110004', role: 'HOST', departmentId: dept('Finance'), passwordHash },
        { name: 'Imran Khan', email: 'guard@foyer.demo', phone: '+923001110005', role: 'GUARD', departmentId: dept('Operations'), passwordHash },
      ])
      .returning();
    const hosts = rest.filter((u) => u.role === 'HOST');
    const guard = rest.find((u) => u.role === 'GUARD')!;

    const people = [
      ['Farah Naeem', 'Nova Logistics'], ['Usman Tariq', 'Bright Audit & Co'], ['Zainab Hussain', 'Kite Recruitment'],
      ['Daniyal Shah', 'Orbit Networks'], ['Mehwish Anwar', 'Lumen Design Studio'], ['Rashid Mehmood', 'Skyline Facilities'],
      ['Hira Baig', 'Pioneer Insurance'], ['Talha Qureshi', 'Delta Couriers'], ['Nimra Javed', 'Crescent Legal'],
      ['Faisal Iqbal', 'Atlas Hardware'], ['Sadia Rauf', 'Greenfield Catering'], ['Owais Butt', 'Vertex Security'],
      ['Mariam Zafar', 'Northwind Training'], ['Adeel Hashmi', 'Pixelwave Media'],
    ] as const;

    const visitorRows = await db
      .insert(schema.visitors)
      .values(
        people.map(([fullName, company], i) => ({
          fullName,
          company,
          phone: `+92321${String(5550100 + i * 37)}`,
          email: `${fullName.split(' ')[0].toLowerCase()}@${company.split(' ')[0].toLowerCase()}.example`,
          idType: 'CNIC',
          idNumber: `3520${String(1000000000 + i * 7919)}`,
        })),
      )
      .returning();

    const purposes = [
      'Project review meeting', 'Candidate interview', 'Invoice discussion', 'Equipment delivery',
      'Vendor demo', 'Audit walkthrough', 'Contract signing', 'Training session', 'Maintenance visit',
    ];

    const nextBadge = async () => {
      const r = await db.execute(sql`select nextval('badge_seq')::int as n`);
      return `V-${String((r.rows[0] as { n: number }).n).padStart(4, '0')}`;
    };

    const now = new Date();
    const history: (typeof schema.visits.$inferInsert)[] = [];

    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - daysAgo);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      const count = 3 + Math.floor(rand() * 6);
      for (let i = 0; i < count; i++) {
        const visitor = pick(visitorRows);
        const host = pick(hosts);
        // Arrivals cluster mid-morning and early afternoon (UTC hours; Karachi is +5).
        const hourUtc = pick([4, 4, 5, 5, 5, 6, 9, 9, 10]);
        const from = new Date(day);
        from.setUTCHours(hourUtc, pick([0, 15, 30, 45]), 0, 0);
        const to = new Date(from.getTime() + 2 * 3600_000);
        const roll = rand();
        const base = {
          visitorId: visitor.id,
          hostId: host.id,
          purpose: pick(purposes),
          expectedFrom: from,
          expectedTo: to,
          passCode: code(),
          isWalkIn: roll > 0.88,
        };
        if (roll < 0.06) {
          history.push({ ...base, status: 'NO_SHOW', isWalkIn: false });
        } else if (roll < 0.1) {
          history.push({ ...base, status: 'CANCELLED', isWalkIn: false });
        } else {
          const checkIn = new Date(from.getTime() + Math.floor(rand() * 12 - 4) * 60_000);
          const stay = (25 + Math.floor(rand() * 95)) * 60_000;
          history.push({
            ...base,
            status: 'CHECKED_OUT',
            checkInAt: checkIn,
            checkOutAt: new Date(checkIn.getTime() + stay),
            checkedInById: guard.id,
            checkedOutById: guard.id,
            badgeNumber: await nextBadge(),
          });
        }
      }
    }
    await db.insert(schema.visits).values(history);

    // Today: someone inside, two expected later, one walk-in waiting for approval.
    const todayAt = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * 3600_000);
    const [sana, bilal, hamza] = [hosts[0], hosts[1], hosts[2]].map((h) => h);
    await db.insert(schema.visits).values([
      {
        visitorId: visitorRows[0].id, hostId: bilal?.id ?? sana.id, purpose: 'Project review meeting', status: 'CHECKED_IN',
        expectedFrom: todayAt(-1.5), expectedTo: todayAt(1), passCode: code(),
        checkInAt: todayAt(-1.2), checkedInById: guard.id, badgeNumber: await nextBadge(),
      },
      {
        visitorId: visitorRows[1].id, hostId: hamza?.id ?? sana.id, purpose: 'Audit walkthrough', status: 'SCHEDULED',
        expectedFrom: todayAt(1), expectedTo: todayAt(3), passCode: code(),
      },
      {
        visitorId: visitorRows[2].id, hostId: sana.id, purpose: 'Candidate interview', status: 'SCHEDULED',
        expectedFrom: todayAt(2), expectedTo: todayAt(4), passCode: code(),
      },
      {
        visitorId: visitorRows[3].id, hostId: sana.id, purpose: 'Equipment delivery', status: 'PENDING_APPROVAL', isWalkIn: true,
        expectedFrom: todayAt(-0.1), expectedTo: todayAt(11.9), passCode: code(),
      },
    ]);

    await db.insert(schema.blacklist).values({
      fullName: 'Sample blocked visitor',
      phone: '+923009990000',
      reason: 'Demo entry: removed from site after a policy breach',
      addedById: admin.id,
    });

    await ensureHierarchy(db);
    console.log('Seeded demo data.\n');
    console.log('Sign in with any of these (password for all: ' + DEMO_PASSWORD + '):');
    console.log('  admin@foyer.demo   Admin');
    console.log('  host@foyer.demo    Host (Bilal Ahmed)');
    console.log('  sana@foyer.demo    Host (Sana Malik)');
    console.log('  guard@foyer.demo   Security guard');
    console.log('  senior@foyer.demo  Senior manager (adds managers)');
    console.log('  manager@foyer.demo Manager (adds hosts and employees)');
    console.log('  employee@foyer.demo Employee');
    console.log('\nChange these passwords before using the system with real people.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
