#!/usr/bin/env -S deno run --allow-read
/**
 * @fileoverview Demo script showcasing MathDemo WebAssembly functionality
 */

import { MathDemo } from "./math-demo.ts";

/**
 * Main demo function that demonstrates various WASM capabilities
 */
async function main() {
  console.log("=".repeat(50));
  console.log("🎯 Starting Math Demo");
  console.log("=".repeat(50));

  try {
    // Create WASM instance using async factory
    const demo = await MathDemo.create();

    console.log("\n" + "-".repeat(30));
    console.log("Test 1: Circle Area Calculation");
    console.log("-".repeat(30));

    // Test circle calculation
    const radius = 5.0;
    const area = demo.calculateCircle(radius);
    console.log(
      `Final result: Circle with radius ${radius} has area ${area.toFixed(2)}`,
    );

    console.log("\n" + "-".repeat(30));
    console.log("Test 2: Fibonacci Sequence");
    console.log("-".repeat(30));

    // Test fibonacci calculation
    const n = 10;
    const fibResult = demo.fibonacci(n);
    console.log(`Final result: Fibonacci(${n}) = ${fibResult}`);

    console.log("\n" + "-".repeat(30));
    console.log("Test 3: Safe String Printing");
    console.log("-".repeat(30));

    // Test safe string printing with memory management
    const msg1 = "Hello from Odin WASM!";
    const bytes1 = demo.printString(msg1);
    console.log(`✅ Printed "${msg1}" (${bytes1} bytes)`);

    const msg2 = "🎉 UTF-8 works!";
    const bytes2 = demo.printString(msg2);
    console.log(`✅ Printed "${msg2}" (${bytes2} bytes, ${msg2.length} chars)`);

    console.log("\n" + "-".repeat(30));
    console.log("Test 4: Dynamic String Return");
    console.log("-".repeat(30));

    // Test dynamic data return from Odin
    const greeting1 = demo.createGreeting("World");
    console.log(`✅ Got: "${greeting1}"`);

    const greeting2 = demo.createGreeting("Odin 🚀");
    console.log(`✅ Got: "${greeting2}"`);

    console.log("\n" + "-".repeat(30));
    console.log("Test 5: String Handling (Legacy)");
    console.log("-".repeat(30));

    // Test string handling
    const name = "Developer";
    const greetingLength = demo.greetUser(name);
    console.log(
      `Final result: Greeting "${name}" would be ${greetingLength} characters`,
    );

    console.log("\n" + "-".repeat(30));
    console.log("Test 6: Multiple Instances");
    console.log("-".repeat(30));

    // Demonstrate multiple instances
    const demo2 = await MathDemo.create();
    console.log("🔄 Created second instance");

    demo2.calculateCircle(3.0);
    demo.fibonacci(7);

    console.log("\n" + "=".repeat(50));
    console.log("✅ Demo completed successfully!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the demo
if (import.meta.main) {
  await main();
}
