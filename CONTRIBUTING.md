# 🤝 Contributing to Elhegazi 2.0

Thank you for your interest in contributing! This guide will help you get started.

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Git
- MongoDB Atlas account (free tier)
- Cloudinary account (free tier)

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone git@github.com:YOUR_USERNAME/Elhegazi-2.0.git
cd Elhegazi-2.0

# Add upstream remote
git remote add upstream git@github.com:M7mod-hegazy/Elhegazi-2.0.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

```bash
# Copy environment template
cp server/.env.example server/.env
cp .env.example .env.local

# Edit with your credentials
nano server/.env
nano .env.local
```

### 4. Start Development

```bash
# Terminal 1: Start backend
npm run server:dev

# Terminal 2: Start frontend
npm run dev

# Or both together
npm run dev:full
```

## 📝 Code Style

### TypeScript

- Use strict mode
- Define types explicitly
- Avoid `any` type
- Use interfaces for objects

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = { id: '1', name: 'John', email: 'john@example.com' };

// ❌ Avoid
const user: any = { id: '1', name: 'John', email: 'john@example.com' };
```

### React Components

- Use functional components with hooks
- Use TypeScript for props
- Keep components small and focused

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}>
    {label}
  </button>
);

// ❌ Avoid
export const Button = ({ label, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}>
    {label}
  </button>
);
```

### Express Routes

- Use async/await
- Handle errors properly
- Validate input
- Return consistent JSON

```typescript
// ✅ Good
app.post('/api/products', async (req, res) => {
  try {
    const { name, price } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }
    
    const product = await Product.create({ name, price });
    return res.json({ ok: true, item: product });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});
```

## 🎯 Commit Messages

Use clear, descriptive commit messages:

```bash
# ✅ Good
git commit -m "feat: add 3D product preview"
git commit -m "fix: resolve MongoDB connection timeout"
git commit -m "docs: update deployment guide"
git commit -m "refactor: simplify API response handling"

# ❌ Avoid
git commit -m "update"
git commit -m "fix bug"
git commit -m "changes"
```

### Commit Types

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style (formatting)
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Build, dependencies

## 🔄 Pull Request Process

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Keep commits atomic and focused
- Write clear commit messages
- Test your changes locally

### 3. Push & Create PR

```bash
git push origin feature/your-feature-name
```

Then on GitHub:
1. Click "Compare & pull request"
2. Fill in PR description
3. Link related issues
4. Submit PR

### 4. PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How to test these changes:
1. Step 1
2. Step 2

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

## 🧪 Testing

### Run Linter

```bash
npm run lint
```

### Test Locally

```bash
# Build frontend
npm run build

# Test production build
npm run preview

# Test backend
npm run server
```

### Manual Testing

1. Test in Chrome/Firefox/Safari
2. Test on mobile (use DevTools)
3. Test with different screen sizes
4. Test with slow network (DevTools)

## 📁 File Structure

When adding new features:

```
src/
├── features/
│   └── my-feature/
│       ├── components/
│       │   └── MyComponent.tsx
│       ├── hooks/
│       │   └── useMyFeature.ts
│       ├── types/
│       │   └── index.ts
│       └── index.ts
├── pages/
│   └── MyPage.tsx
└── ...
```

## 🔐 Security Guidelines

- ✅ Never commit `.env` files
- ✅ Use environment variables for secrets
- ✅ Validate all user input
- ✅ Use HTTPS in production
- ✅ Sanitize HTML output
- ✅ Use prepared statements for queries
- ✅ Keep dependencies updated

## 📚 Documentation

When adding features:

1. Update README.md if needed
2. Add JSDoc comments to functions
3. Document complex logic
4. Update API docs for new endpoints

```typescript
/**
 * Fetches products with optional filtering
 * @param filter - Product filter criteria
 * @param limit - Maximum number of products (default: 10)
 * @returns Promise resolving to array of products
 * @throws Error if database query fails
 */
async function getProducts(filter?: ProductFilter, limit = 10): Promise<Product[]> {
  // Implementation
}
```

## 🐛 Reporting Bugs

Create an issue with:

1. **Title**: Clear, descriptive
2. **Description**: What happened?
3. **Steps to reproduce**: How to replicate?
4. **Expected behavior**: What should happen?
5. **Actual behavior**: What actually happened?
6. **Screenshots**: If applicable
7. **Environment**: OS, browser, Node version

## 💡 Suggesting Features

Create an issue with:

1. **Title**: Feature description
2. **Problem**: What problem does it solve?
3. **Solution**: How should it work?
4. **Alternative**: Any alternatives?
5. **Additional context**: Any other info?

## 📞 Questions?

- Check existing issues/discussions
- Ask in GitHub Discussions
- Create a new issue with `question` label

## 🙏 Thank You!

Your contributions make Elhegazi 2.0 better for everyone!

---

**Happy contributing! 🚀**
