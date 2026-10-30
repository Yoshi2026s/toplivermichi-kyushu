# HD world graphics update

- Land maps use 32px terrain tiles with biome palettes, stone paving, detailed roofs, windows, trees and reflective water.
- Characters use 32×48px sprites with layered clothing, face highlights, hair, accessories and directional walking frames.
- Enemies use material shading, outlined species silhouettes and distinct boss ornaments. Ocean sprites gain shading and surface detail; ocean maps and ships use doubled resolution.
- The gameplay grid remains 16px. Canvas backing resolution and map source resolution are converted explicitly, preserving camera and tap destinations.
- Land map cache is bounded to eight frames and 32 MiB; ocean map cache retains four frames.
- Verification includes rendered sprite contact sheet, map dimensions and tap destinations across two backing resolutions and three CSS scales, plus the full regression suite.
