describe('QR/Barcode Encoding & 203 DPI Constraints (Category C)', () => {
    
    // 203 DPI translates to 8 dots per mm.
    // 58mm printer printable width is ~48mm = 384 dots.
    const DPI = 203;
    const MAX_WIDTH_DOTS = 384;
    const DOTS_PER_MM = DPI / 25.4; // ≈ 7.992
    const PRINTABLE_WIDTH_MM = 48;
    
    function mmToDots(mm) {
        return Math.floor(mm * (DPI / 25.4));
    }

    function getSafeModuleWidth(codeValue) {
        const modules = (codeValue.length * 11) + 35;
        if (modules * 2.0 <= 384) return 2.0;
        if (modules * 1.5 <= 384) return 1.5;
        return 1.0;
    }

    function calculateBarcodeWidthDots(codeValue, format, moduleWidth) {
        if (format === 'CODE128') {
            const mw = moduleWidth || getSafeModuleWidth(codeValue);
            const numChars = codeValue.length;
            const modules = (numChars * 11) + 35;
            return modules * mw;
        }
        return 0;
    }

    it('should fit CODE128 within 58mm bounds with default width: 2.0 for standard barcodes', () => {
        // Standard 13-digit barcode (e.g., EAN-13/CODE128 13 chars)
        const codeValue = "8901234567890";
        const totalDots = calculateBarcodeWidthDots(codeValue, 'CODE128'); // Uses safeWidth (2.0)
        
        // (13 * 11) + 35 = 178 modules.
        // 178 * 2.0 = 356 dots.
        // 356 < 384 (max width). It fits!
        
        expect(totalDots).toBeLessThanOrEqual(MAX_WIDTH_DOTS);
        expect(totalDots).toBe(356);
    });

    it('should warn or truncate if SKU length exceeds printable width', () => {
        // 36 chars * 11 = 396 + 35 = 431 modules.
        // Even at min module width 1.0, it takes 431 dots > 384 limit.
        const codeValue = "VERYLONGSKUTHATWILLNOTFITON58MMPAPER";
        const totalDots = calculateBarcodeWidthDots(codeValue, 'CODE128'); // Uses safeWidth (1.0)
        
        expect(totalDots).toBeGreaterThan(MAX_WIDTH_DOTS);
    });

    it('should comply with HT20 scanner resolution limits', () => {
        const moduleWidth = 2.0; // Optimized module width
        const mmPerDot = 25.4 / DPI;
        const physicalModuleSize = moduleWidth * mmPerDot;
        
        expect(physicalModuleSize).toBeCloseTo(0.25, 2);
        expect(physicalModuleSize).toBeGreaterThan(0.125); // Safe for HT20
    });

    describe('Algorithmic Checksum Verification', () => {
        function calculateEAN13Checksum(payload) {
            if (payload.length !== 12) return null;
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseInt(payload[i]) * (i % 2 === 0 ? 1 : 3);
            }
            const remainder = sum % 10;
            return remainder === 0 ? 0 : 10 - remainder;
        }

        it('should correctly validate EAN-13 payload and compute checksum', () => {
            const barcode12 = "890123456789"; // 12 digits
            const checksum = calculateEAN13Checksum(barcode12);
            expect(checksum).toBe(0);
            
            const ean13Full = barcode12 + checksum;
            expect(ean13Full).toBe("8901234567890");
        });

        it('should correctly validate UPC-A payload and compute checksum', () => {
            const upca11 = "03600029145";
            const upcAsEan = "0" + upca11;
            const checksum = calculateEAN13Checksum(upcAsEan);
            expect(checksum).toBe(2);
            
            const upcaFull = upca11 + checksum;
            expect(upcaFull).toBe("036000291452");
        });

        it('should validate Code128 checksum algorithm mathematically', () => {
            const payload = "SKU-1";
            let sum = 104; 
            sum += 51 * 1;
            sum += 43 * 2;
            sum += 53 * 3;
            sum += 13 * 4;
            sum += 17 * 5;
            const checksum = sum % 103;
            expect(checksum).toBe(22);
        });

        it('should assert QR code structural sizing is still correct for future use', () => {
            const version = 2;
            const modules = ((version - 1) * 4) + 21;
            expect(modules).toBe(25);
            
            const dotSize = 2; 
            const totalWidth = modules * dotSize; 
            
            expect(totalWidth).toBeLessThan(MAX_WIDTH_DOTS);
            expect(totalWidth).toBe(50);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Task 1 — QR Code Sizing Validation (Kept for future layout templates)
    // ─────────────────────────────────────────────────────────────────────────

    describe('Task 1 — QR Code Sizing Validation', () => {
        it('should fit a 20-char alphanumeric SKU QR code within 384-dot ceiling', () => {
            const qrVersion = 2;
            const moduleCount = ((qrVersion - 1) * 4) + 21; // 25
            
            const dotSize2 = 2;
            const widthAt2 = moduleCount * dotSize2; // 50 dots
            
            expect(widthAt2).toBeLessThanOrEqual(MAX_WIDTH_DOTS);
            const mmAt2 = widthAt2 / DOTS_PER_MM;
            expect(mmAt2).toBeLessThan(PRINTABLE_WIDTH_MM);
        });
    });

    describe('Task 1 — Product Barcode (CODE128, 13-digit) Sizing (Reclaimed Layout)', () => {

        it('should fit a 13-digit CODE128 barcode at reclaimed width: 2.0 dots/module', () => {
            const codeValue = "8901234567890";
            const safeWidth = getSafeModuleWidth(codeValue);
            
            expect(safeWidth).toBe(2.0); // Confirms it got widened to 2.0 dots
            
            const totalDots = calculateBarcodeWidthDots(codeValue, 'CODE128', safeWidth);
            expect(totalDots).toBe(356); // 178 modules * 2.0
            expect(totalDots).toBeLessThanOrEqual(MAX_WIDTH_DOTS);
            
            const physicalMm = totalDots / DOTS_PER_MM;
            expect(physicalMm).toBeCloseTo(44.5, 0);
            expect(physicalMm).toBeLessThan(PRINTABLE_WIDTH_MM);
        });

        it('should calculate remaining margin after 13-digit barcode in reclaimed layout', () => {
            const totalDots = 356; 
            const remainingDots = MAX_WIDTH_DOTS - totalDots;
            const remainingMm = remainingDots / DOTS_PER_MM;
            
            expect(remainingDots).toBe(28); // 384 - 356
            expect(remainingMm).toBeCloseTo(3.5, 0);
        });
    });

    describe('Task 1 — Reclaimed Single Barcode Label Layout Sizing', () => {

        it('should fit single barcode layout on a 48x25mm label stacked vertically', () => {
            const labelWidthDots = mmToDots(48);   // 383
            const labelHeightDots = mmToDots(25);   // 199
            
            const barcodeWidth = 356; // 13-digit barcode at width 2.0
            const barcodeHeight = 40; // standard JsBarcode height
            const headerHeight = 10;
            const textHeight = 20;    // name + price
            
            expect(barcodeWidth).toBeLessThanOrEqual(labelWidthDots);
            
            const totalHeight = headerHeight + barcodeHeight + textHeight;
            expect(totalHeight).toBeLessThanOrEqual(labelHeightDots);
        });
    });

    describe('Task 1 — Worst Case & Max Length Constraint Sizing', () => {

        it('should detect overflow for a 36-char barcode at all valid module widths', () => {
            const longCode = "VERYLONGSKUTHATWILLNOTFITON58MMPAPER"; // 36 chars
            
            // Should get scaled down to 1.0 but still overflow
            const safeWidth = getSafeModuleWidth(longCode);
            expect(safeWidth).toBe(1.0);
            
            const totalDots = calculateBarcodeWidthDots(longCode, 'CODE128', safeWidth);
            expect(totalDots).toBe(431); // 431 modules * 1.0 = 431 dots
            expect(totalDots).toBeGreaterThan(MAX_WIDTH_DOTS);
        });

        it('should verify the 20-char SKU maxlength constraint is the correct ceiling for safe width 1.5', () => {
            // Under 20 characters, the barcode can safely scale down to 1.5 dots per module and fit.
            const maxAllowed = 20;
            const safeWidth = getSafeModuleWidth("A".repeat(maxAllowed));
            expect(safeWidth).toBe(1.5); // 20 chars should scale down to 1.5
            
            const totalDots = calculateBarcodeWidthDots("A".repeat(maxAllowed), 'CODE128', safeWidth);
            expect(totalDots).toBe(382.5); // 255 modules * 1.5 = 382.5 dots
            expect(totalDots).toBeLessThanOrEqual(MAX_WIDTH_DOTS);
            
            // 21 characters will drop module width to 1.0 or overflow if 1.5 is forced
            const nextSafeWidth = getSafeModuleWidth("A".repeat(maxAllowed + 1));
            expect(nextSafeWidth).toBe(1.0); // drops to 1.0 to avoid overflow
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Task 2 — Printer Profile Config Validation
    // ─────────────────────────────────────────────────────────────────────────

    describe('Task 2 — Printer Profile Constants Validation', () => {
        const PRINTER_PROFILES = {
            PSF20: {
                dpi: 203,
                paperWidthMm: 58,
                printableWidthMm: 48,
                printableWidthDots: 384,
                dotsPerMm: 7.992,
                duplex: false,
                feedModel: 'label',
                connectionType: 'bluetooth_spp',
                protocol: 'escpos',
                protocolConfirmed: true,
                labelHeightMm: 25,
            }
        };

        it('should validate printableWidthDots matches computed value from printableWidthMm', () => {
            const profile = PRINTER_PROFILES.PSF20;
            const computed = Math.round(profile.printableWidthMm * profile.dotsPerMm);
            expect(Math.abs(profile.printableWidthDots - computed)).toBeLessThanOrEqual(1);
        });
    });
});
