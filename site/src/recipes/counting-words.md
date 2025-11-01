# Counting Words

A classic example that shows the power of process pipelines.

## Simple Word Count

Count total words in a file:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const wordCount = await run("wc", "-w", "book.txt").lines.first;
console.log(`Total words: ${wordCount}`);
```

## Unique Words

Count unique words:

<!-- NOT TESTED: Illustrative example -->
```typescript
const uniqueWords = await run("cat", "book.txt")
  .run("tr", "-cs", "A-Za-z", "\n")  // Extract words
  .run("tr", "A-Z", "a-z")            // Lowercase
  .run("sort")                         // Sort
  .run("uniq")                         // Unique
  .lines
  .count();

console.log(`Unique words: ${uniqueWords}`);
```

## Word Frequency

Find most common words:

<!-- NOT TESTED: Illustrative example -->
```typescript
const topWords = await run("cat", "book.txt")
  .run("tr", "-cs", "A-Za-z", "\n")
  .run("tr", "A-Z", "a-z")
  .run("sort")
  .run("uniq", "-c")
  .run("sort", "-rn")
  .run("head", "-10")
  .lines
  .collect();

console.log("Top 10 words:");
topWords.forEach(line => console.log(line));
```

## Pure JavaScript Version

Do it all in JavaScript:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const wordCounts = await read("book.txt")
  .lines
  .flatMap(line => line.toLowerCase().match(/\w+/g) || [])
  .reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

const topWords = Object.entries(wordCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log("Top 10 words:");
topWords.forEach(([word, count]) => {
  console.log(`${count} ${word}`);
});
```

## Compressed Files

Count words in a compressed file:

<!-- NOT TESTED: Illustrative example -->
```typescript
const wordCount = await read("book.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .flatMap(line => line.match(/\w+/g) || [])
  .count();

console.log(`Total words: ${wordCount}`);
```

## Multiple Files

Count words across multiple files:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const files = ["book1.txt", "book2.txt", "book3.txt"];

const results = await enumerate(files)
  .concurrentMap(async (file) => {
    const words = await read(file)
      .lines
      .flatMap(line => line.match(/\w+/g) || [])
      .count();
    return { file, words };
  }, { concurrency: 3 })
  .collect();

results.forEach(({ file, words }) => {
  console.log(`${file}: ${words} words`);
});
```

## Filter Stop Words

Exclude common words:

<!-- NOT TESTED: Illustrative example -->
```typescript
const stopWords = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for"
]);

const meaningfulWords = await read("book.txt")
  .lines
  .flatMap(line => line.toLowerCase().match(/\w+/g) || [])
  .filter(word => !stopWords.has(word))
  .reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
```

## Word Length Distribution

Analyze word lengths:

<!-- NOT TESTED: Illustrative example -->
```typescript
const lengthDist = await read("book.txt")
  .lines
  .flatMap(line => line.match(/\w+/g) || [])
  .reduce((acc, word) => {
    const len = word.length;
    acc[len] = (acc[len] || 0) + 1;
    return acc;
  }, {});

console.log("Word length distribution:");
Object.entries(lengthDist)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([len, count]) => {
    console.log(`${len} letters: ${count} words`);
  });
```

## Real-World Example: War and Peace

Analyze Tolstoy's War and Peace:

<!-- NOT TESTED: Illustrative example -->
```typescript
const [totalWords, uniqueWords] = await Promise.all([
  // Total words
  read("warandpeace.txt.gz")
    .transform(new DecompressionStream("gzip"))
    .lines
    .flatMap(line => line.match(/\w+/g) || [])
    .count(),
  
  // Unique words
  read("warandpeace.txt.gz")
    .transform(new DecompressionStream("gzip"))
    .lines
    .flatMap(line => line.toLowerCase().match(/\w+/g) || [])
    .reduce((acc, word) => {
      acc.add(word);
      return acc;
    }, new Set())
    .then(set => set.size)
]);

console.log(`Total words: ${totalWords.toLocaleString()}`);
console.log(`Unique words: ${uniqueWords.toLocaleString()}`);
console.log(`Vocabulary richness: ${(uniqueWords / totalWords * 100).toFixed(1)}%`);
```

## Performance Comparison

### Shell Pipeline (fast)

<!-- NOT TESTED: Illustrative example -->
```typescript
// Uses native Unix tools
const count = await run("cat", "book.txt")
  .run("wc", "-w")
  .lines.first;
```

### JavaScript (flexible)

<!-- NOT TESTED: Illustrative example -->
```typescript
// More control, type-safe
const count = await read("book.txt")
  .lines
  .flatMap(line => line.match(/\w+/g) || [])
  .count();
```

### Hybrid (best of both)

<!-- NOT TESTED: Illustrative example -->
```typescript
// Use Unix tools for heavy lifting, JavaScript for logic
const words = await run("cat", "book.txt")
  .run("tr", "-cs", "A-Za-z", "\n")
  .lines
  .filter(word => word.length > 5)  // JavaScript filter
  .count();
```

## Next Steps

- [Process Pipelines](../core/pipelines.md) - Chain commands together
- [Concurrent Processing](../advanced/concurrent.md) - Process multiple files
- [Streaming Large Files](../advanced/streaming.md) - Handle huge files
