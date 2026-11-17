---
version: alpha
name: Backyard garden
description: "A garden planning workspace with a live landscape, a daylight chart and a crop directory."
colors:
  primary: "#EDC58A"
  on-primary: "#30291E"
  canvas: "#151F19"
  surface: "#202C23"
  ink: "#F3F1DF"
  ink-muted: "#B7C1B3"
  hairline: "#38453A"
typography:
  display:
    fontFamily: DM Serif Text
    fontSize: 52px
    fontWeight: 400
    lineHeight: 1.05
  body:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
components:
  playback:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  simulator:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
---

# Backyard garden

The scene, daylight chart and planting directory share one garden. The design follows the workspace visible at 18 seconds in the launch film. [OpenAI garden demo](https://player.vimeo.com/video/1245920966?h=68ea42d819#t=18s)

## Garden views

Use **Render** for an eye-level comparison, **3D orbit** to inspect the planting and **Plan** to position beds from above. Keep view controls inside the garden. Place configuration, dimensions and file operations in **Garden tools**.

## Sunlight and planting

Gold connects the time marker to **Play day**. The main time and garden title use DM Serif Text. Controls and plant names use DM Sans. Show direct sun hours and current light at each bed’s center. Bed names and geometry come from the active plan.

## Small screens

Stack the garden, sunlight simulator and planting directory in that order. Keep panning and orbit gestures inside the canvas so the rest of the page can scroll.
