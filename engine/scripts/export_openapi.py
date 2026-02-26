"""Export OpenAPI 3.1 spec from FastAPI app."""

import json
import sys
from pathlib import Path

# Add engine root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.main import app

def export_openapi():
    """Generate and save OpenAPI spec."""
    spec = app.openapi()
    output_path = Path(__file__).parent.parent.parent / "specs" / "001-quant-trading-cli" / "contracts" / "openapi.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(spec, indent=2))
    print(f"OpenAPI spec exported to {output_path}")
    return spec

if __name__ == "__main__":
    export_openapi()
