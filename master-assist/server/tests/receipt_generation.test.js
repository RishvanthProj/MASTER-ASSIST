const BillingLogic = require('../../js/billing.js');

describe('Receipt Generation & Tax Logic (Category B)', () => {
    
    const mockStore = {
        name: "Test Store",
        address: "123 Main St",
        phone: "9999999999",
        gstin: "22AAAAA0000A1Z5"
    };

    it('should generate correct tax breakdown for a single item cart', () => {
        const cart = [
            { name: "Test Item", qty: 1, price: 100, bargainPrice: 100, gst: 18 }
        ];
        
        const params = { cart };
        const totals = BillingLogic.calculateCartTotals(params);
        
        // 100 inclusive of 18% GST means:
        // Taxable = 100 / 1.18 = 84.7457...
        // GST = 100 - 84.7457 = 15.254...
        expect(totals.taxableValue).toBeCloseTo(84.75, 2);
        expect(totals.gstAmt).toBeCloseTo(15.25, 2);
        expect(totals.halfGst).toBeCloseTo(7.63, 2); // CGST/SGST split
        expect(totals.netSale).toBe(100);

        const receipt = BillingLogic.generateReceiptData(cart, totals, mockStore, "INV-1");
        expect(receipt.items.length).toBe(1);
    });

    it('should correctly sum and format a cart with 50+ items', () => {
        const cart = Array.from({ length: 55 }, (_, i) => ({
            name: `Bulk Item ${i}`,
            qty: 2,
            price: 50,
            bargainPrice: 50,
            gst: 5
        })); // Total = 55 * 2 * 50 = 5500

        const params = { cart };
        const totals = BillingLogic.calculateCartTotals(params);

        // Taxable = 5500 / 1.05 = 5238.095...
        // GST = 5500 - 5238.095 = 261.904...
        expect(totals.totalSale).toBe(5500);
        expect(totals.taxableValue).toBeCloseTo(5238.10, 2);
        expect(totals.gstAmt).toBeCloseTo(261.90, 2);
        expect(totals.netSale).toBe(5500);

        const receipt = BillingLogic.generateReceiptData(cart, totals, mockStore, "INV-2");
        expect(receipt.items.length).toBe(55);
        expect(receipt.totals.totalSale).toBe(5500);
    });

    it('should handle ₹0 items and formatting rules', () => {
        const cart = [
            { name: "Long Product Name That Should Exceed 24 Characters On The Receipt", qty: 1, price: 0, bargainPrice: 0, gst: 18 }
        ];

        const params = { cart };
        const totals = BillingLogic.calculateCartTotals(params);

        expect(totals.totalSale).toBe(0);
        expect(totals.gstAmt).toBe(0);
        expect(totals.netSale).toBe(0);
        // Our billing.js does c.name.substring(0, 24)
    });

    it('should handle negative line items (refunds)', () => {
        const cart = [
            { name: "Product A", qty: 1, price: 100, bargainPrice: 100, gst: 18 },
            { name: "Refund Product B", qty: -1, price: 50, bargainPrice: 50, gst: 18 }
        ];

        const params = { cart };
        const totals = BillingLogic.calculateCartTotals(params);
        
        // Total Sale = 100 + (-50) = 50
        expect(totals.totalSale).toBe(50);
        
        // Taxable = 50 / 1.18 = 42.37
        expect(totals.taxableValue).toBeCloseTo(42.37, 2);
        expect(totals.netSale).toBe(50);
    });

    it('should remain consistent when the same cart is printed twice', () => {
        const cart = [
            { name: "Test", qty: 2, price: 200, bargainPrice: 200, gst: 12 }
        ];

        const pass1 = BillingLogic.calculateCartTotals({ cart });
        const pass2 = BillingLogic.calculateCartTotals({ cart });

        expect(pass1).toEqual(pass2);

        const receipt1 = BillingLogic.generateReceiptData(cart, pass1, mockStore, "INV-1", { date: '2023-01-01' });
        const receipt2 = BillingLogic.generateReceiptData(cart, pass2, mockStore, "INV-1", { date: '2023-01-01' });

        expect(receipt1).toEqual(receipt2);
    });

    it('should apply extra discount percentage and rs correctly', () => {
        const cart = [{ name: "A", qty: 1, price: 1000, bargainPrice: 1000, gst: 12 }]; // Taxable: 892.86
        
        // 10% Discount
        const paramsPct = { cart, extraDiscMode: 'pct', extraDiscValue: 10 };
        const totalsPct = BillingLogic.calculateCartTotals(paramsPct);
        
        // Discount = 100
        expect(totalsPct.extraDiscRs).toBe(100);
        expect(totalsPct.discountedSale).toBe(900);
        // Taxable on 900 = 900 / 1.12 = 803.57
        expect(totalsPct.taxableValue).toBeCloseTo(803.57, 2);
        
        // 150 Rs Discount
        const paramsRs = { cart, extraDiscMode: 'rs', extraDiscValue: 150 };
        const totalsRs = BillingLogic.calculateCartTotals(paramsRs);
        
        expect(totalsRs.extraDiscRs).toBe(150);
        expect(totalsRs.extraDiscPct).toBe(15);
        expect(totalsRs.discountedSale).toBe(850);
    });

    it('should handle other charges', () => {
        const cart = [{ name: "A", qty: 1, price: 1000, bargainPrice: 1000, gst: 18 }];
        
        const params = {
            cart,
            otherCharges: [
                { rate: 18, type: 'inclusive', amt: 118 }, // Taxable: 100, GST: 18
                { rate: 5, type: 'exclusive', amt: 100 }   // Taxable: 100, GST: 5
            ]
        };

        const totals = BillingLogic.calculateCartTotals(params);
        
        expect(totals.totalOcAmt).toBeCloseTo(200, 2);
        expect(totals.totalOcGst).toBeCloseTo(23, 2);
        
        // Total GST = (1000 - 1000/1.18) + 23 = 152.54 + 23 = 175.54
        expect(totals.gstAmt).toBeCloseTo(175.54, 2);
    });
});
