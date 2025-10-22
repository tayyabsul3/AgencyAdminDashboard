# Modals Directory

This directory contains reusable modal components for the article view page.

## Best Practices Applied

### 1. **Component Separation**
Each modal is extracted into its own file for better maintainability and testability.

### 2. **Single Responsibility Principle**
Each component focuses on one specific feature:
- `InsertSectionImagesModal.jsx` - Handles section image selection and generation UI

### 3. **Clear Props Interface**
All components have well-documented props with JSDoc comments:
```javascript
/**
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Array} props.sections - List of article sections
 * // ... etc
 */
```

### 4. **State Management Location**
- **Component State**: UI-specific state (hover effects, internal animations)
- **Parent State**: Business logic state (selected sections, generation progress)
- **Props**: Communication between parent and child

### 5. **Consistent Design System**
All modals follow the glassmorphic design system:
- Purple gradient backgrounds (103, 58, 183 → 156, 39, 176)
- Glass surfaces with blur effects
- Smooth transitions with cubic-bezier easing
- Custom scrollbar styling
- Consistent spacing and typography scale

## Usage Example

```javascript
import InsertSectionImagesModal from './components/modals/InsertSectionImagesModal';

function ArticlePage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedSections, setSelectedSections] = useState([]);
  
  return (
    <InsertSectionImagesModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      sections={extractArticleSections()}
      selectedSections={selectedSections}
      onSelectionChange={setSelectedSections}
      onGenerate={handleGenerate}
      isGenerating={false}
      progress={0}
    />
  );
}
```

## File Structure Benefits

```
view/
├── components/
│   └── modals/
│       ├── InsertSectionImagesModal.jsx  (Clean, focused component)
│       └── README.md                      (Documentation)
├── hooks/                                 (Custom hooks)
├── utils/                                 (Helper functions)
└── page.js                                (Main page - now ~290 lines shorter!)
```

## Reduced Bloat

### Before:
- `page.js`: ~7,660 lines
- Inline modal: ~290 lines of JSX

### After:
- `page.js`: ~7,370 lines (-290 lines, 3.8% reduction)
- Component usage: 10 lines
- `InsertSectionImagesModal.jsx`: 476 lines (reusable, testable, documented)

## Why This Matters

1. **Readability**: Main page is cleaner and easier to navigate
2. **Maintainability**: Changes to modal don't affect main page
3. **Testability**: Modal can be tested in isolation
4. **Reusability**: Can be used in other parts of the app
5. **Performance**: Can be code-split/lazy loaded if needed
6. **Team Collaboration**: Multiple devs can work on different modals without conflicts

## Official React/Next.js Best Practices Followed

✅ **Component Composition** - Building UIs from smaller, reusable pieces  
✅ **Props Drilling Prevention** - Clear data flow through well-defined interfaces  
✅ **Single Source of Truth** - State managed in appropriate locations  
✅ **Separation of Concerns** - UI logic separated from business logic  
✅ **Co-location** - Related code kept together in meaningful directories  
✅ **Documentation** - JSDoc comments for better IDE support  
✅ **Consistent Naming** - Clear, descriptive component and prop names  

## Future Modals

When creating new modals, follow this structure:
1. Create in `components/modals/[FeatureName]Modal.jsx`
2. Add JSDoc documentation
3. Export as default
4. Import and use in parent component
5. Keep business logic in parent, UI logic in component
