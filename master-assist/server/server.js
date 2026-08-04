const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'database.xlsx');

// Serve frontend static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// Simple global async mutex to serialize all reads and writes
let globalLock = Promise.resolve();

function withLock(fn) {
    let release;
    const lock = new Promise(resolve => { release = resolve; });
    const currentLock = globalLock.then(() => {
        return fn().finally(() => {
            release();
        });
    });
    globalLock = globalLock.then(() => lock);
    return currentLock;
}

const itemsColumns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Barcode', key: 'barcode', width: 15 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Sale Price', key: 'sale', width: 15 },
    { header: 'MRP', key: 'mrp', width: 15 },
    { header: 'Purchase Price', key: 'purchase', width: 15 },
    { header: 'Min Stock', key: 'minStock', width: 10 },
    { header: 'GST', key: 'gst', width: 10 },
    { header: 'Category', key: 'cat', width: 15 },
    { header: 'Brand', key: 'brand', width: 15 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'HSN', key: 'hsn', width: 15 },
    { header: 'Tax Type', key: 'taxType', width: 10 },
    { header: 'Description', key: 'desc', width: 30 }
];

const salesColumns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Bill No', key: 'billNo', width: 15 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Time', key: 'time', width: 15 },
    { header: 'Customer', key: 'customer', width: 25 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
    { header: 'Discount Pct', key: 'discountPct', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Pay Mode', key: 'payMode', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Items JSON', key: 'items', width: 50 }
];

const metadataKeys = ['brands', 'categories', 'sizes', 'colours', 'hsns', 'units', 'itemNames'];
const metadataColumns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 30 }
];

// Helper to initialize or load workbook
async function getWorkbook() {
    const wb = new ExcelJS.Workbook();
    let isModified = false;
    if (fs.existsSync(DB_FILE)) {
        try {
            await wb.xlsx.readFile(DB_FILE);
            // Re-attach column keys because exceljs drops them on read
            if (wb.getWorksheet('Items')) wb.getWorksheet('Items').columns = itemsColumns;
            if (wb.getWorksheet('Sales')) wb.getWorksheet('Sales').columns = salesColumns;
            
            // Check if metadata sheets exist, create them if missing
            metadataKeys.forEach(k => {
                let ws = wb.getWorksheet(k);
                if (!ws) {
                    ws = wb.addWorksheet(k);
                    // Add default rows to seeded lists
                    if (k === 'brands') {
                        ws.addRow({ id: 1, name: 'Local' });
                        ws.addRow({ id: 2, name: 'Samsung' });
                    } else if (k === 'categories') {
                        ws.addRow({ id: 1, name: 'Grocery' });
                        ws.addRow({ id: 2, name: 'Electronics' });
                    } else if (k === 'units') {
                        ws.addRow({ id: 1, name: 'Pcs' });
                        ws.addRow({ id: 2, name: 'Kgs' });
                    } else if (k === 'sizes') {
                        ws.addRow({ id: 1, name: 'Free Size' });
                    } else if (k === 'colours') {
                        ws.addRow({ id: 1, name: 'Common' });
                    } else if (k === 'hsns') {
                        ws.addRow({ id: 1, name: '9983' });
                    } else if (k === 'itemNames') {
                        ws.addRow({ id: 1, name: 'Atta 5kg' });
                        ws.addRow({ id: 2, name: 'WHITE SHOE' });
                    }
                    isModified = true;
                }
                ws.columns = metadataColumns;
            });
            if (isModified) {
                await saveWorkbook(wb);
            }
        } catch (err) {
            if (err.code === 'EBUSY' || (err.message && err.message.includes('EBUSY'))) {
                throw new Error('FILE_LOCKED');
            }
            throw err;
        }
    } else {
        // Initialize sheets
        const itemsSheet = wb.addWorksheet('Items');
        itemsSheet.columns = itemsColumns;

        const salesSheet = wb.addWorksheet('Sales');
        salesSheet.columns = salesColumns;
        
        metadataKeys.forEach(k => {
            const ws = wb.addWorksheet(k);
            ws.columns = metadataColumns;
            if (k === 'brands') {
                ws.addRow({ id: 1, name: 'Local' });
                ws.addRow({ id: 2, name: 'Samsung' });
            } else if (k === 'categories') {
                ws.addRow({ id: 1, name: 'Grocery' });
                ws.addRow({ id: 2, name: 'Electronics' });
            } else if (k === 'units') {
                ws.addRow({ id: 1, name: 'Pcs' });
                ws.addRow({ id: 2, name: 'Kgs' });
            } else if (k === 'sizes') {
                ws.addRow({ id: 1, name: 'Free Size' });
            } else if (k === 'colours') {
                ws.addRow({ id: 1, name: 'Common' });
            } else if (k === 'hsns') {
                ws.addRow({ id: 1, name: '9983' });
            } else if (k === 'itemNames') {
                ws.addRow({ id: 1, name: 'Atta 5kg' });
                ws.addRow({ id: 2, name: 'WHITE SHOE' });
            }
        });
        
        await saveWorkbook(wb);
    }
    return wb;
}

async function saveWorkbook(wb) {
    try {
        await wb.xlsx.writeFile(DB_FILE);
    } catch (err) {
        if (err.code === 'EBUSY') {
            throw new Error('FILE_LOCKED');
        }
        throw err;
    }
}

// Convert row to object based on sheet columns
function rowToObject(row, sheet) {
    const obj = {};
    sheet.columns.forEach(col => {
        let val = row.getCell(col.key).value;
        if (val === null || val === undefined) val = '';
        obj[col.key] = val;
    });
    // Type casting
    if (obj.id) obj.id = Number(obj.id);
    if (obj.stock) obj.stock = Number(obj.stock);
    if (obj.sale) obj.sale = Number(obj.sale);
    if (obj.mrp) obj.mrp = Number(obj.mrp);
    if (obj.purchase) obj.purchase = Number(obj.purchase);
    if (obj.minStock) obj.minStock = Number(obj.minStock);
    if (obj.items && typeof obj.items === 'string') {
        try { obj.items = JSON.parse(obj.items); } catch(e) {}
    }
    return obj;
}

// GET /api/items
app.get('/api/items', (req, res) => {
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet('Items');
            const items = [];
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // skip header
                items.push(rowToObject(row, sheet));
            });
            res.json(items);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// POST /api/items (create)
app.post('/api/items', (req, res) => {
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet('Items');
            const data = req.body;
            
            // Check for duplicate SKU
            let isDuplicate = false;
            let maxId = 0;
            sheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const sku = row.getCell('sku').value || '';
                if (sku.toString().toLowerCase() === (data.sku || '').toString().toLowerCase()) {
                    isDuplicate = true;
                }
                const id = Number(row.getCell('id').value) || 0;
                if (id > maxId) maxId = id;
            });
            
            if (isDuplicate) {
                return res.status(400).json({ error: 'SKU already exists' });
            }
            
            data.id = maxId + 1;
            sheet.addRow(data);
            await saveWorkbook(wb);
            res.json(data);
        } catch (e) {
            res.status(e.message === 'FILE_LOCKED' ? 409 : 500).json({ error: e.message === 'FILE_LOCKED' ? 'Database is currently open in Excel. Please close it and try again.' : e.message });
        }
    });
});

// PUT /api/items/:id (update)
app.put('/api/items/:id', (req, res) => {
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet('Items');
            const data = req.body;
            const targetId = Number(req.params.id);
            
            // Check for duplicate SKU excluding self
            let isDuplicate = false;
            let rowIndex = -1;
            sheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const id = Number(row.getCell('id').value);
                const sku = row.getCell('sku').value || '';
                
                if (id === targetId) {
                    rowIndex = rowNum;
                } else if (sku.toString().toLowerCase() === (data.sku || '').toString().toLowerCase()) {
                    isDuplicate = true;
                }
            });
            
            if (isDuplicate) {
                return res.status(400).json({ error: 'SKU already exists' });
            }
            if (rowIndex === -1) {
                return res.status(404).json({ error: 'Item not found' });
            }
            
            data.id = targetId; // ensure ID is preserved
            const row = sheet.getRow(rowIndex);
            sheet.columns.forEach((col, idx) => {
                if (data[col.key] !== undefined) {
                    row.getCell(idx + 1).value = data[col.key];
                }
            });
            row.commit();
            
            await saveWorkbook(wb);
            res.json(data);
        } catch (e) {
            res.status(e.message === 'FILE_LOCKED' ? 409 : 500).json({ error: e.message === 'FILE_LOCKED' ? 'Database is currently open in Excel. Please close it and try again.' : e.message });
        }
    });
});

// DELETE /api/items/:id
app.delete('/api/items/:id', (req, res) => {
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet('Items');
            const targetId = Number(req.params.id);
            
            let rowIndex = -1;
            sheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                if (Number(row.getCell('id').value) === targetId) {
                    rowIndex = rowNum;
                }
            });
            
            if (rowIndex !== -1) {
                sheet.spliceRows(rowIndex, 1);
                await saveWorkbook(wb);
            }
            res.json({ success: true });
        } catch (e) {
            res.status(e.message === 'FILE_LOCKED' ? 409 : 500).json({ error: e.message === 'FILE_LOCKED' ? 'Database is currently open in Excel. Please close it and try again.' : e.message });
        }
    });
});

// GET /api/:type (brands, categories, sizes, colours, hsns, units)
app.get('/api/:type', (req, res, next) => {
    const type = req.params.type;
    if (!metadataKeys.includes(type)) return next();
    
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet(type);
            const list = [];
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // skip header
                list.push({
                    id: Number(row.getCell('id').value),
                    name: row.getCell('name').value
                });
            });
            res.json(list);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// POST /api/:type (create metadata option)
app.post('/api/:type', (req, res, next) => {
    const type = req.params.type;
    if (!metadataKeys.includes(type)) return next();
    
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet(type);
            const data = req.body;
            
            // Check duplicate name
            let isDuplicate = false;
            let maxId = 0;
            sheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const name = row.getCell('name').value || '';
                if (name.toString().toLowerCase() === (data.name || '').toString().toLowerCase()) {
                    isDuplicate = true;
                }
                const id = Number(row.getCell('id').value) || 0;
                if (id > maxId) maxId = id;
            });
            
            if (isDuplicate) {
                return res.status(400).json({ error: 'Value already exists' });
            }
            
            data.id = maxId + 1;
            sheet.addRow(data);
            await saveWorkbook(wb);
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// GET /api/sales
app.get('/api/sales', (req, res) => {
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const sheet = wb.getWorksheet('Sales');
            const sales = [];
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // skip header
                sales.push(rowToObject(row, sheet));
            });
            res.json(sales);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// POST /api/sales (complete a sale)
app.post('/api/sales', (req, res) => {
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const itemsSheet = wb.getWorksheet('Items');
            const salesSheet = wb.getWorksheet('Sales');
            const saleRec = req.body;
            
            // 1 & 2. Re-check current stock
            let stockErrors = [];
            let itemRowsToUpdate = [];
            
            for (let lineItem of saleRec.items) {
                let foundRow = null;
                itemsSheet.eachRow((row, rowNum) => {
                    if (rowNum === 1) return;
                    if (Number(row.getCell('id').value) === Number(lineItem.id)) {
                        foundRow = { row, rowNum };
                    }
                });
                
                if (!foundRow) {
                    stockErrors.push(`Item ID ${lineItem.id} not found.`);
                    continue;
                }
                
                let currentStock = Number(foundRow.row.getCell('stock').value) || 0;
                if (currentStock < lineItem.qty) {
                    stockErrors.push(`Insufficient stock for ${lineItem.name} (Available: ${currentStock}, Requested: ${lineItem.qty})`);
                } else {
                    itemRowsToUpdate.push({
                        row: foundRow.row,
                        newStock: currentStock - lineItem.qty
                    });
                }
            }
            
            if (stockErrors.length > 0) {
                return res.status(400).json({ error: stockErrors.join('\n') });
            }
            
            // 3. Decrement stock
            for (let update of itemRowsToUpdate) {
                update.row.getCell('stock').value = update.newStock;
                update.row.commit();
            }
            
            // 4. Write the sale record
            let maxId = 0;
            salesSheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const id = Number(row.getCell('id').value) || 0;
                if (id > maxId) maxId = id;
            });
            
            saleRec.id = maxId + 1;
            
            // Convert items array to JSON string for the sheet
            const sheetRec = { ...saleRec, items: JSON.stringify(saleRec.items) };
            salesSheet.addRow(sheetRec);
            
            // 5. Save workbook
            await saveWorkbook(wb);
            res.json(saleRec);
            
        } catch (e) {
            res.status(e.message === 'FILE_LOCKED' ? 409 : 500).json({ error: e.message === 'FILE_LOCKED' ? 'Database is currently open in Excel. Please close it and try again.' : e.message });
        }
    });
});

// POST /api/sales/import (raw import for migration, no stock deduction)
app.post('/api/sales/import', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || !Array.isArray(req.body.items)) {
        return res.status(400).json({ error: "Invalid payload format. Expected object with 'items' array." });
    }
    withLock(async () => {
        try {
            const wb = await getWorkbook();
            const salesSheet = wb.getWorksheet('Sales');
            const saleRec = req.body;
            
            let maxId = 0;
            salesSheet.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const id = Number(row.getCell('id').value) || 0;
                if (id > maxId) maxId = id;
            });
            
            saleRec.id = maxId + 1;
            const sheetRec = { ...saleRec, items: JSON.stringify(saleRec.items) };
            salesSheet.addRow(sheetRec);
            
            await saveWorkbook(wb);
            res.json(saleRec);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

const PORT = 4000;

async function startServer() {
    try {
        // Test access to the database to ensure it's not locked by Excel
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(DB_FILE);
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Master Assist Local Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('\n======================================================');
        console.error('CRITICAL ERROR: COULD NOT START LOCAL DATABASE SERVER');
        console.error('======================================================');
        if (err.message && err.message.includes('EBUSY')) {
            console.error('REASON: database.xlsx is currently open in Excel (or locked by another process).');
            console.error('FIX: Please close Excel completely and then restart the app.');
        } else {
            console.error('REASON:', err.message);
        }
        console.error('======================================================\n');
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
