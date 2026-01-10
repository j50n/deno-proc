# Troubleshooting Guide

Common problems and their solutions.

## Compilation Errors

### "undefined identifier"

```
Error: undefined identifier 'math'
```

**Cause**: Missing import.

**Solution**: Add the import at the top of your file:
```odin
import "core:math"
```

### "cannot export procedure with non-C calling convention"

```
Error: cannot export procedure 'my_func' with non-C calling convention
```

**Cause**: Exported functions must use C calling convention.

**Solution**: Add `"c"` to the procedure signature:
```odin
@(export)
my_func :: proc "c" () {  // Note the "c"
    // ...
}
```

### "invalid target"

```
Error: invalid target 'wasm32'
```

**Cause**: Wrong target name.

**Solution**: Use the correct target:
```bash
odin build . -target:js_wasm32 -out:module.wasm \
    -extra-linker-flags:"--import-memory --strip-all"
```

## Link Errors

### "LinkError: import odin_env::xyz not found"

```
LinkError: WebAssembly.instantiate(): Import #0 module="odin_env" function="sin" error: function import requires a callable
```

**Cause**: WASM module expects a function that isn't in your imports.

**Solution**: Add the missing function to your runtime:
```typescript
const imports = {
  odin_env: {
    sin: Math.sin,  // Add missing function
    // ...
  },
};
```

### "LinkError: memory import has wrong type"

**Cause**: Memory configuration mismatch.

**Solution**: Ensure memory is created with compatible settings:
```typescript
const memory = new WebAssembly.Memory({
  initial: 1,
  maximum: 256,
});
```

## Runtime Errors

### "RuntimeError: unreachable executed"

**Cause**: Code hit an unreachable instruction. Common causes:
- Assertion failure
- Panic
- Unhandled switch case
- Explicit `unreachable()` call

**Solution**: Check your Odin code for:
- Failed assertions
- Panic calls
- Missing switch cases

Add logging to narrow down the location.

### "RuntimeError: out of bounds memory access"

**Cause**: Reading or writing outside allocated memory.

**Solution**: 
1. Check array indices
2. Verify pointer arithmetic
3. Ensure buffers are large enough
4. Check for off-by-one errors

```typescript
// Add bounds checking
if (ptr < 0 || ptr + len > memory.buffer.byteLength) {
  throw new Error(`Out of bounds: ${ptr} + ${len}`);
}
```

### "RuntimeError: call stack exhausted"

**Cause**: Stack overflow from deep recursion.

**Solution**:
1. Check for infinite recursion
2. Convert recursive algorithms to iterative
3. Reduce recursion depth

### "TypeError: Cannot read properties of undefined"

**Cause**: Accessing an export that doesn't exist.

**Solution**: 
1. Verify the function is exported in Odin (`@(export)`)
2. Check the exact function name (case-sensitive)
3. Rebuild the WASM module

```typescript
// Debug: list all exports
console.log(Object.keys(instance.exports));
```

## Memory Issues

### "RangeError: Invalid typed array length"

**Cause**: Trying to create a view larger than available memory.

**Solution**: Check memory size before creating views:
```typescript
const available = memory.buffer.byteLength;
if (offset + length > available) {
  throw new Error(`Need ${offset + length} bytes, have ${available}`);
}
```

### Detached ArrayBuffer

```
TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer
```

**Cause**: Memory grew, invalidating existing views.

**Solution**: Recreate views after any operation that might grow memory:
```typescript
memory.grow(1);
// Old views are now invalid!
bytes = new Uint8Array(memory.buffer);  // Create new view
```

### Memory Leak

**Symptoms**: Memory usage grows over time.

**Cause**: Allocating without freeing.

**Solution**:
1. Track allocations
2. Ensure every `allocate` has a matching `deallocate`
3. Use arenas for batch operations

## Performance Issues

### Slow Execution

**Possible causes**:
1. Too many boundary crossings
2. Unoptimized build
3. Inefficient algorithm

**Solutions**:
1. Move loops inside WASM
2. Build with `-o:speed`
3. Profile to find bottlenecks

### Large Bundle Size

**Cause**: Debug builds include extra information.

**Solutions**:
1. Build with `-o:size`
2. Compress the WASM file (gzip/brotli)

## Build Issues

### "Permission denied" on build.sh

**Solution**:
```bash
chmod +x build.sh
```

### WASM file not updating

**Cause**: Build failed silently or wrong output path.

**Solution**:
1. Check build output for errors
2. Verify `-out:` path matches what you're loading
3. Delete old WASM file and rebuild

### Tests pass locally but fail in CI

**Possible causes**:
1. Different Odin/Deno versions
2. Missing dependencies
3. Path issues

**Solutions**:
1. Pin versions in CI
2. Use absolute paths
3. Check CI logs carefully

## Debugging Tips

### Print from WASM

Ensure your runtime's `write` function works:
```typescript
write(fd: number, ptr: number, len: number): number {
  const text = new TextDecoder().decode(
    new Uint8Array(this.memory.buffer, ptr, len)
  );
  console.log("[WASM]", text);
  return len;
}
```

### Hex Dump Memory

```typescript
function hexDump(memory: WebAssembly.Memory, start: number, len: number) {
  const bytes = new Uint8Array(memory.buffer, start, len);
  console.log(Array.from(bytes).map(b => 
    b.toString(16).padStart(2, '0')
  ).join(' '));
}
```

### List Exports

```typescript
console.log("Exports:", Object.keys(instance.exports));
```

### Check Memory Size

```typescript
console.log(`Memory: ${memory.buffer.byteLength} bytes`);
```

## Getting Help

If you're stuck:

1. Check the error message carefully
2. Search the Odin Discord/forums
3. Check Deno's GitHub issues
4. Create a minimal reproduction case
5. Ask with specific details about what you tried
