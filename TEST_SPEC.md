# Test Coverage Specification

## Current Status (2026-01-16)

### Completed ✅
- **TSV Transforms** (80 tests)
  - tsv2record_test.odin (18 tests)
  - tsv2lazyrow_test.odin (19 tests)
  - tsv2csv_test.odin (24 tests)
  - record2tsv_test.odin (19 tests)

- **CSV Parser/Stringifier** (53 tests)
  - csv_test.odin - Comprehensive coverage of core CSV parsing

### Total: 133 Odin tests + 488 TypeScript tests = 621 tests

---

## Remaining Work

### Phase 1: LazyRow Binary Format (Priority: HIGH)
**Why**: Core data structure used throughout the system, currently only tested via integration tests.

**Files to add tests to**: `odin/src/csv/csv_test.odin`

#### LazyRow Encoder Tests (~10 tests)
- [ ] Basic encoding: single row, multiple fields
- [ ] Empty fields handling
- [ ] Large field (>1KB)
- [ ] Many fields (>100)
- [ ] Binary format validation (header structure, field lengths)
- [ ] Round-trip: record → lazyrow → record
- [ ] Edge: empty input
- [ ] Edge: single empty field
- [ ] Edge: field with binary data (0x00 bytes)
- [ ] Buffer capacity limits

#### LazyRow Decoder Tests (~10 tests)
- [ ] Basic decoding: single row, multiple fields
- [ ] Empty fields handling
- [ ] Large field (>1KB)
- [ ] Many fields (>100)
- [ ] Partial row handling (incomplete input)
- [ ] Invalid format detection (corrupted header)
- [ ] Invalid format detection (field length mismatch)
- [ ] Round-trip: lazyrow → record → lazyrow
- [ ] Edge: empty input
- [ ] Edge: truncated row

**Estimated effort**: 2-3 hours

---

### Phase 2: Streaming Components (Priority: MEDIUM)
**Why**: Complex stateful code with chunk boundaries - high risk for bugs.

**Files to add tests to**: `odin/src/csv/csv_test.odin`

#### Streaming LazyRow Decoder Tests (~12 tests)
- [ ] Basic streaming: multiple chunks
- [ ] Chunk boundary: split in row header
- [ ] Chunk boundary: split in field count
- [ ] Chunk boundary: split in field lengths array
- [ ] Chunk boundary: split in field data
- [ ] Output threshold behavior (accumulates until threshold)
- [ ] Finish: flushes remaining data
- [ ] Multiple rows across chunks
- [ ] Empty chunks (no-op)
- [ ] Large row spanning many chunks
- [ ] Invalid: corrupted data mid-stream
- [ ] Clear output buffer behavior

#### Streaming Record Stringifier Tests (~12 tests)
- [ ] Basic streaming: multiple chunks
- [ ] Chunk boundary: split mid-field
- [ ] Chunk boundary: split at field separator
- [ ] Chunk boundary: split at record separator
- [ ] Quoting: field with comma
- [ ] Quoting: field with quote (escaping)
- [ ] Quoting: field with newline
- [ ] Always-quote mode
- [ ] Output threshold behavior
- [ ] Finish: flushes remaining data
- [ ] CRLF line endings
- [ ] Custom separator

**Estimated effort**: 3-4 hours

---

### Phase 3: Direct Parser Edge Cases (Priority: LOW)
**Why**: Already has basic tests, but chunk boundary handling is complex.

**Files to add tests to**: `odin/src/csv/csv_test.odin` or new `direct_parser_test.odin`

#### Direct Parser Tests (~8 tests)
- [ ] Chunk boundary: split mid-quoted-field
- [ ] Chunk boundary: split at quote escape ("")
- [ ] Chunk boundary: split at CRLF
- [ ] Carry buffer: incomplete record preserved
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
