import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { MANAGER_ROLES, Role } from '../db/schema';
import type { AuthUser } from './auth';

export interface ChainPerson {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Who can see whom: the reporting line (employee -> manager -> senior manager). */
@Injectable()
export class ScopeService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** People below (and including) this user in the reporting line. */
  async teamIds(userId: string): Promise<string[]> {
    const r = await this.db.execute(sql`
      with recursive t as (
        select id from users where id = ${userId}::uuid
        union
        select u.id from users u join t on u.manager_id = t.id
      ) select id from t`);
    return (r.rows as { id: string }[]).map((x) => x.id);
  }

  /** Whose visits and people this user may see. null means everyone. */
  async visibleUserIds(actor: AuthUser): Promise<string[] | null> {
    if (actor.role === 'ADMIN' || actor.role === 'GUARD') return null;
    if (MANAGER_ROLES.includes(actor.role)) return this.teamIds(actor.id);
    return [actor.id];
  }

  async canSee(actor: AuthUser, userId: string): Promise<boolean> {
    const ids = await this.visibleUserIds(actor);
    return ids === null || ids.includes(userId);
  }

  /** The person plus everyone above them (max three levels), nearest first. */
  async chainOf(userId: string): Promise<ChainPerson[]> {
    const r = await this.db.execute(sql`
      with recursive c as (
        select id, name, email, role, manager_id, 1 as depth from users where id = ${userId}::uuid
        union all
        select u.id, u.name, u.email, u.role, u.manager_id, c.depth + 1
        from users u join c on u.id = c.manager_id where c.depth < 4
      ) select id, name, email, role from c where true order by depth`);
    return r.rows as unknown as ChainPerson[];
  }

  /** SQL fragment limiting a visits query to the actor's scope. */
  async hostFilter(actor: AuthUser, column = 'host_id') {
    const ids = await this.visibleUserIds(actor);
    if (ids === null) return sql``;
    return sql` and ${sql.raw(column)} in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`;
  }
}

@Global()
@Module({ providers: [ScopeService], exports: [ScopeService] })
export class ScopeModule {}
