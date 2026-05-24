const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "inventory.db");
const LOW_STOCK_THRESHOLD = 5;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity >= 0),
      price REAL NOT NULL CHECK(price >= 0),
      vendor TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  saveDb();
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return db.getRowsModified();
}

function getLastInsertId() {
  const result = db.exec("SELECT last_insert_rowid() as id");
  return result[0]?.values[0][0];
}

function validateItem(body, requireAll = true) {
  const { stock, quantity, price, vendor } = body;

  if (requireAll || stock !== undefined) {
    if (!stock || String(stock).trim() === "") return "stock is required";
  }
  if (requireAll || quantity !== undefined) {
    if (quantity === undefined || quantity === null) return "quantity is required";
    if (Number(quantity) < 0) return "quantity must be >= 0";
  }
  if (requireAll || price !== undefined) {
    if (price === undefined || price === null) return "price is required";
    if (Number(price) < 0) return "price must be >= 0";
  }
  if (requireAll || vendor !== undefined) {
    if (!vendor || String(vendor).trim() === "") return "vendor is required";
  }

  return null;
}

// GET /api/inventory — list items with optional search, sort, filter, pagination
app.get("/api/inventory", (req, res) => {
  try {
    const { search, sort = "stock", order = "asc", vendor, low_stock, page, limit } = req.query;
    const allowedSort = ["stock", "quantity", "price", "vendor", "created_at", "updated_at", "id"];
    const allowedOrder = ["asc", "desc"];

    const sortCol = allowedSort.includes(sort) ? sort : "stock";
    const sortDir = allowedOrder.includes(order.toLowerCase()) ? order.toUpperCase() : "ASC";

    let sql = "SELECT * FROM inventory WHERE 1=1";
    const params = [];

    if (search) {
      sql += " AND (stock LIKE ? OR vendor LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (vendor) {
      sql += " AND vendor = ?";
      params.push(vendor);
    }
    if (low_stock === "1" || low_stock === "true") {
      sql += ` AND quantity <= ${LOW_STOCK_THRESHOLD}`;
    }

    sql += ` ORDER BY ${sortCol} ${sortDir}`;

    const pageNum = parseInt(page) || 0;
    const pageSize = parseInt(limit) || 0;
    if (pageSize > 0) {
      sql += " LIMIT ? OFFSET ?";
      params.push(pageSize, pageNum * pageSize);
    }

    const items = dbAll(sql, params);
    res.json({ success: true, data: items, count: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/inventory/export — CSV download
app.get("/api/inventory/export", (req, res) => {
  try {
    const items = dbAll(
      "SELECT id, stock, quantity, price, vendor, created_at, updated_at FROM inventory ORDER BY stock ASC"
    );

    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const header = "ID,Stock,Quantity,Unit Price,Total Value,Vendor,Created,Updated\n";
    const rows = items
      .map((item) =>
        [
          item.id,
          esc(item.stock),
          item.quantity,
          Number(item.price).toFixed(2),
          (item.quantity * item.price).toFixed(2),
          esc(item.vendor),
          item.created_at,
          item.updated_at,
        ].join(",")
      )
      .join("\n");

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="inventory-${date}.csv"`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/inventory/:id
app.get("/api/inventory/:id", (req, res) => {
  try {
    const item = dbGet("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/inventory — create item
app.post("/api/inventory", (req, res) => {
  try {
    const err = validateItem(req.body, true);
    if (err) return res.status(400).json({ success: false, error: err });

    const { stock, quantity, price, vendor } = req.body;
    dbRun("INSERT INTO inventory (stock, quantity, price, vendor) VALUES (?, ?, ?, ?)", [
      stock.trim(),
      Number(quantity),
      Number(price),
      vendor.trim(),
    ]);

    const newItem = dbGet("SELECT * FROM inventory WHERE id = ?", [getLastInsertId()]);
    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/inventory/:id — full replace
app.put("/api/inventory/:id", (req, res) => {
  try {
    const err = validateItem(req.body, true);
    if (err) return res.status(400).json({ success: false, error: err });

    const existing = dbGet("SELECT id FROM inventory WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: "Item not found" });

    const { stock, quantity, price, vendor } = req.body;
    dbRun(
      "UPDATE inventory SET stock=?, quantity=?, price=?, vendor=?, updated_at=datetime('now') WHERE id=?",
      [stock.trim(), Number(quantity), Number(price), vendor.trim(), req.params.id]
    );

    const updated = dbGet("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/inventory/:id — partial update
app.patch("/api/inventory/:id", (req, res) => {
  try {
    const existing = dbGet("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: "Item not found" });

    const fields = [];
    const params = [];
    const allowed = ["stock", "quantity", "price", "vendor"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if ((key === "quantity" || key === "price") && Number(req.body[key]) < 0) {
          return res.status(400).json({ success: false, error: `${key} must be >= 0` });
        }
        if ((key === "stock" || key === "vendor") && String(req.body[key]).trim() === "") {
          return res.status(400).json({ success: false, error: `${key} cannot be empty` });
        }
        fields.push(`${key} = ?`);
        params.push(
          key === "stock" || key === "vendor"
            ? String(req.body[key]).trim()
            : Number(req.body[key])
        );
      }
    }

    if (fields.length === 0) return res.status(400).json({ success: false, error: "No valid fields provided" });

    fields.push("updated_at = datetime('now')");
    params.push(req.params.id);

    dbRun(`UPDATE inventory SET ${fields.join(", ")} WHERE id = ?`, params);
    const updated = dbGet("SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/inventory/:id
app.delete("/api/inventory/:id", (req, res) => {
  try {
    const existing = dbGet("SELECT id FROM inventory WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: "Item not found" });

    dbRun("DELETE FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: `Item ${req.params.id} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats — aggregate summary
app.get("/api/stats", (req, res) => {
  try {
    const stats = dbGet(`
      SELECT
        COUNT(*) as total_items,
        COALESCE(SUM(quantity), 0) as total_units,
        COALESCE(SUM(quantity * price), 0) as total_value,
        COUNT(DISTINCT vendor) as total_vendors,
        SUM(CASE WHEN quantity <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) as low_stock_count
      FROM inventory
    `);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/vendors — distinct vendor list
app.get("/api/vendors", (req, res) => {
  try {
    const vendors = dbAll("SELECT DISTINCT vendor FROM inventory ORDER BY vendor ASC");
    res.json({ success: true, data: vendors.map((v) => v.vendor) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Inventory API running → http://localhost:${PORT}`);
  });
});
