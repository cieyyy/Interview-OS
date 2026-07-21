# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Interview OS
**Generated:** 2026-07-21 11:46:37
**Category:** B2B Service
**Design Dials:** Variance 3/10 (Structured Spatial) | Motion 2/10 (Subtle) | Density 7/10 (Compact Workspace)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#087CF0` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#586B82` | `--color-secondary` |
| Accent/CTA | `#0567CD` | `--color-accent` |
| Background | `#EAF3FF` | `--color-background` |
| Foreground | `#0B1930` | `--color-foreground` |
| Muted | `#E2F0FF` | `--color-muted` |
| Border | `rgba(73,118,168,.22)` | `--color-border` |
| Destructive | `#B42318` | `--color-destructive` |
| Ring | `#087CF0` | `--color-ring` |

**Color Notes:** Spatial light-blue field + translucent white surfaces + blue focus/action + independent green/amber/red semantic states.

### Typography

- **Heading Font:** Microsoft YaHei UI
- **Body Font:** Microsoft YaHei UI
- **Fallback:** Microsoft YaHei → Segoe UI Variable Text → Segoe UI
- **Supported Weights:** 400 / 600 / 700 only
- **Mood:** spatial, calm, precise, readable, professional

| Token | Size | Usage |
|-------|------|-------|
| `--font-xs` | `11px` | Captions, metadata, status hints |
| `--font-sm` | `12px` | Labels, compact buttons, secondary text |
| `--font-body` | `13px` | Body copy, navigation, inputs and tables |
| `--font-md` | `15px` | Card and group titles |
| `--font-lg` | `17px` | Panel titles and prominent controls |
| `--font-xl` | `22px` | Feature titles and major values |
| `--font-page` | `28px` | Page titles |

- Use semantic tokens instead of hard-coded component font sizes.
- Body and form content uses a minimum line-height of `1.5`; dense labels use at least `1.3`.
- Use `600` for labels and controls, `700` for headings, and `400` for long-form body copy.
- Keep letter spacing at `0` for Chinese UI text.

**CSS Import:**
```css
font-family: "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI Variable Text", "Segoe UI", sans-serif;
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #087CF0;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #0567CD;
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #075EAD;
  border: 1px solid rgba(8,124,240,.2);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: rgba(255,255,255,.76);
  border: 1px solid rgba(73,118,168,.22);
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.card:hover {
  border-color: #C7D0D8;
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: var(--font-body);
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #475569;
  outline: none;
  box-shadow: 0 0 0 3px #47556920;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Spatial UI (VisionOS-inspired) with disciplined enterprise typography

**Keywords:** floating translucent surfaces, layered depth, soft blue spatial field, readable glass, stable grid, visible focus

**Best For:** Desktop productivity tools, knowledge bases, interview training, enterprise workflows

**Key Effects:** translucent surfaces, 18-24px background blur, blue-tinted borders, soft depth shadows, 8px radii, 200ms state transitions, solid-color fallback

### Page Pattern

**Pattern Name:** Desktop Knowledge and Training Workspace

- **Workflow Strategy:** Persistent sidebar, stable top status bar, content-first work area, explicit system feedback.
- **CTA Placement:** One primary action per page header; secondary commands remain visually subordinate.
- **Section Order:** 1. Page context, 2. primary working surface, 3. supporting evidence or history, 4. contextual status and recovery actions.

---

## Motion

**Page Transition** (Subtle) — Trigger: route change | Duration: 200-300ms | Easing: `power1.inOut`

```js
gsap.to(main, { opacity: 0, duration: 0.2, onComplete: () => { navigate(); gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.2 }); } });
```

**Framework notes:** Pair with the router's transition hooks (Next.js App Router transitions, React Router's useNavigate, Vue Router's beforeEach/afterEach)

- ✅ Preload the destination route's critical assets before the exit tween finishes
- ❌ Don't block navigation on animation; cap exit duration at ~250ms so the app never feels unresponsive
- ⚡ Exit animation should always resolve faster than entrance (asymmetric timing) so back/forward feels snappy

---

## Anti-Patterns (Do NOT Use)

- ❌ Playful design
- ❌ Hidden credentials
- ❌ AI purple/pink gradients

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
