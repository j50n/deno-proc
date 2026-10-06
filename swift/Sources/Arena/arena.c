// The allocator the Embedded Swift runtime calls (posix_memalign and free;
// nothing here calls malloc): a bump arena over wasm linear memory, in place
// of wasi-libc's dlmalloc.
//
// `free` does nothing. That is enough here because of how the module is used:
// the JavaScript side makes one instance per stream and drops it when the
// stream ends, which releases everything at once, and wasm memory can't
// shrink anyway, so a real free could only recycle space within one stream.
// What a stream frees is what its buffers leave behind when they grow, and
// they grow by doubling, so the abandoned space is less than the live space.
//
// Memory grows by just the pages an allocation needs. The buffers already
// double, so a stream that grows steadily still calls memory.grow a
// logarithmic number of times; doubling memory as well left up to half of it
// unused, and the 4 GiB a wasm32 memory can reach is what limits the longest
// row.

#include <stddef.h>
#include <stdint.h>

#define PAGE_SIZE 65536

/// The first byte past the static data and the stack; wasm-ld defines it.
extern unsigned char __heap_base;

/// The next free byte, or 0 before the first allocation.
static uintptr_t top;

/// Makes linear memory reach `end`. Returns 0 if it can't.
static int reach(uintptr_t end) {
    uintptr_t pages = __builtin_wasm_memory_size(0);
    if (end <= pages * PAGE_SIZE) return 1;
    uintptr_t needed = (end - pages * PAGE_SIZE + PAGE_SIZE - 1) / PAGE_SIZE;
    return __builtin_wasm_memory_grow(0, needed) != (size_t)-1;
}

// An allocation that can't be made traps rather than returning ENOMEM: the
// Embedded Swift runtime doesn't check, and would write through a null
// pointer, which in wasm is address 0 of this module's own memory. The
// JavaScript side turns the trap into an error naming the row.
int posix_memalign(void **result, size_t alignment, size_t size) {
    if (top == 0) top = (uintptr_t)&__heap_base;
    uintptr_t start = (top + alignment - 1) & ~(uintptr_t)(alignment - 1);
    uintptr_t end = start + size;
    if (start < top || end < start || !reach(end)) __builtin_trap();
    top = end;
    *result = (void *)start;
    return 0;
}

void free(void *pointer) { (void)pointer; }
