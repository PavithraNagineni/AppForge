# AppForge Config Schema

AppForge accepts a JSON config object that describes your entire application.

## Top-Level Structure

```json
{
  "id": "unique-app-id",
  "name": "My App",
  "version": "1.0.0",
  "locale": {
    "default": "en",
    "supported": ["en", "hi", "es"],
    "strings": {
      "en": { "welcome": "Welcome" },
      "hi": { "welcome": "स्वागत है" }
    }
  },
  "auth": {
    "enabled": true,
    "methods": ["email", "google"],
    "ui": {
      "logo": "/logo.png",
      "primaryColor": "#6366f1"
    }
  },
  "theme": {
    "primaryColor": "#6366f1",
    "borderRadius": "8px",
    "fontFamily": "Inter"
  },
  "entities": [...],
  "pages": [...],
  "navigation": [...]
}
```

## Entities (Database Tables)

```json
{
  "entities": [
    {
      "name": "Product",
      "fields": [
        { "name": "id", "type": "uuid", "primary": true, "auto": true },
        { "name": "name", "type": "string", "required": true, "maxLength": 200 },
        { "name": "price", "type": "number", "required": true },
        { "name": "category", "type": "enum", "options": ["Electronics","Clothing","Food"] },
        { "name": "inStock", "type": "boolean", "default": true },
        { "name": "createdAt", "type": "datetime", "auto": true }
      ],
      "relations": [
        { "type": "belongsTo", "entity": "User", "foreignKey": "userId" }
      ]
    }
  ]
}
```

### Field Types
| Type | Notes |
|------|-------|
| `string` | varchar, supports `maxLength` |
| `text` | longtext |
| `number` | decimal/float |
| `integer` | int |
| `boolean` | bool |
| `datetime` | timestamp |
| `date` | date |
| `uuid` | UUID v4 |
| `enum` | requires `options: []` |
| `json` | JSONB |
| `file` | stores URL/path |

## Pages

```json
{
  "pages": [
    {
      "id": "products-list",
      "path": "/products",
      "title": "Products",
      "requiresAuth": true,
      "layout": "dashboard",
      "components": [
        {
          "type": "table",
          "entity": "Product",
          "columns": ["name","price","category","inStock"],
          "actions": ["create","edit","delete","export-csv"],
          "filters": ["category","inStock"],
          "searchable": true,
          "pagination": { "pageSize": 20 }
        }
      ]
    },
    {
      "id": "product-form",
      "path": "/products/new",
      "title": "New Product",
      "requiresAuth": true,
      "layout": "dashboard",
      "components": [
        {
          "type": "form",
          "entity": "Product",
          "fields": ["name","price","category","inStock"],
          "submitLabel": "Create Product",
          "redirectOnSuccess": "/products"
        }
      ]
    },
    {
      "id": "dashboard",
      "path": "/dashboard",
      "title": "Dashboard",
      "requiresAuth": true,
      "layout": "dashboard",
      "components": [
        {
          "type": "stats",
          "metrics": [
            { "label": "Total Products", "entity": "Product", "aggregate": "count" },
            { "label": "Total Value", "entity": "Product", "field": "price", "aggregate": "sum" }
          ]
        },
        {
          "type": "chart",
          "chartType": "bar",
          "entity": "Product",
          "groupBy": "category",
          "aggregate": "count",
          "title": "Products by Category"
        }
      ]
    }
  ]
}
```

### Component Types
| Type | Description |
|------|-------------|
| `table` | Data grid with sorting/filtering/pagination |
| `form` | Create/edit form |
| `stats` | KPI metric cards |
| `chart` | Bar, line, pie charts |
| `detail` | Read-only record view |
| `markdown` | Static content block |
| `csv-importer` | CSV upload + column mapping |

## Navigation

```json
{
  "navigation": [
    { "label": "Dashboard", "path": "/dashboard", "icon": "LayoutDashboard" },
    {
      "label": "Products",
      "icon": "Package",
      "children": [
        { "label": "All Products", "path": "/products" },
        { "label": "Add Product", "path": "/products/new" }
      ]
    }
  ]
}
```

## Fault Tolerance

AppForge handles malformed configs gracefully:
- Unknown component types → rendered as a placeholder with a warning
- Missing required fields → skipped with console warning, not crash
- Type mismatches → coerced or defaulted
- Partial auth config → falls back to email-only
- Missing entity references → error boundary around that component only
