# Responsive system master plan (inventory + rollout)

This document extends the mobile Favorites work and site audit with **everything that touches responsiveness**: global system, **all Mongoose models** (data surfaced in UI), and **all related UI source files** (components, pages, features, styles, entry).

---

## 1. Responsive system (how the app adapts today)

### 1.1 Viewport and HTML shell

| File | Role |
|------|------|
| [index.html](../index.html) | `meta viewport` (`width=device-width, initial-scale=1.0`), fonts, inline theme boot |

### 1.2 Tailwind and design tokens

| File | Role |
|------|------|
| [tailwind.config.ts](../tailwind.config.ts) | `content` globs, `container` (center, padding `2rem`, `2xl: 1400px`), extended colors (CSS variables), `fontFamily.cairo`, animations plugin |
| [src/index.css](../src/index.css) | Global CSS variables (`--primary`, RTL/base styles), layers used by Tailwind |

**Default breakpoints** (Tailwind): `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px.  
**App-specific convention**: [useDeviceDetection](#13-hooks-and-runtime-detection) treats **mobile as width &lt; 768** (aligned with `md`).

### 1.3 Hooks and runtime detection

| File | Role |
|------|------|
| [src/hooks/useDeviceDetection.ts](../src/hooks/useDeviceDetection.ts) | `isMobile` / `isTablet` / `isDesktop`, `screenSize`, touch/hover/pointer, `prefersReducedMotion`, resize listeners |
| [src/hooks/useAdvancedAnimations.ts](../src/hooks/useAdvancedAnimations.ts) | Uses `window.innerWidth` for motion math (affects large visuals) |

**Planned system hardening (optional):** single module `src/lib/responsive.ts` exporting breakpoint constants matching Tailwind + `useDeviceDetection`, documented for new pages.

### 1.4 App composition and routes

| File | Role |
|------|------|
| [src/App.tsx](../src/App.tsx) | `Routes`, lazy pages, `Layout` wrapper |
| [src/components/layout/Layout.tsx](../src/components/layout/Layout.tsx) | Admin vs storefront chrome |
| [src/components/layout/Navbar.tsx](../src/components/layout/Navbar.tsx) | Mobile menu, search, badges (RTL) |
| [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx) | Large footer; responsive columns |

### 1.5 Global / shared styles beyond Tailwind

| File | Role |
|------|------|
| [src/styles/animations.css](../src/styles/animations.css) | Animation utilities |
| [src/components/product/ProductCard.css](../src/components/product/ProductCard.css) | Card swiper / heart animations |
| [src/pages/CategoryPage.css](../src/pages/CategoryPage.css) | Category page-specific layout |

### 1.6 Client-side type “models” (TypeScript)

Domain shapes consumed by responsive lists/cards live mainly in [src/types/index.ts](../src/types/index.ts) (e.g. `Product`, `Category`, `CartItem`). These are not Mongo schemas but **every storefront/admin list layout** should respect these fields (long `nameAr`, images, etc.).

---

## 2. Server models (Mongoose) — all 23 files

All under [server/models/](../server/models/). These define **API payloads** that drive UI density (tables, cards, badges). None render UI directly; responsive work ties **which fields** show per breakpoint and **how** (truncate, sheet, card fallback).

| # | Model file | Typical UI consumers |
|---|------------|----------------------|
| 1 | `BackupJob.js` | Admin backup / import-export flows |
| 2 | `Branch.js` | Locations, maps, branch pickers |
| 3 | `BuilderAccessSession.js` | Shop builder access |
| 4 | `BuilderPricingConfig.js` | Builder pricing UI |
| 5 | `BuilderProject.js` | Shop builder projects list/editor |
| 6 | `Category.js` | Nav, category pages, filters, badges |
| 7 | `History.js` | Admin history |
| 8 | `HistoryRead.js` | Admin history read state |
| 9 | `HomeConfig.js` | Home page sections (sliders, promos) |
| 10 | `Order.js` | Checkout, orders, tracking, admin Orders |
| 11 | `OrderRating.js` | Order feedback flows |
| 12 | `Product.js` | Product grids, detail, cart, favorites, admin Products |
| 13 | `Product3D.js` | Admin 3D products, builder assets |
| 14 | `ProfitReport.js` | Admin Profit / reporting |
| 15 | `ProfitSettings.js` | Admin Profit settings |
| 16 | `Rating.js` | Product ratings, comments modals |
| 17 | `Return.js` | Returns, admin Returns |
| 18 | `Role.js` | Admin permissions |
| 19 | `Settings.js` | Site-wide toggles, pricing visibility |
| 20 | `ShopSetup.js` | Shop setup wizard |
| 21 | `Transaction.js` | Payments / financial UIs |
| 22 | `User.js` | Profile, admin Users, auth |
| 23 | `UserRole.js` | Admin user–role assignments |

*If new models are added under `server/models/`, append a row here in the same PR.*

---

## 3. Related UI files — full inventory by area

Paths are repo-relative (`src/...`). **Every file below is in scope** for a systematic responsive pass (layout, touch targets, overflow, RTL, optional `useDeviceDetection` split where justified).

### 3.1 Layout and shell

- `src/components/layout/Layout.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/FooterLink.tsx`
- `src/components/layout/FooterSection.tsx`
- `src/components/layout/SocialLinks.tsx`

### 3.2 Design system / UI primitives (`src/components/ui/`)

- `accordion.tsx`, `alert.tsx`, `alert-dialog.tsx`, `aspect-ratio.tsx`, `auth-modal.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `ContactButtons.tsx`, `context-menu.tsx`, `creative-slider.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `enhanced-scroll-animation.tsx`, `error-boundary.tsx`, `FavoriteButton.tsx`, `file-dropzone.tsx`, `form.tsx`, `HeroCTA.tsx`, `HeroSection.tsx`, `HeroStats.tsx`, `hover-card.tsx`, `image-upload.tsx`, `input.tsx`, `input-otp.tsx`, `interactive-background.tsx`, `interactive-slider.tsx`, `label.tsx`, `loading.tsx`, `Logo.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `notifications.tsx`, `pagination.tsx`, `parallax-section.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-animation.tsx`, `scroll-area.tsx`, `scroll-progress-bar.tsx`, `section-divider.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `sphere-3d-slider.tsx`, `stagger-animation.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `toggle.tsx`, `toggle-group.tsx`, `tooltip.tsx`, `visually-hidden.tsx`

**High-impact for mobile:** `sheet`, `drawer`, `dialog`, `table`, `sidebar`, `carousel`, `command`, forms (`input`, `select`, `button` sizes).

### 3.3 Home and marketing sections (`src/components/home/`)

- `AnimatedProductCard.tsx`, `BackgroundPattern.tsx`, `CategoriesDesktop.tsx`, `CategoriesMobile.tsx`, `CreativeCategoriesSlider.tsx`, `CreativeCategoriesSlider_CLEAN.tsx`, `CreativeProductsSlider.tsx`, `CreativeProductsSlider_NEW.tsx`, `EnhancedHeroSection.tsx`, `HeroNavigation.tsx`, `HeroSection.tsx`, `MobileHeroSection.tsx`, `ModernHeroSlider.tsx`, `NavigationControls.tsx`, `ProductCard.tsx`, `ProductsDesktop.tsx`, `ProductsMobile.tsx`, `PromoStrip.tsx`, `SlideContent.tsx`

### 3.4 Product and search

- `src/components/product/ProductCard.tsx` + `ProductCard.css`
- `src/components/product/EnhancedProductCard.tsx`
- `src/components/product/ProductsFilterBar.tsx`
- `src/components/product/Rating.tsx`
- `src/components/product/CommentsModal.tsx`
- `src/components/product/WhatsAppContactModal.tsx`
- `src/components/search/SearchSuggestions.tsx`

### 3.5 Cart and checkout

- `src/components/cart/CartSidebar.tsx`
- `src/components/checkout/AddressAutocomplete.tsx`
- `src/components/checkout/CheckoutWizard.tsx`
- `src/components/checkout/steps/CustomerInfoStep.tsx`
- `src/components/checkout/steps/PaymentStep.tsx`
- `src/components/checkout/steps/ReviewStep.tsx`
- `src/components/checkout/steps/ShippingStep.tsx`

### 3.6 Orders and returns

- `src/components/order/MobileOrderTracking.tsx`
- `src/components/order/OrderRating.tsx`
- `src/components/order/ReturnRequestForm.tsx`

### 3.7 Map

- `src/components/map/LeafletBranchMap.tsx`

### 3.8 Room planner (3D / 2D)

- `src/components/room-planner/Column.tsx`, `ColumnsPanel.tsx`, `ObjectControls.tsx`, `Room.tsx`, `RoomPlanner3D.tsx`, `RoomPlanner3D_v2.tsx`, `Shelf.tsx`, `ShelfColumnInsertModal.tsx`, `ShelvesPanel.tsx`, `ThreeDMovementController.tsx`, `Wall.tsx`, `Wall2DView.tsx`, `WallControls.tsx`, `Walls2DPlannerModal.tsx`, `WallsPanel.tsx`

### 3.9 Auth

- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/DualProtectedRoute.tsx`

### 3.10 Admin shared (`src/components/admin/`)

- `AdminHeader.tsx`, `AdminLayout.tsx`, `AdminSidebar.tsx`, `AdminSidebarEnhanced.tsx`, `AnalyticsDashboard.tsx`, `charts/OrdersChart.tsx`, `charts/RevenueChart.tsx`, `ComprehensiveEditModal.tsx`, `CustomerCommunicationDialog.tsx`, `DateRangeSelector.tsx`, `ModernStatCard.tsx`, `ModernTable.tsx`, `OrderCancellationDialog.tsx`, `OrderEditDialog.tsx`, `PartialRefundDialog.tsx`, `PermissionGuard.tsx`, `PNG3DConverter.tsx`, `ProductAnalyticsModal.tsx`, `ShopBuilderDefaultsModal.tsx`, `SmartProductSelector.tsx`, `StatCard.tsx`, `TabbedUploadModal.tsx`, `UnauthorizedAccess.tsx`
- **Home config modals:** `home-config/AboutContentModal.tsx`, `HeroDesignModal.tsx`, `HeroSlidesModal.tsx`, `ProductsManagementModal.tsx`, `PromoSeoModal.tsx`, `QuickActionsModal.tsx`, `SectionsManagementModal.tsx`, `SelectionModal.tsx`

### 3.11 Common / user

- `src/components/common/Logo.tsx`
- `src/components/common/SectionGuard.tsx`
- `src/components/user/DeliveryPreferences.tsx`

### 3.12 Feature module: shop builder (`src/features/shop-builder/`)

- `ShopBuilder3DPage.tsx`
- `store.tsx`, `types.ts`, `index.ts`
- `floorplan/FloorplanCanvas.tsx`, `floorplan/loadFloorplan.ts`
- `three/ThreeScene.tsx`, `three/proceduralProducts.ts`, `three/sampleModels.ts`
- `ui/BuilderToolbar.tsx`, `ui/Model3DPreview.tsx`, `ui/ProductPropertiesPanel.tsx`, `ui/SceneItemsList.tsx`
- `utils/fastCopySystems.ts`, `utils/layoutIO.ts`

*(Exclude `.bak` / backup fragments from implementation work.)*

### 3.13 Pages (`src/pages/`)

**Storefront / account**

- `Index.tsx`, `Products.tsx`, `ProductDetail.tsx`, `Categories.tsx`, `CategoryPage.tsx`, `Category.tsx`, `FeaturedProducts.tsx`, `BestSellers.tsx`, `SpecialOffers.tsx`, `LatestProducts.tsx`, `Cart.tsx`, `Checkout.tsx`, `ModernCheckout.tsx`, `EnhancedCheckout.tsx`, `Login.tsx`, `Register.tsx`, `LoginNew.tsx`, `RegisterNew.tsx`, `Profile.tsx`, `Orders.tsx`, `OrderHistory.tsx`, `OrderConfirmation.tsx`, `EnhancedOrderTracking.tsx`, `OrderTracking.tsx`, `PublicOrderTracking.tsx`, `Favorites.tsx`, `Returns.tsx`, `Addresses.tsx`, `PaymentMethods.tsx`, `About.tsx`, `Contact.tsx`, `Locations.tsx`, `ShopSetup.tsx`, `ShopBuilderIntro.tsx`, `ShopBuilderProjects.tsx`, `RatingMessage.tsx`, `ReturnPolicy.tsx`, `MyReturns.tsx`, `NotFound.tsx`

**Experimental / dev-only pages** (lower priority unless linked in production)

- `ThreeJSTest.tsx`, `ThreeJSTest2.tsx`, `ThreeJSVerification.tsx`, `MinimalThreeJS.tsx`, `RoomPlanner3DStable.tsx`, `RoomPlannerWelcome.tsx`, `SimpleRoom.tsx`

**Admin (`src/pages/admin/`)**

- `Analytics.tsx`, `Categories.tsx`, `Dashboard.tsx`, `History.tsx`, `HomeConfig.tsx`, `Locations.tsx`, `Login.tsx`, `Models3DAnalytics.tsx`, `Models3DCategories.tsx`, `Orders.tsx`, `OrderTracking.tsx`, `Products.tsx`, `Products3D.tsx`, `Profit.tsx`, `ProfitAnalytics.tsx`, `QRCodes.tsx`, `Returns.tsx`, `Settings.tsx`, `Shareholders.tsx`, `ShopAnalytics.tsx`, `Users.tsx`, `Users/PermissionsSection.tsx`

---

## 4. Routed vs unrouted pages (routing gaps)

Defined in [src/App.tsx](../src/App.tsx):

- **Lazy-imported but not mounted:** `Category`, `EnhancedCheckout` (verify before spending responsive effort).
- **Present on disk, no `Route` in `App.tsx`:** e.g. `ReturnPolicy.tsx`, `MyReturns.tsx`, `LoginNew.tsx`, `RegisterNew.tsx`, dev/ThreeJS pages — audit whether they should be linked or removed from scope.

---

## 5. Prioritized responsive work (recap)

### P0 — Storefront mobile fit

- [src/pages/Favorites.tsx](../src/pages/Favorites.tsx): stacked header/toolbar, `compactMobile` on cards, category label resolution (categories API map).
- [src/pages/Cart.tsx](../src/pages/Cart.tsx), [src/pages/ModernCheckout.tsx](../src/pages/ModernCheckout.tsx): sticky summary / step UX on small screens.
- [src/features/shop-builder/ShopBuilder3DPage.tsx](../src/features/shop-builder/ShopBuilder3DPage.tsx) + `ui/BuilderToolbar.tsx`, `ProductPropertiesPanel.tsx`: bottom sheets / collapsible tools.

### P1 — Shell and high-traffic lists

- `Navbar.tsx`, `Footer.tsx`, `Products.tsx`, `CategoryPage.tsx`, `Index.tsx` (home assemblies).

### P2 — Admin

- `AdminLayout.tsx`, `AdminSidebar.tsx`, `ModernTable.tsx`, heavy pages: `admin/Orders.tsx`, `admin/Products.tsx`, `admin/Users.tsx`, `admin/Settings.tsx`.

### P3 — Modals and overlays

- All `*Modal.tsx`, `*Dialog.tsx` under `components/admin` and `components/product` — max-height, scroll, safe-area padding on mobile.

---

## 6. Definition of done (per surface)

- No unintended horizontal scroll at 320–430px width (RTL).
- Interactive targets ≥ 44×44px where possible; forms usable with on-screen keyboard.
- No feature removal: alternate layout (stack, sheet, tabs) instead of hiding business actions.
- Tables: scroll affordance or card fallback on small breakpoints.
- Respect `prefers-reduced-motion` where motion is decorative (hook already exposed in `useDeviceDetection`).

---

## 7. Maintenance

When adding a new **page**, **feature module**, or **Mongo model** that surfaces in UI, append it to sections **2**, **3**, or **5** of this file in the same PR.

---

*Generated for the Arabian Blue Bloom / storefront codebase. Inventory paths reflect repository layout at time of writing.*
