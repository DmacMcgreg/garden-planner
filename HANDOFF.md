# The local garden planner now follows the Astra garden demo

Open the production preview to try the workspace. The initial garden uses the project’s Toronto location and 24 × 10 ft dimensions. [Local planner](http://127.0.0.1:4173/)

## Open a local garden backup

Set `GARDEN_BACKUP_FILE` in `.env.local` to the absolute path of an exported garden JSON file. Restart the Vite server, then append `?garden=` and the URL-encoded name from the JSON file to the local planner URL. The preview opens in **Plan** and frames the beds, buildings, fences, and visible heatmaps.

Opening the backup adds it to **Save & load** if the browser has no garden with that name. Choose **Save** to keep edits under a new name. The link continues to open the source file. The static build excludes the file and the machine-specific configuration.

Browser verification compared the restored layout with its original export, including bed rotations, structure dimensions, and heatmaps. Reopening the archive preserved an edited browser copy and a different default garden.

## Original features and plant catalog

**Add plants** opens the searchable catalog. Each of the 30 plants retains its original ID, display name, category, color, sunlight requirement, spacing, soil pH range, default bed dimensions, and trellis settings. The planting directory shows a portrait for every catalog plant. The four starter portraits use the original demo artwork. The other portraits render the same crop meshes used in the garden.

The comparison used the last committed planner at `4321e33`, the pre-redesign mobile and sun-analysis changes in the working tree, and the historical layouts at `940c652`. The last committed version had already retired the layout picker. **Garden layouts** restores **A: Row-Based**, **B: Companion Zones**, and **C: Raised Bed Grid** with the original bed positions, walking paths, and solar panels. Each template uses the original 24 × 10 ft footprint. Applying a template replaces planting and layout geometry after confirmation. **Structures** has a separate action to restore the original house, neighbor building and two fences.

Desktop tools stay open beside the interactive canvas. Phone tools open as a bottom sheet. **Measurements** controls the property boundary, shared space, and compass directions. Older garden files enable those guides on import. Selected plants show their name, pH, and peak sun hours in the scene. The color editor changes the planter’s front marker. An older custom bed with no identifiable plant keeps its original name and color.

The original date, season, city, yard heading, camera compass, sun path, sun probe, measurement grid, four heatmap modes, structures, alerts, and configuration controls are available in **Garden tools** or the planting directory. A sun alert selects its bed and displays the direct-sun heatmap. Both dragging a bed and editing its coordinates reactivate dismissed alerts.

The regression suite records the original catalog fields, checks each crop mesh and portrait, and runs the original solar calculations. The production build and all 64 tests passed. [Catalog tests](src/catalog.test.ts)

Chromium added, renamed, exported, and deleted each original crop through the editor. A separate garden rendered all 30 at their original bed sizes in **Plan**, **Render**, and **3D orbit**. Day playback ran with the whole collection planted. [All 30 plants in Plan view](docs/garden-demo/all-plants.webp)

Browser checks imported an original-format garden, preserved all 30 crop identities through export, and applied all three historical layouts. The raised-bed grid displayed all 17 bed, path, and solar-panel measurements in metres. City selection, season and time controls, compass modes, location-based sun analysis, multi-heatmap editing, structure shadow settings, alert dismissal, and the alert-to-heatmap action passed.

Canvas checks moved, resized and rotated beds, moved a structure after a camera change, and moved and resized a heatmap. Touch emulation checked one-finger pan, two-finger orbit, and phone probe placement. Phone verification used emulation. Physical-device performance remains unmeasured.

## Reference

The article embeds a 31-second comparison. At the start, a backyard photo leads into dimension, location and sunlight checks. Around 8–14 seconds, the models build raised beds with different levels of material and foliage detail. Around 15–22 seconds, the Astra workspace shows a planting directory, camera controls, planter editing and a sunlight simulator. The last garden sequence changes the time and shadows. [Launch article](https://openai.com/index/introducing-gpt-6-2-astra-sol/) · [Embedded garden film](https://player.vimeo.com/video/1245920966?h=68ea42d819)

## Implementation

The starter garden contains four planted beds, timber fences, perimeter plants and an editable tree. Plan uses an orthographic camera. Render and 3D orbit use different perspective camera positions and controls. All three views use the active garden data. The directory reads daily exposure from the batch solver. The current shade indicator uses the selected time.

The photo workflow runs locally. Enter a known width and mark four corners of a rectangular ground patch to estimate depth. Manual dimensions are also available. Photo GPS is optional and takes effect when the user chooses it. The nearest listed city supplies the time zone. A comparison slider reveals the original photo beside the model. The app does not automatically recover a unique yard layout or identify crops from a single photograph.

Existing defaults load before starter data. An intentionally empty saved garden stays empty. Yard dimensions, the local photo, landscaping and sun-path visibility travel with the configuration. An export that includes a photo can also contain its GPS coordinates.

All materials and models load from the project. The photographic landscape sources and font licenses are in the asset directory. Built-in image generation produced the four directory portraits from a single transparent botanical atlas. The prompt requested a square, four-quadrant photorealistic catalogue sheet with isolated cherry tomatoes, butterhead lettuce, red and golden bell peppers, and basil in soft upper-left daylight. The resulting files are `public/garden/tomatoes.webp`, `lettuce.webp`, `peppers.webp` and `herbs.webp`. [Asset sources](public/garden/CREDITS.txt)

## Verification

The initial redesign passed the production build and 31 Vitest checks. The suite covers the earlier solar geometry values, batch equivalence, photo perspective calibration, polar daylight and tree shade. Tree shade in the exposure solver approximates the trunk and crown. Actual garden measurements and live shade observations would be needed to validate site-specific accuracy.

Chromium checks exercised the production app at desktop, tablet and phone sizes. They covered playback, speed, chart dragging, real plan-view bed dragging, naming beds, changing views, labels, expanding the scene, tree selection and addition, sun probes and heatmaps. A synthetic geotagged photo exercised GPS lookup, corner selection, manual sizing and the comparison slider. Save, export, default reload and legacy import passed. The primary browser run reported zero console errors or failed requests. The phone checks used a simulated viewport.

The visual walkthrough includes the original opening view and current desktop and phone captures. [Walkthrough](docs/garden-demo/preview.html)

## Working state

The web build and all 65 tests passed after integrating the existing `mobile/` project from `main`. The Vite production preview uses port 4173. To restart it, run `bun install --frozen-lockfile`, `bun run build` and `bun run preview --host 127.0.0.1 --port 4173`.
