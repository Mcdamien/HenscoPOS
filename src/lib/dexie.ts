import Dexie, { type Table } from 'dexie';

export interface Product {
  id: string;
  itemId: number;
  name: string;
  cost: number;
  price: number;
  warehouseStock: number;
  restockQty: number;
  updatedAt: Date;
}

export interface Store {
  id: string;
  name: string;
  location?: string | null;
  updatedAt: Date;
}

export interface Inventory {
  id: string;
  storeId: string;
  productId: string;
  stock: number;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  transactionId: number;
  storeId: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  synced: number; // 0 for no, 1 for yes
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  itemName: string;
  itemPrice: number;
  itemCost: number;
  qty: number;
}

export interface PendingInventoryChange {
  id: string;
  productId: string;
  storeId: string;
  changeType: string;
  qty: number;
  newCost?: number | null;
  newPrice?: number | null;
  reason?: string | null;
  status: string;
  requestedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransfer {
  id: string;
  transferId: number;
  fromStore?: string | null;
  toStore: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date | null;
  confirmedBy?: string | null;
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
}

export interface StockTransferItem {
  id: string;
  stockTransferId: string;
  productId: string;
  itemName: string;
  qty: number;
}

export interface InventoryAddition {
  id: string;
  additionId: number;
  referenceId?: string | null;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAdditionItem {
  id: string;
  inventoryAdditionId: string;
  productId: string;
  itemName: string;
  cost: number;
  price: number;
  qty: number;
}

export interface SyncQueue {
  id?: number;
  table: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'bulk_create';
  data: any;
  timestamp: number;
}

export class YamesDatabase extends Dexie {
  products!: Table<Product>;
  stores!: Table<Store>;
  inventories!: Table<Inventory>;
  transactions!: Table<Transaction>;
  transactionItems!: Table<TransactionItem>;
  pendingChanges!: Table<PendingInventoryChange>;
  stockTransfers!: Table<StockTransfer>;
  stockTransferItems!: Table<StockTransferItem>;
  inventoryAdditions!: Table<InventoryAddition>;
  inventoryAdditionItems!: Table<InventoryAdditionItem>;
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('YamesPOSDB');
    this.version(2).stores({
      products: 'id, itemId, name, updatedAt',
      stores: 'id, name, updatedAt',
      inventories: 'id, [storeId+productId], storeId, productId, updatedAt',
      transactions: 'id, transactionId, storeId, createdAt, synced',
      transactionItems: 'id, transactionId, productId',
      pendingChanges: 'id, productId, storeId, status, updatedAt',
      stockTransfers: 'id, transferId, toStore, status, updatedAt',
      stockTransferItems: 'id, stockTransferId, productId',
      inventoryAdditions: 'id, additionId, referenceId, updatedAt',
      inventoryAdditionItems: 'id, inventoryAdditionId, productId',
      syncQueue: '++id, table, action, timestamp'
    });
  }
}

export const dexieDb = new YamesDatabase();
