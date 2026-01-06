# Documentation Guidelines

## Core Principles

1. **Every public API must have JSDoc with a working example**
2. **Every example must have a corresponding test**
3. **Examples must be minimal and focused on one concept**
4. **Documentation must explain WHY, not just WHAT**
5. **Error handling is the PRIMARY selling point**

## Consistency Across Sources

- **mod.ts JSDoc**, **README.md**, and **site docs** must be consistent
- Same terminology, same examples, same explanations across all three
- Documentation link (https://j50n.github.io/deno-proc/) should be prominent
- "Why proc?" benefits should be consistent

## JSDoc Requirements

- Module-level JSDoc in mod.ts appears on JSR overview page
- Include: tagline, documentation link, "Why proc?", Key Concepts, examples
- Function-level JSDoc should include:
  - Clear description
  - `@param` for all parameters with types
  - `@returns` with return type
  - `@example` with working code examples
- Mark technical details as "for advanced users" when appropriate

## mdbook Documentation

- All code examples must have test markers:
  - `<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->` for verified examples
  - `<!-- NOT TESTED: Illustrative example -->` for conceptual examples
- Use visual callouts with emojis in blockquotes for emphasis
- Organize into clear sections: Getting Started, Core Features, Advanced Topics, etc.
- Include "Key points" explanations after code examples

## Documentation Structure

### Key Documentation Files

- **mod.ts**: Module-level JSDoc that appears on JSR overview page
- **README.md**: GitHub landing page, consistent with mod.ts JSDoc
- **site/src/**: mdbook documentation with comprehensive guides

### Visual Enhancements (mdbook)

- **site/theme/custom.css**: Professional styling with shadows, rounded corners, hover effects
- **site/theme/custom.js**: Interactive features like copy buttons and smooth scrolling
- **site/book.toml**: Navy theme, GitHub integration, enhanced search

## Example Standards

- Examples should be copy-paste ready (for TESTED examples)
- Use realistic scenarios, not toy examples
- Include comments explaining non-obvious parts
- Show complete working code, not fragments
- TESTED examples must match documentation exactly

## Test Markers

All code examples in mdbook have HTML comments:
- `<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->` for verified examples
- `<!-- NOT TESTED: Illustrative example -->` for conceptual/comparison examples

## Maintenance Guidelines

### When Adding New Features
1. Add JSDoc to the function/class
2. Add example to mod.ts if it's a common use case
3. Update README if it's a key feature
4. Add pattern to patterns.md if it's a common usage
5. Consider if tests should be added
6. Mark examples as TESTED or NOT TESTED

### When Updating Documentation
1. Keep README, mod.ts JSDoc, and site docs consistent
2. Use same terminology across all docs
3. Add test markers to all code examples
4. Run both build scripts to verify
5. Check that JSR overview page looks good
