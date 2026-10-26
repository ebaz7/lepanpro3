export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  status: 'Active' | 'Lead' | 'Inactive';
  revenue: number;
  region: string;
  industry: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unitPrice: number;
  location: string;
  status: 'In Stock' | 'Low Stock' | 'Critical';
}

export interface Transaction {
  id: string;
  date: string;
  client: string;
  type: 'Income' | 'Expense';
  amount: number;
  status: 'Paid' | 'Pending' | 'Completed' | 'Overdue';
  invoiceNo: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  email: string;
  location: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueGrowth: string;
  totalInventoryValue: number;
  lowStockCount: number;
  activeClients: number;
  totalEmployees: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netMargin: string;
}

export type ActiveTab = 'dashboard' | 'crm' | 'inventory' | 'finance' | 'hr' | 'audit' | 'settings';
export type PlatformMode = 'desktop' | 'mobile' | 'android';
