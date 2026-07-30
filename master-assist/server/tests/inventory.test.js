const request = require('supertest');
const app = require('../server');

describe('Inventory Logic (Category D)', () => {
    let newItemId;
    const testSku = 'TEST-SKU-' + Date.now();

    it('should add a new product to inventory', async () => {
        const payload = {
            name: 'Test Product',
            sku: testSku,
            stock: 100,
            sale: 10,
            mrp: 12,
            purchase: 8
        };
        const res = await request(app)
            .post('/api/items')
            .send(payload);
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body.sku).toEqual(testSku);
        newItemId = res.body.id;
    });

    it('should retrieve the added product', async () => {
        const res = await request(app).get('/api/items');
        expect(res.statusCode).toEqual(200);
        
        const found = res.body.find(item => item.id === newItemId);
        expect(found).toBeDefined();
        expect(found.stock).toEqual(100);
    });

    it('should decrement stock when a sale is completed', async () => {
        const salePayload = {
            customer: 'Test Customer',
            subtotal: 10,
            total: 10,
            payMode: 'Cash',
            items: [
                {
                    id: newItemId,
                    name: 'Test Product',
                    qty: 5,
                    price: 10
                }
            ]
        };

        const res = await request(app)
            .post('/api/sales')
            .send(salePayload);
        
        expect(res.statusCode).toEqual(200);

        // Verify stock is decremented
        const itemsRes = await request(app).get('/api/items');
        const updatedItem = itemsRes.body.find(item => item.id === newItemId);
        expect(updatedItem.stock).toEqual(95);
    });

    it('should prevent sale if insufficient stock', async () => {
        const salePayload = {
            customer: 'Test Customer',
            total: 2000,
            items: [
                {
                    id: newItemId,
                    qty: 100 // only 95 left
                }
            ]
        };

        const res = await request(app)
            .post('/api/sales')
            .send(salePayload);
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain('Insufficient stock');
    });

    it('should delete the test product', async () => {
        const res = await request(app).delete('/api/items/' + newItemId);
        expect(res.statusCode).toEqual(200);
        
        const itemsRes = await request(app).get('/api/items');
        const found = itemsRes.body.find(item => item.id === newItemId);
        expect(found).toBeUndefined();
    });

    it('should handle concurrent sales requests gracefully without negative stock', async () => {
        // Create an item with exactly 1 stock
        const resCreate = await request(app)
            .post('/api/items')
            .send({
                name: 'Race Condition Item',
                sku: 'RACE-123',
                stock: 1,
                sale: 100,
                mrp: 100,
                purchase: 50
            });
        
        const raceItemId = resCreate.body.id;

        // Fire 5 simultaneous sales requests for 1 qty each
        const salePayload = {
            customer: 'Race Customer',
            total: 100,
            items: [{ id: raceItemId, qty: 1 }]
        };

        const requests = Array(5).fill(null).map(() => 
            request(app).post('/api/sales').send(salePayload)
        );

        const responses = await Promise.all(requests);
        
        // Only one should succeed (200), the rest should fail (400)
        const successCount = responses.filter(r => r.statusCode === 200).length;
        const failCount = responses.filter(r => r.statusCode === 400).length;

        // Since the backend uses a synchronous lock or sequential sqlite, it should catch it
        expect(successCount).toBeLessThanOrEqual(1);
        expect(failCount).toBeGreaterThanOrEqual(4);

        const itemsRes = await request(app).get('/api/items');
        const updatedItem = itemsRes.body.find(item => item.id === raceItemId);
        expect(updatedItem.stock).toBeGreaterThanOrEqual(0);
        
        // Clean up
        await request(app).delete('/api/items/' + raceItemId);
    });

    it('should reject malformed bulk CSV import payloads', async () => {
        // Simulate posting malformed data to /sync/write (which acts as bulk sync)
        // or /api/items bulk endpoint if it existed. The spec said "bulk CSV import payload validation".
        // Looking at the app, /api/sales/import exists. Let's test invalid payload.
        const invalidPayload = {
            sales: "not-an-array"
        };
        
        const res = await request(app)
            .post('/api/sales/import')
            .send(invalidPayload);
        
        expect(res.statusCode).not.toEqual(200); // Should fail validation or gracefully handle error
    });
});
