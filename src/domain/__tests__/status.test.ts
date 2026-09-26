import {
  allowedActions,
  daysOverdue,
  displayStatus,
  nextStoredStatus,
  type StatusFacts,
} from '../status';

const base: StatusFacts = {
  type: 'INVOICE',
  stored: 'SENT',
  total: 10000,
  paid: 0,
  dueDate: '2026-09-30',
  today: '2026-09-26',
};

describe('displayStatus', () => {
  it('passes draft and void through', () => {
    expect(displayStatus({ ...base, stored: 'DRAFT' })).toBe('DRAFT');
    expect(displayStatus({ ...base, stored: 'VOID', paid: 10000 })).toBe(
      'VOID',
    );
  });

  it('derives invoice payment states', () => {
    expect(displayStatus(base)).toBe('SENT');
    expect(displayStatus({ ...base, paid: 2500 })).toBe('PARTIAL');
    expect(displayStatus({ ...base, paid: 10000 })).toBe('PAID');
    expect(displayStatus({ ...base, paid: 12000 })).toBe('PAID');
  });

  it('marks overdue only after the due date and only with a balance', () => {
    expect(displayStatus({ ...base, today: '2026-09-30' })).toBe('SENT');
    expect(displayStatus({ ...base, today: '2026-10-01' })).toBe('OVERDUE');
    expect(displayStatus({ ...base, today: '2026-10-01', paid: 5000 })).toBe(
      'OVERDUE',
    );
    expect(displayStatus({ ...base, today: '2026-10-01', paid: 10000 })).toBe(
      'PAID',
    );
    expect(displayStatus({ ...base, dueDate: null, today: '2027-01-01' })).toBe(
      'SENT',
    );
  });

  it('never calls a zero-total invoice paid', () => {
    expect(displayStatus({ ...base, total: 0 })).toBe('SENT');
  });

  it('receipts are always paid once issued', () => {
    expect(displayStatus({ ...base, type: 'RECEIPT' })).toBe('PAID');
  });

  it('expires open estimates and change orders', () => {
    const est = {
      ...base,
      type: 'ESTIMATE' as const,
      validUntil: '2026-09-20',
    };
    expect(displayStatus(est)).toBe('EXPIRED');
    expect(displayStatus({ ...est, validUntil: '2026-10-20' })).toBe('SENT');
    expect(displayStatus({ ...est, validUntil: null })).toBe('SENT');
    expect(displayStatus({ ...est, stored: 'ACCEPTED' })).toBe('ACCEPTED');
    expect(displayStatus({ ...est, type: 'CHANGE_ORDER' })).toBe('EXPIRED');
  });

  it('uses the stored status for other types', () => {
    expect(
      displayStatus({ ...base, type: 'DELIVERY_NOTE', stored: 'DELIVERED' }),
    ).toBe('DELIVERED');
  });
});

describe('daysOverdue', () => {
  it('counts only past-due days', () => {
    expect(daysOverdue('2026-09-20', '2026-09-26')).toBe(6);
    expect(daysOverdue('2026-09-30', '2026-09-26')).toBe(0);
    expect(daysOverdue(null, '2026-09-26')).toBe(0);
  });
});

describe('allowedActions', () => {
  it('drafts can be edited, sent and deleted', () => {
    expect(allowedActions('INVOICE', 'DRAFT')).toEqual([
      'EDIT',
      'SEND',
      'MARK_SENT',
      'DELETE',
      'DUPLICATE',
    ]);
    expect(allowedActions('RECEIPT', 'DRAFT')).not.toContain('MARK_SENT');
  });

  it('voided documents can only be duplicated', () => {
    expect(allowedActions('INVOICE', 'VOID')).toEqual(['DUPLICATE']);
  });

  it('sent documents are never deletable', () => {
    for (const status of ['SENT', 'PARTIAL', 'PAID', 'OVERDUE'] as const) {
      expect(allowedActions('INVOICE', status)).not.toContain('DELETE');
    }
  });

  it('invoices take payments until paid', () => {
    expect(allowedActions('INVOICE', 'PARTIAL')).toContain('RECORD_PAYMENT');
    expect(allowedActions('INVOICE', 'PAID')).not.toContain('RECORD_PAYMENT');
    expect(allowedActions('INVOICE', 'PAID')).toContain('CREATE_CREDIT_NOTE');
  });

  it('estimates flow through accept, convert and change orders', () => {
    expect(allowedActions('ESTIMATE', 'SENT')).toEqual(
      expect.arrayContaining(['ACCEPT', 'DECLINE']),
    );
    expect(allowedActions('ESTIMATE', 'ACCEPTED')).toEqual(
      expect.arrayContaining(['CONVERT_TO_INVOICE', 'CREATE_CHANGE_ORDER']),
    );
    expect(allowedActions('ESTIMATE', 'CONVERTED')).not.toContain(
      'CONVERT_TO_INVOICE',
    );
    expect(allowedActions('ESTIMATE', 'CONVERTED')).toContain(
      'CREATE_CHANGE_ORDER',
    );
    expect(allowedActions('ESTIMATE', 'DECLINED')).not.toContain('ACCEPT');
  });

  it('change orders can be accepted while open', () => {
    expect(allowedActions('CHANGE_ORDER', 'SENT')).toContain('ACCEPT');
    expect(allowedActions('CHANGE_ORDER', 'EXPIRED')).toContain('ACCEPT');
    expect(allowedActions('CHANGE_ORDER', 'ACCEPTED')).not.toContain('ACCEPT');
  });

  it('delivery notes and purchase orders complete once', () => {
    expect(allowedActions('DELIVERY_NOTE', 'SENT')).toContain('MARK_DELIVERED');
    expect(allowedActions('DELIVERY_NOTE', 'DELIVERED')).not.toContain(
      'MARK_DELIVERED',
    );
    expect(allowedActions('PURCHASE_ORDER', 'SENT')).toContain('MARK_RECEIVED');
    expect(allowedActions('PURCHASE_ORDER', 'RECEIVED')).not.toContain(
      'MARK_RECEIVED',
    );
  });

  it('other types can be edited, resent and voided', () => {
    expect(allowedActions('CREDIT_NOTE', 'SENT')).toEqual([
      'EDIT',
      'SEND',
      'DUPLICATE',
      'VOID',
    ]);
  });
});

describe('nextStoredStatus', () => {
  it('maps actions to stored transitions', () => {
    expect(nextStoredStatus('SEND', 'DRAFT')).toBe('SENT');
    expect(nextStoredStatus('MARK_SENT', 'DRAFT')).toBe('SENT');
    expect(nextStoredStatus('SEND', 'ACCEPTED')).toBeNull();
    expect(nextStoredStatus('VOID', 'SENT')).toBe('VOID');
    expect(nextStoredStatus('ACCEPT', 'SENT')).toBe('ACCEPTED');
    expect(nextStoredStatus('DECLINE', 'SENT')).toBe('DECLINED');
    expect(nextStoredStatus('CONVERT_TO_INVOICE', 'ACCEPTED')).toBe(
      'CONVERTED',
    );
    expect(nextStoredStatus('MARK_DELIVERED', 'SENT')).toBe('DELIVERED');
    expect(nextStoredStatus('MARK_RECEIVED', 'SENT')).toBe('RECEIVED');
    expect(nextStoredStatus('RECORD_PAYMENT', 'SENT')).toBeNull();
  });
});
