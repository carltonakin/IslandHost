// SQL Server results are dynamic at the persistence boundary; DTOs validate all external writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type Actor = { id: string; email: string; displayName: string; roles: string[]; permissions: string[]; customerId?: string; sessionId: string };
export const ROLES = ['SuperAdmin','Management','OperationsManager','ConciergeAgent','Dispatcher','Finance','Vendor','Driver','Customer'] as const;
export const PERMISSIONS: Record<string, string[]> = {
 SuperAdmin: ['*'],
 Management: ['bookings.manage','operations.read','requests.write','customers.write','trips.write','catalog.write','itineraries.write','audit.read','quotes.read','quotes.write','invoices.read','invoices.write','payments.read','payments.write','refunds.write','financial.read','vendors.read','vendors.write','dispatch.read','dispatch.write','conversations.manage'],
 OperationsManager: ['bookings.manage','operations.read','requests.write','customers.write','trips.write','itineraries.write','quotes.read','quotes.write','vendors.read','vendors.write','dispatch.read','dispatch.write','conversations.manage'],
 ConciergeAgent: ['bookings.manage','operations.read','requests.write','customers.write','trips.write','itineraries.write','quotes.read','quotes.write','conversations.manage'],
 Dispatcher: ['operations.read','requests.write','itineraries.write','dispatch.read','dispatch.write','conversations.manage'],
 Finance: ['operations.read','quotes.read','quotes.write','invoices.read','invoices.write','payments.read','payments.write','refunds.write','financial.read','conversations.manage'], Vendor: ['vendor'], Driver: ['driver'], Customer: ['customer']
};
export const allowed = (actor: Actor, permission: string) => actor.permissions.includes('*') || actor.permissions.includes(permission);
export const isStaff = (actor: Actor) => allowed(actor, 'operations.read');
export const STATUSES = ['Requested','Under Review','Quoted','Client Approved','Payment Required','Confirmed','Assigned','In Progress','Completed','Cancelled','Unavailable','Refunded','Rescheduled'] as const;
export type Status = typeof STATUSES[number];
export const TRANSITIONS: Record<Status, readonly Status[]> = {
 Requested: ['Under Review','Confirmed','Cancelled','Unavailable'],
 'Under Review': ['Quoted','Confirmed','Unavailable','Cancelled'],
 Quoted: ['Client Approved','Under Review','Cancelled'],
 'Client Approved': ['Payment Required','Confirmed','Cancelled'],
 'Payment Required': ['Confirmed','Cancelled'],
 Confirmed: ['Assigned','In Progress','Rescheduled','Cancelled'],
 Assigned: ['In Progress','Rescheduled','Cancelled'],
 'In Progress': ['Completed','Cancelled'],
 Completed: ['Refunded'], Cancelled: ['Refunded'], Unavailable: ['Under Review'],
 Refunded: [], Rescheduled: ['Confirmed','Cancelled','Unavailable']
};
export function canTransition(from: Status, to: Status) { return TRANSITIONS[from]?.includes(to) ?? false; }
export const dateOnly = (value: Date | string): string => typeof value === 'string' ? value.slice(0,10) : value.toISOString().slice(0,10);
export const bahamasToday = () => new Intl.DateTimeFormat('en-CA',{ timeZone: 'America/Nassau', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());

