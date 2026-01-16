# Glossary

Key terms used throughout this documentation.

## A

**Aggregation** : An operation that consumes an entire iterable and produces a
single value. Examples: `count()`, `reduce()`, `collect()`. Aggregations are
terminal operations.

**Async Iterator** : A JavaScript object that produces values asynchronously,
one at a time, when requested. proc uses async iterators instead of streams for
pull-based data flow.

## B

**Backpressure** : The problem of coordinating data flow when a producer
generates data faster than a consumer can process it. Traditional streams
require explicit backpressure handling. proc eliminates backpressure by using
pull-based async iterators.

## C

**Collect** : A terminal operation that gathers all items from an iterable into
an array. Use with caution on large datasets as it loads everything into memory.

## E

**Enumerable** : proc's wrapper around async iterables that provides Array-like
methods (`map`, `filter`, `reduce`, etc.). Created with `enumerate()` or
returned by `run().lines`.

**enumerate()** : Function that wraps any iterable (sync or async) in an
Enumerable, giving it Array-like methods.

## F

**flatdata** : A WASM-powered CLI tool included with proc for high-performance
CSV/TSV processing. Achieves excellent throughput by offloading parsing to a
subprocess.

## L

**Lazy Evaluation** : Computation that only happens when results are needed.
proc pipelines are lazy—nothing executes until you call a terminal operation
like `collect()` or `forEach()`.

**LazyRow** : An optimization for CSV parsing that defers field extraction until
accessed. Improves performance when you only need some columns from each row.

## P

**Pipeline** : A chain of operations where each step's output becomes the next
step's input. In proc, pipelines are built with method chaining:
`.map().filter().collect()`.

**Pull-based** : A data flow model where consumers request data when ready.
Contrast with push-based streams where producers send data regardless of
consumer readiness. proc uses pull-based async iterators.

**Push-based** : A data flow model where producers send data to consumers.
Traditional JavaScript streams are push-based, requiring backpressure
coordination.

## R

**Record Format** : A binary format used by flatdata for efficient inter-process
communication. Faster than text formats because it avoids repeated parsing.

## S

**Streaming** : Processing data piece by piece rather than loading everything
into memory. proc streams by default, enabling processing of files larger than
available RAM.

## T

**Terminal Operation** : An operation that consumes an iterable and produces a
final result, triggering execution of the pipeline. Examples: `collect()`,
`forEach()`, `count()`, `first`, `reduce()`.

**Transform** : An operation that converts data from one form to another. In
proc, transforms can be TransformStreams or async generator functions.

**TransformStream** : A Web Streams API object that transforms data passing
through it. proc's `.transform()` method accepts TransformStreams.

## U

**UpstreamError** : An error type that wraps errors from earlier stages in a
pipeline. Helps identify where in a chain the original error occurred.
