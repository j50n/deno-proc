# Coding Standards

## TypeScript Standards
- Use explicit types, avoid `any` (lint rule: no-explicit-any)
- Follow Deno's formatting standards (enforced by `deno fmt`)
- All code must pass `deno lint` and `deno check`
- Use the shebang pattern: `":" //#;` on line 2 for executable scripts

## Testing Requirements
- All tests must pass before committing (172 tests currently)
- Tests should be added for new features following existing patterns
- Test files use descriptive names: `feature.test.ts`
- When adding new features, consider if tests are needed

## Error Handling
- Errors should propagate naturally through pipelines
- Use try-catch at the end of pipelines, not at each step
- Process errors throw `ExitCodeError` with `.code` property
- Always provide clear error messages

## File Structure
- `src/`: Core library code
- `tests/`: All test files
  - `tests/mdbook_examples.test.ts`: Tests for documentation examples
  - `tests/readme_examples.test.ts`: Tests for README examples
  - `tests/docs/`: Tests for API documentation examples
- `site/src/`: mdbook documentation source
- `site/theme/`: Custom CSS and JS for documentation
- `docs/`: Generated documentation site (committed to git for GitHub Pages)
- `tools/`: Build tools and preprocessors

## Naming Conventions
- Use kebab-case for file names: `my-feature.ts`
- Use PascalCase for classes: `ProcessEnumerable`
- Use camelCase for functions and variables: `enumerate`, `lineCount`
- Use SCREAMING_SNAKE_CASE for constants: `DAYS`, `HOURS`

## Git Workflow
- Contributors handle their own git commits
- Use descriptive commit messages
- All tests must pass before committing
- Follow the standard build process before releases

## Security Best Practices
- Substitute PII in examples with generic placeholders
- No secret keys in code unless specifically required
- Follow secure coding practices for process execution
