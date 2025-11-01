# Documentation Structure (as of v0.23.2)

## Key Documentation Files

### mod.ts
Module-level JSDoc that appears on JSR overview page. Matches README structure with:
- "Why proc?" section explaining benefits
- Key Concepts (properties vs methods, resource management, error handling, enumeration)
- Type Hierarchy for AI/advanced users
- Multiple examples covering common use cases
- Documentation link to https://j50n.github.io/deno-proc/

### README.md
GitHub landing page. Consistent with mod.ts JSDoc:
- Documentation link at top with emoji for prominence
- Same "Why proc?" benefits
- Same Key Concepts
- Same quick examples
- Features list

### site/src/ (mdbook documentation)
- **patterns.md**: Comprehensive patterns guide with 12 common patterns and 2 anti-patterns
- **introduction.md**: Enhanced with visual callouts (emojis in blockquotes)
- All pages have test markers (TESTED vs NOT TESTED)
- Organized into: Getting Started, Core Features, Async Iterables, Advanced Topics, Utilities, Recipes

## Visual Enhancements (mdbook)

### site/theme/custom.css
Professional styling:
- Code blocks with shadows, rounded corners, hover effects
- Enhanced tables with alternating rows
- Better typography and spacing
- Smooth animations and transitions
- Visual hierarchy with colors

### site/theme/custom.js
Interactive features:
- Copy buttons on code blocks (appear on hover)
- Smooth scrolling for anchor links
- Active section highlighting in sidebar
- Keyboard shortcuts hint on page load

### site/book.toml
Configuration:
- Navy theme (default and preferred dark)
- GitHub repository link with icon
- Sidebar folding enabled
- Enhanced search with boolean operators

## Documentation Philosophy

### AI-Friendly
- Explicit mental models and type hierarchies
- Pattern recognition guide for typical usage flows
- Disambiguation of confusing concepts (enumerate/enum, properties/methods)
- Examples with explanations ("Key points"), not just code
- Multiple entry points reinforcing same mental model

### Consistent
- Same content structure across README, JSDoc, and site docs
- Same examples used throughout
- Same terminology and explanations

### Engaging
- "Why proc?" benefits upfront
- Visual callouts with emojis
- Interactive features (copy buttons, smooth scrolling)
- Professional visual design

### Practical
- Common patterns guide showing typical usage
- Anti-patterns showing what NOT to do
- "Key points" explaining why patterns work
- Real-world examples

## Build Process

### build.sh
Runs in order:
1. Update Rust and mdbook
2. Update Deno
3. Format markdown and TypeScript
4. Fix shebang pattern (sed command)
5. Lint TypeScript
6. Type check TypeScript
7. Run tests with specific allowed commands (includes 'false' for error handling tests)

### build-site.sh
Runs in order:
1. Update Rust and mdbook
2. Generate API docs with `deno doc --html`
3. Format site source files
4. Build mdbook site
5. Copy to docs/ directory

### Version Management
- Single source of truth: deno.json
- Preprocessor reads version from deno.json
- No separate version.json file

## Test Coverage

### Statistics
- 172 tests total (100% passing)
- 36 mdbook example tests in tests/mdbook_examples.test.ts
- 31 examples marked as TESTED in documentation
- 331 examples marked as NOT TESTED (illustrative/comparison examples)

### Test Markers
All code examples in mdbook have HTML comments:
- `<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->` for verified examples
- `<!-- NOT TESTED: Illustrative example -->` for conceptual/comparison examples

### Key Test Files
- tests/mdbook_examples.test.ts: Tests for user-facing documentation examples
- tests/readme_examples.test.ts: Tests for README examples
- tests/docs/: Tests for API documentation examples
- All tests verify examples match documentation exactly

## Maintenance Guidelines

### When Adding New Features
1. Add JSDoc to the function/class
2. Add example to mod.ts if it's a common use case
3. Update README if it's a key feature
4. Add pattern to patterns.md if it's a common usage
5. Add test to appropriate test file
6. Mark example as TESTED or NOT TESTED in documentation

### When Updating Documentation
1. Keep README, mod.ts JSDoc, and site docs consistent
2. Use same terminology across all docs
3. Add test markers to all code examples
4. Run both build scripts to verify
5. Check that JSR overview page looks good (from mod.ts JSDoc)

### Documentation Priorities
1. Accuracy: All TESTED examples must work exactly as shown
2. Consistency: Same content across README, JSDoc, site docs
3. AI-friendliness: Explicit explanations, mental models, patterns
4. Engagement: Visual appeal, interactive features, clear benefits
