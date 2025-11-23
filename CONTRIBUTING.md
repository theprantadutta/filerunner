# Contributing to FileRunner

Thank you for your interest in contributing to FileRunner! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them get started
- Focus on what is best for the project
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (OS, Rust version, etc.)
   - Logs or error messages

### Suggesting Features

1. Check if the feature has been suggested
2. Create a new issue describing:
   - The problem you're trying to solve
   - Your proposed solution
   - Any alternatives you've considered
   - Additional context or examples

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Test your changes
5. Commit with clear messages
6. Push to your fork
7. Create a Pull Request

## Development Setup

### Backend (Rust)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone your fork
git clone https://github.com/YOUR_USERNAME/filerunner.git
cd filerunner/backend

# Install SQLx CLI
cargo install sqlx-cli --no-default-features --features postgres

# Setup database
createdb filerunner
cp .env.example .env
# Edit .env with your settings
sqlx migrate run

# Run backend
cargo run
```

### Frontend (Phase 2)

```bash
cd frontend
npm install
npm run dev
```

## Coding Standards

### Rust

- Follow Rust standard style (use `cargo fmt`)
- Run `cargo clippy` and fix warnings
- Add tests for new features
- Document public APIs
- Use meaningful variable names
- Handle errors properly (no unwrap in production code)

### Database

- Write reversible migrations
- Test migrations both up and down
- Add indexes for foreign keys
- Document complex queries

### API Design

- Follow RESTful conventions
- Use proper HTTP status codes
- Validate input
- Return consistent error formats
- Document endpoints

## Testing

### Running Tests

```bash
# Backend
cd backend
cargo test

# Frontend (when available)
cd frontend
npm test
```

### Writing Tests

- Unit tests for business logic
- Integration tests for API endpoints
- Test edge cases and error conditions
- Use descriptive test names

## Commit Messages

Follow the Conventional Commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add password reset functionality

Implements password reset via email with token expiration.

Closes #123
```

```
fix(upload): handle large file uploads correctly

Previously failed for files > 100MB due to timeout.
Increased timeout and added streaming support.
```

## Project Structure

### Backend

```
backend/src/
├── main.rs              # Entry point, routing
├── config.rs            # Configuration
├── error.rs             # Error types
├── models/              # Data models
├── handlers/            # Request handlers
├── middleware/          # Middleware
├── db/                  # Database utilities
└── utils/               # Helper functions
```

### Adding New Features

1. **Models**: Define data structures in `models/`
2. **Migrations**: Create migration in `migrations/`
3. **Handlers**: Implement logic in `handlers/`
4. **Routes**: Add routes in `main.rs`
5. **Tests**: Add tests
6. **Docs**: Update relevant documentation

## Documentation

- Update README.md for user-facing changes
- Update API_EXAMPLES.md for new endpoints
- Add inline comments for complex logic
- Keep documentation in sync with code

## Review Process

1. Automated checks must pass (formatting, tests)
2. Code review by maintainers
3. Address feedback and update PR
4. Maintainer merges when approved

## Release Process

1. Update version in `Cargo.toml`
2. Update CHANGELOG.md
3. Create git tag
4. Build Docker image
5. Publish release notes

## Getting Help

- Join discussions in GitHub Issues
- Ask questions in Pull Requests
- Check existing documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be added to:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing to FileRunner! 🎉
