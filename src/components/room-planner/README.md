# Modern Room Planner

A modern, light-themed 3D room planner with simplified architecture and improved user experience.

## Features

- **Modern Light Theme**: Clean, minimalist design with a focus on usability
- **Modular Architecture**: Code split into reusable hooks and components
- **3D Room Visualization**: Interactive 3D room planning with Three.js
- **2D Wall Editing**: Precise shelf and column placement with drag-and-drop
- **Reset to Default**: One-click reset to default 4-wall configuration
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

The room planner is organized into the following modules:

### Components
- `Room.tsx` - Main 3D room visualization
- `Wall.tsx` - Individual wall rendering
- `Shelf.tsx` - Shelf objects
- `Column.tsx` - Column objects
- `Wall2DViewModern.tsx` - Modern 2D wall editing interface
- `WallControls.tsx` - Wall manipulation controls
- `WallDimensionPreview.tsx` - Wall dimension preview
- `ThreeDMovementController.tsx` - 3D object movement controls

### Hooks
- `useRoomPlanner.ts` - Main state management and business logic
- `useRoomPlannerHandlers.ts` - Event handlers and UI interactions

### Constants
- `constants.ts` - Preconfigured items and default configurations

### Styling
- `RoomPlannerModern.css` - Modern, light-themed styling

## Usage

To use the modern room planner in your application:

```tsx
import { RoomPlannerModern } from '@/pages';

function App() {
  return (
    <RoomPlannerModern />
  );
}
```

## Key Improvements

1. **Simplified Code Structure**: 
   - Split large component into smaller, focused hooks
   - Improved maintainability and readability

2. **Modern Design**:
   - Clean, light color scheme
   - Improved typography and spacing
   - Consistent component styling

3. **Enhanced Functionality**:
   - Reset to default walls button
   - Better 2D wall editing experience
   - Improved drag-and-drop interactions

4. **Performance**:
   - Optimized rendering
   - Efficient state management
   - Code splitting for faster loading

## Customization

To customize the styling, modify `RoomPlannerModern.css`. The CSS uses a consistent naming convention:

- `.room-planner-modern` - Root container
- `.card` - Card components
- `.button` - Button elements
- `.form-group` - Form sections
- `.grid-*` - Grid layouts

## Future Enhancements

Planned improvements:
- Full 2D mode implementation
- Advanced object management
- Export and sharing features
- Additional furniture types