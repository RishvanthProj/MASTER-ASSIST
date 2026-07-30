/**
 * BillingLogic Module
 * Decoupled from the DOM for testability.
 */

const BillingLogic = {
    calculateItemTotals: function(c) {
        const price = c.price || 0;
        const bargainPrice = c.bargainPrice || 0;
        const qty = c.qty || 0;
        const gst = c.gst || 0;

        const itemSub = (bargainPrice * qty);
        return { itemSub, price, bargainPrice, qty, gst };
    },

    calculateCartTotals: function(params) {
        const {
            cart = [],
            extraDiscMode = 'pct', // 'pct' or 'rs'
            extraDiscValue = 0, // pct or rs amount based on mode
            otherCharges = [], // { rate: number, type: 'inclusive'|'exclusive', amt: number }
            cnAmount = 0,
            cnStatus = '',
            manualRoundOff = null // null means auto-round
        } = params;

        let totalMrp = 0;
        let totalSale = 0;
        let totalQty = 0;

        cart.forEach(c => {
            const totals = this.calculateItemTotals(c);
            totalMrp += (totals.price * totals.qty);
            totalSale += totals.itemSub;
            totalQty += totals.qty;
        });

        // 1. Extra Discount
        let extraDiscRs = 0;
        let extraDiscPct = 0;
        if (extraDiscMode === 'pct') {
            extraDiscPct = extraDiscValue;
            extraDiscRs = (totalSale * extraDiscPct) / 100;
        } else {
            extraDiscRs = extraDiscValue;
            extraDiscPct = totalSale > 0 ? (extraDiscRs / totalSale) * 100 : 0;
        }

        let discountedSale = totalSale - extraDiscRs;

        // 2. Taxable and GST for items
        let taxableValue = 0;
        let gstAmt = 0;

        cart.forEach(c => {
            const totals = this.calculateItemTotals(c);
            let itemRatio = totalSale > 0 ? (totals.itemSub / totalSale) : 0;
            let itemDiscSub = discountedSale * itemRatio;
            
            let itemTaxable = itemDiscSub / (1 + (totals.gst / 100));
            let itemGst = itemDiscSub - itemTaxable;
            
            taxableValue += itemTaxable;
            gstAmt += itemGst;
        });

        // 3. Other Charges
        let totalOcAmt = 0;
        let totalOcGst = 0;
        let totalOcTotal = 0;
        const processedCharges = otherCharges.map(ch => {
            let ocTaxable = 0;
            let ocGstAmt = 0;
            let ocTotalAmt = 0;
            const amt = ch.amt || 0;
            const rate = ch.rate || 0;
            
            if (ch.type === 'inclusive') {
                ocTotalAmt = amt;
                ocTaxable = amt / (1 + (rate / 100));
                ocGstAmt = amt - ocTaxable;
            } else {
                ocTaxable = amt;
                ocGstAmt = amt * (rate / 100);
                ocTotalAmt = amt + ocGstAmt;
            }
            totalOcAmt += ocTaxable;
            totalOcGst += ocGstAmt;
            totalOcTotal += ocTotalAmt;
            return { ...ch, ocTaxable, ocGstAmt, ocTotalAmt };
        });

        // Combine
        taxableValue += totalOcAmt;
        gstAmt += totalOcGst;
        let grossSale = taxableValue + gstAmt;
        let halfGst = gstAmt / 2;

        // 4. Credit Note
        let cnAdjust = 0;
        if (cnStatus && cnAmount > 0) {
            cnAdjust = Math.min(cnAmount, grossSale);
            grossSale -= cnAdjust;
        }
        let cnBalance = cnAmount - cnAdjust;

        // 5. Round Off
        let roundOffVal = manualRoundOff;
        if (roundOffVal === null || typeof roundOffVal !== 'number' || isNaN(roundOffVal)) {
            let roundedGross = Math.round(grossSale);
            roundOffVal = roundedGross - grossSale;
        }
        
        let netSale = grossSale + roundOffVal;

        return {
            totalMrp,
            totalSale,
            totalQty,
            extraDiscRs,
            extraDiscPct,
            discountedSale,
            taxableValue,
            gstAmt,
            halfGst,
            totalOcAmt,
            totalOcGst,
            totalOcTotal,
            grossSale,
            cnAdjust,
            cnBalance,
            roundOffVal,
            netSale,
            processedCharges
        };
    },

    generateReceiptData: function(cart, totals, storeSettings, invoiceId, overrides = {}) {
        return {
            store: storeSettings,
            invoiceId: invoiceId,
            date: overrides.date || new Date().toISOString(),
            items: cart.map(c => ({
                name: c.name,
                qty: c.qty,
                price: c.price,
                bargainPrice: c.bargainPrice,
                gst: c.gst,
                ...this.calculateItemTotals(c)
            })),
            totals: totals
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BillingLogic;
} else {
    window.BillingLogic = BillingLogic;
}
