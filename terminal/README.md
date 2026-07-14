# HearthCode Terminal Themes

HearthCode ships Moss and Ember in Dark and Light variants for Warp, Windows Terminal, Kitty, Alacritty, and iTerm2. `HearthCode Moss Dark` is the recommended starting point: it carries the clearest HearthCode identity and the strongest dark-surface separation.

All theme files in the platform directories are generated from the same terminal token contract as the editor themes. Do not edit them directly; change the color-system sources and run `pnpm run sync`.

## Warp

Copy a file from [`warp/`](./warp/) to `~/.warp/themes/`, restart Warp, then select it under **Settings → Appearance → Current Theme**.

## Windows Terminal

Open [`windows-terminal/`](./windows-terminal/), copy the objects inside the JSON `schemes` array into the `schemes` array in your Windows Terminal `settings.json`, then choose the matching `colorScheme` in a profile.

## Kitty

Copy a file from [`kitty/`](./kitty/) to `~/.config/kitty/`, then add an include line such as this to `kitty.conf`:

```conf
include hearthcode-moss-dark.conf
```

Reload Kitty or restart it.

## Alacritty

Copy a file from [`alacritty/`](./alacritty/) into your Alacritty config directory, then import it from `alacritty.toml`:

```toml
[general]
import = ["~/.config/alacritty/hearthcode-moss-dark.toml"]
```

## iTerm2

In **Settings → Profiles → Colors**, open **Color Presets… → Import…** and choose a file from [`iterm2/`](./iterm2/). Select the imported preset afterward.

## Included themes

- `HearthCode Moss Dark`
- `HearthCode Moss Light`
- `HearthCode Ember Dark`
- `HearthCode Ember Light`
