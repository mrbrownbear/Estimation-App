
const state = {
  client: {
    guests: 100,
    events: [
      { id: '1', date: '2026-01-01', guests: 100 },
      { id: '2', date: '2026-01-02', guests: 100 }
    ]
  },
  stations: [
    { eventId: '1', items: [{ price: 1000 }] },
    { eventId: '2', items: [{ price: 2000 }] }
  ],
  fees: {
    labor: 0, chafing: 0, travel: 0, kitchen: 0, custom: 0
  },
  taxRate: 0,
  paymentMade: 500
};

function computeTotalsForStations(stations, fees, guests) {
    const totalItems = stations.reduce((sum, st) => sum + st.items.reduce((s, i) => s + i.price, 0), 0);
    const totalFoodCost = totalItems * guests; // Wait, app.js logic: totalItems * guests
    // Actually totalItems in app.js is sum of (item.price). totalFoodCost is totalItems * guests.
    // Let's assume price is per person.
    
    // Simplified logic from app.js
    const subtotal = totalFoodCost;
    const grandTotal = subtotal; 
    return { grandTotal };
}

console.log("--- Reproduction of Estimate Print Logic ---");
state.client.events.forEach(ev => {
    const stationsForEvent = state.stations.filter(st => st.eventId === ev.id);
    // In app.js: const totals = computeTotalsForStations(...)
    // Here we simplify
    const totalItems = stationsForEvent.reduce((sum, st) => sum + st.items.reduce((s, i) => s + i.price, 0), 0);
    const grandTotal = totalItems; // Simplifying: assume total is just item price (guests=1 for simplicity in verification)
    
    const pay = state.paymentMade;
    const bal = grandTotal - pay;
    
    console.log(`Event ${ev.date}: Total ${grandTotal}, Payment Shown ${pay}, Balance Shown ${bal}`);
});
