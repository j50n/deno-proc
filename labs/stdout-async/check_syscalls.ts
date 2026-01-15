// Write to a real file to see syscall behavior
const file = await Deno.open("/tmp/test.txt", { write: true, create: true, truncate: true });

console.log("Writing 10 x 1KB chunks...");
for (let i = 0; i < 10; i++) {
  const chunk = new Uint8Array(1024).fill(65);
  file.writeSync(chunk);
}

file.close();
console.log("Done");
