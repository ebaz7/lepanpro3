import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-Memory Enterprise Mock Database for persistent live operations during session
let customers = [
  { id: 'CUST-001', name: 'Acme Global Ltd', contact: 'John Carter', email: 'john@acme.com', phone: '+1 555-0192', status: 'Active', revenue: 145000, region: 'North America', industry: 'Manufacturing' },
  { id: 'CUST-002', name: 'Apex Industrial', contact: 'Elena Rostova', email: 'elena@apex.de', phone: '+49 30 123456', status: 'Active', revenue: 280000, region: 'Europe', industry: 'Engineering' },
  { id: 'CUST-003', name: 'Nexus Bio-Tech', contact: 'Dr. Aris Thorne', email: 'athorne@nexusbio.io', phone: '+1 555-0842', status: 'Lead', revenue: 95000, region: 'North America', industry: 'Biotechnology' },
  { id: 'CUST-004', name: 'Solaria Energy Systems', contact: 'Marcus Vance', email: 'mvance@solaria.com', phone: '+44 20 7946 0912', status: 'Active', revenue: 520000, region: 'Europe', industry: 'Renewable Energy' },
  { id: 'CUST-005', name: 'Pacific Logistics Inc', contact: 'Mei-Ling Chen', email: 'mchen@paclog.sg', phone: '+65 6789 0123', status: 'Active', revenue: 310000, region: 'Asia Pacific', industry: 'Logistics' }
];

let inventory = [
  { id: 'INV-101', name: 'High-Precision Servo Actuator X7', category: 'Robotics', stock: 42, minStock: 15, unitPrice: 1250, location: 'Warehouse A-12', status: 'In Stock' },
  { id: 'INV-102', name: 'Industrial Optical Sensor Module', category: 'Sensors', stock: 8, minStock: 20, unitPrice: 340, location: 'Warehouse B-04', status: 'Low Stock' },
  { id: 'INV-103', name: 'Titanium Enclosure Housing V2', category: 'Hardware', stock: 115, minStock: 30, unitPrice: 620, location: 'Warehouse A-08', status: 'In Stock' },
  { id: 'INV-104', name: 'Embedded AI Processing Unit Mk.IV', category: 'Electronics', stock: 4, minStock: 10, unitPrice: 2400, location: 'Cleanroom C-01', status: 'Critical' },
  { id: 'INV-105', name: 'Pneumatic Control Valve Assembly', category: 'Hydraulics', stock: 88, minStock: 25, unitPrice: 180, location: 'Warehouse B-09', status: 'In Stock' }
];

let transactions = [
  { id: 'TX-901', date: '2026-10-25', client: 'Apex Industrial', type: 'Income', amount: 48500, status: 'Paid', invoiceNo: 'INV-2026-881' },
  { id: 'TX-902', date: '2026-10-24', client: 'Acme Global Ltd', type: 'Income', amount: 22000, status: 'Paid', invoiceNo: 'INV-2026-882' },
  { id: 'TX-903', date: '2026-10-22', client: 'Component Supplies Corp', type: 'Expense', amount: 14200, status: 'Completed', invoiceNo: 'EXP-2026-104' },
  { id: 'TX-904', date: '2026-10-20', client: 'Solaria Energy Systems', type: 'Income', amount: 95000, status: 'Pending', invoiceNo: 'INV-2026-883' },
  { id: 'TX-905', date: '2026-10-18', client: 'Cloud Infrastructure Services', type: 'Expense', amount: 6800, status: 'Completed', invoiceNo: 'EXP-2026-105' }
];

let employees = [
  { id: 'EMP-01', name: 'Sarah Jenkins', role: 'Chief Technology Officer', department: 'Executive', status: 'Active', email: 's.jenkins@enterprise.com', location: 'Headquarters' },
  { id: 'EMP-02', name: 'David K. Miller', role: 'Lead Solutions Architect', department: 'Engineering', status: 'Active', email: 'd.miller@enterprise.com', location: 'Headquarters' },
  { id: 'EMP-03', name: 'Amira Patel', role: 'Supply Chain Manager', department: 'Operations', status: 'Active', email: 'a.patel@enterprise.com', location: 'Logistics Hub' },
  { id: 'EMP-04', name: 'Carlos Mendez', role: 'Senior Financial Controller', department: 'Finance', status: 'Active', email: 'c.mendez@enterprise.com', location: 'Headquarters' },
  { id: 'EMP-05', name: 'Jessica Taylor', role: 'VP of Global Sales', department: 'Sales', status: 'On Leave', email: 'j.taylor@enterprise.com', location: 'EMEA Regional' }
];

let auditLogs = [
  { id: 'LOG-1001', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), user: 'David K. Miller', action: 'System Initialization', module: 'System', details: 'Enterprise Suite environment checked and verified nominal' },
  { id: 'LOG-1002', timestamp: new Date(Date.now() - 35 * 60000).toISOString(), user: 'Amira Patel', action: 'Stock Adjustment', module: 'Inventory', details: 'Updated stock count for INV-103 (Titanium Enclosure Housing V2)' },
  { id: 'LOG-1003', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), user: 'Carlos Mendez', action: 'Invoice Generated', module: 'Finance', details: 'Created invoice INV-2026-883 for Solaria Energy Systems ($95,000)' }
];

// Health check API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: 'production',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Dashboard Stats API
app.get('/api/dashboard/stats', (_req: Request, res: Response) => {
  const totalRevenue = customers.reduce((acc, c) => acc + c.revenue, 0);
  const totalInventoryValue = inventory.reduce((acc, i) => acc + (i.stock * i.unitPrice), 0);
  const lowStockCount = inventory.filter(i => i.stock <= i.minStock).length;
  const activeClients = customers.filter(c => c.status === 'Active').length;

  res.json({
    totalRevenue,
    revenueGrowth: '+14.2%',
    totalInventoryValue,
    lowStockCount,
    activeClients,
    totalEmployees: employees.length,
    monthlyIncome: 165500,
    monthlyExpenses: 21000,
    netMargin: '87.3%'
  });
});

// CRM Endpoints
app.get('/api/crm/customers', (_req: Request, res: Response) => {
  res.json(customers);
});

app.post('/api/crm/customers', (req: Request, res: Response) => {
  const newCust = {
    id: `CUST-${String(customers.length + 1).padStart(3, '0')}`,
    ...req.body,
    revenue: Number(req.body.revenue) || 0
  };
  customers.unshift(newCust);
  
  auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user: 'System Admin',
    action: 'Client Created',
    module: 'CRM',
    details: `Added new client: ${newCust.name}`
  });

  res.status(201).json(newCust);
});

// Inventory Endpoints
app.get('/api/inventory/items', (_req: Request, res: Response) => {
  res.json(inventory);
});

app.post('/api/inventory/items', (req: Request, res: Response) => {
  const newItem = {
    id: `INV-${Math.floor(100 + Math.random() * 900)}`,
    ...req.body,
    stock: Number(req.body.stock) || 0,
    minStock: Number(req.body.minStock) || 10,
    unitPrice: Number(req.body.unitPrice) || 0
  };
  inventory.unshift(newItem);

  auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user: 'Inventory Manager',
    action: 'Item Added',
    module: 'Inventory',
    details: `Added new inventory SKU: ${newItem.name} (${newItem.stock} units)`
  });

  res.status(201).json(newItem);
});

// Finance Endpoints
app.get('/api/finance/transactions', (_req: Request, res: Response) => {
  res.json(transactions);
});

app.post('/api/finance/transactions', (req: Request, res: Response) => {
  const newTx = {
    id: `TX-${Math.floor(900 + Math.random() * 100)}`,
    date: new Date().toISOString().split('T')[0],
    ...req.body,
    amount: Number(req.body.amount) || 0
  };
  transactions.unshift(newTx);

  auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user: 'Financial Controller',
    action: 'Transaction Created',
    module: 'Finance',
    details: `Recorded ${newTx.type} of $${newTx.amount.toLocaleString()} for ${newTx.client}`
  });

  res.status(201).json(newTx);
});

// HR Endpoints
app.get('/api/hr/employees', (_req: Request, res: Response) => {
  res.json(employees);
});

// Audit Logs Endpoint
app.get('/api/audit-logs', (_req: Request, res: Response) => {
  res.json(auditLogs);
});

// Start Server with Vite Middleware in Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await import('fs').then((fs) =>
          fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
        );
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[ENTERPRISE SERVER] Running on port ${PORT}`);
  });
}

startServer();
