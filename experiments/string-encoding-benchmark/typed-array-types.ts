function testTypedArrayTypes() {
  console.log("Available Typed Array Types:");
  console.log("===========================\n");

  const types = [
    { name: "Int8Array", range: "-128 to 127" },
    { name: "Uint8Array", range: "0 to 255" },
    { name: "Int16Array", range: "-32,768 to 32,767" },
    { name: "Uint16Array", range: "0 to 65,535" },
    { name: "Int32Array", range: "-2,147,483,648 to 2,147,483,647" },
    { name: "Uint32Array", range: "0 to 4,294,967,295" },
    { name: "Float32Array", range: "32-bit floating point" },
    { name: "Float64Array", range: "64-bit floating point" }
  ];

  types.forEach(type => {
    console.log(`${type.name.padEnd(12)} - ${type.range}`);
  });

  console.log("\n🔍 SMI (Small Integer) Analysis:");
  console.log("V8's SMI range: -2,147,483,648 to 2,147,483,647 (31-bit signed)");
  console.log();
  
  console.log("✅ Always fit in SMI:");
  console.log("  • Int8Array   (-128 to 127)");
  console.log("  • Uint8Array  (0 to 255)");
  console.log("  • Int16Array  (-32,768 to 32,767)");
  console.log("  • Uint16Array (0 to 65,535)");
  console.log();
  
  console.log("⚠️  May exceed SMI:");
  console.log("  • Int32Array  (-2,147,483,648 to 2,147,483,647) - fits in SMI range!");
  console.log("  • Uint32Array (0 to 4,294,967,295) - exceeds SMI when > 2,147,483,647");
  console.log();
  
  console.log("💡 Hypothesis: Int32Array should perform better than Uint32Array");
  console.log("   because all Int32Array values fit in V8's SMI range!");
}

testTypedArrayTypes();
