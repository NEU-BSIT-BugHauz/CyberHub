'use strict';
const { nextCustomerNumber } = require('../services/customerNumber');

test('generates CUST8 after legacy CUST1 through CUST7', async () => {
  const db = { query: jest.fn().mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ last_number: '7' }] }) };
  expect(await nextCustomerNumber(db)).toBe('CUST8');
  expect(db.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  expect(db.query.mock.calls[1][0]).toContain("FROM customer");
});

test('then generates CUST9, CUST10 and beyond from database state', async () => {
  for (const [last, expected] of [['8','CUST9'], ['9','CUST10'], ['100','CUST101']]) {
    const db = { query: jest.fn().mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ last_number: last }] }) };
    expect(await nextCustomerNumber(db)).toBe(expected);
  }
});
