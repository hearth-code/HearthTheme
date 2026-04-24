# moss Color Optimization

Generated from current theme outputs. This report is algorithmic only; it does not modify source tokens.

## Summary

- Status: hold
- Mean current score: 0.995
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
| darkSoft | keyword | 1.000 | 1.000 | hold | 47.2 / 0.49 | 47.2 / 0.49 |
| darkSoft | function | 1.000 | 1.000 | hold | 100.9 / 0.47 | 100.9 / 0.47 |
| darkSoft | method | 0.997 | 1.000 | hold | 164.8 / 0.40 | 167.1 / 0.45 |
| darkSoft | property | 1.000 | 1.000 | hold | 105.0 / 0.36 | 105.0 / 0.36 |
| darkSoft | type | 1.000 | 1.000 | hold | 194.0 / 0.46 | 194.0 / 0.46 |
| darkSoft | number | 1.000 | 1.000 | hold | 211.2 / 0.45 | 211.2 / 0.45 |
| darkSoft | string | 0.988 | 1.000 | hold | 34.7 / 0.39 | 34.3 / 0.43 |
| light | keyword | 0.967 | 1.000 | hold | 44.0 / 0.80 | 42.4 / 0.70 |
| light | function | 1.000 | 1.000 | hold | 114.5 / 0.48 | 113.0 / 0.48 |
| light | method | 1.000 | 1.000 | hold | 167.1 / 0.50 | 167.1 / 0.50 |
| light | property | 1.000 | 1.000 | hold | 128.7 / 0.40 | 128.7 / 0.40 |
| light | type | 1.000 | 1.000 | hold | 198.8 / 0.62 | 198.8 / 0.62 |
| light | number | 0.991 | 1.000 | hold | 209.5 / 0.53 | 211.1 / 0.48 |
| light | string | 1.000 | 1.000 | hold | 50.5 / 0.54 | 49.8 / 0.54 |
| lightSoft | keyword | 1.000 | 1.000 | hold | 42.1 / 0.66 | 42.1 / 0.66 |
| lightSoft | function | 1.000 | 1.000 | hold | 111.2 / 0.44 | 111.2 / 0.44 |
| lightSoft | method | 1.000 | 1.000 | hold | 165.6 / 0.48 | 166.3 / 0.48 |
| lightSoft | property | 1.000 | 1.000 | hold | 129.8 / 0.36 | 129.8 / 0.36 |
| lightSoft | type | 1.000 | 1.000 | hold | 196.2 / 0.61 | 196.2 / 0.61 |
| lightSoft | number | 1.000 | 1.000 | hold | 208.6 / 0.49 | 209.2 / 0.49 |
| lightSoft | string | 1.000 | 1.000 | hold | 52.5 / 0.45 | 53.3 / 0.45 |

## Rhythm Diagnostics

This section checks whether the generated high-exposure roles are chromatically safe but visually too concentrated.

| Variant | Level | Risk | Dominant band | Dominant share | Adjacent top-two | Adjacent share | Active bands | Cause |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: | --- |
| dark | balanced | 0.000 | 90-134 | 26.1% | 45-89 + 90-134 | 46.1% | 5 | chromatic weight is well distributed |
| darkSoft | balanced | 0.000 | 90-134 | 26.1% | 45-89 + 90-134 | 46.1% | 5 | chromatic weight is well distributed |
| light | balanced | 0.000 | 90-134 | 26.1% | 45-89 + 90-134 | 44.7% | 5 | chromatic weight is well distributed |
| lightSoft | balanced | 0.000 | 90-134 | 26.1% | 45-89 + 90-134 | 44.7% | 5 | chromatic weight is well distributed |

## Rhythm Targets

- Dominant hue band target: <= 30.0% of chromatic high-exposure weight.
- Adjacent hue band target: <= 52.0% of chromatic high-exposure weight.
- Active hue band target: at least 4 bands with >= 8.0% chromatic share.
