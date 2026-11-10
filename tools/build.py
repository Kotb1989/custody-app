#!/usr/bin/env python3
"""يجمع ملفات src في web/app.js"""
import pathlib
r = pathlib.Path(__file__).resolve().parent.parent
order = ["p_core", "p_data", "p_views_old", "p_export", "p_views", "p_actions"]
body = "\n".join((r / "src" / (n + ".js")).read_text(encoding="utf-8") for n in order)
(r / "web" / "app.js").write_text('"use strict";\n(function(){\n' + body + "\n})();\n", encoding="utf-8")
