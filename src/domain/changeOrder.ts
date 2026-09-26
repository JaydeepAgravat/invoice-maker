/**
 * Contract value of an estimate after change orders. Only accepted change
 * orders count toward the revised total; pending ones are shown separately
 * so the contractor sees what is still waiting for the client.
 */

export type ChangeOrderSummary = {
  total: number;
  status: 'ACCEPTED' | 'PENDING' | 'DECLINED' | 'VOID';
};

export type ContractValue = {
  original: number;
  approvedChanges: number;
  pendingChanges: number;
  revised: number;
  /** Revised plus pending: the value if every open change is accepted. */
  projected: number;
};

export function contractValue(
  originalTotal: number,
  changeOrders: readonly ChangeOrderSummary[],
): ContractValue {
  const approvedChanges = changeOrders
    .filter(c => c.status === 'ACCEPTED')
    .reduce((a, c) => a + c.total, 0);
  const pendingChanges = changeOrders
    .filter(c => c.status === 'PENDING')
    .reduce((a, c) => a + c.total, 0);
  const revised = originalTotal + approvedChanges;
  return {
    original: originalTotal,
    approvedChanges,
    pendingChanges,
    revised,
    projected: revised + pendingChanges,
  };
}
