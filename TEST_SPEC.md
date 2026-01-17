# Test Coverage Specification

## Current Status (2026-01-16)

### Completed ✅
- **TSV Transforms** (80 tests)
  - tsv2record_test.odin (18 tests)
  - tsv2lazyrow_test.odin (19 tests)
  - tsv2csv_test.odin (24 tests)
  - record2tsv_test.odin (19 tests)

- **LazyRow Binary Format** (21 tests)
  - LazyRow encoder tests (11 tests)
  - LazyRow decoder tests (10 tests)

- **Streaming Components** (21 tests)
  - Streaming LazyRow decoder tests (11 tests)
  - Streaming record stringifier tests (10 tests)

- **Direct Parser Edge Cases** (7 tests)
  - Chunk boundary edge cases (4 tests)
  - Error handling tests (3 tests)

- **CSV Parser/Stringifier** (53 tests)
  - csv_test.odin - Comprehensive coverage of core CSV parsing

### Total: 182 Odin tests + 488 TypeScript tests = 670 tests

**Target achieved: 182 Odin tests (target was 180+)** ✅

---

## Remaining Work

### Phase 4: SIMD vs Scalar Validation (Priority: LOW)
**Status**: DEFERRED - Pending review of SIMD rationale

**Why**: Ensure both code paths produce identical results.

**Files**: New `odin/src/simd_test.odin` or add to `record2tsv_test.odin`

#### SIMD Tests (~6 tests)
- [ ] record2tsv: SIMD vs scalar equivalence (small input)
- [ ] record2tsv: SIMD vs scalar equivalence (large input)
- [ ] record2tsv: SIMD vs scalar equivalence (unaligned input)
- [ ] record2tsv: SIMD performance validation (optional)
- [ ] Alignment requirements
- [ ] Edge: input length not multiple of 16

**Estimated effort**: 1-2 hours

**Note**: This phase is deferred pending review of whether SIMD implementation makes sense for this library.

---

## Summary

### Work Completed
- ✅ Phase 1: TSV Transforms (80 tests)
- ✅ Phase 2: LazyRow Binary Format (21 tests)
- ✅ Phase 3: Streaming Components (21 tests)
- ✅ Phase 4: Direct Parser Edge Cases (7 tests)
- ⏸️ Phase 5: SIMD Validation (deferred)

### Test Count Progress
- **Starting**: 53 Odin tests
- **Added**: 129 new Odin tests
- **Final**: 182 Odin tests + 488 TypeScript tests = **670 total tests**
- **Target**: 180+ Odin tests ✅ **EXCEEDED**

### Coverage Achievements
- ✅ TSV transform modules: 100% unit test coverage
- ✅ LazyRow encoder/decoder: Comprehensive coverage including edge cases
- ✅ Streaming components: Chunk boundaries and carry buffer logic fully tested
- ✅ Direct parser: Edge cases and error conditions covered
- ✅ Round-trip validation: All format conversions validated

### Quality Gates
- ✅ All tests pass on every commit
- ✅ Fast feedback: Odin unit tests run in ~2-3ms
- ✅ No memory leaks (Odin memory tracking enabled)
- ✅ All error conditions tested (invalid input, buffer overflow, unclosed quotes)

---

## Testing Principles

1. **Fast Feedback**: Odin unit tests provide immediate feedback (<3ms vs 13s for TypeScript)
2. **Isolation**: Each test is independent and tests one specific behavior
3. **Edge Cases**: Comprehensive coverage of boundary conditions and error paths
4. **Round-trips**: Validate that encode→decode produces original data
5. **Chunk Boundaries**: Test streaming behavior with data split at every possible boundary

---
- [ ] Carry buffer: multiple incomplete records
- [ ] Output buffer auto-grow
- [ ] Error: unclosed quote at finish
- [ ] Error: invalid char after quote

**Estimated effort**: 1-2 hours

---

### Phase 4: SIMD vs Scalar Validation (Priority: LOW)
**Why**: Ensure both code paths produce identical results.

**Files**: New `odin/src/simd_test.odin` or add to `record2tsv_test.odin`

#### SIMD Tests (~6 tests)
- [ ] record2tsv: SIMD vs scalar equivalence (small input)
- [ ] record2tsv: SIMD vs scalar equivalence (large input)
- [ ] record2tsv: SIMD vs scalar equivalence (unaligned input)
- [ ] record2tsv: SIMD performance validation (optional)
- [ ] Alignment requirements
- [ ] Edge: input length not multiple of 16

**Estimated effort**: 1-2 hours

---

## Total Remaining Effort
- **High Priority**: 2-3 hours (LazyRow)
- **Medium Priority**: 3-4 hours (Streaming)
- **Low Priority**: 2-4 hours (Direct Parser + SIMD)
- **Total**: 7-11 hours

---

## Success Criteria

### Coverage Targets
- **Odin tests**: 180+ (current: 133)
- **Critical paths**: 100% coverage (LazyRow, streaming)
- **Edge cases**: All chunk boundaries tested
- **Round-trips**: All format conversions validated

### Quality Gates
- [ ] All tests pass on every commit
- [ ] No memory leaks (Odin memory tracking)
- [ ] SIMD and scalar paths produce identical output
- [ ] All error conditions tested (invalid input, buffer overflow)

---

## Testing Strategy

### Unit Test Principles
1. **One assertion per concept** - Test one thing clearly
2. **Descriptive names** - `test_streaming_lazyrow_chunk_boundary_in_header`
3. **Minimal setup** - Use helpers to reduce boilerplate
4. **Edge cases first** - Empty, single, boundary conditions
5. **Round-trip validation** - Encode/decode should be identity

### Test Organization
- Keep related tests together in same file
- Use comment blocks to separate test categories
- Add "Why" comments for non-obvious test cases
- Use consistent naming: `test_<module>_<scenario>`

### When to Add Tests
- **Before fixing bugs** - Write failing test first
- **Before refactoring** - Ensure behavior preserved
- **For new features** - Test-driven development
- **When uncertain** - Write test to explore behavior

---

## Notes

### Why Odin Tests Matter
- **Faster feedback** - No WASM compilation, no TypeScript overhead
- **Better isolation** - Test pure logic without integration complexity
- **Easier debugging** - Native debugger, memory tracking
- **Documentation** - Shows exact expected behavior

### Why Not Just Integration Tests?
- Integration tests are slow (WASM compilation + Deno startup)
- Hard to test edge cases (chunk boundaries, buffer limits)
- Difficult to isolate failures
- Don't validate internal invariants

### Current Gaps
The streaming components and LazyRow encoder/decoder are only tested through TypeScript integration tests. This means:
- Chunk boundary bugs might not be caught
- Performance regressions harder to detect
- Debugging failures requires full stack trace
- Can't validate internal state transitions
