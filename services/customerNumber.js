'use strict';

// PostgreSQL transactional advisory lock serializes both customer-signup routes.
// Does not recycle deleted customer numbers. Legacy random IDs remain unchanged.
const LOCK_GROUP = 2026;
const LOCK_NUMBER = 4118;

async function nextCustomerNumber(client) {
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [LOCK_GROUP, LOCK_NUMBER]);
  const result = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(custno FROM 5)::numeric), 7)::text AS last_number
     FROM customer
     WHERE custno ~* '^CUST[0-9]{1,16}$'`
  );
  const last = BigInt(result.rows[0].last_number);
  const next = last + 1n;
  if (String(next).length > 16) {
    throw new Error('Customer number has reached the VARCHAR(20) capacity.');
  }
  return `CUST${next}`;
}

module.exports = { nextCustomerNumber };
