# Code Review Findings

## Issues Found

### 1. **CRITICAL: Fisher-Yates Shuffle Bug** (src/utility.ts)

**Location:** `shuffle()` function, line ~280

**Issue:** The shuffle implementation is incorrect. It doesn't properly implement Fisher-Yates algorithm.

**Current code:**
```typescript
export function shuffle<T>(items: T[]) {
  for (let i = 0; i < items.length; i++) {
    const j = Math.floor(Math.random() * items.length);  // ❌ WRONG
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}
```

**Problem:** This can select already-shuffled elements, leading to biased shuffling.

**Fix:**
```typescript
export function shuffle<T>(items: T[]) {
  for (let i = 0; i < items.length; i++) {
    const j = Math.floor(Math.random() * (items.length - i)) + i;  // ✅ CORRECT
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}
```

**Impact:** HIGH - Produces non-uniform shuffles, violating user expectations
**Test coverage:** NONE - No tests for this function

---

### 2. **MEDIUM: Range Function - No Protection Against step=0** (src/utility.ts)

**Location:** `range()` function

**Issue:** If `step` is 0, the function will create an infinite loop.

**Current code:**
```typescript
const s = options.step ?? 1;
// No validation that s !== 0
```

**Fix:**
```typescript
const s = options.step ?? 1;
if (s === 0) {
  throw new RangeError("step cannot be 0");
}
```

**Impact:** MEDIUM - Can cause infinite loops and hang the program
**Test coverage:** PARTIAL - Tests exist but don't cover step=0 edge case

---

## Recommendations

### High Priority

1. **Fix shuffle() bug immediately** - This is a correctness issue
2. **Add test for shuffle()** - Verify uniform distribution
3. **Add step=0 validation to range()** - Prevent infinite loops
4. **Add test for range() with step=0** - Verify error is thrown

### Test Coverage Gaps

The following functions lack tests:
- `shuffle()` - No tests at all
- `concatLines()` - Not directly tested
- `sleep()` - Not tested (though it's simple)
- `writeAll()` - Not directly tested

### Code Quality Notes

**Excellent:**
- `concurrent.ts` - Clever and correct implementation
- `writable-iterable.ts` - Sound queue-based design
- `helpers.ts` - Good error handling
- Error handling throughout is generally good

**Good:**
- Most functions have proper edge case handling
- Type safety is well maintained
- Documentation is comprehensive

## Test Quality Assessment

### Documentation Tests (tests/docs/)
✅ **Good:** All examples are tested
✅ **Good:** Tests verify expected behavior
✅ **Good:** Tests are clear and focused

### Existing Tests
✅ **Good:** Good coverage of main functionality
⚠️ **Gap:** Missing edge case tests (step=0, empty arrays, etc.)
⚠️ **Gap:** No tests for utility functions like shuffle()

### Suggested Additional Tests

1. **Edge cases for range():**
   - step=0 (should throw)
   - Very large ranges
   - Fractional steps

2. **Edge cases for concat():**
   - Empty arrays
   - Single element
   - Very large arrays

3. **Shuffle tests:**
   - Verify all elements present after shuffle
   - Statistical test for uniformity (optional but recommended)

4. **Concurrent tests:**
   - Error handling in mapFn
   - Empty iterables
   - Single item iterables
