# 🏪 Elhegazi 2.0 - Advanced Shop Builder Platform

A modern, full-stack e-commerce platform with 3D shop visualization, real-time product management, and advanced analytics.

## ✨ Features

### 🎨 Frontend
- **React 18** with TypeScript for type safety
- **Vite** for lightning-fast development
- **Tailwind CSS** for responsive design
- **shadcn-ui** for beautiful components
- **Three.js** for 3D shop visualization
- **Real-time preview** and interactive builder
- **Mobile-responsive** design

### 🔧 Backend
- **Express.js** REST API
- **MongoDB** with Mongoose ORM
- **Authentication & Authorization** (RBAC)
- **File uploads** via Cloudinary
- **Email notifications** via Gmail SMTP
- **Rate limiting** and security headers
- **Compression** and caching

### 📊 Key Capabilities
- ✅ 3D shop builder with interactive camera
- ✅ Product management with images
- ✅ Order management system
- ✅ Real-time analytics dashboard
- ✅ User roles and permissions
- ✅ Email notifications
- ✅ PDF/Excel exports
- ✅ QR code generation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([install with nvm](https://github.com/nvm-sh/nvm))
- npm or yarn
- MongoDB Atlas account (free tier available)
- Cloudinary account (free tier available)

### Installation

```bash
# 1. Clone the repository
git clone git@github.com:M7mod-hegazy/Elhegazi-2.0.git
cd Elhegazi-2.0

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp server/.env.example server/.env
# Edit server/.env with your credentials

# 4. Start development server
npm run dev:full
# Or run separately:
# Terminal 1: npm run server:dev
# Terminal 2: npm run dev
```

### Development URLs
- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:4000
- **API**: http://localhost:4000/api

## 📋 Environment Variables

Create `server/.env` file:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=appdb

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server
PORT=4000
NODE_ENV=development

# Email (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Admin (optional)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password
```

## 📁 Project Structure

```
.
├── src/                    # Frontend (React)
│   ├── pages/             # Page components
│   ├── features/          # Feature modules
│   ├── components/        # Reusable components
│   ├── hooks/             # Custom React hooks
│   ├── context/           # Context providers
│   ├── lib/               # Utilities
│   └── App.tsx            # Main app component
│
├── server/                # Backend (Express)
│   ├── models/            # MongoDB schemas
│   ├── services/          # Business logic
│   ├── rbac/              # Role-based access control
│   ├── templates/         # Email templates
│   └── index.js           # Express server
│
├── public/                # Static assets
├── package.json           # Dependencies
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind configuration
└── tsconfig.json          # TypeScript configuration
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start frontend dev server
npm run server:dev       # Start backend with auto-reload
npm run dev:full        # Start both frontend and backend

# Production
npm run build           # Build frontend for production
npm run preview         # Preview production build
npm run server          # Start backend server

# Utilities
npm run lint            # Run ESLint
npm run build:dev       # Build in development mode
```

## 🌐 Deployment

### Railway.app (Recommended)
Deploy full stack (frontend + backend) on Railway's free tier:

```bash
# 1. Push to GitHub
git push origin main

# 2. Sign up on railway.app
# 3. Connect your GitHub repository
# 4. Add environment variables
# 5. Deploy!
```

**Expected cost**: $0-5/month (within free tier)

### Vercel (Frontend Only)
Deploy frontend on Vercel, backend on Railway/Render:

```bash
# Frontend only
npm run build
# Deploy dist/ folder to Vercel
```

## 📚 API Documentation

### Authentication
All API requests require `x-user-id` header:
```bash
curl -H "x-user-id: user_id" http://localhost:4000/api/products
```

### Key Endpoints
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/analytics` - Get analytics
- `POST /api/shop-setup` - Setup shop

## 🔐 Security

- ✅ Environment variables for secrets
- ✅ Helmet.js for security headers
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input validation
- ✅ Role-based access control (RBAC)

## 🐛 Troubleshooting

### MongoDB Connection Error
- Verify MongoDB URI in `.env`
- Add your IP to MongoDB Atlas Network Access
- Check credentials

### Cloudinary Upload Error
- Verify API keys in `.env`
- Check Cloudinary account settings
- Ensure CORS is enabled

### Email Not Sending
- Use Gmail App Password (not regular password)
- Enable "Less secure apps" if needed
- Check EMAIL_USER and EMAIL_PASSWORD

## 📞 Support

For issues or questions:
1. Check existing GitHub issues
2. Create a new issue with details
3. Include error messages and steps to reproduce

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

Built with:
- React & TypeScript
- Express.js
- MongoDB
- Three.js
- Tailwind CSS
- shadcn-ui

---

**Happy coding! 🚀**
