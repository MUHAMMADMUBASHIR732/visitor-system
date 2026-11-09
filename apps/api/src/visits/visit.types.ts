import type { users, visitors, visits, VisitStatus } from '../db/schema';

export type VisitRow = {
  visit: typeof visits.$inferSelect;
  visitor: typeof visitors.$inferSelect;
  host: Pick<typeof users.$inferSelect, 'id' | 'name' | 'email' | 'phone'>;
};

export interface SerializedVisit {
  id: string;
  status: VisitStatus;
  purpose: string;
  isWalkIn: boolean;
  expectedFrom: string;
  expectedTo: string;
  passCode: string | null;
  /** Signed pass for the QR code. Only present while the visit can still be checked in. */
  passToken: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  entryPhotoUrl: string | null;
  badgeNumber: string | null;
  vehiclePlate: string | null;
  createdAt: string;
  visitor: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    company: string | null;
    idType: string | null;
    idNumber: string | null;
  };
  host: { id: string; name: string; email: string; phone: string | null };
}
