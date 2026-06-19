# moss Color Optimization

Generated from current theme outputs. This report is algorithmic only; it does not modify source tokens.

## Summary

- Status: hold
- Mean current score: 0.992
- Mean best score: 1.000
- Candidate moves: 0
- Max rhythm risk: 0.000 (balanced)

## Candidate Moves

| Variant | Role | Current | Candidate | Gain | Contrast | dE From Current | Why |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| none | none | - | - | 0.000 | - | - | Current generated colors are already inside the optimizer's safe basin. |

## Role Scores

| Variant | Role | Current Score | Best Score | Status | Current Hue/Sat | Best Hue/Sat |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| dark | keyword | 1.000 | 1.000 | hold | 47.4 / 0.61 | 46.9 / 0.61 |
| dark | function | 1.000 | 1.000 | hold | 100.0 / 0.49 | 100.0 / 0.49 |
| dark | method | 0.985 | 1.000 | hold | 162.1 / 0.39 | 164.7 / 0.43 |
| dark | property | 0.966 | 1.000 | hold | 105.0 / 0.31 | 109.4 / 0.35 |
| dark | type | 0.978 | 1.000 | hold | 193.5 / 0.42 | 193.3 / 0.47 |
| dark | number | 1.000 | 1.000 | hold | 208.4 / 0.50 | 207.7 / 0.50 |
| dark | string | 1.000 | 1.000 | hold | 35.7 / 0.47 | 35.7 / 0.47 |
| light | keyword | 0.967 | 1.000 | hold | 44.0 / 0.80 | 42.4 / 0.70 |
| light | function | 1.000 | 1.000 | hold | 105.8 / 0.51 | 105.8 / 0.51 |
| light | method | 1.000 | 1.000 | hold | 167.1 / 0.50 | 167.1 / 0.50 |
| light | property | 0.997 | 1.000 | hold | 112.6 / 0.34 | 110.5 / 0.38 |
| light | type | 1.000 | 1.000 | hold | 198.8 / 0.62 | 198.8 / 0.62 |
| light | number | 0.991 | 1.000 | hold | 209.5 / 0.53 | 211.1 / 0.48 |
| light | string | 1.000 | 1.000 | hold | 50.5 / 0.54 | 49.8 / 0.54 |

## Rhythm Diagnostics

This section checks whether the generated high-exposure roles are chromatically safe but visually too concentrated.

| Variant | Level | Risk | Dominant band | Dominant share | Adjacent top-two | Adjacent share | Active bands | Cause |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: | --- |
| dark | balanced | 0.000 | 90-134 | 26.1% | 45-89 + 90-134 | 46.1% | 5 | chromatic weight is well distributed |
| light | balanced | 0.000 | 90-134 | 26.1% | 45-89 + 90-134 | 44.7% | 5 | chromatic weight is well distributed |

## Rhythm Targets

- Dominant hue band target: <= 30.0% of chromatic high-exposure weight.
- Adjacent hue band target: <= 52.0% of chromatic high-exposure weight.
- Active hue band target: at least 4 bands with >= 8.0% chromatic share.
