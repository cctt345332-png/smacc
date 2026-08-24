import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.plan_catalog import default_plan_catalog

output = Path('/tmp/smacc-unified-plan-catalog.json')
output.write_text(json.dumps(default_plan_catalog(), ensure_ascii=False), encoding='utf-8')
print(output)
