# Design Principles

This document outlines the UI/UX design principles and patterns used throughout the application. Follow these guidelines to maintain visual consistency across all components.

---

## Table of Contents

1. [Color System](#color-system)
2. [Border Radius](#border-radius)
3. [Spacing](#spacing)
4. [Typography](#typography)
5. [Component Patterns](#component-patterns)
6. [Icons](#icons)
7. [Animations & Transitions](#animations--transitions)
8. [General Philosophy](#general-philosophy)

---

## Color System

### Gray Scale (Primary UI Colors)

| Token | Usage |
|-------|-------|
| `gray-50` | Backgrounds for badges, code blocks, table headers, subtle fills |
| `gray-100` | Hover states, subtle dividers, table row dividers |
| `gray-200` | Borders for cards, badges, inputs, containers |
| `gray-300` | Hover borders (e.g., card hover states) |
| `gray-400` | Muted icons, placeholder text, secondary icons |
| `gray-500` | Secondary text, labels, descriptions |
| `gray-600` | Body text, icon hover states |
| `gray-700` | Primary text in badges, labels, form labels |
| `gray-900` | Headings, primary text, titles |

### Accent Colors

| Color | Usage |
|-------|-------|
| `blue-500` | Primary accent for icons in badges, active states |
| `blue-600` | Icon emphasis in analytics cards |
| `blue-50` | Background for icon containers |
| `green-500` | Success states, connected status, checkmarks |
| `amber-50` | Warning/tip backgrounds |
| `amber-100` | Warning/tip borders |
| `amber-500` | Warning icons |
| `amber-700` | Warning text |
| `red-50` | Destructive hover backgrounds |
| `red-600` | Destructive text/icons on hover |
| `purple-500` | Secondary accent for alternative content types |

### Background Colors

- **Cards & Containers**: `bg-white`
- **Subtle fills**: `bg-gray-50`
- **Warning/Tip boxes**: `bg-amber-50`
- **Icon containers**: `bg-blue-50`

---

## Border Radius

### Hierarchy

| Element Type | Border Radius | Usage |
|--------------|---------------|-------|
| **Containers** | `rounded-xl` | Cards, modals, dialogs, popovers, dropdowns, command palettes |
| **Inner Items** | `rounded-lg` | Badges, buttons, list items, code blocks, table containers, avatars, input fields, menu items |
| **Small Elements** | `rounded-md` or `rounded` | Rarely used, avoid for consistency |

### Examples

```tsx
// Card container
<Card className="rounded-xl border-gray-200" />

// Badge inside card
<Badge className="rounded-lg bg-gray-50 border-gray-200" />

// Dropdown menu
<DropdownMenuContent className="rounded-xl border-gray-200" />

// Menu item inside dropdown
<DropdownMenuItem className="rounded-lg" />
```

---

## Spacing

### Padding Standards

| Component | Padding |
|-----------|---------|
| **Badges** | `py-1.5 px-2.5` |
| **Cards** | `px-5 py-4` |
| **Modal content** | `gap-4` between sections |
| **Info boxes** | `p-3` or `px-3 py-2.5` |
| **Table cells** | `px-4 py-3` |
| **Table headers** | `px-4 py-2.5` |

### Gap Standards

| Context | Gap |
|---------|-----|
| Icon to text in badges | `mr-1.5` on icon |
| Items in a flex row | `gap-2` or `gap-2.5` |
| Form fields | `gap-2` (label to input), `gap-4` (between fields) |
| Stacked content | `space-y-4` |

---

## Typography

### Font Weights

| Usage | Weight |
|-------|--------|
| Headings, titles | `font-medium` or `font-semibold` |
| Badge text | `font-medium` |
| Body text | `font-normal` |
| Labels | `font-medium` |

### Font Sizes

| Element | Size |
|---------|------|
| Badge text | `text-xs` |
| Body text | `text-sm` |
| Secondary/muted text | `text-xs` or `text-sm` |
| Headings in modals | Default (inherits from DialogTitle) |
| Table headers | `text-xs` |

### Text Colors

| Purpose | Color |
|---------|-------|
| Primary text | `text-gray-900` |
| Badge labels | `text-gray-700` |
| Secondary text | `text-gray-500` |
| Muted/tertiary text | `text-gray-400` |
| Warning text | `text-amber-700` |

---

## Component Patterns

### Badges

Standard badge pattern used throughout the application:

```tsx
<Badge
  variant="outline"
  className="rounded-lg py-1.5 px-2.5 bg-gray-50 border-gray-200 font-normal hover:bg-gray-100 transition-colors"
>
  <IconComponent className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
  <span className="text-gray-700 font-medium text-xs">Label</span>
</Badge>
```

**Key properties:**
- `variant="outline"` - always use outline variant
- `rounded-lg` - consistent border radius
- `py-1.5 px-2.5` - standard padding
- `bg-gray-50 border-gray-200` - subtle background with visible border
- Icon: `h-3.5 w-3.5 mr-1.5` with colored accent (e.g., `text-blue-500`)
- Text: `text-gray-700 font-medium text-xs`

### Cards

```tsx
<Card className="rounded-xl border-gray-100 hover:border-gray-200 transition-colors">
  {/* Card content */}
</Card>
```

**Key properties:**
- `rounded-xl` - container-level radius
- `border-gray-100` - subtle default border
- `hover:border-gray-200` - slightly darker on hover
- `transition-colors` - smooth hover effect

### Modals & Dialogs

```tsx
<DialogContent className="rounded-xl border-gray-200 bg-white">
  <DialogHeader>
    <DialogTitle className="text-gray-900">Title</DialogTitle>
    <DialogDescription className="text-gray-500">
      Description text
    </DialogDescription>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

### Dropdowns & Popovers

```tsx
// Container
<DropdownMenuContent className="rounded-xl border-gray-200 bg-white p-1.5 shadow-lg">

  // Items
  <DropdownMenuItem className="rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700">
    <Icon className="h-4 w-4 mr-2 text-gray-400" />
    Item Label
  </DropdownMenuItem>

  // Separator
  <DropdownMenuSeparator className="bg-gray-100" />

  // Label
  <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-medium text-gray-400">
    Section Label
  </DropdownMenuLabel>
</DropdownMenuContent>
```

### Info/Tip Boxes

```tsx
// Warning/Tip style
<div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
  <p className="text-xs text-amber-700">
    Tip content here
  </p>
</div>

// Neutral info style
<div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
  <p className="font-medium mb-1 text-gray-700">Title</p>
  <p>Description text</p>
</div>
```

### Code Blocks / Copyable Values

```tsx
<code className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
  {value}
</code>
```

### Tables

```tsx
<div className="rounded-lg border border-gray-200 overflow-hidden">
  <table className="min-w-full divide-y divide-gray-100">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
          Header
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-100">
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-700">
          Cell content
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Buttons

**Ghost buttons (icon only):**
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7 text-gray-400 hover:text-gray-600"
>
  <Icon className="h-3.5 w-3.5" />
</Button>
```

**Destructive ghost buttons:**
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

### Inputs with Icons

```tsx
<div className="relative">
  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
  <Input className="pl-10" placeholder="Placeholder text" />
</div>
```

---

## Icons

### Sizing Standards

| Context | Icon Size |
|---------|-----------|
| Inside badges | `h-3.5 w-3.5` |
| Inside buttons (icon-only, small) | `h-3.5 w-3.5` |
| Inside buttons (icon-only, medium) | `h-4 w-4` |
| Inside menu items | `h-4 w-4` |
| Inside inputs | `h-4 w-4` |
| Analytics card icons | `h-5 w-5` (inside `h-8 w-8` container) |

### Icon Colors by Context

| Context | Color |
|---------|-------|
| Primary action/link icons | `text-blue-500` |
| Success/connected | `text-green-500` |
| Warning/pending | `text-amber-500` |
| Alternative/secondary type | `text-purple-500` |
| Neutral/muted | `text-gray-400` |
| Hover state | `text-gray-600` |

### Icon Containers (for emphasis)

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
  <Icon className="h-5 w-5 text-blue-600" />
</div>
```

---

## Animations & Transitions

### Standard Transitions

| Property | Value |
|----------|-------|
| Color transitions | `transition-colors` |
| General transitions | `transition-all` with `duration-200` |

### Hover Effects

- **Cards**: Border color change (`border-gray-100` → `border-gray-200`)
- **Badges**: Background color change (`bg-gray-50` → `bg-gray-100`)
- **Buttons**: Color and background change
- **Menu items**: Background highlight (`bg-gray-100`)

### Avoid

- Unnecessary Framer Motion animations for simple UI elements
- Complex staggered animations in modals
- Animations that slow down perceived performance

---

## General Philosophy

### Simplicity First

- Remove unnecessary UI elements and text
- Condense information where possible
- Avoid verbose instructions - trust users to understand
- Show information contextually (e.g., DNS setup shown after domain is added)

### Consistency Over Creativity

- Use established patterns rather than creating new ones
- Same component types should look identical across pages
- When in doubt, reference existing implementations

### Visual Hierarchy

1. **Containers** get `rounded-xl` and subtle borders (`border-gray-100/200`)
2. **Inner elements** get `rounded-lg` and same border treatment
3. **Text** follows gray scale: `900` → `700` → `500` → `400`
4. **Accents** use brand colors sparingly (blue-500, green-500, amber-500)

### Accessibility Considerations

- Maintain sufficient color contrast
- Use semantic HTML elements
- Provide hover/focus states
- Keep interactive elements at minimum 44x44px touch targets

### Dark Mode

- Currently not prioritized - focus on light mode consistency
- Remove orphaned `dark:` classes for cleaner code
- When implementing, follow same gray scale hierarchy

---

## Quick Reference

### The Badge Formula
```
rounded-lg + py-1.5 px-2.5 + bg-gray-50 + border-gray-200 + icon(h-3.5 w-3.5 mr-1.5 text-{color}-500) + text(text-gray-700 font-medium text-xs)
```

### The Container Formula
```
rounded-xl + border-gray-200 + bg-white + shadow-sm/lg (for elevated elements)
```

### The Inner Item Formula
```
rounded-lg + text-sm/text-xs + text-gray-700 + hover:bg-gray-100
```

### Color Progression (light to dark)
```
bg: white → gray-50 → gray-100
border: gray-100 → gray-200 → gray-300
text: gray-400 → gray-500 → gray-700 → gray-900
```
