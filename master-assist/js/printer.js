/**
 * PrinterService API
 * Abstracts hardware printer commands to allow mock testing and error simulation.
 */
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
        return new Promise((resolve) => {
            // Trigger browser print dialog for receipt
            window.print();
            resolve(true);
        });
    }

    async printLabel(html) {
        if (!this.connected) throw new Error("Printer not connected");
        return new Promise((resolve) => {
            // Trigger browser print dialog for label
            window.print();
            resolve(true);
        });
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
window.PrinterAPI = new RealPrinterService();
window.RealPrinterService = RealPrinterService;
window.MockPrinterService = MockPrinterService;
