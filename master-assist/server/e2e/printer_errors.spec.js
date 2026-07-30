const { test, expect } = require('@playwright/test');

test.describe('Printer Hardware Failure Simulation (Category A/B)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4000/new_sale.html');
        // Wait for page to initialize and render
        await page.waitForTimeout(1000); 

        // Inject MockPrinterService over the RealPrinterService
        await page.evaluate(() => {
            window.PrinterAPI = new MockPrinterService();
            window.PrinterAPI.initPrinterUI();
        });
    });

    test('should show error toast on printer disconnect (A-03 / B-08)', async ({ page }) => {
        // Simulate disconnect
        await page.evaluate(() => {
            window.PrinterAPI.simulateEvent('disconnect');
        });

        // The SweetAlert toast should appear
        const swalTitle = page.locator('.swal2-title');
        await expect(swalTitle).toBeVisible({ timeout: 2000 });
        await expect(swalTitle).toContainText('Printer Disconnected');
    });

    test('should show warning toast on out of paper (A-08a / B-07a - UI warning only)', async ({ page }) => {
        // Simulate out of paper
        await page.evaluate(() => {
            window.PrinterAPI.simulateEvent('outOfPaper');
        });

        const swalTitle = page.locator('.swal2-title');
        await expect(swalTitle).toBeVisible({ timeout: 2000 });
        await expect(swalTitle).toContainText('Printer Out of Paper');
    });

    test('should show info toast on low battery (A-09)', async ({ page }) => {
        // Simulate low battery
        await page.evaluate(() => {
            window.PrinterAPI.simulateEvent('lowBattery');
        });

        const swalTitle = page.locator('.swal2-title');
        await expect(swalTitle).toBeVisible({ timeout: 2000 });
        await expect(swalTitle).toContainText('Printer Battery Low');
    });
});
