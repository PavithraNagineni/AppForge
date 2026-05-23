/**
 * Seed script — creates a demo user + sample app for development.
 * Run: npx tsx src/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const DEMO_CONFIG = {
  name: 'Product Manager',
  description: 'Demo app — manage your product catalog and orders',
  locale: {
    default: 'en',
    supported: ['en', 'hi'],
    strings: {
      en: { welcome: 'Welcome', save: 'Save', cancel: 'Cancel' },
      hi: { welcome: 'स्वागत है', save: 'सहेजें', cancel: 'रद्द करें' },
    },
  },
  auth: { enabled: true, methods: ['email', 'google'] },
  theme: { primaryColor: '#6366f1' },
  entities: [
    {
      name: 'Product',
      displayName: 'Product',
      fields: [
        { name: 'name', type: 'string', required: true, label: 'Product Name' },
        { name: 'price', type: 'number', required: true, label: 'Price' },
        { name: 'category', type: 'enum', options: ['Electronics', 'Clothing', 'Food', 'Books'], label: 'Category' },
        { name: 'description', type: 'text', label: 'Description' },
        { name: 'inStock', type: 'boolean', default: true, label: 'In Stock' },
        { name: 'sku', type: 'string', label: 'SKU' },
      ],
    },
    {
      name: 'Order',
      displayName: 'Order',
      fields: [
        { name: 'customerName', type: 'string', required: true, label: 'Customer Name' },
        { name: 'customerEmail', type: 'string', required: true, label: 'Email' },
        { name: 'total', type: 'number', required: true, label: 'Total Amount' },
        { name: 'status', type: 'enum', options: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending', label: 'Status' },
        { name: 'notes', type: 'text', label: 'Notes' },
      ],
    },
  ],
  pages: [
    {
      id: 'dashboard',
      path: '/dashboard',
      title: 'Dashboard',
      layout: 'dashboard',
      components: [
        {
          type: 'stats',
          metrics: [
            { label: 'Total Products', entity: 'Product', aggregate: 'count' },
            { label: 'Total Revenue', entity: 'Order', field: 'total', aggregate: 'sum', prefix: '₹' },
            { label: 'Total Orders', entity: 'Order', aggregate: 'count' },
            { label: 'Avg Order Value', entity: 'Order', field: 'total', aggregate: 'avg', prefix: '₹' },
          ],
        },
        { type: 'chart', chartType: 'bar', entity: 'Product', groupBy: 'category', aggregate: 'count', title: 'Products by Category' },
        { type: 'chart', chartType: 'pie', entity: 'Order', groupBy: 'status', aggregate: 'count', title: 'Orders by Status' },
      ],
    },
    {
      id: 'products',
      path: '/products',
      title: 'Products',
      layout: 'dashboard',
      components: [
        {
          type: 'table',
          entity: 'Product',
          columns: ['name', 'price', 'category', 'inStock', 'sku'],
          actions: ['create', 'edit', 'delete', 'export-csv', 'import-csv'],
          searchable: true,
          pagination: { pageSize: 20 },
        },
      ],
    },
    {
      id: 'new-product',
      path: '/products/new',
      title: 'Add Product',
      layout: 'dashboard',
      components: [
        {
          type: 'form',
          entity: 'Product',
          fields: ['name', 'price', 'category', 'description', 'inStock', 'sku'],
          submitLabel: 'Create Product',
          redirectOnSuccess: '/products',
        },
      ],
    },
    {
      id: 'orders',
      path: '/orders',
      title: 'Orders',
      layout: 'dashboard',
      components: [
        {
          type: 'table',
          entity: 'Order',
          columns: ['customerName', 'customerEmail', 'total', 'status'],
          actions: ['create', 'edit', 'delete', 'export-csv'],
          searchable: true,
          filters: ['status'],
        },
      ],
    },
    {
      id: 'import',
      path: '/import',
      title: 'Import Data',
      layout: 'dashboard',
      components: [
        { type: 'csv-importer', entity: 'Product', title: 'Import Products from CSV' },
        { type: 'csv-importer', entity: 'Order', title: 'Import Orders from CSV' },
      ],
    },
  ],
  navigation: [
    { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Products', path: '/products', icon: 'Package' },
    { label: 'Orders', path: '/orders', icon: 'ShoppingCart' },
    { label: 'Import Data', path: '/import', icon: 'Upload' },
  ],
};

const DEMO_PRODUCTS = [
  { name: 'iPhone 15 Pro', price: 134900, category: 'Electronics', inStock: true, sku: 'IPH-15P-256', description: 'Latest iPhone with titanium design' },
  { name: 'MacBook Air M3', price: 114900, category: 'Electronics', inStock: true, sku: 'MBA-M3-256', description: '15-inch MacBook Air with M3 chip' },
  { name: 'Sony WH-1000XM5', price: 24990, category: 'Electronics', inStock: true, sku: 'SNY-WH5', description: 'Industry-leading noise cancelling headphones' },
  { name: 'Levi\'s 511 Slim Jeans', price: 4499, category: 'Clothing', inStock: true, sku: 'LV-511-32', description: 'Classic slim fit jeans' },
  { name: 'Nike Air Max 270', price: 10995, category: 'Clothing', inStock: false, sku: 'NK-AM270-10', description: 'Lifestyle shoes with Max Air unit' },
  { name: 'The Pragmatic Programmer', price: 899, category: 'Books', inStock: true, sku: 'BK-PROG-PP', description: '20th Anniversary Edition' },
  { name: 'Clean Code', price: 699, category: 'Books', inStock: true, sku: 'BK-CC-RC', description: 'A Handbook of Agile Software Craftsmanship' },
  { name: 'Organic Green Tea (100g)', price: 299, category: 'Food', inStock: true, sku: 'FD-GT-100G', description: 'Premium organic green tea from Darjeeling' },
  { name: 'Dark Chocolate 85%', price: 199, category: 'Food', inStock: true, sku: 'FD-DC-85', description: 'Single origin dark chocolate bar' },
  { name: 'iPad Air 5th Gen', price: 59900, category: 'Electronics', inStock: true, sku: 'IPD-AIR5', description: 'iPad Air with M1 chip, 10.9-inch display' },
];

const DEMO_ORDERS = [
  { customerName: 'Arjun Sharma', customerEmail: 'arjun@example.com', total: 134900, status: 'delivered', notes: 'Express delivery' },
  { customerName: 'Priya Patel', customerEmail: 'priya@example.com', total: 24990, status: 'shipped', notes: '' },
  { customerName: 'Rahul Gupta', customerEmail: 'rahul@example.com', total: 15494, status: 'processing', notes: 'Gift wrapping requested' },
  { customerName: 'Ananya Singh', customerEmail: 'ananya@example.com', total: 114900, status: 'pending', notes: 'Office delivery' },
  { customerName: 'Vikram Kumar', customerEmail: 'vikram@example.com', total: 1598, status: 'delivered', notes: '' },
  { customerName: 'Sneha Reddy', customerEmail: 'sneha@example.com', total: 59900, status: 'shipped', notes: 'Please call before delivery' },
  { customerName: 'Amit Verma', customerEmail: 'amit@example.com', total: 10995, status: 'cancelled', notes: 'Out of stock' },
  { customerName: 'Kavya Nair', customerEmail: 'kavya@example.com', total: 498, status: 'delivered', notes: '' },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const email = 'demo@appforge.dev';
  const existing = await prisma.user.findUnique({ where: { email } });

  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log(`✅ Demo user already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash('demo1234', 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: 'Demo User', provider: 'local' },
    });
    userId = user.id;
    console.log(`✅ Created demo user: ${email} / demo1234`);
  }

  // Create demo app
  const existingApp = await prisma.app.findUnique({ where: { slug: 'product-manager' } });
  let appId: string;

  if (existingApp) {
    appId = existingApp.id;
    console.log('✅ Demo app already exists');
  } else {
    const app = await prisma.app.create({
      data: { slug: 'product-manager', config: DEMO_CONFIG as object, userId },
    });
    appId = app.id;
    console.log('✅ Created demo app: product-manager');
  }

  // Seed products
  const existingRecords = await prisma.appRecord.count({ where: { appId, entityName: 'Product' } });
  if (existingRecords === 0) {
    const now = new Date().toISOString();
    await prisma.appRecord.createMany({
      data: DEMO_PRODUCTS.map((p) => {
        const id = uuidv4();
        return {
          id,
          appId,
          entityName: 'Product',
          userId,
          data: { id, ...p, createdAt: now, updatedAt: now },
        };
      }),
    });
    console.log(`✅ Seeded ${DEMO_PRODUCTS.length} products`);
  } else {
    console.log('✅ Products already seeded');
  }

  // Seed orders
  const existingOrders = await prisma.appRecord.count({ where: { appId, entityName: 'Order' } });
  if (existingOrders === 0) {
    const now = new Date().toISOString();
    await prisma.appRecord.createMany({
      data: DEMO_ORDERS.map((o) => {
        const id = uuidv4();
        return {
          id,
          appId,
          entityName: 'Order',
          userId,
          data: { id, ...o, createdAt: now, updatedAt: now },
        };
      }),
    });
    console.log(`✅ Seeded ${DEMO_ORDERS.length} orders`);
  } else {
    console.log('✅ Orders already seeded');
  }

  // Seed welcome notification
  const notifCount = await prisma.notification.count({ where: { userId } });
  if (notifCount === 0) {
    await prisma.notification.create({
      data: { userId, title: 'Welcome to AppForge!', message: 'Your demo app "Product Manager" is ready. Try importing a CSV!', type: 'success' },
    });
    console.log('✅ Created welcome notification');
  }

  console.log('\n🚀 Seed complete!');
  console.log('   Login: demo@appforge.dev / demo1234');
  console.log('   App:   /apps/product-manager');
}

seed()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
