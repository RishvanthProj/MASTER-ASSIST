const { test, expect } = require('@playwright/test');

test.describe('Scanner Simulation & Keyboard Wedge (Category C)', () => {
    
    test.beforeAll(async ({ request }) => {
        // Seed the product so the scanner has something to find
        await request.post('http://localhost:4000/api/items', {
            data: {
                name: "Atta 5kg",
                sku: "GROC-01",
                barcode: "8901234567890",
                sale: 250,
                mrp: 280,
                cat: "Grocery",
                stock: 50,
                gst: 0
            }
        });
    });

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        await page.goto('http://localhost:4000/new_sale.html');
        // Wait for page to initialize and render
        await page.waitForTimeout(1000); 
        await page.evaluate(() => {
            document.addEventListener('keydown', e => console.log('KEY DOWN:', e.key, 'BUFFER:', window.barcodeBuffer));
        });
    });

    test('should add item to cart on fast consecutive keystrokes (valid scanner speed)', async ({ page }) => {
        const barcode = "8901234567890";
        await page.evaluate(() => document.activeElement.blur());
        await page.keyboard.type(barcode, { delay: 1 });
        await page.keyboard.press('Enter');

        const rows = page.locator('#cartItems tr');
        await expect(rows).toHaveCount(1, { timeout: 3000 });
        
        const firstRowText = await rows.nth(0).innerText();
        expect(firstRowText).toContain('Atta 5kg');
        expect(firstRowText).toContain('8901234567890');
    });

    test('should ignore slow manual typing outside of input fields', async ({ page }) => {
        const barcode = "8909876543210"; 
        await page.evaluate(() => document.activeElement.blur());
        
        for (const char of barcode) {
            await page.keyboard.type(char);
            await page.waitForTimeout(100);
        }
        await page.keyboard.press('Enter');

        const rows = page.locator('#cartItems tr');
        await expect(rows).toHaveCount(0);
    });

    test('should properly debounce double scans to prevent accidental double entry', async ({ page }) => {
        const barcode = "8901234567890";
        await page.evaluate(() => document.activeElement.blur());
        
        await page.keyboard.type(barcode, { delay: 1 });
        await page.keyboard.press('Enter');
        
        await page.waitForTimeout(10);
        
        await page.keyboard.type(barcode, { delay: 1 });
        await page.keyboard.press('Enter');

        const rows = page.locator('#cartItems tr');
        await expect(rows).toHaveCount(1, { timeout: 3000 });
        
        await page.waitForTimeout(200); 
        
        const qtyInput = rows.nth(0).locator('input[type="number"]').first();
        const val = await qtyInput.inputValue();
        expect(val).toBe("2");
    });

    test('should handle unknown SKU pathways without crashing', async ({ page }) => {
        const barcode = "UNKNOWN999";
        await page.evaluate(() => document.activeElement.blur());
        
        await page.keyboard.type(barcode, { delay: 1 });
        await page.keyboard.press('Enter');

        const rows = page.locator('#cartItems tr');
        await expect(rows).toHaveCount(0);

        const swal = page.locator('.swal2-container');
        await expect(swal).toBeVisible({ timeout: 3000 });
        await expect(swal).toContainText('Item not found');
    });

});
