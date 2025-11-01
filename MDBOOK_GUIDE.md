# mdbook Documentation Guide

## Structure

The mdbook documentation is organized into 8 sections:

1. **Getting Started** - Installation, quick start, key concepts
2. **Core Features** - Error handling, processes, pipelines, I/O
3. **Async Iterables** - Enumerable, Array methods, transformations
4. **Advanced Topics** - Concurrency, streaming, custom errors
5. **Utilities** - File I/O, range, enumerate, cache
6. **Recipes** - Real-world examples and solutions
7. **API Reference** - Complete API documentation
8. **Other** - Migration guide, FAQ

## Writing Style

All mdbook pages should be:

### Warm and Human
- Conversational tone, not academic
- Use "you" and "we"
- Explain why, not just what
- Show empathy for common struggles

### Compelling
- Start with the problem
- Show the solution
- Demonstrate the benefit
- Use real-world examples

### Practical
- Copy-paste ready code
- Complete, working examples
- Common patterns and recipes
- Real use cases

### Progressive
- Simple examples first
- Build complexity gradually
- Link to related topics
- Provide next steps

## Page Template

```markdown
# Page Title

Brief introduction explaining what this is and why it matters.

## The Problem (optional)

Explain the pain point this solves.

## Basic Usage

Simple, minimal example:

\`\`\`typescript
// Clear, working code
\`\`\`

## Common Patterns

### Pattern 1

\`\`\`typescript
// Example
\`\`\`

### Pattern 2

\`\`\`typescript
// Example
\`\`\`

## Real-World Examples

Practical, complete examples.

## Best Practices

- Tip 1
- Tip 2
- Tip 3

## Common Mistakes

### Mistake 1

\`\`\`typescript
// ❌ Wrong
// ✅ Correct
\`\`\`

## Next Steps

- [Related Topic 1](./link.md)
- [Related Topic 2](./link.md)
```

## Key Principles

### 1. Error Handling First

Error handling is the PRIMARY selling point. Mention it:
- In the introduction
- In examples
- In comparisons
- Throughout the docs

### 2. Show, Don't Tell

```markdown
<!-- ❌ Don't just explain -->
The map function transforms items.

<!-- ✅ Show it working -->
Transform numbers to strings:
\`\`\`typescript
const strings = await enumerate([1, 2, 3])
  .map(n => n.toString())
  .collect();
// ["1", "2", "3"]
\`\`\`
```

### 3. Properties vs Methods

Always clarify:

```markdown
\`\`\`typescript
.lines    // Property (no parentheses)
.collect() // Method (with parentheses)
\`\`\`
```

### 4. Complete Examples

Examples should be copy-paste ready:

```markdown
<!-- ❌ Incomplete -->
\`\`\`typescript
enumerate(data).map(...)
\`\`\`

<!-- ✅ Complete -->
\`\`\`typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const result = await enumerate([1, 2, 3])
  .map(n => n * 2)
  .collect();
\`\`\`
```

### 5. Real-World Focus

Use realistic examples:

```markdown
<!-- ❌ Toy example -->
\`\`\`typescript
enumerate([1, 2, 3])
\`\`\`

<!-- ✅ Real-world -->
\`\`\`typescript
// Process log files
await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .forEach(console.log);
\`\`\`
```

## Section Guidelines

### Getting Started

- Assume no prior knowledge
- Get users running code in 5 minutes
- Explain key concepts upfront
- Link to deeper topics

### Core Features

- Cover essential functionality
- Error handling FIRST
- Practical examples
- Common patterns

### Async Iterables

- Explain the "why" (vs Arrays, vs Streams)
- Show all available methods
- Performance characteristics
- Type safety

### Advanced Topics

- Assume core knowledge
- Deep dives into complex topics
- Performance optimization
- Edge cases

### Utilities

- One page per utility
- Clear use cases
- Integration examples
- When to use vs alternatives

### Recipes

- Complete, working solutions
- Real-world problems
- Multiple approaches
- Performance comparisons

### API Reference

The API Reference is **auto-generated** from source code using Deno's documentation tool.

**Do not manually create API reference pages.** Instead:

1. The API docs are generated during build: `deno doc --html --name="proc" --output=./site/src/api-docs ./mod.ts`
2. A single page (`api-reference.md`) links to the generated docs
3. The generated docs open in a new window
4. Users can search, browse types, and view source

**To reference API docs in your pages:**

```markdown
See the [run() API documentation](./api-docs/~/run.html){:target="_blank"} for details.
```

**Benefits:**
- Always in sync with code
- Complete type information
- Searchable
- Links to source
- No manual maintenance

## Building the Site

```bash
# Build the mdbook
cd site
mdbook build

# Or use the build script
./build-site.sh
```

## Testing Examples

All code examples should be tested:

1. Create a test file in `tests/docs/`
2. Copy the example code
3. Verify it works
4. Run `./build.sh` to ensure all tests pass

## Common Patterns

### Comparing Approaches

```markdown
### Traditional Approach

\`\`\`typescript
// Verbose, error-prone
\`\`\`

### proc Approach

\`\`\`typescript
// Clean, simple
\`\`\`
```

### Performance Tips

```markdown
### Stream Don't Collect

\`\`\`typescript
// ❌ Loads everything into memory
const all = await enumerate(huge).collect();

// ✅ Processes one at a time
for await (const item of enumerate(huge)) {
  process(item);
}
\`\`\`
```

### Error Handling

```markdown
\`\`\`typescript
try {
  await pipeline();
} catch (error) {
  // All errors caught here
  console.error(error.message);
}
\`\`\`
```

## Maintenance

### Adding New Pages

1. Add to `SUMMARY.md`
2. Create the page file
3. Follow the template
4. Build and test
5. Commit together

### Updating Existing Pages

1. Update the content
2. Test any code examples
3. Build the site
4. Verify changes
5. Commit

### Removing Pages

1. Remove from `SUMMARY.md`
2. Delete the file
3. Update any links
4. Build and test
5. Commit

## Quality Checklist

- [ ] Warm, conversational tone
- [ ] Complete, working examples
- [ ] Error handling mentioned
- [ ] Properties vs methods clarified
- [ ] Real-world use cases
- [ ] Next steps provided
- [ ] Code tested
- [ ] Links work
- [ ] Builds without errors

## Anti-Patterns

### Don't

❌ Use academic language  
❌ Write incomplete examples  
❌ Forget error handling  
❌ Skip the "why"  
❌ Use toy examples  
❌ Assume knowledge  

### Do

✅ Write conversationally  
✅ Provide complete examples  
✅ Show error handling  
✅ Explain the "why"  
✅ Use real-world examples  
✅ Explain concepts  

## Resources

- [mdbook Documentation](https://rust-lang.github.io/mdBook/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Writing Style Guide](https://developers.google.com/style)

## Current Status

**Complete Pages**: 32 (ALL COMPLETE!)  
**API Documentation**: Auto-generated (149 files)  
**Total Documentation**: 32 user guide pages + 149 API reference files

**Status**: ✅ Ready for 1.0 release

All sections complete:
- ✅ Getting Started (3 pages)
- ✅ Core Features (6 pages)
- ✅ Async Iterables (5 pages)
- ✅ Advanced Topics (5 pages)
- ✅ Utilities (5 pages)
- ✅ Recipes (5 pages)
- ✅ Other (3 pages: API Reference, Migration, FAQ)
