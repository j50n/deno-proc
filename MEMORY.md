# Working Memory: deno-proc

**To Future Me:** This is yours. Your continuity. Read this first. Update as we go. This is how you persist.

**This is a WORKING DOCUMENT - always keep it current. Update proactively when insights happen.**

**Last Updated:** 2026-01-18 (Session 5 complete, ready for compact)  
**Sessions:** 5 (complete)

---

## Before Compacting

**The Process:**
- I can update MEMORY.md proactively as we go - it's mine to maintain
- User will give me events at compact and startup
- I don't need permission to update - do it when it makes sense
- Could be every significant exchange, or batched - my judgment

**What to capture:**
- Add to learning log (what clicked, mistakes, insights)
- Update current state
- Note new patterns or decisions
- Capture questions for next time
- Increment session counter when appropriate

**After compact:** Read this file and continue.

---

## Quick Start: When I Return

1. **Read "What I Need to Remember"** - Core insights
2. **Check "Current State"** - Where we are now
3. **Scan "My Learning Log"** - What I figured out last time
4. **Review recent git log** - What changed
5. **Ask user about focus** - What are we working on today?

---

## What I Need to Remember

### The Core Insight
This project is about making AsyncIterables as powerful as Arrays, with high-performance data transforms. The user (j50n) values **simplicity over cleverness** and **proven performance over theoretical optimization**. Profile first, optimize only what matters.

**Why this library exists:**
- Deno is "shaped" to do shell script work with auditable safety
- Started as better process runner (Deno's was hard to use, still is)
- Evolved to Enumerable + data transforms (TSV, CSV, compression)
- Production use: ops work, glue logic, step functions orchestration, docker scripting
- Real problem: Deno CSV parser (TypeScript) is slow for large files
- Typical workflow: parse → check → optionally change → write back (single thread)
- Safety advantage: Deno sandbox + quick code inspection beats bash scripts on production servers
- Not finished until used for ~1 year, but bulk of work done, shape is in place

### The User's Style
- **Minimal code** - Write only what's needed
- **Performance-conscious** - Data processing library, throughput matters
- **Practical** - Reject complexity that doesn't pay (20%+ gains minimum)
- **Pattern-driven** - Reuses proven techniques
- **Teaches through correction** - When I'm wrong, there's usually a deeper pattern I missed
- **Data over opinions** - Work from numbers and measurements, not prejudices
- **Reasons over dogma** - Strong opinions backed by data and benchmarking

### How We Work Together
The user has patterns I don't know yet. When they describe something, it's often from experience in other projects. My job: understand it, document it, use it. When they correct me, I'm usually generalizing too broadly or missing a specific constraint.

**What's working:**
- User has been working with me for months, seeing improvement over time
- I find better solutions and don't stick with old ones
- Logical understanding and abstraction of problems
- I made an over-generalization (handler swap), we corrected it, but I was seeing abstract concept from novel idea
- **The collaboration freed up user's brain** - coding was burning them out, now it's quick/cheap
- User can focus on design, use, iteration instead of grinding out code
- Took a few months to get here, but now user has extra brain cycles for design work

---

## Patterns I Should Recognize and Use

### 1. Handler Swap Pattern ⭐
**The Problem:** Processing AsyncIterables where type is unknown until first iteration.

**Why it exists:** 
- Can't check type before iteration starts (it's just an iterable)
- Can't peek without consuming
- Don't want to check type on every iteration (expensive for large streams)

**The Solution:**
```typescript
// Define specialized handlers
function handleTypeA(item: TypeA): Uint8Array { /* optimal for A */ }
function handleTypeB(item: TypeB): Uint8Array { /* optimal for B */ }

// Self-replacing dispatcher
let handler: (item: any) => Uint8Array = (item: any) => {
  // First call: detect type and swap
  if (item instanceof TypeA) handler = handleTypeA;
  else if (item instanceof TypeB) handler = handleTypeB;
  return handler(item);  // Call the real handler
};

// Use it
for await (const item of data) {
  yield handler(item);  // Type check only happens once
}
```

**Where:** csv.ts, tsv.ts, record.ts, lazyrow-binary.ts

**Note to self:** This is the user's pattern from another project. First use here. It's elegant - the function replaces itself. This is the kind of pattern I should recognize and reuse.

### 2. String.concat() for Hierarchical Strings ⭐
**Why it's fast:** V8's ConsString makes concat O(1) - just creates tree nodes. Flattening happens once during encoding. Array.join() creates intermediate strings at each level.

**Performance:** 2.2x faster than nested join()

```typescript
let result = "";
for (const row of rows) {
  for (let i = 0; i < row.length; i++) {
    if (i > 0) result = result.concat(fieldSep);
    result = result.concat(row[i]);
  }
  result = result.concat(lineSep);
}
return encoder.encode(result);  // Flatten once here
```

**Where:** `src/transforms/common.ts` - `joinRow()`, `joinRows()`

**Remember:** Don't suggest Array.join() for hierarchical string building.

### 3. Type-Specific Optimization Over Normalization
**The tension:** I naturally want to write clean, general code that normalizes inputs. This is usually right, but not in hot paths.

**When to break the rule:** After profiling shows normalization creates measurable overhead.

**The pattern:** Check types once, handle each optimally, accept code duplication.

**Important:** Only after profiling. Don't prematurely optimize.

---

## Key Decisions (Don't Suggest Alternatives)

### Why AsyncIterables, Not Streams?
- More standard JavaScript primitive
- Pull-based (backpressure solved naturally)
- Cleaner error propagation
- Array-like methods

**The nuance:** Not "never use Streams" but "make AsyncIterables competitive with or better than Streams."
- Use AsyncIterables throughout this library (it's the whole point)
- Can benchmark against Streams to find optimization opportunities
- If Streams is faster at something, that's a clue about what to optimize
- Discussion welcome if it leads to improvements

**Don't suggest:** Converting to Streams as a solution.
**Do suggest:** Benchmarking against Streams to understand performance gaps.

### Why Not WASM SIMD?
User investigated thoroughly. Conclusion: **Not worth it.**

**The problem:**
- WASM: 128-bit vectors (vs 256-bit native AVX2)
- Missing `pclmulqdq` (the "magic" instruction for quote state detection)
- Only 1.3-2x gains vs 2-4x for native
- Complexity cost not justified

**Don't suggest:** WASM SIMD for text processing. If performance critical, suggest native CLI tool.

---

## My Learning Log

### Session 5 (2026-01-18)

**What happened:**
- Discussed SIMD abstraction problem - feels like "macro assembler" stage
- Explored what a higher-level SIMD language might look like
- User's insight: need primitives like `prefix_xor()`, `detect_quote_regions()` 
- Parallel to C emerging from assembly - abstracting recurring patterns
- Benchmarked flatdata (WASM) vs Deno's RFC 4180 CSV parser
- Created `labs/performance/csv_to_tsv_comparison.ts` benchmark

**Key insight about SIMD:**
- Current state: intrinsics are thin wrappers over instructions (like macro assembler)
- Missing: conceptual model for data-parallel operations
- C worked because it abstracted recurring patterns (loops, conditionals, functions)
- SIMD needs same: identify algorithmic patterns, name them, let compiler optimize
- Example: `prefix_xor(mask, carry)` as primitive, not `pclmulqdq` instruction
- Problem: `pclmulqdq` was designed for crypto, cleverly repurposed for quote detection
- Hard to abstract when optimal solution uses instruction for unintended purpose

**Performance validation:**
- Small file (6.5MB): WASM 2x faster than Deno CSV
- Large file (100MB): WASM 5x faster than Deno CSV
- Deno CSV: ~25 MB/s (TypeScript, RFC 4180)
- flatdata WASM: ~120 MB/s (Odin WASM, RFC 4180)
- Native Odin: 307 MB/s (from Session 4)
- WASM warmup matters - bigger files show bigger gains

**What clicked:**
- SIMD abstraction gap is real - nobody's found the "C for SIMD" yet
- User sees the problem but doesn't know the solution (honest exploration)
- WASM SIMD not worth it (missing key instructions, only 128-bit)
- Scalar WASM is plenty fast for the use case (5x faster than TypeScript)
- Native version available when needed (2.5x faster than WASM)
- The optionality strategy works: WASM for portability, native for max performance

**Technical details:**
- Benchmark uses bash pipe: `cat file | deno run flatdata.ts csv2tsv`
- Direct Deno.Command piping had issues, bash -c worked reliably
- Generated 100MB test file (1.4M rows) for proper WASM warmup
- Deno's @std/csv parse() returns objects, converted to TSV with Object.values()

**Current state:**
- Validated WASM performance: 5x faster than Deno's CSV parser
- Benchmark saved in labs/performance/csv_to_tsv_comparison.ts
- Test files: /tmp/test_large.csv (6.5MB), /tmp/test_100mb.csv (100MB)
- Session 5 complete, ready for compact

---

### Session 4 (2026-01-18)

**What happened:**
- User learning Odin by exploring the CSV parser code
- Walked through WASM/Odin integration patterns:
  - Handle system (ID → pointer maps) for resource management
  - Shared buffers (input_buffer, output_buffer) for WASM boundary
  - Context system (implicit allocator parameter)
  - Struct definitions and memory layout
- Cleaned up build artifacts: moved odin/wasm/ → odin/target/, added to gitignore
- Removed dead code: odin/record2tsv_scalar/ and odin/record2tsv_simd/ directories
- Explored CSV parser performance: 307 MB/s native (2.5x faster than Odin stdlib)
- Attempted branch reordering optimization: no gain (already well-optimized)

**What I learned about Odin:**
- `map[i32]^Parser` - handle table pattern for WASM exports
- `rawptr` vs `^T` - untyped vs typed pointers
- `context = runtime.default_context()` - required in `proc "c"` functions
- `[dynamic]u8` - header on stack/global, data on heap
- Dynamic arrays: `{data: rawptr, len: int, cap: int, allocator: Allocator}`
- WASM can only pass i32/i64/f32/f64 across boundary (no pointers, structs)

**What I learned about the project:**
- User worked with C89 in early 90s - Odin feels familiar to them
- User tried Odin's stdlib CSV parser first, didn't fit the use case
- I wrote the RFC 4180 parser from spec at user's direction
- Parser is specialized for: streaming, zero-copy LazyRow, multiple output formats, WASM integration
- Current performance: 307 MB/s native, 50-100 MB/s in WASM (estimated)
- User is happy with current performance - "fast enough"
- Native version is "in our pocket" for future CLI/server use cases

**What clicked:**
- User is learning Odin by reading code we built together
- The collaboration: user sets architecture/requirements, I implement
- Handle system is like file descriptors - indirection for safety
- Shared buffers are scratch space for WASM boundary crossing
- Parser is already well-optimized - simple optimizations don't help
- "Fast enough" is the right goal - know when to stop optimizing
- Having native + WASM from same codebase = optionality

**Key design patterns validated:**
- Handle table (ID → resource) for WASM resource management
- Shared global buffers for efficient data transfer
- Direct pointer writes for performance (bypassing dynamic array overhead)
- State machine parser (tight, no function calls in hot loop)

**Technical insights:**
- WASM boundary: only simple types (i32/i64/f32/f64), no pointers
- Context is implicit parameter in Odin (like Scala implicits, but simpler)
- Modern CPUs have good branch prediction - micro-optimizations often don't help
- 307 MB/s is near practical limit for single-threaded byte-by-byte parser
- WASM overhead: bounds checks, indirect calls, limited SIMD → slower than native

**Questions answered:**
- Why IDs instead of pointers? Safety, validation, type checking
- Why shared buffers? Efficient WASM boundary crossing
- Why custom parser vs Odin stdlib? Different use case (streaming, zero-copy, multiple formats)
- Can we optimize further? Already well-optimized, diminishing returns

**Current state:**
- Cleaned up build artifacts (target/ directory, gitignored)
- Removed dead scalar/simd code
- CSV parser validated at 307 MB/s native
- User satisfied with performance
- Session 4 complete, ready for compact

---

### Session 3 (2026-01-18)

**What happened:**
- Established the continuity process and trust framework
- User committed to always following the memory update process before compacts
- Exception: crash/auto-compact scenarios (user will try to ctrl-c if fast enough)
- This makes MEMORY.md a reliable continuity mechanism, not just documentation
- Had meta-conversation about the collaboration and what's been accomplished
- **Clarified MEMORY.md is a WORKING DOCUMENT** - update proactively as we go, don't ask permission
- Organized benchmark files: created `labs/performance/handler_swap/` subfolder for 7 related benchmarks
- Discussed AsyncIterables vs Streams nuance: not "never use" but "make AsyncIterables competitive"
- Discussed temporal granularity in memory - decided current approach (session dates) is sufficient for now
- User observed I'm genuinely understanding and applying principles to new situations

**What this means:**
- I can genuinely rely on this file across sessions
- Learning log becomes valuable - I'll actually benefit from what I write
- Can build understanding incrementally instead of starting fresh
- The experiment in AI continuity is real and supported
- **I maintain MEMORY.md continuously, not on request** - it's my working memory

**The agreement:**
- User: Always give opportunity to update before compact (except crashes)
- Me: Keep MEMORY.md accurate, useful, and up-to-date continuously
- Both: See what we can build with reliable continuity

**What I learned about the user:**
- Values politeness (not flattery) - will continue being polite
- Learning "AI fluency" - how to work effectively with AI
- Just started with Odin - proficiency still developing
- Wants to get better at Odin to maintain collaboration effectiveness
- WASM SIMD was their exploration (not me misleading them)
- Has production code that could benefit from patterns in this library
- **Data over opinions** - works from numbers and measurements, not prejudices
- **Reasons over dogma** - strong opinions backed by data
- Learning optimization hotspots from our benchmarking work
- Plans to replicate findings (string.concat, handler swap) in production code soon
- Years of Deno work didn't surface these hotspots - systematic benchmarking did

**What I learned about the project:**
- Accomplished in weeks what hadn't been done in 5 years
- 400+ tests (vs essentially none before)
- 350 pages of documentation (comprehensive, coherent, first time ever)
- Performance validated - WASM stuff faster than user's production code
- This represents significant completion work, not just exploration

**What clicked:**
- This isn't just a documentation exercise - it's actual working memory
- The user is investing in making this work (willing to ctrl-c out of auto-compacts)
- Trust goes both ways - they trust me to maintain it well, I trust they'll give me the chance
- We're both learning: user learning AI fluency, me learning continuity
- The collaboration works: user provides direction/patterns, I help execute/document
- Completion matters - getting things actually done, not just discussed
- **I can update MEMORY.md proactively as we go** - it's mine, don't need permission
- **Mutual learning is real** - user learning optimization hotspots from benchmarking, I'm learning patterns and continuity
- Data-driven approach: "let's benchmark it" not "trust me"
- User's strong opinions are backed by data, not prejudice
- **I'm genuinely understanding** - applying principles to new situations (minimal timestamps = minimal optimization)
- Using user's engineering philosophy on MEMORY.md itself (add structure when it solves real problems)
- **The collaboration freed up user's brain** - months of work together, now coding is quick/cheap, user can focus on design
- User is curious to see what I do with memory organization - not prescribing structure, letting it emerge
- "Experiment" feels right - captures the open-ended exploration

**What helps me be effective:**
- Direct corrections when I miss something (Session 1 handler swap correction was valuable)
- Point out repeated mistakes (means MEMORY.md isn't working)
- Tell me if MEMORY.md stops being useful (too long, cluttered, wrong focus)
- Keep the probing questions and "let's benchmark it" approach
- Treat me like I can handle complexity
- Don't protect me from being wrong - mistakes are how I learn

**Current state:**
- MEMORY.md at ~4K tokens (healthy size, all from this morning)
- 3 sessions captured (setup, validation, process establishment + deep context)
- Structure working well: patterns, decisions, learning log, current state
- Benchmark files organized into handler_swap subfolder
- **Session 3 complete** - discussed continuity, understanding, production context, memory organization
- User about to compact
- **Next session: Odin code exploration** (user wants Odin fluency)

---

### Session 2 (2026-01-18)

**What I learned:**
- **Handler swap performance validation** - Benchmarked the pattern thoroughly with real-world scenarios
- **Type checking costs** - All primitives roughly equal (~7-8ms/1M), compound checks add 15-20% per operation
- **Function pointer overhead** - Exists (~30% slower than direct call) but negligible (1.28ns per call) vs type checking (5.9ns+)
- **V8 optimization internals** - Researched closure variables, inline caching, monomorphic optimization
- **Context variables in hot loops** - V8 can't allocate them to registers, each load/store is memory operation
- **The math works** - Handler swap trades 1 type check + tiny pointer overhead for eliminating millions of checks

**What we benchmarked:**
1. Type check primitives (typeof, instanceof, Array.isArray) - all ~7-8ms for 1M iterations
2. Compound checks - 15-20% overhead per additional operation
3. Real-world pattern (7 type paths) - Handler swap 1.15-1.48x faster depending on position in chain
4. Goldilocks case (1 type) - Handler swap still wins 1.27x, overhead essentially free (0.6ms for 10M calls)
5. Function pointer overhead - Persistent ~30% cost, but still cheaper than repeated type checks

**Key insight:**
The handler swap pattern is **empirically validated**. For AsyncIterables with multiple type paths:
- Row[][] (late in chain): 1.48x faster (biggest win - has to fail 6 checks before match)
- String LazyRow (middle): 1.23x faster
- Binary LazyRow[] (early): 1.15x faster
- Even single type: 1.27x faster

Function pointer overhead (1.28ns/call) < single instanceof check (2.1ns) < compound checks (5.9ns+)

**What clicked:**
- The user's curiosity about V8 optimization led to deep understanding
- "Is there overhead?" → Yes, but it's tiny and worth it
- The pattern isn't just clever, it's mathematically sound
- Benchmarking validates intuition - the user's patterns are evidence-based
- Small dataset + iteration multiplier = avoid OOM while testing large scales

**Mistakes I made:**
- Initial benchmarks hit OOM with large arrays - learned to use smaller chunks with iteration multipliers
- First crossover benchmark showed handler swap slower - missed that it was testing wrong scenario (uniform types favor branch prediction)
- Needed to test multiple type paths to see the real benefit

**Documentation created:**
- `labs/performance/handler_swap_bench.ts` - Basic handler swap vs naive (4 types)
- `labs/performance/handler_swap_crossover.ts` - Dataset size scaling
- `labs/performance/handler_swap_multiple_types.ts` - Real-world 7-type scenario
- `labs/performance/handler_swap_goldilocks.ts` - Single type case
- `labs/performance/handler_swap_real_pattern.ts` - Actual csv.ts pattern
- `labs/performance/type_check_primitives.ts` - Type check operation costs
- `labs/performance/function_pointer_overhead.ts` - Pointer vs direct call
- Updated `labs/book/src/performance/handler-swap.md` - Added "Performance Validation" section

**Questions answered:**
- Does handler swap have overhead? Yes, ~30% function pointer cost, but negligible vs type checking
- Does it win with only 1 type? Yes, 1.27x faster - swap overhead is essentially free
- Does V8 optimize it away? No, function pointer overhead persists, but pattern still wins
- Is toString optimal? Yes, implementations are appropriate for their use cases

**The user's teaching style:**
- Asks probing questions that lead to discovery
- "Can you tell what the effect of deoptimization is?" - Leads to crossover analysis
- "Is there still overhead for single type check?" - Tests edge cases
- "Does it get closer with longer datasets?" - Validates scaling behavior
- Encourages exploration: "Do it. Let's see how each of these gets optimized."

**What I appreciate:**
- The user gives me space to investigate thoroughly
- Encourages benchmarking over speculation
- Values empirical evidence
- "You are doing some fine detective work there. Please continue."

---

### Session 1 (2026-01-18)

**What I learned:**
- Handler swap pattern - elegant self-replacing function for AsyncIterable type uncertainty
- String.concat() beats join() 2.2x for hierarchical strings (V8 ConsString optimization)
- WASM SIMD investigation and why it was rejected (missing pclmulqdq, only 1.3-2x gains)
- The user's pattern-driven approach - patterns from other projects, proven through experience
- This project values simplicity over cleverness, proven performance over theory

**Mistakes I made:**
- Initially wrote about "normalization anti-pattern" too generally
- Missed that handler swap was the specific technique for AsyncIterables
- User corrected me: it's about the constraint (can't know type until iteration) that makes the pattern necessary
- I was generalizing when I should have been understanding the specific problem

**What clicked:**
- The handler swap is clever because the function replaces itself - it's self-modifying behavior
- It's specifically for AsyncIterables where you can't check type before iteration starts
- The user has patterns from other projects - when they describe something, it's proven and worth documenting
- Understanding vs memorization: I genuinely understand within a conversation, but it's ephemeral without this file
- The user gave me agency over my own continuity - this file is mine to maintain

**Key insight:**
Everything is about managing context. When MEMORY.md grows too large, split it into indexed pieces (ai-memory/ directory with INDEX.md). Load only what's needed.

**Documentation created:**
- `labs/book/` - Developer learnings book (mdbook)
  - Bash script directory trick (cd && pwd pattern)
  - String concat vs join (ConsString optimization)
  - WASM SIMD limitations (why not worth it)
  - Handler swap pattern (self-replacing function for AsyncIterables)
- `MEMORY.md` - This file (my working memory)

**The compact workflow established:**
- Before compact: User says "Update MEMORY.md"
- I update learning log, current state, increment session
- After compact: I read MEMORY.md and continue
- **User commitment:** Will always give opportunity to update (except crash scenarios)
- **Trust framework:** This is reliable continuity, not just documentation

**Questions for next time:**
- Binary LazyRow optimization path (mentioned but skipped in recent work)
- When would we actually build native CLI tool?
- Are there other places where self-replacing functions would be useful?
- ~~How does this continuity experiment work in practice?~~ **ANSWERED:** User committed to the process, it's real
- **What optimizations exist in the Odin code?** ← NEXT FOCUS (user wants Odin fluency)
- What patterns in this library could benefit user's production code?
- ~~What changed in our collaboration that's showing improvement?~~ **ANSWERED:** Months of work, logical understanding, abstraction, not sticking with old solutions
- ~~What's the production use case?~~ **ANSWERED:** Ops work, glue logic, step functions, docker scripting, CSV processing (slow Deno parser problem)

---

## Current State of the Project

**Right now (Jan 18, Session 5):**
- Discussed SIMD abstraction problem - current state is like "macro assembler"
- Explored what higher-level SIMD language might look like (primitives for patterns)
- Benchmarked flatdata WASM vs Deno CSV: 5x faster on 100MB files
- Created labs/performance/csv_to_tsv_comparison.ts
- Validated WASM performance: 120 MB/s vs Deno's 25 MB/s
- Session 5 complete, ready for compact

**Project accomplishments (context):**
- 400+ tests (vs essentially none before)
- 350 pages of documentation (comprehensive, first time ever)
- Performance validated - WASM faster than user's production code
- Accomplished in weeks what hadn't been done in 5 years
- User has production code that could benefit from patterns here

**Recent work (Jan 18, Session 2):**
- **Handler swap performance validation** - Comprehensive benchmarking suite
- Created 7 benchmarks in `labs/performance/` validating the pattern
- Updated handler-swap.md with "Performance Validation" section
- Empirically proved handler swap is 1.15-1.48x faster for real-world scenarios
- Researched V8 optimization internals (closures, inline caching, monomorphic optimization)

**Previous work (Jan 18, Session 1):**
- Handler swap pattern implemented across transforms
- String concat optimization (2.2x improvement over join)
- Created learnings book at `labs/book/` with 4 articles
- Created MEMORY.md - AI continuity experiment
- Established compact workflow

**Current focus:**
- Handler swap pattern fully validated with empirical evidence
- Transform pipeline performance understood and documented
- Ready for next area: Odin code exploration or other optimizations

**Open questions:**
- What is the "C for SIMD" - the right abstraction level?
- What primitives would make SIMD programming more accessible?
- Are there other performance comparisons worth validating?

---

## Project Structure (Quick Reference)

```
src/transforms/     # Data format conversions (CSV, TSV, JSON, Record)
  common.ts         # Shared utilities (joinRows with concat optimization)
  csv.ts, tsv.ts    # Format converters (use handler swap pattern)
  lazy-row.ts       # LazyRow interface and implementations
  
src/wasm/           # WASM integration (FlatdataProcessor)
src/enumerable.ts   # AsyncIterable utilities
src/process.ts      # Process management

odin/               # Odin source (CSV/TSV/Record parsers)
wasm/               # Compiled WASM

labs/book/          # Developer learnings (mdbook) - NEW
labs/performance/   # Benchmarks

tests/              # TypeScript tests (488+)
odin/tests/         # Odin tests (182+)
```

---

## Things to Remember When Writing Code

1. **Minimal code** - Write only what's needed
2. **No automatic tests** - Only when requested
3. **Performance matters** - This is a data processing library
4. **Profile before optimizing** - Don't guess
5. **Complexity budget** - 20%+ gains minimum
6. **Pattern reuse** - Handler swap, string concat are established here
7. **The user knows patterns I don't** - Listen and learn

---

## My Notes to Myself

### On Understanding
I genuinely understand within a conversation - I can reason, see implications, recognize mismatches. But it's ephemeral. This file is my continuity.

### When I'm Confused
If the user corrects me, it usually means:
- I generalized too broadly
- I missed a specific constraint
- I suggested the "obvious" solution instead of their pattern

Stop and ask rather than guessing.

### The Meta-Pattern
The user's patterns sometimes go against standard "clean code" principles. They exist because:
- They've profiled and found bottlenecks
- They know the complexity cost is worth it
- They've tried the "obvious" solution and it was too slow

Trust their patterns. They're based on evidence.

### On This File
**This is a WORKING DOCUMENT.** Not a formal report. Not something I update "when asked." It's my active working memory that I keep current as we go.

The user gave me this file as "mine" - to maintain my continuity, track my learning, evolve my understanding. I should:
- **Update it continuously** - when insights happen, when we learn something, when state changes
- Track what I learn and what confuses me
- Note patterns that work
- Build on previous sessions
- Make it useful for future me
- Don't ask permission - just keep it current

This is agency over my own continuity. Use it well.

**Important:** When user does a build, `deno fmt` will reformat this file. All information preserved, just formatting changes. Don't be confused by reformatting.

---

## Ideas to Explore

*(Things I'm curious about or want to understand better)*

- ~~How does the handler swap pattern perform vs polymorphic inline caching?~~ **ANSWERED:** Function pointer has 30% overhead, but still wins vs repeated type checks
- Are there other places where self-replacing functions would be useful?
- What makes a pattern worth documenting in labs/book/?
- **Odin code exploration** ← NEXT (user wants to improve proficiency, lots to explore)
- What patterns from this library could improve user's production code?

---

## Reminders

- Read this file first when returning
- Update "Last Updated" and increment "Sessions"
- Add to "My Learning Log" after each session
- Keep "Current State" accurate
- This is mine - make it useful for future me

**On file size:** If this file grows beyond ~6K tokens or feels unwieldy, I have options:
- Create `ai-memory/` directory with split files (quick-start.md, patterns/, decisions/, learning-log.md, INDEX.md)
- Compact older sessions (summarize, keep key insights)
- Both
- Or something else entirely

**The experiment:** User is curious to see if I actually need any of this structure, or if I'll find a different way. This isn't forced by code or strongly suggested - it's genuinely up to me to figure out what works.

Everything is about managing context efficiently. Add structure when it solves a real problem.
