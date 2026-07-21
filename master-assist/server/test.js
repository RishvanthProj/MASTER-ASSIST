async function run() {
    try {
        console.log('Creating item...');
        const createRes = await fetch('http://localhost:4000/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Item', sku: 'TEST1', stock: 10, sale: 100 })
        });
        const createdItem = await createRes.json();
        console.log('Created item:', createdItem);
        
        console.log('Firing 3 simultaneous sales of qty 4 (total 12, but stock is 10)...');
        
        const doSale = async (qty) => {
            const res = await fetch('http://localhost:4000/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billNo: 'TEST-1',
                    total: 100 * qty,
                    items: [{ id: createdItem.id, name: 'Test Item', qty: qty, price: 100 }]
                })
            });
            const body = await res.text();
            return { status: res.status, body };
        };

        const p1 = doSale(4);
        const p2 = doSale(4);
        const p3 = doSale(4);
        
        const results = await Promise.all([p1, p2, p3]);
        results.forEach((r, i) => {
            console.log(`Sale ${i+1}: Status ${r.status}, Body: ${r.body}`);
        });
        
        const getRes = await fetch('http://localhost:4000/api/items');
        const items = await getRes.json();
        console.log('Final items array:', items);
    } catch(e) {
        console.error(e);
    }
}
run();
