import os
import sys

target = sys.argv[1]
root_dir = sys.argv[2]

for root, _, files in os.walk(root_dir):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        filepath = os.path.join(root, file)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                if target in f.read():
                    print(f"FOUND IN: {filepath}")
        except Exception as e:
            pass
