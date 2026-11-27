# Panel implementation notes

- Do not use the HTML `hidden` attribute or `display: none` to hide elements in panels. DesktopXR may fail to render them again when they are shown. Keep panel elements rendered and hide them with opacity instead, restoring their configured opacity when shown. Update `aria-hidden` when appropriate.
