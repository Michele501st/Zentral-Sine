import os

file_path = r"c:\Users\miche\Documents\Antigravity\Zentral-Sine\Zentral-Sine-Release\chrome.css"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We will replace the block from "/* Allow sidebar to grow up to 50vw" to the end of the 240px rule.
import re

pattern = re.compile(
    r"/\* Allow sidebar to grow up to 50vw.*?(?=/\*|$)", 
    re.DOTALL
)
replacement = """/* Allow sidebar to grow up to 50vw - ONLY when NOT in collapsed mode */
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) #navigator-toolbox,
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) #sidebar-box,
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) #sidebar-container,
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) .sidebar-panel {
  max-width: 50vw !important;
}

/* Enforce minimum width for Sidebar ONLY when explicitly expanded */
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) #navigator-toolbox,
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) #sidebar-box,
:root:not([zentral-sidebar-collapsed="true"]):not([zen-sidebar-collapsed="true"]):not([mod-sameerasw_zen_compact_sidebar_type]) #sidebar-container {
  min-width: var(--zentral-sidebar-min-width, 240px) !important;
}

/* In Collapsed Sidebar Mode, explicitly reset and allow Zen to collapse to icon strip width */
:root[zentral-sidebar-collapsed="true"] #navigator-toolbox,
:root[zentral-sidebar-collapsed="true"] #sidebar-box,
:root[zentral-sidebar-collapsed="true"] #sidebar-container,
:root[zen-sidebar-collapsed="true"] #navigator-toolbox,
:root[zen-sidebar-collapsed="true"] #sidebar-box,
:root[zen-sidebar-collapsed="true"] #sidebar-container {
  min-width: 0 !important;
}
"""

new_content = re.sub(r"/\* Allow sidebar to grow up to 50vw[\s\S]*?240px\) !important;\n}", replacement, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done replacing.")