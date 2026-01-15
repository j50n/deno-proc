# stdout-async Experiment Summary

## Question
Is synchronous `writeSync()` a performance bottleneck? Should we use async writes?

## Answer
**No. Keep `writeSync()` - it's the fastest approach.**

## Key Insight
`writeSync()` is only "synchronous" at the JavaScript level. The OS kernel buffers writes and performs I/O asynchronously. We get async performance with sync semantics.

## Performance Results
- **Sync**: 1026 MB/s (100MB file)
- **Async Simple**: 922 MB/s (-10%)
- **Async Queued**: 976 MB/s (-5%)

With CPU work (data transformation):
- **Sync**: 603 MB/s
- **Async Simple**: 581 MB/s (-4%)

## Why Sync Wins
1. **OS kernel buffering** - Writes return immediately after copying to kernel space
2. **No promise overhead** - Async adds event loop scheduling costs
3. **No parallelism benefit** - JavaScript is single-threaded
4. **Console.log safety** - No output interleaving

## Proof of Kernel Buffering
- To `/dev/null`: 18,193 MB/s
- To real file: 3,421 MB/s
- Piped (benchmarks): 1,026 MB/s

## Recommendation
✅ **Current `toStdout()` implementation is optimal**

No changes needed. The synchronous approach is fastest, safest, and simplest.
