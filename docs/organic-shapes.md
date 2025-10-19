# Organic Matter Shape Variations

Designers can control how organic pickups render by selecting a `shape` value in the organic matter configuration or spawn overrides. The renderer now supports several layered sprite offsets that determine how pulses, rotation, and glow stack together.

## Available shape keys

| Shape key       | Visual notes |
| --------------- | ------------ |
| `sphere`        | Single cell with a soft glow. Useful as a fallback. |
| `blob`          | Loose cluster with uneven bulges. |
| `compact-blob`  | Tight, multi-lobed mass ideal for lipids or dense nutrients. |
| `cluster`       | Wide scatter of small nodes. |
| `chain`         | Linear strand with mild curvature. |
| `droplet`       | Teardrop with a tapered tail. |
| `crystal`       | Cross-shaped crystalline shards. |
| `star`          | Radiating points around a bright core. |
| `spiral`        | Coiled arm wrapping outwards from the center. |
| `wave`          | Sine-wave pattern; good for flowing carbohydrates. |

All keys are case-sensitive. The generator returns an array of offsets with radius, rotation, and stretch metadata. The renderer animates each offset with per-segment pulse noise, while still honoring the entity's overall `rotation`, `glowIntensity`, and randomized `shapeScale`.

## Usage tips

- Prefer `spiral` for protein clusters that should appear more active or directional.
- Use `wave` for resources that should imply motion or conductivity.
- Choose `compact-blob` when you need dense pickups without the wider scatter of `blob` or `cluster`.
- New shape metadata works with existing overrides such as `shapeSeed`, `shapeScale`, and color tweaks from `organicMatterTypes`.

Remember to include any custom shape key in the corresponding type's `shapes` array so factories can randomly select it.
