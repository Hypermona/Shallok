# AST Extraction Reference

## Extraction Strategy
Shallok uses Babel AST parsing (`@babel/parser` and `@babel/traverse`) with full JSX and TypeScript support to safely inspect and transform source files without regular expressions.

## Normalized Dot-Paths for Keys (Never Object-Based)
- **Always use normalized dot-separated key paths**: e.g., `"checkout.pay_now"`, `"auth.login.title"`, `"dashboard.metrics.active_users"`.
- **Never use object-based or nested object paths**: Catalogs must never store nested object trees.
- **If an existing project uses object-based keys**: Ask the user for confirmation to flatten them to normalized dot-path keys before running extraction or migrating catalogs.

## What is Extracted
1. **JSX Text Nodes**:
   - `<h1>Welcome</h1>` → `{t('home.welcome')}`
   - `<button>Pay now</button>` → `<button>{t('checkout.pay_now')}</button>`
2. **User-Facing Attributes**:
   - `placeholder="Enter your email"`
   - `aria-label="Submit login form"`
   - `title="Cart summary"`
   - `alt="Product thumbnail"`
   - `label="Password"`
3. **Conditional UI Expressions**:
   - `{isMember ? 'VIP Member' : 'Guest User'}`
4. **Template Literals with Variables**:
   - `Hello, ${name}!` → `Hello, {name}!` with variable preservation.

## What is Explicitly Ignored
- Technical attributes: `className`, `id`, `name`, `key`, `ref`, `type`, `href`, `src`, `data-testid`, `role`.
- Console and logger calls: `console.log(...)`, `console.error(...)`, `logger.debug(...)`.
- URLs, file paths, hex colors, CSS units.
- Non-user-facing strings, code constants, and symbols.
- Already localized calls: `t(...)`, `i18n.t(...)`.

## Dry-Run Mode
Always use `shallok extract --dry-run` to preview keys and occurrences before committing changes to source files.
