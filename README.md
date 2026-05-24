# Inventory Management System

A full-stack inventory manager built with **Node.js + Express + SQLite**.

## Stack
- **Backend**: Express.js REST API
- **Database**: SQLite via `sql.js` (file-persisted as `inventory.db`)
- **Frontend**: Vanilla HTML/CSS/JS (served by Express)

---

## Getting Started

### Prerequisites
You will need **Node.js** installed on your machine.

- **Mac**: Install via [https://nodejs.org](https://nodejs.org) or run `brew install node` if you have Homebrew
- **Windows**: Download the installer from [https://nodejs.org](https://nodejs.org)

### Setup & Running

1. **Download or clone the project** and make sure the folder looks like this:
   ```
   Inventory-app/
   ├── public/
   │   └── index.html
   └── server.js
   ```

2. **Open a terminal** and navigate into the project folder:
   ```bash
   cd path/to/Inventory-app
   ```

3. **Install dependencies:**
   ```bash
   npm install express cors sql.js
   ```

4. **Start the server:**
   ```bash
   node server.js
   ```

5. **Open your browser and go to:**
   ```
   http://localhost:3000
   ```

   You should see the inventory dashboard. To stop the server at any time, press `Ctrl + C` in the terminal.

> **Note:** The database file (`inventory.db`) is created automatically in the project folder on first run. All data persists between sessions.

---

## How to Use the Application

### Adding an Item
1. Click **+ New Item** in the toolbar, or simply start filling in the form on the right-hand panel
2. Enter the **Stock Name**, **Quantity**, **Unit Price**, and **Vendor**
3. Click **Save Item** — the item will appear in the table immediately

### Editing an Item
1. Click the **✎ (pencil)** icon on any row in the table
2. The form on the right will populate with that item's current details
3. Make your changes and click **Update Item**

### Deleting an Item
1. Click the **✕** icon on the row you want to remove
2. A confirmation dialog will appear — click **Delete** to confirm

### Searching & Filtering
- Use the **search bar** to filter items by stock name or vendor in real time
- Use the **All Vendors** dropdown to filter the table by a specific vendor

### Sorting
- Click any **column header** (Stock, Qty, Price, Vendor, Updated) to sort by that column
- Click the same header again to reverse the sort order

### Stats Bar
The four cards at the top of the page update automatically and show:
- **Total Items** — number of distinct items in the inventory
- **Total Units** — sum of all quantities across all items
- **Portfolio Value** — total stock value calculated as `quantity × price` for every item
- **Vendors** — number of unique vendors

### Low Stock Warning
Any item with a quantity of **5 or fewer** will be highlighted in red and tagged with a **LOW** badge in the table.

---

## REST API Reference

Base URL: `http://localhost:3000/api`

### Inventory Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory` | List all items |
| GET | `/inventory/:id` | Get a single item by ID |
| POST | `/inventory` | Create a new item |
| PUT | `/inventory/:id` | Fully replace an existing item |
| PATCH | `/inventory/:id` | Partially update an item |
| DELETE | `/inventory/:id` | Delete an item |
| GET | `/stats` | Get aggregate stats (totals, value) |
| GET | `/vendors` | Get a list of distinct vendor names |

### GET /inventory — Optional Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Filter by stock name or vendor |
| `vendor` | string | Filter by exact vendor name |
| `sort` | string | Column to sort by (default: `stock`) |
| `order` | `asc` / `desc` | Sort direction (default: `asc`) |

### Request Body — POST / PUT

```json
{
  "stock": "USB-C Cable 2m",
  "quantity": 50,
  "price": 12.99,
  "vendor": "Acme Supplies"
}
```

### Request Body — PATCH (any subset of fields)

```json
{ "quantity": 35 }
```

### Response Format

All endpoints return a consistent JSON structure:

```json
{ "success": true, "data": { ... } }
```

On error:

```json
{ "success": false, "error": "Descriptive error message" }
```

### Validation Rules
- `stock` and `vendor` must be non-empty strings
- `quantity` must be a whole number ≥ 0
- `price` must be a number ≥ 0
