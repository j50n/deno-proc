# Build Process

## Version Management
- Single source of truth: `deno.json` version field
- No separate version.json file
- Update version before release commits

## Build Scripts

### build.sh
Runs tests, lint, type checking:
- Updates Rust and mdbook
- Updates Deno
- Formats markdown and TypeScript
- Fixes shebang pattern (sed command)
- Lints TypeScript
- Type checks TypeScript
- Runs tests with specific allowed commands
  - Must include 'false' in allowed run commands for error handling tests
  - All 172 tests must pass

### build-site.sh
Generates API docs, builds mdbook site:
- Updates Rust and mdbook
- Generates API docs with `deno doc --html`
- Formats site source files
- Builds mdbook site
- Copies to docs/ directory

## Release Process

1. Update version in deno.json
2. Run `./build.sh` to verify all tests pass
3. Run `./build-site.sh` to regenerate documentation
4. Commit with descriptive message
5. Push to GitHub
6. JSR automatically publishes from git tags

## Current Status

**Version:** 0.23.2  
**Registry:** JSR (jsr.io)  
**License:** MIT  
**Test Coverage:** 172 tests (all passing)

**Recent Improvements:**
- Enhanced documentation for accessibility
- Added Common Patterns guide
- Visual enhancements to mdbook site (custom CSS/JS)
- Aligned JSDoc with README for consistency
- All documentation sources consistent

## Build Tools

- **tools/mdbook-deno-script-preprocessor.ts**: Processes Deno code blocks in documentation
- **site/gitv.ts**: Git version preprocessor for mdbook
- **site/theme/**: Custom CSS and JavaScript for enhanced documentation experience

## Dependencies

- **Deno**: Runtime and tooling
- **mdbook**: Documentation site generator
- **Rust toolchain**: Required for mdbook
- **Git**: Version control and preprocessor data
