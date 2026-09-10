---
version: 2.0
name: Chatlas-Project-Design-System
description: A project-wide visual and interaction system for Chatlas, a Melaka tourism exploration community Progressive Web App. This design system preserves the approved search-and-filter page direction: a white navigation bar, a large deep-green discovery hero, an integrated search field with an amber Search button, a pale neutral content background, pill-shaped filters, and photography-led attraction cards. It is intended to keep all six Chatlas modules visually consistent without copying Airbnb branding or marketplace/booking patterns.

project:
  name: Chatlas
  platform: Progressive Web App
  initial-region: Melaka, Malaysia
  modules:
    - User Management
    - Attraction Explorer
    - Review & Community
    - Exploration Map
    - Social Profile
    - Personal Collection

visual-principles:
  - Preserve the approved white, deep-green, light-green, and amber visual direction.
  - Use clean layouts, generous whitespace, rounded components, and restrained shadows.
  - Let attraction photography and maps provide most of the visual emphasis.
  - Keep the interface friendly and suitable for tourists, but realistic for a student-built PWA.
  - Use one consistent component language across every module.
  - Do not introduce booking, payment, pricing, reservation, ticketing, or marketplace patterns.
  - Do not redesign the approved Search and Filter page into a separate search-results product flow.

colors:
  primary: "#006C56"
  primary-hover: "#005E4B"
  primary-active: "#004D3E"
  primary-dark: "#004638"
  primary-deep: "#00372C"
  primary-soft: "#E6F7F0"
  primary-soft-strong: "#CDF5E5"
  primary-muted: "#61AD9F"

  action-accent: "#FFAB00"
  action-accent-hover: "#E89B00"
  action-accent-active: "#CF8900"
  action-accent-soft: "#FFF3D6"
  on-action-accent: "#142033"

  canvas: "#FFFFFF"
  page-background: "#F7F9FB"
  surface-card: "#FFFFFF"
  surface-soft: "#F1F6F4"
  surface-selected: "#E3F4EE"
  surface-disabled: "#EFF2F4"

  ink: "#10213B"
  body: "#405066"
  muted: "#65748A"
  muted-soft: "#98A2B3"
  inverse-text: "#FFFFFF"

  border: "#D8E1E7"
  border-strong: "#BBC8D0"
  divider: "#E8EDF1"

  rating-star: "#FFAB00"
  success: "#16845B"
  warning: "#B7791F"
  error: "#C2413B"
  info: "#2F6DA1"
  scrim: "#000000"

color-usage:
  primary:
    use-for:
      - brand wordmark
      - hero backgrounds
      - active filter chips
      - main navigation active state
      - map markers and progress indicators
      - selected and confirmed states
  action-accent:
    use-for:
      - Search button
      - small high-attention actions inside the discovery flow
      - rating star icons
    restrictions:
      - Do not use amber as a large page background.
      - Do not use amber for destructive or error states.
  primary-soft:
    use-for:
      - card image placeholders
      - selected backgrounds
      - empty states
      - subtle module sections

font:
  family: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  note: Use Inter throughout the project. Do not require Airbnb Cereal or other proprietary fonts.

typography:
  display-xl:
    fontSize: 46px
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: -0.8px
    use: Main desktop hero heading
  display-lg:
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.24
    letterSpacing: -0.4px
    use: Main page title
  display-md:
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.2px
    use: Section heading
  title-lg:
    fontSize: 21px
    fontWeight: 650
    lineHeight: 1.35
    use: Card groups and profile headings
  title-md:
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.35
    use: Card title and navigation label
  body-lg:
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
    use: Hero support copy
  body-md:
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
    use: Default text
  body-sm:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    use: Card metadata and helper text
  caption:
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    use: Counts, timestamps, and secondary labels
  button-md:
    fontSize: 15px
    fontWeight: 650
    lineHeight: 1.3
    use: Buttons and filter chips

rounded:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 18px
  xl: 24px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  base: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

layout:
  max-content-width: 1120px
  wide-content-width: 1200px
  desktop-gutter: 38px
  tablet-gutter: 24px
  mobile-gutter: 16px
  nav-height-desktop: 68px
  nav-height-mobile: 60px
  desktop-breakpoint: 1128px
  tablet-breakpoint: 744px
  card-grid-desktop: 3 columns
  card-grid-tablet: 2 columns
  card-grid-mobile: 1 column

shadow:
  card-rest: "0 1px 2px rgba(16, 33, 59, 0.04)"
  card-hover: "0 8px 22px rgba(16, 33, 59, 0.10)"
  floating-panel: "0 12px 32px rgba(16, 33, 59, 0.16)"
  principle: Use no more than these three shadow levels. Most surfaces should remain flat.

components:
  top-navigation:
    height: 68px
    backgroundColor: "{colors.canvas}"
    borderBottom: "1px solid {colors.divider}"
    logoColor: "{colors.primary}"
    logoTypography: "{typography.title-lg}"
    guest-layout:
      left: Chatlas wordmark
      right:
        - Attractions navigation link
        - Sign in with Google outline button
    authenticated-layout:
      left: Chatlas wordmark
      center-or-right:
        - Attractions
        - Community
        - Exploration Map
        - Personal Collection
      user-area:
        - circular profile avatar
        - dropdown menu
    mobile-layout:
      left: Chatlas wordmark
      right:
        - search or current-page action when necessary
        - profile avatar or menu button

  hero-discovery:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.inverse-text}"
    paddingDesktop: "54px 0 58px"
    paddingMobile: "36px 0 40px"
    contentMaxWidth: 760px
    eyebrowStyle: "{typography.title-md}"
    headingStyle: "{typography.display-xl}"
    bodyStyle: "{typography.body-lg}"
    note: Preserve the approved hero and integrated search layout from the reference page.

  search-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    heightDesktop: 52px
    heightMobile: 50px
    border: "1px solid rgba(255,255,255,0.35)"
    inputPadding: "0 18px"
    button:
      backgroundColor: "{colors.action-accent}"
      hoverColor: "{colors.action-accent-hover}"
      activeColor: "{colors.action-accent-active}"
      textColor: "{colors.on-action-accent}"
      typography: "{typography.button-md}"
      minWidth: 92px
      roundedRight: "{rounded.md}"
    behavior:
      - Search updates the attraction list within the same page or moves focus to the results section.
      - Do not require a separate Search Results page.

  button-primary-green:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.inverse-text}"
    rounded: "{rounded.sm}"
    height: 46px
    padding: "12px 20px"
  button-accent:
    backgroundColor: "{colors.action-accent}"
    textColor: "{colors.on-action-accent}"
    rounded: "{rounded.sm}"
    height: 46px
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary-dark}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.sm}"
    height: 46px
    padding: "12px 20px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.inverse-text}"
    rounded: "{rounded.sm}"
    height: 46px
    padding: "12px 20px"
  icon-button:
    size: 40px
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.full}"

  filter-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.full}"
    height: 36px
    padding: "8px 15px"
  filter-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.inverse-text}"
    border: "1px solid {colors.primary}"
  filter-menu:
    desktop: anchored popover or right-side drawer
    mobile: bottom sheet
    surface: "{colors.canvas}"
    rounded: "{rounded.lg}"
    shadow: "{shadow.floating-panel}"
    standardActions:
      - Apply
      - Reset
      - Close

  attraction-card:
    backgroundColor: "{colors.surface-card}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    shadowRest: "{shadow.card-rest}"
    shadowHover: "{shadow.card-hover}"
    imageAspectRatio: "4 / 3"
    imagePlaceholder: "{colors.primary-soft-strong}"
    bodyPadding: 16px
    requiredContent:
      - attraction photo or placeholder
      - attraction name
      - category
      - location or address summary
      - rating when available
    optionalContent:
      - review count supplied by Review & Community module
      - save/favourite control supplied by Personal Collection module
    note: Cross-module actions must not be treated as Attraction Explorer-owned functions.

  standard-card:
    backgroundColor: "{colors.surface-card}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 20px

  detail-section:
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    paddingDesktop: 24px
    paddingMobile: 18px

  photo-gallery:
    rounded: "{rounded.lg}"
    gap: 8px
    thumbnailRadius: "{rounded.sm}"
    placeholderColor: "{colors.primary-soft-strong}"
    enlargedView: full-screen modal lightbox with dark scrim

  map-container:
    backgroundColor: "{colors.surface-soft}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    minHeightDesktop: 420px
    minHeightMobile: 320px
    markerColor: "{colors.primary}"
    infoCard: "{components.standard-card}"

  form-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.sm}"
    height: 48px
    padding: "12px 14px"
    focusBorder: "2px solid {colors.primary}"
  text-area:
    minHeight: 120px
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.sm}"
    padding: 14px
  upload-zone:
    backgroundColor: "{colors.surface-soft}"
    border: "1px dashed {colors.border-strong}"
    rounded: "{rounded.md}"
    padding: 24px

  profile-avatar:
    sizes:
      small: 36px
      medium: 56px
      large: 96px
    shape: circle
    fallbackBackground: "{colors.primary-soft-strong}"
    fallbackTextColor: "{colors.primary-dark}"

  tabs:
    defaultText: "{colors.muted}"
    activeText: "{colors.primary-dark}"
    activeIndicator: "2px solid {colors.primary}"
    mobileBehavior: horizontally scrollable

  review-card:
    backgroundColor: "{colors.canvas}"
    borderBottom: "1px solid {colors.divider}"
    padding: "18px 0"
    structure:
      - author avatar and name
      - rating and date
      - review text
      - optional uploaded photos
      - owner actions only when applicable

  progress-card:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 20px
    progressColor: "{colors.primary}"

  modal:
    backdrop: "rgba(0,0,0,0.55)"
    surface: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: 24px
    shadow: "{shadow.floating-panel}"
  confirmation-dialog:
    use-for:
      - delete review
      - discard profile changes
      - destructive collection actions
    destructiveActionColor: "{colors.error}"

  status-banner:
    successBackground: "#E8F7EF"
    warningBackground: "#FFF7E6"
    errorBackground: "#FDECEC"
    infoBackground: "#EAF3FA"
    rounded: "{rounded.sm}"
    padding: "12px 16px"

  empty-state:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.body}"
    rounded: "{rounded.lg}"
    padding: "44px 24px"
    structure:
      - simple icon or illustration
      - concise heading
      - one sentence of guidance
      - optional single action

  loading-state:
    skeletonColor: "#E7ECEF"
    skeletonHighlight: "#F4F6F7"
    cardShape: Match the component being loaded

module-patterns:
  user-management:
    screens:
      - Social Login
      - Edit Profile
      - Upload Profile Picture
    visualRules:
      - Use centered or two-column profile forms on desktop.
      - Keep Google sign-in as an outlined white button with green border.
      - Use the standard form, upload-zone, avatar, modal, and status components.

  attraction-explorer:
    screens:
      - Integrated Search and Filter page
      - Attraction Details
      - Enlarged Attraction Photo modal
      - Attraction Location map view
    visualRules:
      - Preserve the approved hero, search bar, content heading, chips, and attraction grid.
      - Search and filtering belong to the same main page.
      - Category chips stay visible below the result count.
      - Additional location-area and rating filters may be placed in a compact More Filters popover/drawer.
      - Attraction Details should display attraction name, description, category, address, rating, and photos.
      - The map view displays one attraction marker and address; it does not provide directions or route navigation.

  review-community:
    screens:
      - View Attraction Reviews
      - Create Review
      - Give Rating
      - Upload Review Photos
      - Edit Review
      - Delete Review confirmation
    visualRules:
      - Reuse profile avatars, rating rows, text areas, upload zones, review cards, and confirmation dialogs.
      - Keep review writing focused and uncluttered.
      - Destructive actions must use confirmation dialogs.

  exploration-map:
    screens:
      - Personal Exploration Map
      - Highlighted Visited Attractions
      - Visited Locations list
      - Exploration Progress summary
    visualRules:
      - Use a large map canvas with green visited markers.
      - Keep progress cards and visited-location panels visually secondary to the map.
      - Use the same map info-card pattern as Attraction Explorer.

  social-profile:
    screens:
      - Other User Profile
      - Other User Reviews
      - Other User Exploration Map
      - Compare Exploration Progress
      - Compare Visited Attractions
    visualRules:
      - Use a profile header followed by tabs.
      - Use side-by-side comparison cards on desktop and stacked cards on mobile.
      - Use green progress bars and neutral surfaces; do not use competitive red/green ranking colors.

  personal-collection:
    screens:
      - Wishlist
      - Favourite Attractions
      - My Reviews
      - My Uploaded Photos
      - Travel History
    visualRules:
      - Use tabbed or segmented navigation.
      - Reuse attraction cards, review cards, gallery tiles, and empty states.
      - Keep all collection actions consistent with the standard icon and confirmation patterns.

responsive-behavior:
  mobile-under-744px:
    - Use a single-column layout.
    - Reduce hero heading to approximately 34px.
    - Stack or compact the search input and button without changing their approved visual identity.
    - Allow category chips and tabs to scroll horizontally.
    - Present filter controls in a bottom sheet.
    - Display maps full-width.
    - Use at least 44px touch targets.
  tablet-744-to-1127px:
    - Use a two-column attraction grid.
    - Preserve the hero layout with reduced side gutters.
    - Allow panels to occupy up to 70% viewport width.
  desktop-1128px-and-above:
    - Use a three-column attraction grid.
    - Center content within the project max width.
    - Use popovers, drawers, or side-by-side panels where appropriate.

interaction-rules:
  - Every interactive control must have default, hover, active, focus, disabled, and loading states where relevant.
  - Use 180–220ms transitions for color, border, opacity, and shadow changes.
  - Avoid large motion effects, parallax, floating 3D cards, glassmorphism, and neon gradients.
  - Keep navigation and interaction patterns predictable across modules.
  - Use clear error, empty, offline, and unavailable states instead of blank screens.

accessibility:
  - Maintain WCAG AA text contrast.
  - Minimum touch target is 44px by 44px.
  - Never rely on color alone to indicate status or selection.
  - Provide visible keyboard focus rings using the primary green.
  - Add labels or accessible names for icon-only buttons.
  - Provide alt text for attraction and review photos.
  - Ensure map information is also available in text form when the map cannot load.

content-style:
  tone: Friendly, direct, and useful to local and international tourists.
  casing: Sentence case for headings, buttons, labels, and navigation.
  spelling: Use British English where practical, such as traveller and favourite.
  examples:
    attractionHeading: "Explore Melaka Attractions"
    resultCount: "Showing 13 attraction(s)"
    emptySearch: "No attractions match your search. Try another keyword or filter."
    offline: "You are offline. Previously viewed content is still available."

prohibited-patterns:
  - Booking dates, guest selectors, prices, reservation cards, payments, tickets, or checkout
  - Airbnb logos, Rausch pink, proprietary Airbnb fonts, or copied Airbnb copy
  - Route directions, travel-time estimates, or live navigation inside Attraction Explorer
  - Admin dashboards or moderation tools
  - Real-time chat interfaces
  - Excessive gradients, glassmorphism, neon colors, or futuristic dashboard styling
---

# Chatlas Project UI Guidance

This file is the shared design source of truth for all Chatlas modules. Team members may create module-specific screens, but they must reuse the same color tokens, type scale, spacing, rounded corners, cards, forms, chips, navigation, feedback states, and responsive behavior defined above.

The approved Search and Filter page is the main visual reference for the project. Its structure should remain recognizable across future iterations: white navigation, green discovery hero, integrated search with amber action button, light content background, pill filters, and a clean attraction-card grid.
