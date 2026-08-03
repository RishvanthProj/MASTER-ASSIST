/**
 * PrinterService API
 * Abstracts hardware printer commands to allow mock testing and error simulation.
 *
 * PRINTER_PROFILES — Validated hardware profiles for 58mm thermal printers.
 * All sizing math uses 384-dot (48mm) printable width ceiling at 203 DPI.
 *
 * Changelog:
 *   2026-08-03 — Added PSF20 / H58i profiles; fixed label width 50mm→48mm;
 *                fixed receipt width 80mm→48mm for 58mm printers.
 */

const PRINTER_PROFILES = {
    /** POSiFLOW PSF20 — Label printer, ESC/POS confirmed */
    PSF20: {
        displayName:      'POSiFLOW PSF20',
        dpi:              203,
        paperWidthMm:     58,
        printableWidthMm: 48,      // ~5mm dead margin per side
        printableWidthDots: 384,   // 48 × 7.992 ≈ 384
        dotsPerMm:        7.992,   // 203 / 25.4
        duplex:           false,
        feedModel:        'label', // single-label feed — needs gap detection
        connectionType:   'bluetooth_spp', // Bluetooth Classic SPP
        protocol:         'escpos',
        protocolConfirmed: true,
        labelHeightMm:    25,      // typical label stock
        notes:            'Confirmed ESC/POS via ShreyansPOS ecosystem. Gap-detect feed.'
    },

    /** helett H58i (BillQuick-Go) — Receipt printer, ESC/POS probable */
    H58i: {
        displayName:      'helett H58i BillQuick-Go',
        dpi:              203,
        paperWidthMm:     58,
        printableWidthMm: 48,
        printableWidthDots: 384,
        dotsPerMm:        7.992,
        duplex:           false,
        feedModel:        'continuous', // continuous roll — needs cut command
        connectionType:   'bluetooth_spp', // assumed SPP, BLE possible
        protocol:         'escpos',
        protocolConfirmed: false,  // NOT confirmed by vendor docs
        labelHeightMm:    null,    // continuous — no fixed label height
        notes:            'ESC/POS probable but unconfirmed. No official SDK. Physical test required.'
    },

    /** Generic 80mm — Kept for backward compatibility with existing receipt layout */
    GENERIC_80MM: {
        displayName:      'Generic 80mm Receipt Printer',
        dpi:              203,
        paperWidthMm:     80,
        printableWidthMm: 72,
        printableWidthDots: 576,   // 72 × 8
        dotsPerMm:        7.992,
        duplex:           false,
        feedModel:        'continuous',
        connectionType:   'usb',
        protocol:         'escpos',
        protocolConfirmed: true,
        labelHeightMm:    null,
        notes:            'Legacy profile. Matches the original 80mm receipt layout.'
    }
};

/** Active profile key — change this to switch target printer */
let _activeProfileKey = 'PSF20';

function getActiveProfile() {
    return PRINTER_PROFILES[_activeProfileKey] || PRINTER_PROFILES.PSF20;
}

function setActiveProfile(key) {
    if (!PRINTER_PROFILES[key]) {
        console.warn('Unknown printer profile: ' + key + '. Falling back to PSF20.');
        _activeProfileKey = 'PSF20';
    } else {
        _activeProfileKey = key;
    }
}

/** Barcode sizing constants (CODE128) */
const BARCODE_SIZING = {
    modulesPerChar: 11,         // CODE128: 11 modules per data character
    startStopChecksum: 35,      // overhead modules for start/stop/checksum
    defaultModuleWidthDots: 2.0, // Reclaimed width: target 2.0 dots per module for optimal scanning

    /** Find the largest module width that fits in 384 dots (tries 2.0, then 1.5, then 1.0) */
    getSafeModuleWidth(codeValue) {
        const modules = (codeValue.length * this.modulesPerChar) + this.startStopChecksum;
        if (modules * 2.0 <= 384) return 2.0;
        if (modules * 1.5 <= 384) return 1.5;
        return 1.0;
    },

    /** Calculate barcode width in dots for a given code value */
    calcWidthDots(codeValue, moduleWidth) {
        const mw = moduleWidth || this.getSafeModuleWidth(codeValue);
        const modules = (codeValue.length * this.modulesPerChar) + this.startStopChecksum;
        return modules * mw;
    },

    /** Max safe character count for a given module width and max dot width */
    maxSafeChars(moduleWidth, maxDots) {
        const mw = moduleWidth || this.defaultModuleWidthDots;
        const md = maxDots || 384;
        return Math.floor((md / mw - this.startStopChecksum) / this.modulesPerChar);
    }
};

class PrinterService {
    constructor() {
        this.connected = false;
        this.paperOut = false;
        this.batteryLevel = 100;
        this.lastError = null;
        this.listeners = [];
    }

    subscribe(fn) {
        this.listeners.push(fn);
        fn(this.getState());
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    getState() {
        return {
            connected: this.connected,
            paperOut: this.paperOut,
            batteryLevel: this.batteryLevel,
            lastError: this.lastError
        };
    }

    notify() {
        const state = this.getState();
        this.listeners.forEach(fn => fn(state));
    }

    initPrinterUI() {
        if (typeof Swal !== 'undefined') {
            this.subscribe((state) => {
                if (state.lastError === 'Disconnected') {
                    Swal.fire({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
                        icon: 'error', title: 'Printer Disconnected'
                    });
                } else if (state.lastError === 'Out of Paper') {
                    Swal.fire({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
                        icon: 'warning', title: 'Printer Out of Paper'
                    });
                } else if (state.lastError === 'Low Battery') {
                    Swal.fire({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
                        icon: 'info', title: 'Printer Battery Low'
                    });
                } else if (state.connected && !state.lastError) {
                    // Only show reconnected if there was a previous error that we're clearing
                    // For now, silent on happy path to avoid spam
                }
            });
        }
    }

    async connect() { throw new Error("Not implemented"); }
    async printReceipt(data) { throw new Error("Not implemented"); }
    async printLabel(data) { throw new Error("Not implemented"); }
}

class RealPrinterService extends PrinterService {
    constructor() {
        super();
        this.connected = true; // Fallback to assumed true for browser native print
        setTimeout(() => this.notify(), 0);
    }

    async connect() {
        this.connected = true;
        this.notify();
        return true;
    }

    async printReceipt(html) {
        if (!this.connected) throw new Error("Printer not connected");
        const profile = getActiveProfile();
        const w = profile.printableWidthMm + 'mm';
        return new Promise((resolve) => {
            this._printViaIframe(html, `
                @page { margin: 0; width: ${w}; }
                body { font-family: monospace; padding: 0; margin: 0; width: ${w}; }
            `);
            resolve(true);
        });
    }

    async printLabel(html) {
        if (!this.connected) throw new Error("Printer not connected");
        const profile = getActiveProfile();
        const w = profile.printableWidthMm + 'mm';  // 48mm for 58mm stock
        const h = (profile.labelHeightMm || 25) + 'mm';
        return new Promise((resolve) => {
            this._printViaIframe(html, `
                @page { margin: 0; width: ${w}; }
                body { 
                    margin: 0; 
                    padding: 0; 
                    width: ${w}; 
                    display: flex;
                    flex-direction: column;
                }
                .barcode-label { 
                    width: ${w} !important; 
                    height: ${h} !important; 
                    border: none !important; 
                    box-sizing: border-box !important; 
                    margin: 0 !important; 
                    padding: 2mm !important; 
                    overflow: hidden !important; 
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: center !important;
                    flex-shrink: 0 !important;
                }
                /* Hide the preview container grid styles when printing */
                .label-grid { display: block !important; padding: 0 !important; margin: 0 !important; }
            `);
            resolve(true);
        });
    }

    _printViaIframe(html, css) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <style>${css}</style>
            </head>
            <body>${html}</body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 500); // Wait for fonts/svgs to render
    }
}

class MockPrinterService extends PrinterService {
    constructor() {
        super();
        this.connected = true;
        this.log = [];
    }

    async connect() {
        this.connected = true;
        this.notify();
        return true;
    }

    simulateEvent(event) {
        if (event === 'disconnect') {
            this.connected = false;
            this.lastError = 'Disconnected';
        } else if (event === 'outOfPaper') {
            this.paperOut = true;
            this.lastError = 'Out of Paper';
        } else if (event === 'lowBattery') {
            this.batteryLevel = 15;
            this.lastError = 'Low Battery';
        } else if (event === 'reset') {
            this.connected = true;
            this.paperOut = false;
            this.batteryLevel = 100;
            this.lastError = null;
        }
        this.notify();
    }

    async printReceipt(data) {
        if (!this.connected) throw new Error("Printer not connected");
        if (this.paperOut) throw new Error("Out of paper");
        if (this.batteryLevel < 10) throw new Error("Battery too low to print");
        
        this.log.push({ type: 'receipt', data, time: Date.now() });
        return true;
    }

    async printLabel(data) {
        if (!this.connected) throw new Error("Printer not connected");
        if (this.paperOut) throw new Error("Out of paper");
        if (this.batteryLevel < 10) throw new Error("Battery too low to print");

        this.log.push({ type: 'label', data, time: Date.now() });
        return true;
    }
}

// Attach globally
window.PRINTER_PROFILES = PRINTER_PROFILES;
window.BARCODE_SIZING = BARCODE_SIZING;
window.getActiveProfile = getActiveProfile;
window.setActiveProfile = setActiveProfile;
window.PrinterAPI = new RealPrinterService();
window.RealPrinterService = RealPrinterService;
window.MockPrinterService = MockPrinterService;
