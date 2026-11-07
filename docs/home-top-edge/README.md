# Home image at the screen edge

The home previously inherited `insets.top` from the shared screen container,
leaving a light strip above the photograph. Like Crane's
`HomeView.ignoresSafeArea(.container, edges: .top)`, home now starts at the top of
the display and explicitly disables automatic scroll content insets.

The original `hero.jpg`, its 888/853 aspect ratio and the countdown layout are
unchanged. Removing the top inset moves the image and subsequent content upward
by that inset. Other tabs and modal screens retain the top safe area; the tab bar
retains its bottom safe area.

Home owns its status-bar appearance: white over the dark photo, then theme-aware
text over a background that masks scrolling content once the photo has passed.
This prevents the clock from colliding with the text underneath while scrolling.

Verification: TypeScript check, iOS export, and browser previews rendered from
the actual Home/Main components. Preview dimensions cover 320, 393 and 768 px
widths, top insets of 20, 59 and 24, both themes, scrolling, settings and a modal.
Clock/notch graphics are simulated; icons and nonessential charts are host
adapters. These images are **not physical-device screenshots**.

`verification.json` records measured image and countdown positions.
`scope.json` records unchanged settings, hero artwork and native configuration.
No new native dependency or binary is required; distribute through production
iOS EAS Update, runtime 1.1.0. Device-side application remains unverified.
