import json
import os
import sys

json_path = 'simulation_data.json'
js_path = 'js/data_loader.js'

if not os.path.exists(json_path):
    print(f"Error: {json_path} not found.")
    sys.exit(1)

print(f"Reading {json_path}...")
with open(json_path, 'r', encoding='utf-8') as f:
    data = f.read()

# Validate JSON and re-serialize to prevent script injection
try:
    data_obj = json.loads(data)
    safe_data = json.dumps(data_obj, ensure_ascii=False)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON in {json_path}: {e}")
    sys.exit(1)

# Escape any </script> tags that could break the HTML context
safe_data = safe_data.replace('</script', '<\\/script')

print(f"Writing to {js_path}...")
with open(js_path, 'w', encoding='utf-8') as f:
    f.write(f"window.SIMULATION_DATA = {safe_data};\n")

print("Conversion complete.")
