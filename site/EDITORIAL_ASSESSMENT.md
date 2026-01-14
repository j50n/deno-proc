# Editorial Assessment: proc Documentation

**Reviewer**: O'Reilly Editorial Review\
**Date**: January 2026\
**Status**: Pre-publication assessment

---

## Executive Summary

This documentation has strong bones. The technical content is solid, examples
are practical, and the core value proposition (error handling that just works)
is compelling. However, several structural and editorial issues need addressing
before publication.

**Overall Grade**: B+\
**Publication Readiness**: 70%

### Strengths

- Clear, practical examples throughout
- Strong technical accuracy
- Good recipe/cookbook section
- Conversational but knowledgeable voice
- Excellent FAQ section

### Areas Requiring Work

- Table of contents ordering undermines learning progression
- Introduction buries the lede
- Redundant content between chapters
- Inconsistent cross-referencing
- Voice occasionally too casual for technical authority

---

## 1. Structural Issues

### 1.1 Table of Contents Ordering

**Current order** (problematic):

```
Core Features:
  - Error Handling        ← Why is this first?
  - Running Processes     ← This should be first
  - Process Pipelines
  - Working with Output
  - Working with Input
  - Resource Management
```

**Problem**: You can't understand error handling until you know how to run a
process. Leading with error handling is like teaching exception handling before
"Hello World."

**Recommended order**:

```
Core Features:
  - Running Processes     ← Start here
  - Working with Output
  - Working with Input
  - Process Pipelines
  - Error Handling        ← Now this makes sense
  - Resource Management
```

### 1.2 "Common Patterns" Placement

**Current**: Standalone chapter in Getting Started section.

**Problem**: This 200+ line file duplicates content from Core Features and Async
Iterables. Readers encounter the same patterns twice, which feels repetitive and
wastes their time.

**Recommendation**:

- Delete as standalone chapter
- Integrate unique patterns into relevant chapters as "Pattern:" callout boxes
- Move anti-patterns to a "Common Mistakes" appendix

### 1.3 Advanced vs Core Distinction

**Current**: "Concurrent Processing" is in Advanced Topics, but concurrency is a
primary use case.

**Problem**: Users who need `concurrentMap` (a common need) might not look in
"Advanced."

**Recommendation**:

- Rename "Advanced Topics" to "Specialized Topics"
- Add a brief concurrency section to Core Features with a forward reference
- Keep deep dive in Specialized Topics

### 1.4 Data Transforms Isolation

**Current**: Data Transforms section exists but feels disconnected from Async
Iterables.

**Problem**: Readers don't understand when to use `enumerate().map()` vs
`fromCsvToRows()`. The conceptual bridge is missing.

**Recommendation**: Add a "Choosing Your Approach" section that explains:

- When to use process pipelines (shell-like operations)
- When to use async iterables (in-memory transformations)
- When to use data transforms (format conversions)
- When to use flatdata CLI (maximum performance)

---

## 2. Introduction Weaknesses

### 2.1 Missing "Who This Book Is For"

**Current**: Jumps straight into "What is proc?"

**Problem**: Readers don't know if this is for them. O'Reilly books always
establish audience upfront.

**Add this section after the title**:

```markdown
## Who This Book Is For

This book is for Deno developers who:

- Run child processes and need better error handling
- Process streaming data (logs, CSV files, API responses)
- Want Array-like methods for async data
- Are frustrated with JavaScript stream complexity

You should be comfortable with:

- TypeScript basics
- Async/await syntax
- Command-line tools

No prior experience with Deno streams or child processes required.
```

### 2.2 Buried Value Proposition

**Current**: The "backpressure" explanation appears in a blockquote tip, easily
missed.

**Problem**: This is the KILLER FEATURE. It should be front and center, not a
tip.

**Recommendation**: Make backpressure the opening hook:

```markdown
# Welcome to proc

**The Problem**: JavaScript streams are push-based. Producers push data whether
consumers are ready or not. This creates backpressure—and backpressure creates
bugs, memory leaks, and complex coordination code.

**The Solution**: proc uses async iterators (pull-based). Consumers pull data
when ready. No backpressure. No coordination. No bugs.

Oh, and errors just work too.
```

### 2.3 No Decision Framework

**Current**: Lists features but doesn't help readers decide what to use when.

**Add a decision tree**:

```markdown
## Quick Decision Guide

**Need to run a shell command?** → Start with [Running Processes](...)

**Processing a file line by line?** → See [File I/O](...)

**Converting CSV to JSON?** → Check [Data Transforms](...)

**Need maximum performance?** → Use [flatdata CLI](...)

**Working with any async data?** → Learn [Enumerable](...)
```

---

## 3. Content Redundancy

### 3.1 Duplicate Explanations

The following concepts are explained multiple times:

| Concept                | Locations                                     | Recommendation                                       |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Properties vs Methods  | Key Concepts, FAQ, patterns.md                | Keep in Key Concepts only, reference elsewhere       |
| Resource Management    | Key Concepts, patterns.md, error-handling.md  | Consolidate into Resource Management chapter         |
| enumerate() vs .enum() | Key Concepts, FAQ, enumerable.md, patterns.md | Keep in enumerable.md, brief mention in Key Concepts |
| Error propagation      | Key Concepts, error-handling.md, patterns.md  | Keep in error-handling.md only                       |

### 3.2 patterns.md Audit

This file should be eliminated. Here's where each pattern belongs:

| Pattern               | Move To                          |
| --------------------- | -------------------------------- |
| Run and Collect       | running-processes.md             |
| Process Pipeline      | pipelines.md                     |
| Transform and Filter  | array-methods.md                 |
| Error Handling        | error-handling.md                |
| Check Status          | error-handling.md                |
| Enumerate patterns    | enumerable.md                    |
| Stream Large Files    | streaming.md                     |
| Decompress            | decompression.md recipe          |
| Concurrent Processing | concurrent.md                    |
| Reduce                | aggregations.md                  |
| Tee                   | Already in transformations.md    |
| Anti-patterns         | New appendix: common-mistakes.md |

---

## 4. Cross-Referencing Gaps

### 4.1 Missing Forward References

**Problem**: Chapters mention concepts without linking to where they're
explained.

**Examples found**:

- error-handling.md mentions `fnError` option but links to non-existent
  `../advanced/custom-errors.md`
- running-processes.md doesn't link to pipelines.md
- enumerable.md doesn't link to data transforms

### 4.2 Missing "See Also" Sections

**Every chapter should end with**:

```markdown
## See Also

- [Related Topic 1](link) - Brief description
- [Related Topic 2](link) - Brief description
```

### 4.3 Missing "Prerequisites" Notes

**Complex chapters should open with**:

```markdown
> **Prerequisites**: This chapter assumes you've read [Running Processes](...)
> and understand basic error handling.
```

---

## 5. Example Quality

### 5.1 Inconsistent Testing Markers

**Current**: Mix of `<!-- TESTED -->` and `<!-- NOT TESTED -->` markers.

**Problem**: Readers don't know which examples are verified to work.

**Recommendation**:

- Test ALL examples
- Remove markers from published output (they're internal)
- Add a note in the preface: "All examples in this book are tested against proc
  version X.X"

### 5.2 Examples Don't Build on Each Other

**Problem**: Each chapter starts fresh. Readers can't follow a continuous
example.

**Recommendation**: Create a running example throughout Core Features:

- Chapter 1: Run `git log` and capture output
- Chapter 2: Process the output (filter, map)
- Chapter 3: Pipe to another command
- Chapter 4: Handle errors when repo doesn't exist
- Chapter 5: Manage resources properly

### 5.3 Missing "Why" Explanations

**Current**:

```typescript
const lines = await run("ls", "-la").lines.collect();
```

**Better**:

```typescript
// .lines converts byte stream to string lines
// .collect() gathers all lines into an array (consuming the stream)
const lines = await run("ls", "-la").lines.collect();
```

---

## 6. Voice and Tone

### 6.1 Excessive Enthusiasm

**Problem**: Too many exclamation marks undermine technical authority.

**Examples found**:

- "Errors just work!"
- "That's the whole point!"
- "This is revolutionary!"

**Recommendation**: Remove 80% of exclamation marks. Let the technology speak
for itself.

**Before**: "Errors just work. Like they should have all along."\
**After**: "Errors propagate naturally through pipelines, eliminating the need
for error handling at each step."

### 6.2 Inconsistent Formality

**Problem**: Tone shifts between casual and technical.

**Too casual**: "This trips up everyone at first."\
**Too formal**: "The error is captured and downstream operations are skipped."

**Target tone**: Conversational but confident. Like explaining to a smart
colleague.

**Better**: "A common stumbling block: some APIs are properties, others are
methods."

### 6.3 Overuse of Blockquotes

**Current**: Tips, warnings, and notes all use blockquotes with emoji.

**Problem**: When everything is highlighted, nothing is highlighted.

**Recommendation**:

- Use blockquotes sparingly (max 2 per chapter)
- Reserve for genuinely important warnings
- Remove emoji from technical content

---

## 7. Missing Content

### 7.1 No Troubleshooting Chapter

**Current**: Troubleshooting is buried in FAQ.

**Recommendation**: Create dedicated troubleshooting chapter with:

- Common error messages and solutions
- Debugging techniques
- Performance issues

### 7.2 No Migration Path from Deno.Command

**Current**: migration.md exists but is nearly empty.

**Recommendation**: Add concrete before/after examples showing how to convert
Deno.Command code to proc.

### 7.3 No Glossary

**Recommendation**: Add glossary defining:

- Enumerable
- Backpressure
- Pull-based vs push-based
- Terminal operation
- Lazy evaluation

---

## 8. Technical Accuracy Issues

### 8.1 Broken Links

- `../advanced/custom-errors.md` - Referenced but doesn't exist
- Several internal links use inconsistent paths

### 8.2 Version Placeholders

**Current**: `{{gitv}}` placeholders throughout.

**Recommendation**: Ensure build process replaces these, or use `@latest` for
documentation.

---

## 9. Recommended Chapter Order (Final)

```
Introduction
  - Who This Book Is For (NEW)
  - What is proc?
  - Quick Decision Guide (NEW)

Part I: Getting Started
  - Installation
  - Quick Start
  - Key Concepts

Part II: Core Features  
  - Running Processes
  - Working with Output
  - Working with Input
  - Process Pipelines
  - Error Handling
  - Resource Management

Part III: Async Iterables
  - Understanding Enumerable
  - Array-Like Methods
  - Transformations
  - Aggregations
  - Slicing and Sampling

Part IV: Data Processing
  - Choosing Your Approach (NEW - decision framework)
  - Data Transforms Overview
  - CSV Transforms
  - TSV Transforms
  - JSON Transforms
  - Record Format
  - LazyRow Optimization
  - flatdata CLI

Part V: Specialized Topics
  - Concurrent Processing
  - Streaming Large Files
  - Custom Transformations
  - Performance Tuning

Part VI: Recipes
  - (keep current recipes)

Appendices
  - Common Mistakes (NEW - from anti-patterns)
  - Troubleshooting (NEW)
  - Migration from Deno.Command (expand)
  - CSV Parser Specification
  - Glossary (NEW)
  - API Reference
```

---

## 10. Priority Action Items

### Immediate (Before Publication)

1. **Fix TOC order** - Move Error Handling after Running Processes
2. **Fix broken link** - Create or remove reference to custom-errors.md
3. **Add "Who This Book Is For"** - 10 minutes, high impact
4. **Remove patterns.md** - Integrate content into relevant chapters

### Short-term (1-2 weeks)

5. **Add decision framework** to introduction
6. **Create "Choosing Your Approach"** chapter for Data Processing
7. **Add "See Also" sections** to all chapters
8. **Reduce exclamation marks** throughout

### Medium-term (Before Print)

9. **Test all examples** and remove testing markers
10. **Create running example** through Core Features
11. **Add Troubleshooting chapter**
12. **Add Glossary**
13. **Expand Migration Guide**

---

## Conclusion

This documentation is close to publication-ready. The technical content is
strong, and the practical focus aligns well with O'Reilly's style. The main
issues are structural (TOC ordering, redundancy) and editorial (voice
consistency, cross-referencing).

With the changes outlined above, this could be an excellent addition to the
O'Reilly catalog—a focused, practical guide that solves a real problem
developers face.

**Estimated effort to publication-ready**: 2-3 weeks of focused editorial work.

---

_Assessment prepared for internal editorial review. Not for distribution._
