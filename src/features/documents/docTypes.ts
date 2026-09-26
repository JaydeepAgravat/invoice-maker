import {
  ClipboardList,
  FileClock,
  FileDiff,
  FileMinus,
  FileText,
  ReceiptText,
  ScrollText,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from 'lucide-react-native';

import type { Messages } from '@/i18n/locales/en';

export type DocType =
  | 'INVOICE'
  | 'ESTIMATE'
  | 'RECEIPT'
  | 'CREDIT_NOTE'
  | 'PROFORMA'
  | 'DELIVERY_NOTE'
  | 'CHANGE_ORDER'
  | 'PURCHASE_ORDER'
  | 'STATEMENT';

export type DocTypeMeta = {
  type: DocType;
  icon: LucideIcon;
  labelKey: `new.${keyof Messages['new']}`;
  /** Shown as a large tile in the New sheet; the rest are listed below. */
  primary: boolean;
  pro: boolean;
};

export const DOC_TYPES: readonly DocTypeMeta[] = [
  {
    type: 'INVOICE',
    icon: FileText,
    labelKey: 'new.invoice',
    primary: true,
    pro: false,
  },
  {
    type: 'ESTIMATE',
    icon: ClipboardList,
    labelKey: 'new.estimate',
    primary: true,
    pro: false,
  },
  {
    type: 'RECEIPT',
    icon: ReceiptText,
    labelKey: 'new.receipt',
    primary: true,
    pro: false,
  },
  {
    type: 'CREDIT_NOTE',
    icon: FileMinus,
    labelKey: 'new.creditNote',
    primary: false,
    pro: false,
  },
  {
    type: 'PROFORMA',
    icon: FileClock,
    labelKey: 'new.proforma',
    primary: false,
    pro: false,
  },
  {
    type: 'DELIVERY_NOTE',
    icon: Truck,
    labelKey: 'new.deliveryNote',
    primary: false,
    pro: false,
  },
  {
    type: 'CHANGE_ORDER',
    icon: FileDiff,
    labelKey: 'new.changeOrder',
    primary: false,
    pro: true,
  },
  {
    type: 'PURCHASE_ORDER',
    icon: ShoppingCart,
    labelKey: 'new.purchaseOrder',
    primary: false,
    pro: true,
  },
  {
    type: 'STATEMENT',
    icon: ScrollText,
    labelKey: 'new.statement',
    primary: false,
    pro: true,
  },
];
