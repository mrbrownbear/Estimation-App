
// Mock DOM
const document = {
  getElementById: () => ({
    children: [],
    querySelectorAll: () => [],
    appendChild: () => {},
    classList: { contains: () => false }
  }),
  createElement: (tag) => ({
    className: '',
    style: {},
    appendChild: () => {},
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => ({ appendChild: () => {} })
  }),
  body: { classList: { contains: () => false } }
};

// Mock State
const state = {
  client: {
    events: [
      { id: '1', date: '2026-01-01', guests: 100 },
      { id: '2', date: '2026-01-02', guests: 100 }
    ],
    guests: 100
  },
  stations: [],
  fees: {},
  paymentMade: 500,
  taxRate: 0.06
};

// Mock Utilities
const currency = (n) => `$${n}`;
const formatDateUS = (d) => d;
const ensureEventFees = () => ({});
const getCustomTotalsForEvent = () => ({});
const computeTotalsForStations = () => ({ grandTotal: 1000, subtotal: 900, taxAmount: 100 });
const ensureEventCustomCharges = () => [];
const applyBrandLogo = () => {};
const applyCompanyHeader = () => {};

// Extracted Logic from buildPrintView (Multi-event block)
function testMultiEventLogic() {
  const events = state.client.events;
  console.log(`Testing with ${events.length} events.`);
  
  if (events.length > 1) {
    let grandTotalSum = 0;
    
    events.forEach((ev, index) => {
      console.log(`\nProcessing Event ${index + 1} (${ev.date}):`);
      const totals = computeTotalsForStations();
      grandTotalSum += totals.grandTotal;
      
      const rows = [];
      if (totals.grandTotal > 0) rows.push(['Total Price', currency(totals.grandTotal)]);
      
      // Check for Payment Received in rows
      const hasPayment = rows.some(r => r[0] === 'Payment Received');
      console.log(`  Rows generated: ${JSON.stringify(rows)}`);
      console.log(`  Contains 'Payment Received'? ${hasPayment}`);
    });

    console.log(`\nGenerating Summary Page:`);
    const sRows = [];
    sRows.push(['Total Estimate (All Events)', currency(grandTotalSum)]);
    const paySum = Number(state.paymentMade || 0);
    if (paySum > 0) sRows.push(['Payment Received', currency(paySum)]);
    const balSum = grandTotalSum - paySum;
    sRows.push(['Balance Due', currency(balSum)]);
    
    console.log(`  Summary Rows: ${JSON.stringify(sRows)}`);
  }
}

testMultiEventLogic();
