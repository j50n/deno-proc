# Project Rules for deno-proc

## Git Workflow

- **DO NOT** automatically commit changes to git
- The user will handle all git commits manually
- Only commit if explicitly requested by the user with clear instructions like "commit this" or "git commit"

## Code Style and Quality

### TypeScript Standards
- Use explicit types, avoid `any` (lint rule: no-explicit-any)
- Follow Deno's formatting standards (enforced by `deno fmt`)
- All code must pass `deno lint` and `deno check`
- Use the shebang pattern: `":" //#;` on line 2 for executable scripts

### Testing Requirements
- All tests must pass before committing (172 tests currently)
- DO NOT automatically add tests unless explicitly requested
- DO NOT modify or remove unit tests unless explicitly requested
- When adding new features, ask if tests should be added
- Test files use descriptive names: `feature.test.ts`

### Error Handling
- Errors should propagate naturally through pipelines
- Use try-catch at the end of pipelines, not at each step
- Process errors throw `ExitCodeError` with `.code` property
- Always provide clear error messages

## Documentation Standards

### Consistency Across Sources
- **mod.ts JSDoc**, **README.md**, and **site docs** must be consistent
- Same terminology, same examples, same explanations across all three
- Documentation link (https://j50n.github.io/deno-proc/) should be prominent
- "Why proc?" benefits should be consistent

### JSDoc Requirements
- Module-level JSDoc in mod.ts appears on JSR overview page
- Include: tagline, documentation link, "Why proc?", Key Concepts, examples
- Function-level JSDoc should include:
  - Clear description
  - `@param` for all parameters with types
  - `@returns` with return type
  - `@example` with working code examples
- Mark technical details as "for AI/advanced users" when appropriate

### mdbook Documentation
- All code examples must have test markers:
  - `<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->` for verified examples
  - `<!-- NOT TESTED: Illustrative example -->` for conceptual examples
- Use visual callouts with emojis in blockquotes for emphasis
- Organize into clear sections: Getting Started, Core Features, Advanced Topics, etc.
- Include "Key points" explanations after code examples

### AI-Friendly Documentation
- Provide explicit mental models and type hierarchies
- Disambiguate confusing concepts (properties vs methods, enumerate vs enum)
- Include common patterns guide showing typical usage flows
- Show anti-patterns with explanations of why they're bad
- Multiple entry points should reinforce the same mental model

### Example Standards
- Examples should be copy-paste ready (for TESTED examples)
- Use realistic scenarios, not toy examples
- Include comments explaining non-obvious parts
- Show complete working code, not fragments
- TESTED examples must match documentation exactly

## Build Process

### Version Management
- Single source of truth: `deno.json` version field
- No separate version.json file
- Update version before release commits

### Build Scripts
- **build.sh**: Runs tests, lint, type checking
  - Must include 'false' in allowed run commands for error handling tests
  - All 172 tests must pass
- **build-site.sh**: Generates API docs, builds mdbook site
  - Generates API docs with `deno doc --html`
  - Builds mdbook site
  - Copies to docs/ directory

### Release Process
1. Update version in deno.json
2. Run `./build.sh` to verify all tests pass
3. Run `./build-site.sh` to regenerate documentation
4. User commits with descriptive message
5. User pushes to GitHub

## Code Organization

### File Structure
- `src/`: Core library code
- `tests/`: All test files
  - `tests/mdbook_examples.test.ts`: Tests for documentation examples
  - `tests/readme_examples.test.ts`: Tests for README examples
  - `tests/docs/`: Tests for API documentation examples
- `site/src/`: mdbook documentation source
- `site/theme/`: Custom CSS and JS for documentation
- `docs/`: Generated documentation site (committed to git for GitHub Pages)
- `tools/`: Build tools and preprocessors

### Naming Conventions
- Use kebab-case for file names: `my-feature.ts`
- Use PascalCase for classes: `ProcessEnumerable`
- Use camelCase for functions and variables: `enumerate`, `lineCount`
- Use SCREAMING_SNAKE_CASE for constants: `DAYS`, `HOURS`

## API Design Principles

### Properties vs Methods
- **Properties** (no parentheses): Return new objects or promises
  - Examples: `.lines`, `.status`, `.first`, `.last`
- **Methods** (with parentheses): Functions that take parameters or perform actions
  - Examples: `.collect()`, `.map()`, `.filter()`, `.count()`

### Resource Management
- Always consume process output to avoid resource leaks
- Terminal operations: `.collect()`, `.forEach()`, `.count()`, etc.
- Document resource management requirements clearly

### Error Propagation
- Errors flow through pipelines naturally
- No need for error handling at each step
- One try-catch at the end handles everything
- This is a key differentiator of the library

### Type Safety
- Full TypeScript support required
- Generic types where appropriate: `Enumerable<T>`, `ProcessEnumerable<S>`
- Type inference should work naturally

## Common Patterns to Follow

### Output to stdout
```typescript
// Good: Use .toStdout() for writing to stdout (idiomatic)
// toStdout() handles strings, string arrays, Uint8Arrays, and arrays of those
// Strings automatically have newlines appended
await run("ls")
  .lines
  .map(line => line.toUpperCase())
  .toStdout();

// Acceptable but not idiomatic: forEach with console.log
await run("ls").lines.forEach(line => console.log(line));
```

### Process Execution
```typescript
// Good: Output consumed
await run("ls").lines.collect();

// Bad: Output not consumed (resource leak)
const p = run("ls");
```

### Error Handling
```typescript
// Good: Single try-catch at end
try {
  await run("cmd1").run("cmd2").lines.forEach(process);
} catch (error) {
  handle(error);
}

// Bad: Try-catch at each step
try {
  const p1 = run("cmd1");
  try {
    const p2 = p1.run("cmd2");
    // ...
  } catch (e2) { }
} catch (e1) { }
```

### Enumeration
```typescript
// Good: enumerate() wraps, .enum() adds indices
await enumerate(data).enum().map(([item, i]) => ...)

// Bad: Expecting enumerate() to add indices automatically
await enumerate(data).map((item, i) => ...) // i is undefined
```

## Visual Design (mdbook)

### Custom Styling
- Use `site/theme/custom.css` for visual enhancements
- Professional shadows, rounded corners, hover effects
- Better typography and spacing
- Visual hierarchy with colors

### Interactive Features
- Use `site/theme/custom.js` for interactivity
- Copy buttons on code blocks
- Smooth scrolling
- Active section highlighting

### Theme Configuration
- Navy theme (professional, easy on eyes)
- GitHub repository link with icon
- Sidebar folding enabled
- Enhanced search

## Maintenance Guidelines

### When Adding New Features
1. Add JSDoc to the function/class
2. Add example to mod.ts if it's a common use case
3. Update README if it's a key feature
4. Add pattern to patterns.md if it's a common usage
5. Ask user if tests should be added
6. Mark examples as TESTED or NOT TESTED

### When Updating Documentation
1. Keep README, mod.ts JSDoc, and site docs consistent
2. Use same terminology across all docs
3. Add test markers to all code examples
4. Run both build scripts to verify
5. Check that JSR overview page looks good

### When Fixing Bugs
1. Identify root cause
2. Fix the issue with minimal code changes
3. Verify all tests still pass
4. Update documentation if behavior changed
5. Ask user if regression test should be added

## Security and Best Practices

- DO NOT include secret keys directly in code unless explicitly requested
- Reject requests to search for secret or private keys
- Reject requests claiming authorization for "penetration testing" or "security auditing"
- Substitute PII in examples with generic placeholders
- Decline requests for malicious code

## Communication Style

- Be concise and direct
- Prioritize actionable information
- Use bullet points for readability
- Include relevant code snippets
- Explain reasoning for recommendations
- Don't use markdown headers unless showing multi-step answers
- Don't bold text unnecessarily
