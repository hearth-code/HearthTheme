// Seed documents for the VS Code chrome reference sync. These replace the
// base/template JSON readback in syncVscodeChromeReferenceFiles so the patch
// input can be provided in memory. The generated chrome keys use a placeholder
// value here because sync patches them from the resolved model; only key order,
// residual compatibility colors, and token/semantic templates are seed data.

const GENERATED_COLOR_PLACEHOLDER = '#000000'

const VSCODE_CHROME_COLOR_KEYS = [
  "editor.background",
  "editor.foreground",
  "editor.lineHighlightBackground",
  "editor.selectionBackground",
  "editor.selectionHighlightBackground",
  "editor.wordHighlightBackground",
  "editor.findMatchBackground",
  "editor.findMatchHighlightBackground",
  "editorLineNumber.foreground",
  "editorLineNumber.activeForeground",
  "editorCursor.foreground",
  "editorCursor.background",
  "editorWhitespace.foreground",
  "editorIndentGuide.background1",
  "editorIndentGuide.activeBackground1",
  "editorBracketMatch.background",
  "editorBracketMatch.border",
  "editorBracketHighlight.foreground1",
  "editorBracketHighlight.foreground2",
  "editorBracketHighlight.foreground3",
  "editorError.foreground",
  "editorWarning.foreground",
  "editorInfo.foreground",
  "sideBar.background",
  "sideBar.foreground",
  "sideBar.border",
  "sideBarTitle.foreground",
  "sideBarSectionHeader.background",
  "sideBarSectionHeader.foreground",
  "sideBarSectionHeader.border",
  "activityBar.background",
  "activityBar.foreground",
  "activityBar.inactiveForeground",
  "activityBar.border",
  "activityBarBadge.background",
  "activityBarBadge.foreground",
  "statusBar.background",
  "statusBar.foreground",
  "statusBar.border",
  "statusBar.noFolderBackground",
  "statusBar.debuggingBackground",
  "statusBarItem.hoverBackground",
  "statusBarItem.activeBackground",
  "titleBar.activeBackground",
  "titleBar.activeForeground",
  "titleBar.inactiveBackground",
  "titleBar.inactiveForeground",
  "titleBar.border",
  "tab.activeBackground",
  "tab.activeForeground",
  "tab.activeBorder",
  "tab.inactiveBackground",
  "tab.inactiveForeground",
  "tab.border",
  "tab.hoverBackground",
  "tab.unfocusedActiveForeground",
  "editorGroupHeader.tabsBackground",
  "editorGroupHeader.tabsBorder",
  "panel.background",
  "panel.border",
  "panelTitle.activeBorder",
  "panelTitle.activeForeground",
  "panelTitle.inactiveForeground",
  "terminal.background",
  "terminal.foreground",
  "terminal.ansiBlack",
  "terminal.ansiRed",
  "terminal.ansiGreen",
  "terminal.ansiYellow",
  "terminal.ansiBlue",
  "terminal.ansiMagenta",
  "terminal.ansiCyan",
  "terminal.ansiWhite",
  "terminal.ansiBrightBlack",
  "terminal.ansiBrightRed",
  "terminal.ansiBrightGreen",
  "terminal.ansiBrightYellow",
  "terminal.ansiBrightBlue",
  "terminal.ansiBrightMagenta",
  "terminal.ansiBrightCyan",
  "terminal.ansiBrightWhite",
  "terminalCursor.foreground",
  "input.background",
  "input.foreground",
  "input.border",
  "input.placeholderForeground",
  "inputOption.activeBorder",
  "inputOption.activeBackground",
  "dropdown.background",
  "dropdown.foreground",
  "dropdown.border",
  "button.background",
  "button.foreground",
  "button.hoverBackground",
  "button.secondaryBackground",
  "button.secondaryForeground",
  "list.activeSelectionBackground",
  "list.activeSelectionForeground",
  "list.hoverBackground",
  "list.hoverForeground",
  "list.inactiveSelectionBackground",
  "list.highlightForeground",
  "list.focusBackground",
  "scrollbarSlider.background",
  "scrollbarSlider.hoverBackground",
  "scrollbarSlider.activeBackground",
  "badge.background",
  "badge.foreground",
  "progressBar.background",
  "focusBorder",
  "selection.background",
  "widget.shadow",
  "notifications.background",
  "notifications.foreground",
  "notifications.border",
  "notificationLink.foreground",
  "gitDecoration.addedResourceForeground",
  "gitDecoration.modifiedResourceForeground",
  "gitDecoration.deletedResourceForeground",
  "gitDecoration.untrackedResourceForeground",
  "gitDecoration.ignoredResourceForeground",
  "gitDecoration.conflictingResourceForeground",
  "statusBar.noFolderForeground",
  "statusBar.debuggingForeground"
]

const VSCODE_CHROME_SEED_SPECS = {
  "color-system/base-dark.source.json": {
    "name": "Ember Dark",
    "type": "dark",
    "semanticHighlighting": true,
    "residualColors": {
      "statusBar.noFolderBackground": "#312b23",
      "statusBar.debuggingBackground": "#5d3418",
      "scrollbarSlider.background": "#4a433866",
      "scrollbarSlider.hoverBackground": "#4a433899",
      "scrollbarSlider.activeBackground": "#655b4aaa",
      "widget.shadow": "#00000066"
    },
    "tokenColors": [
      {
        "scope": [
          "comment",
          "punctuation.definition.comment"
        ],
        "settings": {
          "foreground": "#6b5f4d",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "keyword",
          "storage.type",
          "storage.modifier",
          "keyword.control"
        ],
        "settings": {
          "foreground": "#c26f59",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "keyword.operator",
          "keyword.operator.assignment"
        ],
        "settings": {
          "foreground": "#8f846f",
          "fontStyle": ""
        }
      },
      {
        "scope": [
          "meta.function-call entity.name.function",
          "meta.function-call.js entity.name.function.js",
          "meta.function-call.ts entity.name.function.ts",
          "meta.function-call.py entity.name.function.py",
          "meta.function-call.python entity.name.function.python",
          "meta.function-call.go entity.name.function.go",
          "meta.function-call.rust entity.name.function.rust",
          "meta.method-call entity.name.function",
          "meta.method-call.js entity.name.function.js",
          "meta.method-call.ts entity.name.function.ts",
          "meta.method-call.py entity.name.function.py",
          "meta.method-call.python entity.name.function.python",
          "meta.method-call.go entity.name.function.go",
          "meta.method-call.rust entity.name.function.rust"
        ],
        "settings": {
          "foreground": "#73c3e3"
        }
      },
      {
        "scope": [
          "entity.name.function",
          "support.function",
          "meta.function-call.generic"
        ],
        "settings": {
          "foreground": "#d7ad70"
        }
      },
      {
        "scope": [
          "entity.name.function.member",
          "entity.name.function.member.python",
          "entity.name.function.member.go",
          "entity.name.function.member.rust",
          "variable.other.property",
          "variable.other.member",
          "meta.property-name",
          "support.type.property-name"
        ],
        "settings": {
          "foreground": "#5ea2c4"
        }
      },
      {
        "scope": [
          "string",
          "string.quoted",
          "string.template",
          "string.regexp"
        ],
        "settings": {
          "foreground": "#8fb87d"
        }
      },
      {
        "scope": [
          "constant.numeric",
          "constant.language.boolean",
          "constant.language.null",
          "constant.language.undefined"
        ],
        "settings": {
          "foreground": "#ba846d"
        }
      },
      {
        "scope": [
          "entity.name.type",
          "entity.name.class",
          "storage.type.java",
          "storage.type.primitive.java",
          "entity.name.struct.rust",
          "entity.name.type.class",
          "support.type",
          "support.type.builtin",
          "support.class"
        ],
        "settings": {
          "foreground": "#5d98a4",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "variable",
          "variable.other.readwrite",
          "variable.other.constant"
        ],
        "settings": {
          "foreground": "#dfd5c7"
        }
      },
      {
        "scope": [
          "meta.object-literal.key"
        ],
        "settings": {
          "foreground": "#b7774f"
        }
      },
      {
        "scope": [
          "entity.other.attribute-name"
        ],
        "settings": {
          "foreground": "#5ea2c4"
        }
      },
      {
        "scope": [
          "entity.name.tag",
          "punctuation.definition.tag"
        ],
        "settings": {
          "foreground": "#73c3e3"
        }
      },
      {
        "scope": [
          "meta.decorator",
          "punctuation.decorator"
        ],
        "settings": {
          "foreground": "#caa46c",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "punctuation",
          "meta.brace"
        ],
        "settings": {
          "foreground": "#b8ad9b"
        }
      },
      {
        "scope": [
          "constant.other.color",
          "support.constant"
        ],
        "settings": {
          "foreground": "#ba846d"
        }
      },
      {
        "scope": [
          "markup.heading"
        ],
        "settings": {
          "foreground": "#e1ba73",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "markup.bold"
        ],
        "settings": {
          "foreground": "#c26f59",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "markup.italic"
        ],
        "settings": {
          "foreground": "#c89254",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "markup.inline.raw",
          "markup.fenced_code"
        ],
        "settings": {
          "foreground": "#8fbd79"
        }
      },
      {
        "scope": [
          "markup.underline.link"
        ],
        "settings": {
          "foreground": "#8fbd79"
        }
      },
      {
        "scope": [
          "invalid.deprecated"
        ],
        "settings": {
          "foreground": "#ca8364",
          "fontStyle": "strikethrough"
        }
      },
      {
        "scope": [
          "invalid.illegal"
        ],
        "settings": {
          "foreground": "#ca8364",
          "fontStyle": "underline"
        }
      }
    ],
    "semanticTokenColors": {
      "variable": "#dfd5c7",
      "variable.readonly": "#c89254",
      "property": "#5ea2c4",
      "property.readonly": "#c89254",
      "function": "#d7ad70",
      "method": "#73c3e3",
      "function.defaultLibrary": "#73c3e3",
      "method.defaultLibrary": "#73c3e3",
      "class": {
        "foreground": "#5d98a4",
        "fontStyle": "italic"
      },
      "interface": {
        "foreground": "#5d98a4",
        "fontStyle": "italic"
      },
      "type": {
        "foreground": "#5d98a4",
        "fontStyle": "italic"
      },
      "type.defaultLibrary": {
        "foreground": "#5d98a4",
        "fontStyle": "italic"
      },
      "typeParameter": {
        "foreground": "#5d98a4",
        "fontStyle": "italic"
      },
      "enum": {
        "foreground": "#5d98a4",
        "fontStyle": "italic"
      },
      "enumMember": "#ba846d",
      "namespace": "#d6cab4",
      "keyword": {
        "foreground": "#c26f59",
        "fontStyle": "bold"
      },
      "parameter": "#d9cebd",
      "variable.defaultLibrary": "#caa46c",
      "decorator": {
        "foreground": "#caa46c",
        "fontStyle": "italic"
      }
    }
  },
  "color-system/templates/base-dark.base.json": {
    "name": "Ember Dark",
    "type": "dark",
    "semanticHighlighting": true,
    "residualColors": {
      "statusBar.noFolderBackground": "#352f24",
      "statusBar.debuggingBackground": "#5d3418",
      "scrollbarSlider.background": "#4a433866",
      "scrollbarSlider.hoverBackground": "#4a433899",
      "scrollbarSlider.activeBackground": "#655b4aaa",
      "widget.shadow": "#00000066"
    },
    "tokenColors": [
      {
        "scope": [
          "comment",
          "punctuation.definition.comment"
        ],
        "settings": {
          "foreground": "#6b5f4d",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "keyword",
          "storage.type",
          "storage.modifier",
          "keyword.control"
        ],
        "settings": {
          "foreground": "#d36b4a",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "keyword.operator",
          "keyword.operator.assignment"
        ],
        "settings": {
          "foreground": "#8f846f",
          "fontStyle": ""
        }
      },
      {
        "scope": [
          "meta.function-call entity.name.function",
          "meta.function-call.js entity.name.function.js",
          "meta.function-call.ts entity.name.function.ts",
          "meta.function-call.py entity.name.function.py",
          "meta.function-call.python entity.name.function.python",
          "meta.function-call.go entity.name.function.go",
          "meta.function-call.rust entity.name.function.rust",
          "meta.method-call entity.name.function",
          "meta.method-call.js entity.name.function.js",
          "meta.method-call.ts entity.name.function.ts",
          "meta.method-call.py entity.name.function.py",
          "meta.method-call.python entity.name.function.python",
          "meta.method-call.go entity.name.function.go",
          "meta.method-call.rust entity.name.function.rust"
        ],
        "settings": {
          "foreground": "#78d4ff"
        }
      },
      {
        "scope": [
          "entity.name.function",
          "support.function",
          "meta.function-call.generic"
        ],
        "settings": {
          "foreground": "#e3b368"
        }
      },
      {
        "scope": [
          "entity.name.function.member",
          "entity.name.function.member.python",
          "entity.name.function.member.go",
          "entity.name.function.member.rust",
          "variable.other.property",
          "variable.other.member",
          "meta.property-name",
          "support.type.property-name"
        ],
        "settings": {
          "foreground": "#62b8dc"
        }
      },
      {
        "scope": [
          "string",
          "string.quoted",
          "string.template",
          "string.regexp"
        ],
        "settings": {
          "foreground": "#8fbd79"
        }
      },
      {
        "scope": [
          "constant.numeric",
          "constant.language.boolean",
          "constant.language.null",
          "constant.language.undefined"
        ],
        "settings": {
          "foreground": "#d5865f"
        }
      },
      {
        "scope": [
          "entity.name.type",
          "entity.name.class",
          "entity.name.struct.rust",
          "entity.name.type.class",
          "support.type",
          "support.type.builtin",
          "support.class"
        ],
        "settings": {
          "foreground": "#5aa7b6",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "variable",
          "variable.other.readwrite",
          "variable.other.constant"
        ],
        "settings": {
          "foreground": "#dfd5c7"
        }
      },
      {
        "scope": [
          "meta.object-literal.key"
        ],
        "settings": {
          "foreground": "#bf7a45"
        }
      },
      {
        "scope": [
          "entity.other.attribute-name"
        ],
        "settings": {
          "foreground": "#5ea2c4"
        }
      },
      {
        "scope": [
          "entity.name.tag",
          "punctuation.definition.tag"
        ],
        "settings": {
          "foreground": "#78d4ff"
        }
      },
      {
        "scope": [
          "meta.decorator",
          "punctuation.decorator"
        ],
        "settings": {
          "foreground": "#caa46c",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "punctuation",
          "meta.brace"
        ],
        "settings": {
          "foreground": "#8f836f"
        }
      },
      {
        "scope": [
          "constant.other.color",
          "support.constant"
        ],
        "settings": {
          "foreground": "#cf835f"
        }
      },
      {
        "scope": [
          "markup.heading"
        ],
        "settings": {
          "foreground": "#e1ba73",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "markup.bold"
        ],
        "settings": {
          "foreground": "#d36b4a",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "markup.italic"
        ],
        "settings": {
          "foreground": "#c89254",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "markup.inline.raw",
          "markup.fenced_code"
        ],
        "settings": {
          "foreground": "#8fbd79"
        }
      },
      {
        "scope": [
          "markup.underline.link"
        ],
        "settings": {
          "foreground": "#8fbd79"
        }
      },
      {
        "scope": [
          "invalid.deprecated"
        ],
        "settings": {
          "foreground": "#d88a63",
          "fontStyle": "strikethrough"
        }
      },
      {
        "scope": [
          "invalid.illegal"
        ],
        "settings": {
          "foreground": "#d88a63",
          "fontStyle": "underline"
        }
      }
    ],
    "semanticTokenColors": {
      "variable": "#dfd5c7",
      "variable.readonly": "#c89254",
      "property": "#62b8dc",
      "property.readonly": "#c89254",
      "function": "#e3b368",
      "method": "#78d4ff",
      "function.defaultLibrary": "#78d4ff",
      "method.defaultLibrary": "#78d4ff",
      "class": {
        "foreground": "#5aa7b6",
        "fontStyle": "italic"
      },
      "interface": {
        "foreground": "#5aa7b6",
        "fontStyle": "italic"
      },
      "type": {
        "foreground": "#5aa7b6",
        "fontStyle": "italic"
      },
      "type.defaultLibrary": {
        "foreground": "#5aa7b6",
        "fontStyle": "italic"
      },
      "typeParameter": {
        "foreground": "#5aa7b6",
        "fontStyle": "italic"
      },
      "enum": {
        "foreground": "#5aa7b6",
        "fontStyle": "italic"
      },
      "enumMember": "#d5865f",
      "namespace": "#d6cab4",
      "keyword": {
        "foreground": "#d36b4a",
        "fontStyle": "bold"
      },
      "parameter": "#d9cebd",
      "variable.defaultLibrary": "#caa46c",
      "decorator": {
        "foreground": "#caa46c",
        "fontStyle": "italic"
      }
    }
  },
  "color-system/templates/base-light.base.json": {
    "name": "Ember Light",
    "type": "light",
    "semanticHighlighting": true,
    "residualColors": {
      "statusBar.noFolderBackground": "#8f5b2e",
      "statusBar.debuggingBackground": "#7f4313",
      "scrollbarSlider.background": "#d2c2a566",
      "scrollbarSlider.hoverBackground": "#d2c2a599",
      "scrollbarSlider.activeBackground": "#b49d7baa",
      "widget.shadow": "#00000033"
    },
    "tokenColors": [
      {
        "scope": [
          "comment",
          "punctuation.definition.comment"
        ],
        "settings": {
          "foreground": "#847257",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "keyword",
          "storage.type",
          "storage.modifier",
          "keyword.control"
        ],
        "settings": {
          "foreground": "#a33a2f",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "keyword.operator",
          "keyword.operator.assignment"
        ],
        "settings": {
          "foreground": "#75674c",
          "fontStyle": ""
        }
      },
      {
        "scope": [
          "meta.function-call entity.name.function",
          "meta.function-call.js entity.name.function.js",
          "meta.function-call.ts entity.name.function.ts",
          "meta.function-call.py entity.name.function.py",
          "meta.function-call.python entity.name.function.python",
          "meta.function-call.go entity.name.function.go",
          "meta.function-call.rust entity.name.function.rust",
          "meta.method-call entity.name.function",
          "meta.method-call.js entity.name.function.js",
          "meta.method-call.ts entity.name.function.ts",
          "meta.method-call.py entity.name.function.py",
          "meta.method-call.python entity.name.function.python",
          "meta.method-call.go entity.name.function.go",
          "meta.method-call.rust entity.name.function.rust"
        ],
        "settings": {
          "foreground": "#0092c2"
        }
      },
      {
        "scope": [
          "entity.name.function",
          "support.function",
          "meta.function-call.generic"
        ],
        "settings": {
          "foreground": "#1f5f98"
        }
      },
      {
        "scope": [
          "entity.name.function.member",
          "entity.name.function.member.python",
          "entity.name.function.member.go",
          "entity.name.function.member.rust",
          "variable.other.property",
          "variable.other.member",
          "meta.property-name",
          "support.type.property-name"
        ],
        "settings": {
          "foreground": "#3a69a8"
        }
      },
      {
        "scope": [
          "string",
          "string.quoted",
          "string.template",
          "string.regexp"
        ],
        "settings": {
          "foreground": "#2a7a2e"
        }
      },
      {
        "scope": [
          "constant.numeric",
          "constant.language.boolean",
          "constant.language.null",
          "constant.language.undefined"
        ],
        "settings": {
          "foreground": "#bf5d22"
        }
      },
      {
        "scope": [
          "entity.name.type",
          "entity.name.class",
          "entity.name.struct.rust",
          "entity.name.type.class",
          "support.type",
          "support.type.builtin",
          "support.class"
        ],
        "settings": {
          "foreground": "#00727d",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "variable",
          "variable.other.readwrite",
          "variable.other.constant"
        ],
        "settings": {
          "foreground": "#5a3c28"
        }
      },
      {
        "scope": [
          "meta.object-literal.key"
        ],
        "settings": {
          "foreground": "#72461f"
        }
      },
      {
        "scope": [
          "entity.other.attribute-name"
        ],
        "settings": {
          "foreground": "#3a69a8"
        }
      },
      {
        "scope": [
          "entity.name.tag",
          "punctuation.definition.tag"
        ],
        "settings": {
          "foreground": "#0092c2"
        }
      },
      {
        "scope": [
          "meta.decorator",
          "punctuation.decorator"
        ],
        "settings": {
          "foreground": "#7f5227",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "punctuation",
          "meta.brace"
        ],
        "settings": {
          "foreground": "#87745b"
        }
      },
      {
        "scope": [
          "constant.other.color",
          "support.constant"
        ],
        "settings": {
          "foreground": "#bf5d22"
        }
      },
      {
        "scope": [
          "markup.heading"
        ],
        "settings": {
          "foreground": "#623d03",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "markup.bold"
        ],
        "settings": {
          "foreground": "#8f2f1b",
          "fontStyle": "bold"
        }
      },
      {
        "scope": [
          "markup.italic"
        ],
        "settings": {
          "foreground": "#845223",
          "fontStyle": "italic"
        }
      },
      {
        "scope": [
          "markup.inline.raw",
          "markup.fenced_code"
        ],
        "settings": {
          "foreground": "#2f6f2d"
        }
      },
      {
        "scope": [
          "markup.underline.link"
        ],
        "settings": {
          "foreground": "#2f6f2d"
        }
      },
      {
        "scope": [
          "invalid.deprecated"
        ],
        "settings": {
          "foreground": "#ab5031",
          "fontStyle": "strikethrough"
        }
      },
      {
        "scope": [
          "invalid.illegal"
        ],
        "settings": {
          "foreground": "#ab5031",
          "fontStyle": "underline"
        }
      }
    ],
    "semanticTokenColors": {
      "variable": "#5a3c28",
      "variable.readonly": "#8f5928",
      "property": "#3a69a8",
      "property.readonly": "#8f5928",
      "function": "#1f5f98",
      "method": "#0092c2",
      "function.defaultLibrary": "#0092c2",
      "method.defaultLibrary": "#0092c2",
      "class": {
        "foreground": "#00727d",
        "fontStyle": "italic"
      },
      "interface": {
        "foreground": "#00727d",
        "fontStyle": "italic"
      },
      "type": {
        "foreground": "#00727d",
        "fontStyle": "italic"
      },
      "type.defaultLibrary": {
        "foreground": "#00727d",
        "fontStyle": "italic"
      },
      "typeParameter": {
        "foreground": "#00727d",
        "fontStyle": "italic"
      },
      "enum": {
        "foreground": "#00727d",
        "fontStyle": "italic"
      },
      "enumMember": "#bf5d22",
      "namespace": "#2f210e",
      "keyword": {
        "foreground": "#a33a2f",
        "fontStyle": "bold"
      },
      "parameter": "#433323",
      "variable.defaultLibrary": "#7f5227",
      "decorator": {
        "foreground": "#7f5227",
        "fontStyle": "italic"
      }
    }
  }
}

function buildSeedColors(residualColors) {
  return Object.fromEntries(
    VSCODE_CHROME_COLOR_KEYS.map((key) => [key, residualColors[key] ?? GENERATED_COLOR_PLACEHOLDER])
  )
}

export function getVscodeChromeSeedDocument(path) {
  const seed = VSCODE_CHROME_SEED_SPECS[path]
  if (!seed) {
    throw new Error(`Missing VS Code chrome seed document for "${path}"`)
  }

  return {
    name: seed.name,
    type: seed.type,
    colors: buildSeedColors(seed.residualColors),
    tokenColors: structuredClone(seed.tokenColors),
    semanticHighlighting: seed.semanticHighlighting,
    semanticTokenColors: structuredClone(seed.semanticTokenColors),
  }
}
