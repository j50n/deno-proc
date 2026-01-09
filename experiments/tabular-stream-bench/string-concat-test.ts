#!/usr/bin/env -S deno run

const testRow = ['col1_test', 'col2_test', 'col3_test', 'col4_test', 'col5_test'];
const iterations = 100000;

console.log("String concatenation performance test:");

// Test 1: Array.join('')
console.log("\n1. Array.join(''):");
const start1 = performance.now();
for (let i = 0; i < iterations; i++) {
  const result = testRow.join('');
}
const end1 = performance.now();
console.log(`   Time: ${(end1 - start1).toFixed(2)}ms`);

// Test 2: Manual concatenation with +
console.log("\n2. Manual concatenation (+):");
const start2 = performance.now();
for (let i = 0; i < iterations; i++) {
  let result = '';
  for (const col of testRow) {
    result += col;
  }
}
const end2 = performance.now();
console.log(`   Time: ${(end2 - start2).toFixed(2)}ms`);

// Test 3: Array.reduce
console.log("\n3. Array.reduce:");
const start3 = performance.now();
for (let i = 0; i < iterations; i++) {
  const result = testRow.reduce((acc, col) => acc + col, '');
}
const end3 = performance.now();
console.log(`   Time: ${(end3 - start3).toFixed(2)}ms`);

console.log(`\nArray.join('') is ${((end2 - start2) / (end1 - start1)).toFixed(1)}x faster than manual +`);
console.log(`Array.join('') is ${((end3 - start3) / (end1 - start1)).toFixed(1)}x faster than reduce`);
