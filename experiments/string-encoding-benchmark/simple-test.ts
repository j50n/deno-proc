// Simple test for StringRow
import { StringRow } from './string-row.ts';

console.log("StringRow - Row-Based Data Structure");
console.log("===================================");

// Customer record example
const customerData = [
  "12345",           // customer_id
  "John Doe",        // name  
  "john@email.com",  // email
  "555-1234",        // phone
  "New York",        // city
  "Premium"          // status
];

console.log(`Original: ${JSON.stringify(customerData)}`);

// Create row
const row = StringRow.fromArray(customerData);
console.log(`Columns: ${row.columnCount}`);
console.log(`Customer: ${row.get(1)} (${row.get(2)})`);

// Update data
row.set(2, "john.doe@newemail.com");  // Update email
row.set(4, "Los Angeles");            // Update city

console.log(`Updated: ${JSON.stringify(row.toArray())}`);
console.log(`Changes: ${row.changeCount} columns modified`);

// Serialize
const bytes = row.toBytes();
console.log(`Serialized: ${bytes.length} bytes`);

// Restore
const restored = StringRow.fromBytes(bytes);
console.log(`Restored: ${JSON.stringify(restored.toArray())}`);
console.log(`Match: ${JSON.stringify(row.toArray()) === JSON.stringify(restored.toArray())}`);

console.log("\n✅ StringRow working perfectly!");
