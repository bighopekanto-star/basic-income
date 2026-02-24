import json
import os

json_path = 'simulation_data.json'
js_path = 'js/data_loader.js'

if not os.path.exists(json_path):
    print(f"Error: {json_path} not found.")
    exit(1)

print(f"Reading {json_path}...")
with open(json_path, 'r', encoding='utf-8') as f:
    data = f.read()

# Minify? Maybe not needed, but safe.
# data_obj = json.loads(data)
# data_min = json.dumps(data_obj)

print(f"Writing to {js_path}...")
with open(js_path, 'w', encoding='utf-8') as f:
    f.write(f"window.SIMULATION_DATA = {data};\n")

print("Conversion complete.")
