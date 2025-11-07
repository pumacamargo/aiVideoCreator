# Layout Guidelines

This document outlines the layout guidelines for the application, based on the structure of the 'Script' step.

## Main Content Container

The main container for each step's content should have the following properties:

- **Centering:** The container should be centered on the page.
- **Maximum Width:** The container should have a maximum width of `1400px`.
- **Flexbox Layout:** The container should use flexbox with a column direction to stack its children vertically.
- **Left Alignment:** The children of the container should be aligned to the left.

**Example CSS:**

```css
{
  width: '100%',
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start'
}
```

## Sections

Each distinct part of a step's content should be wrapped in a section `div`.

- **Width:** The section should take up the full width of its parent container.
- **Spacing:** The section should have a bottom margin of `20px` to create space between sections.

**Example CSS:**

```css
{
  width: '100%',
  marginBottom: '20px'
}
```

## Section Titles

Each section should have a title using an `h3` tag.

- **Color:** The title should be blue (`#007bff`).
- **Spacing:** The title should have a bottom margin of `10px`.
- **Alignment:** The title should be left-aligned.

**Example CSS:**

```css
{
  color: '#007bff',
  marginBottom: '10px',
  textAlign: 'left'
}
```

## Content within Sections

Content within a section (e.g., input fields, buttons) should be wrapped in a `div` with the following properties:

- **Flexbox Layout:** The container should use flexbox to align its children.
- **Alignment:** The children should be vertically centered.
- **Spacing:** The children should have a gap of `10px` between them.
- **Width:** The container should take up the full width of its parent.

**Example CSS:**

```css
{
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%'
}
```
