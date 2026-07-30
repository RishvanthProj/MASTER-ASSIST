const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.goto('http://localhost:4000/new_sale.html');
    await page.waitForTimeout(1000);
    
    const count = await page.evaluate(() => window.products ? window.products.length : 0);
    console.log('PRODUCTS COUNT:', count);
    
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.type("8901234567890", { delay: 1 });
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(1000);
    
    const rows = await page.evaluate(() => document.querySelectorAll('#cartItems tr').length);
    console.log('CART ROWS:', rows);
    
    await browser.close();
})();
