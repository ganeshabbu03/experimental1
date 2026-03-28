import urllib.request
import json
from urllib.error import HTTPError

api_key = "oc_44hpxmhxm_44hpxmhy7_52b00d3bfe868e5fe31c4537ae7da9a4858798f353e8c004"

payload = {
    "language": "python",
    "stdin": "",
    "files": [
        {
            "name": "main.py",
            "content": "print('hello from onecompiler')"
        }
    ]
}

data = json.dumps(payload).encode("utf-8")

headers = {
    "x-api-key": api_key,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
}

req = urllib.request.Request("https://api.onecompiler.com/v1/run", data=data, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        print("API Direct Success!", response.read().decode())
except HTTPError as e:
    print("API Direct Failed!", e.code, e.reason, e.read().decode())
except Exception as e:
    print("API Direct Failed!", e)

# And try GET runtimes
req2 = urllib.request.Request("https://api.onecompiler.com/v1/runtimes", headers=headers)
try:
    with urllib.request.urlopen(req2) as response:
        print("API Runtimes Success!", len(response.read().decode()))
except HTTPError as e:
    print("API Runtimes Failed!", e.code, e.reason, e.read().decode())
except Exception as e:
    print("API Runtimes Failed!", e)
