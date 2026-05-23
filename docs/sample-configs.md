# Sample Configs for Testing AppForge

## 1. Minimal Config (bare minimum)
```json
{
  "name": "Todo App",
  "entities": [
    {
      "name": "Todo",
      "fields": [
        { "name": "title", "type": "string", "required": true },
        { "name": "done", "type": "boolean" }
      ]
    }
  ],
  "pages": [
    {
      "id": "todos",
      "path": "/todos",
      "title": "Todos",
      "components": [
        { "type": "table", "entity": "Todo" }
      ]
    }
  ]
}
```

## 2. Intentionally Broken Config (tests fault tolerance)
```json
{
  "name": 12345,
  "entities": [
    {
      "fields": [
        { "name": "x", "type": "INVALIDTYPE" },
        null,
        { "type": "string" }
      ]
    },
    null
  ],
  "pages": [
    {
      "components": [
        { "type": "table", "entity": "NonExistentEntity" },
        { "type": "unknownWidget", "foo": "bar" },
        null
      ]
    }
  ],
  "auth": "not-an-object",
  "theme": { "primaryColor": "invalid-color" }
}
```
Expected: app is created with warnings, broken parts render as error placeholders

## 3. Full-Featured Config (all features)
See frontend/src/app/apps/new/page.tsx → SAMPLE_CONFIG

## 4. Missing Fields Config
```json
{
  "name": "CRM",
  "entities": [
    {
      "name": "Contact",
      "fields": [
        { "name": "email", "type": "string", "required": true },
        { "name": "phone", "type": "string" }
      ]
    }
  ],
  "pages": [
    {
      "id": "contacts",
      "path": "/contacts",
      "title": "Contacts",
      "components": [
        {
          "type": "table",
          "entity": "Contact",
          "columns": ["email", "phone", "nonExistentField"],
          "actions": ["create", "edit", "delete", "export-csv", "import-csv"]
        }
      ]
    }
  ]
}
```
Expected: table renders with email + phone, nonExistentField silently omitted

## 5. Localization Config
```json
{
  "name": "Multi-lang App",
  "locale": {
    "default": "en",
    "supported": ["en", "hi", "es"],
    "strings": {
      "en": { "welcome": "Welcome", "save": "Save", "cancel": "Cancel" },
      "hi": { "welcome": "स्वागत है", "save": "सहेजें", "cancel": "रद्द करें" },
      "es": { "welcome": "Bienvenido", "save": "Guardar", "cancel": "Cancelar" }
    }
  },
  "entities": [
    { "name": "Item", "fields": [{ "name": "name", "type": "string", "required": true }] }
  ],
  "pages": [
    {
      "id": "items",
      "path": "/items",
      "title": "Items",
      "components": [{ "type": "table", "entity": "Item", "actions": ["create"] }]
    }
  ]
}
```
