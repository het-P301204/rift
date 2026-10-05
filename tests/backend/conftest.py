import sys
import os
# Ensure the API root is on PYTHONPATH so absolute imports work
api_root = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "api")
if api_root not in sys.path:
    sys.path.insert(0, os.path.abspath(api_root))
